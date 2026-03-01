import { MODULE_ID, FLAG_SCOPE, FLAG_KEY, HandlebarsApplicationMixin, ApplicationV2 } from '../constants.js';
import { updatedata, populatedates, getUsersOptions } from '../data.js';
import { SummaryWindow } from './summary.js';
import { TrendsWindow } from './trends.js';
import { manageDiceData } from './manage.js';

//////////////////////////////////////    CHART WINDOW CLASS    //////////////////////////////////////

export class ChartWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dhs-winapp",
        tag: "div",
        classes: ["dhs-app-window", "dhs-chart-ui"],
        window: {
            title: "Daggerheart: Statistics",
            icon: "fas fa-chart-bar",
            resizable: true,
            contentClasses: ["standard-form"]
        },
        position: {
            width: 920,
            height: "auto"
        },
        actions: {
            toggleSave: ChartWindow._onToggleSave,
            manageData: ChartWindow._onManageData,
            openSummary: ChartWindow._onOpenSummary,
            openTrends: ChartWindow._onOpenTrends,
            refreshData: ChartWindow._onRefreshData
        }
    };

    static get PARTS() {
        return {
            content: {
                template: `modules/${MODULE_ID}/templates/dhs.hbs`,
            }
        };
    }

    async _prepareContext(options) {
        try {
            const theuser = game.user.name;
            const userFlags = game.user.getFlag(FLAG_SCOPE, FLAG_KEY);

            if (!userFlags) {
                return { hasData: false };
            }

            let datarange = Object.keys(userFlags);
            if (datarange.length === 0) return { hasData: false };

            // SORT initial date range
            datarange.sort((a, b) => {
                let dateA = new Date(a.split('/').reverse().join('-'));
                let dateB = new Date(b.split('/').reverse().join('-'));
                return dateA - dateB;
            });

            let whichuser = getUsersOptions();

            // Pass complete range for initial calculation
            let p = updatedata(datarange[0], datarange[datarange.length - 1], theuser, 'all');
            let dates = populatedates(theuser);

            let paus = game.settings.get(MODULE_ID, 'pausedataacq');
            let savingRollData = paus ? 'OFF' : 'ON';
            let saveIconColor = paus ? '#D32F2F' : '#388E3C';

            const selectedUserObj = game.users.find(u => u.name === theuser);
            const isSelectedUserGM = selectedUserObj ? selectedUserObj.isGM : false;

            return {
                hasData: true,
                savingRollData: savingRollData,
                saveIconColor: saveIconColor,
                isPaused: paus,
                isSelectedUserGM: isSelectedUserGM,

                // GM Data
                gmD20Count: p['gmD20Count'],
                gmCrits: p['gmCrits'],
                gmFearGain: p['gmFearGain'],
                gmFearSpend: p['gmFearSpend'],
                gmFumbles: p['gmFumbles'],
                gmHits: p['gmHits'],
                gmMisses: p['gmMisses'],

                // Player Data
                dualityCount: p['dualityCount'],
                dualityHope: p['dualityHope'],
                dualityFear: p['dualityFear'],
                dualityCrit: p['dualityCrit'],

                // Player Stats
                playerHits: p['playerHits'],
                playerMisses: p['playerMisses'],
                playerSuccesses: p['playerSuccesses'],
                playerFailures: p['playerFailures'],
                playerHopeEarned: p['playerHopeEarned'],
                playerFearGenerated: p['playerFearGenerated'],

                whichuser: whichuser,
                appcontent: p['appcontent'],
                messagealldatesfrom: dates['messagealldatesfrom'],
                messagealldatesto: dates['messagealldatesto'],
                isGM: game.user.isGM
            };
        } catch (error) {
            console.error("DHS | Error preparing context:", error);
            return { hasData: false };
        }
    }

    _onRender(context, options) {
        const html = this.element;

        const userSelect = html.querySelector('#selectuser');
        if(userSelect) {
            userSelect.value = game.user.name;
            userSelect.addEventListener('change', this._onFilterChange.bind(this));
        }

        const fromSelect = html.querySelector('#fromdateselect');
        if(fromSelect) {
            fromSelect.addEventListener('change', this._onFilterChange.bind(this));
        }

        const toSelect = html.querySelector('#todateselect');
        if(toSelect && toSelect.options.length > 0) {
             toSelect.value = toSelect.options[toSelect.options.length - 1].value;
             toSelect.addEventListener('change', this._onFilterChange.bind(this));
        }

        const typeSelect = html.querySelector('#filter-rolltype');
        if (typeSelect) {
            typeSelect.addEventListener('change', this._onFilterChange.bind(this));
        }
    }

    _onFilterChange(event) {
        const html = this.element;
        const userSelect = html.querySelector("#selectuser");
        const fromSelect = html.querySelector("#fromdateselect");
        const toSelect = html.querySelector("#todateselect");

        if (!userSelect || !fromSelect || !toSelect) return;

        let userVal = userSelect.value;

        // Handle User Change Logic
        if (event && event.target.id === "selectuser") {
             let dates = populatedates(userVal);
             fromSelect.innerHTML = dates.messagealldatesfrom;
             toSelect.innerHTML = dates.messagealldatesto;

             // If user changes, auto-select the most recent date
             if (toSelect.options.length > 0) {
                 const lastDate = toSelect.options[toSelect.options.length - 1].value;
                 fromSelect.value = lastDate;
                 toSelect.value = lastDate;
             }
        }

        // Grab current values (after potential update above)
        let fromVal = fromSelect.value;
        let toVal = toSelect.value;

        const typeSelect = html.querySelector("#filter-rolltype");
        const typeVal = typeSelect ? typeSelect.value : 'all';

        if (!fromVal || !toVal) return;

        let start = new Date(fromVal.split('/').reverse().join('-'));
        let end = new Date(toVal.split('/').reverse().join('-'));

        if (start > end) {
            ui.notifications.error("Wrong date selection");
            return;
        }

        let uscolor = game.users.find(f => f.name === userVal)?.color || "#000000";

        let p = updatedata(fromVal, toVal, userVal, typeVal);

        const selectedUserObj = game.users.find(u => u.name === userVal);
        const isSelectedUserGM = selectedUserObj ? selectedUserObj.isGM : false;

        const barsContainer = html.querySelector('#allthebars');
        if (barsContainer) barsContainer.innerHTML = p['appcontent'];

        html.querySelectorAll('.bar').forEach(el => el.style.backgroundColor = uscolor);
        html.querySelectorAll('.bar').forEach(el => el.style.setProperty('--user-color', uscolor));

        const gmStats = html.querySelector('#gm-stats-container');
        const dualityStats = html.querySelector('#duality-stats-container');
        const filterEl = html.querySelector("#filter-rolltype-group");

        if (filterEl) filterEl.style.display = 'flex';

        if (isSelectedUserGM) {
            if(gmStats) gmStats.style.display = 'block';
            if(dualityStats) dualityStats.style.display = 'none';
            if(gmStats) gmStats.classList.remove('hidden');
            if(dualityStats) dualityStats.classList.add('hidden');

            const d20CountEl = html.querySelector('#gmD20Count');
            if(d20CountEl) d20CountEl.innerHTML = p['gmD20Count'];
            const gmCritEl = html.querySelector('#gmCrits');
            if(gmCritEl) gmCritEl.innerHTML = p['gmCrits'];

            const fearGainEl = html.querySelector('#gmFearGain');
            if(fearGainEl) fearGainEl.innerHTML = p['gmFearGain'];

            const fearSpendEl = html.querySelector('#gmFearSpend');
            if(fearSpendEl) fearSpendEl.innerHTML = p['gmFearSpend'];

            const fumbleEl = html.querySelector('#gmFumbles');
            if(fumbleEl) fumbleEl.innerHTML = p['gmFumbles'];

            const hitsEl = html.querySelector('#gmHits');
            if(hitsEl) hitsEl.innerHTML = p['gmHits'];
            const missEl = html.querySelector('#gmMisses');
            if(missEl) missEl.innerHTML = p['gmMisses'];

        } else {
            if(gmStats) gmStats.style.display = 'none';
            if(dualityStats) dualityStats.style.display = 'block';
            if(gmStats) gmStats.classList.add('hidden');
            if(dualityStats) dualityStats.classList.remove('hidden');

            const dHope = html.querySelector('#dualityHope');
            if(dHope) dHope.innerHTML = p['dualityHope'];
            const dCrit = html.querySelector('#dualityCrit');
            if(dCrit) dCrit.innerHTML = p['dualityCrit'];

            const dFear = html.querySelector('#dualityFear');
            if(dFear) dFear.innerHTML = p['dualityFear'];

            const pHits = html.querySelector('#playerHits');
            if(pHits) pHits.innerHTML = p['playerHits'];
            const pMiss = html.querySelector('#playerMisses');
            if(pMiss) pMiss.innerHTML = p['playerMisses'];

            const pSucc = html.querySelector('#playerSuccesses');
            if(pSucc) pSucc.innerHTML = p['playerSuccesses'];
            const pFail = html.querySelector('#playerFailures');
            if(pFail) pFail.innerHTML = p['playerFailures'];

            const pHopeEarned = html.querySelector('#playerHopeEarned');
            if(pHopeEarned) pHopeEarned.innerHTML = p['playerHopeEarned'];
            const pFearGen = html.querySelector('#playerFearGenerated');
            if(pFearGen) pFearGen.innerHTML = p['playerFearGenerated'];
        }
    }

    static async _onToggleSave(event, target) {
        let paus = game.settings.get(MODULE_ID, 'pausedataacq');
        await game.settings.set(MODULE_ID, 'pausedataacq', !paus);
        this.render();

        let savingRollData = !paus ? 'OFF' : 'ON';
        ChatMessage.create({
            content: `<div class="sdsdisabled"><b> Saving Roll data is now ${savingRollData} </b></div>`
        });
    }

    static _onManageData(event, target) {
        new manageDiceData().render(true);
    }

    static _onOpenSummary(event, target) {
        const appElement = this.element;

        if (!appElement) {
            console.error("DHS | Could not find app element.");
            return;
        }

        const fromVal = appElement.querySelector('#fromdateselect')?.value;
        const toVal = appElement.querySelector('#todateselect')?.value;

        if (!fromVal || !toVal) {
            ui.notifications.warn("Please select a date range first.");
            return;
        }

        try {
            new SummaryWindow({ dateFrom: fromVal, dateTo: toVal }).render(true);
        } catch (err) {
            console.error("DHS | Failed to open SummaryWindow:", err);
            ui.notifications.error("Failed to open summary. Check console.");
        }
    }

    static _onOpenTrends(event, target) {
        const appElement = this.element;

        if (!appElement) {
            console.error("DHS | Could not find app element.");
            return;
        }

        const fromVal = appElement.querySelector('#fromdateselect')?.value;
        const toVal = appElement.querySelector('#todateselect')?.value;
        const userVal = appElement.querySelector('#selectuser')?.value;

        if (!fromVal || !toVal) {
            ui.notifications.warn("Please select a date range first.");
            return;
        }

        try {
            new TrendsWindow({ dateFrom: fromVal, dateTo: toVal, selectedUser: userVal }).render(true);
        } catch (err) {
            console.error("DHS | Failed to open TrendsWindow:", err);
            ui.notifications.error("Failed to open trends. Check console.");
        }
    }

    static _onRefreshData(event, target) {
        this.render();
    }
}
