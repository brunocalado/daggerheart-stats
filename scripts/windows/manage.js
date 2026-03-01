import { MODULE_ID, FLAG_SCOPE, FLAG_KEY, DEFAULT_TAGS, DEFAULT_TAG_ICONS, AVAILABLE_ICONS, HandlebarsApplicationMixin, ApplicationV2 } from '../constants.js';
import { UserDices, getUsersOptions } from '../data.js';

//////////////////////////////////////    MANAGE DATA CLASS    //////////////////////////////////////

export class manageDiceData extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dhs-winapp-mngdata",
        tag: "div",
        classes: ["dhs-app-window", "dhs-management-ui"],
        window: { title: "Manage Daggerheart Data", resizable: false },
        position: { width: 900, height: "auto" },
        actions: {
            exportData: manageDiceData._onExport,
            importData: manageDiceData._onImport,
            deleteData: manageDiceData._onDelete,
            deleteDate: manageDiceData._onDeleteDate,
            fullWipe: manageDiceData.fullWipe,
            saveTags: manageDiceData._onSaveTags,
            resetTags: manageDiceData._onResetTags,
            toggleVisibility: manageDiceData._onToggleVisibility,
            setCurrentGM: manageDiceData._onSetCurrentGM
        }
    };

    static get PARTS() { return { content: { template: `modules/${MODULE_ID}/templates/management.hbs` } }; }

    async _prepareContext(options) {
        let whichuser = getUsersOptions();
        let users = game.users.contents;

        // Get hidden users list
        const hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];

        // Get current GM setting
        let currentGM = game.settings.get(MODULE_ID, 'currentGM') || '';

        // If no currentGM is set, default to first GM
        const allGMs = users.filter(u => u.isGM);
        if (!currentGM && allGMs.length > 0) {
            currentGM = allGMs[0].name;
        }

        // Check if there are multiple GMs
        const hasMultipleGMs = allGMs.length > 1;

        // Prepare Tags List for Edition
        const currentTags = game.settings.get(MODULE_ID, 'tagOverrides');
        const currentIcons = game.settings.get(MODULE_ID, 'tagIcons');

        const editableTags = Object.keys(DEFAULT_TAGS).map(key => {
            const currentIcon = currentIcons[key] !== undefined ? currentIcons[key] : DEFAULT_TAG_ICONS[key];
            return {
                key: key,
                default: DEFAULT_TAGS[key],
                current: currentTags[key] || DEFAULT_TAGS[key],
                currentIcon: currentIcon,
                iconOptions: AVAILABLE_ICONS.map(icon => ({ value: icon, isSelected: icon === currentIcon }))
            };
        });

        return {
            whichuser: whichuser,
            users: users.map(u => ({
                name: u.name,
                id: u.id,
                isHidden: hiddenUsers.includes(u.name),
                isGM: u.isGM,
                isCurrentGM: u.name === currentGM
            })),
            hasMultipleGMs: hasMultipleGMs,
            tags: editableTags
        };
    }

    _onRender(context, options) {
        const select = this.element.querySelector('#select-usertomanage');
        if(select) { this.updateDateList(select.value); select.addEventListener('change', (e) => this.updateDateList(e.target.value)); }

        // Restore Last Active Tab
        const lastTab = game.settings.get(MODULE_ID, 'lastManageTab') || 'user-management';
        const tabButtons = this.element.querySelectorAll('.dhs-tab-btn');
        const tabPanels = this.element.querySelectorAll('.tab-content');

        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === lastTab);
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                tabButtons.forEach(b => b.classList.remove('active'));
                tabPanels.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const panel = this.element.querySelector(`#tab-${tabId}`);
                if (panel) panel.classList.add('active');
                game.settings.set(MODULE_ID, 'lastManageTab', tabId);
            });
        });

        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${lastTab}`);
        });
    }

    updateDateList(userName) {
        const user = game.users.getName(userName);
        if (!user) return;
        const dateList = this.element.querySelector('#list-dates');
        if (!dateList) return;
        dateList.innerHTML = '';
        const flags = user.getFlag(FLAG_SCOPE, FLAG_KEY);
        if (!flags) return;

        let dates = Object.keys(flags);
        dates.sort((a, b) => {
            let dateA = new Date(a.split('/').reverse().join('-'));
            let dateB = new Date(b.split('/').reverse().join('-'));
            return dateA - dateB;
        });

        const container = document.createElement('div');
        container.classList.add('dates-list-container');
        for (let d of dates) {
            const tag = document.createElement('div');
            tag.classList.add('date-tag');
            tag.dataset.action = 'deleteDate';
            tag.dataset.date = d;
            tag.dataset.user = userName;
            tag.innerHTML = `<i class="fas fa-trash"></i> ${d}`;
            container.appendChild(tag);
        }
        dateList.appendChild(container);
    }

    static async _onExport(event, target) {
        const userName = target.dataset.user || this.element.querySelector('#select-usertomanage')?.value;
        const user = game.users.getName(userName);
        const flags = user.getFlag(FLAG_SCOPE, FLAG_KEY);
        if (flags) {
            const blob = new Blob([JSON.stringify(flags, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dhs-${userName}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    static async _onDelete(event, target) {
        const userName = target.dataset.user || this.element.querySelector('#select-usertomanage')?.value;
        const user = game.users.getName(userName);
        if (user) {
            let currentDate = new Date();
            let dateString = currentDate.toLocaleDateString('en-GB');
            let d12sbydate = { [dateString]: new UserDices(user.name) };
            await user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
            await user.setFlag(FLAG_SCOPE, FLAG_KEY, d12sbydate);
            ui.notifications.info(`Data deleted for ${user.name}`);
        }
    }

    static async _onImport(event, target) {
        const userName = target.dataset.user;
        const user = game.users.getName(userName);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const text = await foundry.utils.readTextFromFile(file);
                    const jsonData = JSON.parse(text);
                    await user.setFlag(FLAG_SCOPE, FLAG_KEY, jsonData);
                    ui.notifications.info(`Data imported for ${user.name}`);
                } catch (err) {
                    ui.notifications.error("Invalid JSON file or error reading file.");
                    console.error(err);
                }
            }
        };
        input.click();
    }

    static async _onDeleteDate(event, target) { const date = target.dataset.date; const userName = target.dataset.user; const user = game.users.getName(userName); let flagData = user.getFlag(FLAG_SCOPE, FLAG_KEY); delete flagData[date]; if (Object.keys(flagData).length === 0) { let currentDate = new Date(); let dateString = currentDate.toLocaleDateString('en-GB'); flagData = { [dateString]: new UserDices(user.name) }; } await user.unsetFlag(FLAG_SCOPE, FLAG_KEY); await user.setFlag(FLAG_SCOPE, FLAG_KEY, flagData); if(target && target.remove) target.remove(); }

    static async _onSaveTags(event, target) {
        const form = this.element.querySelector('#tag-edit-form');
        if (!form) return;
        const inputs = form.querySelectorAll('input[data-tag-key]');
        const selects = form.querySelectorAll('select[data-icon-key]');
        let newTags = {};
        let newIcons = {};
        inputs.forEach(inp => { newTags[inp.dataset.tagKey] = inp.value || DEFAULT_TAGS[inp.dataset.tagKey]; });
        selects.forEach(sel => { newIcons[sel.dataset.iconKey] = sel.value; });
        await game.settings.set(MODULE_ID, 'tagOverrides', newTags);
        await game.settings.set(MODULE_ID, 'tagIcons', newIcons);
        ui.notifications.info("Tags saved successfully.");
    }

    static async _onResetTags(event, target) {
        await game.settings.set(MODULE_ID, 'tagOverrides', DEFAULT_TAGS);
        await game.settings.set(MODULE_ID, 'tagIcons', DEFAULT_TAG_ICONS);
        ui.notifications.info("Tags reset to defaults.");
        this.render();
    }

    static async _onToggleVisibility(event, target) {
        const userName = target.dataset.user;
        let hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];
        if (hiddenUsers.includes(userName)) {
            hiddenUsers = hiddenUsers.filter(u => u !== userName);
        } else {
            hiddenUsers.push(userName);
        }
        await game.settings.set(MODULE_ID, 'hiddenUsers', hiddenUsers);
        this.render();
    }

    static async _onSetCurrentGM(event, target) {
        const gmName = target.dataset.user;
        await game.settings.set(MODULE_ID, 'currentGM', gmName);
        ui.notifications.info(`${gmName} is now the active GM for statistics.`);
        this.render();
    }

    static async fullWipe() {
        const confirm = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Warning!" },
            content: `
                <div style="text-align: center;">
                    <h3 style="color: #D32F2F; margin-bottom: 10px;">DANGER ZONE</h3>
                    <p>Are you sure you want to <b>WIPE ALL DATA</b> for <b>ALL USERS</b>?</p>
                    <p style="font-size: 0.9em; color: #666;">This action cannot be undone.</p>
                </div>
            `,
            rejectClose: false,
            modal: true
        });

        if (confirm) {
            let usnames = game.users.contents.map(obj => obj.name);
            let currentDate = new Date();
            let dateString = currentDate.toLocaleDateString('en-GB');

            for (let element of usnames) {
                let user = game.users.find(f => f.name === element);
                if(user) {
                    let d12sbydate = { [dateString]: new UserDices(user.name) };
                    await user.unsetFlag(FLAG_SCOPE, FLAG_KEY);
                    await user.setFlag(FLAG_SCOPE, FLAG_KEY, d12sbydate);
                }
            }
            ui.notifications.info("All Daggerheart Stats data has been wiped.");
        }
    }
}
