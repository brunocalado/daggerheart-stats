const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "daggerheart-stats";
const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "d12stats";

let currentFearValue = 0; // Tracks the last known Fear value for GM

function logDebug(...args) {
    if (game.settings.get(MODULE_ID, 'debugmode')) {
        console.log("DHS DEBUG |", ...args);
    }
}

//////////////////////////////////////    DATA CLASS    //////////////////////////////////////

class UserDices {
    constructor(username) {
        this.username = username;
        this.totalRolls = 0;
        this.diceRolls = new Array(12).fill(0); 
        
        this.d20Count = 0;
        this.gmCrits = 0; 
        
        // GM Stats
        this.gmFearGain = 0;
        this.gmFearSpend = 0;
        this.gmFumbles = 0; 
        this.gmHits = 0;   
        this.gmMisses = 0; 

        // Player Hit and Miss statistics
        this.playerHits = 0;
        this.playerMisses = 0;
        // Hope Earned & Fear Generated (Action Rolls Only)
        this.playerHopeEarned = 0;
        this.playerFearGenerated = 0;

        this.d20Totals = {}; 
        this.d20ActionTotals = {}; 
        this.d20ReactionTotals = {};

        this.dualityTotals = {}; 
        this.actionTotals = {};  
        this.reactionTotals = {}; 

        this.duality = { count: 0, hope: 0, fear: 0, crit: 0, totalSum: 0 };
        this.actionStats = { count: 0, hope: 0, fear: 0, crit: 0 };
        this.reactionStats = { count: 0, hope: 0, fear: 0, crit: 0 };
    }

    incrementDiceRoll(diceNumber) {
        if (diceNumber >= 1 && diceNumber <= 12) {
            this.diceRolls[diceNumber - 1]++;
            this.totalRolls++;
        }
    }
    
    incrementD20Count(val, isCritical = false, type = "action") {
        this.d20Count++;
        if (isCritical) this.gmCrits++;

        if (val !== null && val !== undefined && !isNaN(val)) {
            if (!this.d20Totals[val]) this.d20Totals[val] = 0;
            this.d20Totals[val]++;

            let targetTotals = (type === "reaction") ? this.d20ReactionTotals : this.d20ActionTotals;
            if (!targetTotals) {
                 if (type === "reaction") { this.d20ReactionTotals = {}; targetTotals = this.d20ReactionTotals; }
                 else { this.d20ActionTotals = {}; targetTotals = this.d20ActionTotals; }
            }
            if (!targetTotals[val]) targetTotals[val] = 0;
            targetTotals[val]++;
        }
    }
    
    registerDualityRoll(outcomeLabel, isCrit, totalVal, type) {
        const label = outcomeLabel ? outcomeLabel.toLowerCase() : "";
        const isHope = label === "hope";
        const isFear = label === "fear";
        
        if (!isHope && !isFear && !isCrit) return;

        this.duality.count++;
        this.duality.totalSum += totalVal;
        
        if (!this.dualityTotals[totalVal]) this.dualityTotals[totalVal] = 0;
        this.dualityTotals[totalVal]++;
        
        if (isCrit) { 
            this.duality.crit++; 
            this.duality.hope++; 
        } 
        else if (isHope) this.duality.hope++;
        else if (isFear) this.duality.fear++;

        let targetStats = (type === "reaction") ? this.reactionStats : this.actionStats;
        let targetTotals = (type === "reaction") ? this.reactionTotals : this.actionTotals;

        if (!targetTotals) {
             if (type === "reaction") { this.reactionTotals = {}; targetTotals = this.reactionTotals; }
             else { this.actionTotals = {}; targetTotals = this.actionTotals; }
        }

        if (!targetTotals[totalVal]) targetTotals[totalVal] = 0;
        targetTotals[totalVal]++;
        
        targetStats.count++;
        
        if (isCrit) { 
            targetStats.crit++; 
            targetStats.hope++; 
        } 
        else if (isHope) targetStats.hope++;
        else if (isFear) targetStats.fear++;
        
        // Track Hope Earned / Fear Generated for Action Rolls Only
        if (type === "action") {
            if (isHope || isCrit) { 
                this.playerHopeEarned++;
            } else if (isFear) {
                this.playerFearGenerated++;
            }
        }
    }
}

//////////////////////////////////////    SUMMARY WINDOW CLASS    //////////////////////////////////////

class SummaryWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.dateFrom = options.dateFrom;
        this.dateTo = options.dateTo;
    }

    static DEFAULT_OPTIONS = {
        id: "dhs-summary-win",
        tag: "div",
        // UPDATED: Added dhs-app-window and dhs-summary-ui for CSS scoping
        classes: ["dhs-app-window", "dhs-summary-ui"], 
        window: {
            title: "Daggerheart: Summary",
            icon: "fas fa-clipboard-list",
            resizable: true,
            contentClasses: ["summary-content"]
        },
        position: {
            width: 900,
            height: "auto"
        }
    };

    static get PARTS() {
        return {
            content: {
                template: `modules/${MODULE_ID}/templates/summary.hbs`,
            }
        };
    }

    async _prepareContext(options) {
        const users = game.users.contents;
        let gmData = null;
        let playersData = [];
        
        // Create period string once to inject directly
        const periodString = `${this.dateFrom} - ${this.dateTo}`;

        // 1. Gather Data
        for (const user of users) {
            const result = updatedata(this.dateFrom, this.dateTo, user.name, 'all');
            let mathStats = { min: '-', max: '-', avg: '-' };
            
            if (user.isGM) {
                mathStats = this._calculateMathStats(result.d20Totals);
                gmData = {
                    name: user.name,
                    color: user.color,
                    // totalD20: result.gmD20Count, // Removed per request
                    period: periodString, // Injected here to ensure availability
                    crits: result.gmCrits,
                    fumbles: result.gmFumbles,
                    hits: result.gmHits,
                    misses: result.gmMisses,
                    fearEarned: result.gmFearGain,
                    fearSpent: result.gmFearSpend,
                    min: mathStats.min,
                    max: mathStats.max,
                    avg: mathStats.avg,
                    totalD20: result.gmD20Count // Kept for count stat
                };
            } else {
                mathStats = this._calculateMathStats(result.dualityTotals);
                playersData.push({
                    name: user.name,
                    color: user.color,
                    period: periodString,
                    hopeRolls: result.dualityHope, 
                    crits: result.dualityCrit,
                    hits: result.playerHits,
                    misses: result.playerMisses,
                    fearRolls: result.dualityFear,
                    hopeEarned: result.playerHopeEarned,
                    fearGen: result.playerFearGenerated,
                    min: mathStats.min,
                    max: mathStats.max,
                    avg: mathStats.avg,
                    badges: [] // Initialize badges array
                });
            }
        }

        // --- BADGE ASSIGNMENT LOGIC ---

        // Helper function to find players with max value in a category (ignoring 0)
        const findWinners = (metric) => {
            let max = 0;
            playersData.forEach(p => { if (p[metric] > max) max = p[metric]; });
            if (max === 0) return [];
            return playersData.filter(p => p[metric] === max);
        };

        // 2. Assign Independent Badges
        findWinners('fearGen').forEach(p => 
            p.badges.push({ label: "DM's Best Friend", class: "badge-fear", tooltip: "Most Fear Generated" }));
        
        findWinners('crits').forEach(p => 
            p.badges.push({ label: "God Mode", class: "badge-crit", tooltip: "Most Critical Successes" }));
        
        findWinners('hopeEarned').forEach(p => 
            p.badges.push({ label: "The Beacon", class: "badge-beacon", tooltip: "Most Hope Earned" }));

        // 3. Assign Mutually Exclusive Group 1: Professional vs Stormtrooper
        // Rule: Winner of Professional CANNOT win Stormtrooper.
        
        // A. Assign Professional
        const profWinners = findWinners('hits');
        const profNames = new Set();
        
        profWinners.forEach(p => {
            p.badges.push({ label: "The Professional", class: "badge-hit", tooltip: "Most Hits on Target" });
            profNames.add(p.name);
        });

        // B. Assign Stormtrooper (excluding Professionals)
        let maxMisses = 0;
        playersData.forEach(p => {
            // Only consider player if NOT in the Professional list
            if (!profNames.has(p.name) && p.misses > maxMisses) {
                maxMisses = p.misses;
            }
        });

        if (maxMisses > 0) {
            playersData.filter(p => !profNames.has(p.name) && p.misses === maxMisses).forEach(p => {
                p.badges.push({ label: "Stormtrooper", class: "badge-miss", tooltip: "Most Misses on Target" });
            });
        }

        // 4. Assign Mutually Exclusive Group 2: Good Vibes vs Chaos Agent
        // Rule: Winner of Good Vibes CANNOT win Chaos Agent.

        // A. Assign Good Vibes Only
        const vibeWinners = findWinners('hopeRolls');
        const vibeNames = new Set();

        vibeWinners.forEach(p => {
            p.badges.push({ label: "Good Vibes Only", class: "badge-hope", tooltip: "Most Rolls with Hope" });
            vibeNames.add(p.name);
        });

        // B. Assign Chaos Agent (excluding Good Vibes winners)
        let maxFearRolls = 0;
        playersData.forEach(p => {
            if (!vibeNames.has(p.name) && p.fearRolls > maxFearRolls) {
                maxFearRolls = p.fearRolls;
            }
        });

        if (maxFearRolls > 0) {
            playersData.filter(p => !vibeNames.has(p.name) && p.fearRolls === maxFearRolls).forEach(p => {
                p.badges.push({ label: "Chaos Agent", class: "badge-chaos", tooltip: "Most Rolls with Fear" });
            });
        }

        return {
            dateFrom: this.dateFrom,
            dateTo: this.dateTo,
            gm: gmData,
            players: playersData
        };
    }

    _calculateMathStats(totalsMap) {
        if (!totalsMap || Object.keys(totalsMap).length === 0) {
            return { min: '-', max: '-', avg: '-' };
        }

        let min = null;
        let max = null;
        let sum = 0;
        let count = 0;

        for (const [valStr, freq] of Object.entries(totalsMap)) {
            const val = parseInt(valStr);
            const frequency = parseInt(freq);

            if (frequency > 0) {
                if (min === null || val < min) min = val;
                if (max === null || val > max) max = val;
                
                sum += val * frequency;
                count += frequency;
            }
        }

        return {
            min: min !== null ? min : '-',
            max: max !== null ? max : '-',
            avg: count > 0 ? (sum / count).toFixed(1) : '-'
        };
    }
}

//////////////////////////////////////    CHART WINDOW CLASS    //////////////////////////////////////    

class ChartWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dhs-winapp",
        tag: "div",
        // UPDATED: Added dhs-app-window and dhs-chart-ui for CSS scoping
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
            refreshData: ChartWindow._onRefreshData // Nova Ação
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

            let whichuser = this._getUsersOptions();
            
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

        const userVal = userSelect.value;
        const fromVal = fromSelect.value;
        const toVal = toSelect.value;
        
        const typeSelect = html.querySelector("#filter-rolltype");
        const typeVal = typeSelect ? typeSelect.value : 'all';

        if (event && event.target.id === "selectuser") {
             let dates = populatedates(userVal);
             fromSelect.innerHTML = dates.messagealldatesfrom;
             toSelect.innerHTML = dates.messagealldatesto;
             if (toSelect.options.length > 0) {
                 toSelect.value = toSelect.options[toSelect.options.length - 1].value;
             }
        }

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
        
        const gmStats = html.querySelector('#gm-stats-container');
        const dualityStats = html.querySelector('#duality-stats-container');
        const filterEl = html.querySelector("#filter-rolltype-group");

        if (filterEl) filterEl.style.display = 'flex'; 

        if (isSelectedUserGM) {
            if(gmStats) gmStats.style.display = 'block';
            if(dualityStats) dualityStats.style.display = 'none';

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
    
    // Updated Action Handler
    static _onOpenSummary(event, target) {
        // 'this' refers to the Application instance when invoked by Foundry actions
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

    static _onRefreshData(event, target) {
        this.render(); // Re-render the application to fetch fresh data
        // Notificação removida conforme solicitado
    }

    _getUsersOptions() {
        let usnames = [];
        
        if (!game.settings.get(MODULE_ID, 'allowviewgmstats') && !game.user.isGM) {
            usnames = game.users.contents.filter(u => !u.isGM).map(u => u.name);
        } else {
            usnames = game.users.contents.map(obj => obj.name);
        }

        let whichuser = '';
        for (let name of usnames) {
            whichuser += `<option value="${name}">${name}</option>`;
        }
        return whichuser;
    }
}

//////////////////////////////////////    MANAGE DATA CLASS    //////////////////////////////////////

class manageDiceData extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = { 
        id: "dhs-winapp-mngdata", 
        tag: "div",
        // UPDATED: Added dhs-app-window and dhs-management-ui for CSS scoping 
        classes: ["dhs-app-window", "dhs-management-ui"], 
        window: { title: "Manage Daggerheart Data", resizable: false }, 
        position: { width: 900, height: "auto" }, 
        actions: { 
            exportData: manageDiceData._onExport, 
            importData: manageDiceData._onImport, 
            deleteData: manageDiceData._onDelete, 
            deleteDate: manageDiceData._onDeleteDate,
            fullWipe: manageDiceData.fullWipe 
        } 
    };
    
    static get PARTS() { return { content: { template: `modules/${MODULE_ID}/templates/management.hbs` } }; }
    
    async _prepareContext(options) {
        const chartWin = new ChartWindow();
        let whichuser = chartWin._getUsersOptions(); 
        let users = game.users.contents;
        return { whichuser: whichuser, users: users.map(u => ({name: u.name, id: u.id})) };
    }
    
    _onRender(context, options) {
        const select = this.element.querySelector('#select-usertomanage');
        if(select) { this.updateDateList(select.value); select.addEventListener('change', (e) => this.updateDateList(e.target.value)); }
        
        const tabBtns = this.element.querySelectorAll('.dhs-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => b.classList.remove('active'));
                this.element.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                const tabId = e.target.dataset.tab;
                const content = this.element.querySelector(`#tab-${tabId}`);
                if(content) content.classList.add('active');
            });
        });
    }
    
    updateDateList(userName) {
        const user = game.users.getName(userName);
        const container = this.element.querySelector('#list-dates');
        if(!user || !container) return;
        
        container.innerHTML = ''; 
        
        const listDiv = document.createElement('div');
        listDiv.className = "dates-list-container";
        container.appendChild(listDiv);

        const flags = user.getFlag(FLAG_SCOPE, FLAG_KEY);
        if(!flags) return;
        let alldates = Object.keys(flags);
        for (let date of alldates) {
            let btndate = document.createElement('button'); 
            btndate.innerText = `${date}`; 
            btndate.className = 'date-tag'; 
            btndate.dataset.date = date; 
            btndate.dataset.user = user.name; 
            btndate.type = "button"; 
            btndate.addEventListener('click', () => this.constructor._onDeleteDate(null, btndate)); 
            listDiv.appendChild(btndate);
        }
    }
    
    static _onExport(event, target) { 
        const userName = target.dataset.user; 
        const user = game.users.getName(userName); 
        if(!user) return; 
        let json = JSON.stringify(user.getFlag(FLAG_SCOPE, FLAG_KEY), null, 2); 
        foundry.utils.saveDataToFile(json, "json", `${user.name}_daggerheart_stats.json`); 
    }

    static async _onDelete(event, target) { 
        const userName = target.dataset.user; 
        const user = game.users.getName(userName); 
        if(!user) return; 
        
        const confirm = await foundry.applications.api.DialogV2.confirm({ 
            window: { title: "Warning!" },
            content: `
                <div style="text-align: center;">
                    <h3 style="color: #D32F2F; margin-bottom: 10px;">DELETE USER DATA</h3>
                    <p>Are you sure you want to delete <b>ALL DATA</b> for <b>${user.name}</b>?</p>
                    <p style="font-size: 0.9em; color: #666;">This action cannot be undone.</p>
                </div>
            `,
            rejectClose: false, 
            modal: true 
        }); 
        
        if (confirm) { 
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

window.DaggerheartStats = {
    FullWipe: manageDiceData.fullWipe,
    Open: () => {
        logDebug("Opening Statistics Window (API)");
        new ChartWindow().render(true);
    }
};

//////////////////////////////////////    HOOKS    //////////////////////////////////////   

Hooks.once('init', function () {
    game.settings.register(MODULE_ID, 'allowhiddenrolls', { name: 'Allow to Save Hidden Rolls', hint: 'If enabled, Blind and Whisper rolls will be included in the statistics.', scope: 'world', config: true, type: Boolean, default: true });
    game.settings.register(MODULE_ID, 'allowviewgmstats', { name: 'Players can see GM Stats', hint: 'If enabled, players can select the GM in the User dropdown and view their statistics.', scope: 'world', config: true, type: Boolean, default: true });
    game.settings.register(MODULE_ID, 'pausedataacq', { name: 'Pause the acquisition of data', hint: 'Stop recording new rolls temporarily.', scope: 'world', config: true, type: Boolean, default: false });
    game.settings.register(MODULE_ID, 'debugmode', { name: 'Enable Debug Mode', hint: 'Prints roll detection info to console (F12) for troubleshooting.', scope: 'world', config: true, type: Boolean, default: false });
});

Hooks.on("ready", function () {
    if (game.system.id !== 'daggerheart') return;

    // Initialize initial Fear Value
    currentFearValue = game.settings.get('daggerheart', 'ResourcesFear') || 0;

    let usnames = game.users.contents.map(obj => obj.name);
    usnames.forEach(element => { 
        let currentDate = new Date(); 
        let dateString = currentDate.toLocaleDateString('en-GB'); 
        if (!game.users.find(f => f.name === element).getFlag(FLAG_SCOPE, FLAG_KEY)) { 
            let d12sbydate = { [dateString]: new UserDices(element) }; 
            game.users.find(f => f.name === element).setFlag(FLAG_SCOPE, FLAG_KEY, d12sbydate); 
        } 
    });
    if (game.settings.get(MODULE_ID, 'pausedataacq') && game.user.isGM) { ui.notifications.warn('Daggerheart Statistics: Saving roll data is disabled'); }
});

Hooks.on('updateSetting', (setting, changes) => {
    if (game.system.id !== 'daggerheart') return;
    if (setting.key !== 'daggerheart.ResourcesFear') return;
    
    if (!game.user.isGM) return; 
    if (game.settings.get(MODULE_ID, 'pausedataacq')) return;

    if (changes.value !== undefined) {
        const newFear = changes.value;
        const diff = newFear - currentFearValue;

        if (diff !== 0) {
            let currentDate = new Date();
            let dateString = currentDate.toLocaleDateString('en-GB');
            const user = game.user;
            
            let userflag = user.getFlag(FLAG_SCOPE, FLAG_KEY) || {};
            if (!userflag[dateString]) userflag[dateString] = new UserDices(user.name);

            let currentStats = new UserDices(user.name);
            Object.assign(currentStats, userflag[dateString]);

            if (currentStats.gmFearGain === undefined) currentStats.gmFearGain = 0;
            if (currentStats.gmFearSpend === undefined) currentStats.gmFearSpend = 0;
            if (currentStats.gmFumbles === undefined) currentStats.gmFumbles = 0;
            if (currentStats.gmHits === undefined) currentStats.gmHits = 0;
            if (currentStats.gmMisses === undefined) currentStats.gmMisses = 0;

            if (diff > 0) {
                currentStats.gmFearGain += diff;
                logDebug(`GM Gained ${diff} Fear. Total Gain: ${currentStats.gmFearGain}`);
            } else {
                currentStats.gmFearSpend += Math.abs(diff);
                logDebug(`GM Spent ${Math.abs(diff)} Fear. Total Spend: ${currentStats.gmFearSpend}`);
            }

            userflag[dateString] = currentStats;
            user.setFlag(FLAG_SCOPE, FLAG_KEY, userflag);
        }
        currentFearValue = newFear;
    }
});

Hooks.on('getSceneControlButtons', function (controls) {
    if (game.system.id !== 'daggerheart') return;
    let bar = controls.tokens ?? controls.find(c => c.name === 'token');
    if (!bar) return;
    const btnData = { 
        name: "dices", 
        title: 'Daggerheart Statistics', 
        icon: 'fas fa-chart-bar', 
        onChange: () => {
            logDebug("Opening Statistics Window");
            new ChartWindow().render(true);
        }, 
        button: true 
    };
    if(Array.isArray(bar.tools)) bar.tools.push(btnData); else bar.tools.dices = btnData;
});

// Add Stats button to sidebar
Hooks.on("renderDaggerheartMenu", (app, element, data) => {
    const html = element instanceof jQuery ? element[0] : element;

    const myButton = document.createElement("button");
    myButton.type = "button";
    myButton.innerHTML = `<i class="fas fa-chart-bar"></i> Stats`; // Icon + Text
    myButton.style.marginTop = "10px";
    myButton.style.width = "100%";
    
    myButton.onclick = () => {
        if (window.DaggerheartStats) {
            window.DaggerheartStats.Open();
        } else {
            ui.notifications.error("Daggerheart Stats module not fully initialized.");
        }
    };

    const fieldset = html.querySelector("fieldset");
    if (fieldset) {
        const newFieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.innerText = "Statistics"; 
        newFieldset.appendChild(legend);
        newFieldset.appendChild(myButton);
        fieldset.after(newFieldset);
    } else {
        html.appendChild(myButton);
    }
});

Hooks.on("createChatMessage", (chatMessage) => {
    if (game.system.id !== 'daggerheart') return;
    logDebug("Message Created:", chatMessage);
    if (game.settings.get(MODULE_ID, 'pausedataacq')) return;
    const hasSystemRoll = chatMessage.system?.roll !== undefined;
    const hasChatRollClass = (chatMessage.content || "").includes("chat-roll");
    if (!hasChatRollClass && !hasSystemRoll) { logDebug("Ignored message"); return; }
    detectroll(chatMessage);
});

function detectroll(chatMessage) {
    const user = chatMessage.author; 
    if (user.id !== game.user.id) return; 

    let currentDate = new Date();
    let dateString = currentDate.toLocaleDateString('en-GB');
    let userflag = user.getFlag(FLAG_SCOPE, FLAG_KEY) || {};
    if (!userflag[dateString]) userflag[dateString] = new UserDices(user.name);

    let currentStats = new UserDices(user.name);
    Object.assign(currentStats, userflag[dateString]);
    
    // Initialize default objects
    if (!currentStats.duality) currentStats.duality = { count: 0, hope: 0, fear: 0, crit: 0, totalSum: 0 };
    if (!currentStats.dualityTotals) currentStats.dualityTotals = {};
    if (!currentStats.actionStats) currentStats.actionStats = { count: 0, hope: 0, fear: 0, crit: 0 };
    if (!currentStats.reactionStats) currentStats.reactionStats = { count: 0, hope: 0, fear: 0, crit: 0 };
    if (!currentStats.actionTotals) currentStats.actionTotals = {};
    if (!currentStats.reactionTotals) currentStats.reactionTotals = {};
    if (!currentStats.d20Totals) currentStats.d20Totals = {}; 
    if (!currentStats.d20ActionTotals) currentStats.d20ActionTotals = {}; 
    if (!currentStats.d20ReactionTotals) currentStats.d20ReactionTotals = {}; 
    if (currentStats.d20Count === undefined) currentStats.d20Count = 0;
    if (currentStats.gmCrits === undefined) currentStats.gmCrits = 0;
    
    // Initialize Fear Stats & Fumbles & Hits/Miss
    if (currentStats.gmFearGain === undefined) currentStats.gmFearGain = 0;
    if (currentStats.gmFearSpend === undefined) currentStats.gmFearSpend = 0;
    if (currentStats.gmFumbles === undefined) currentStats.gmFumbles = 0;
    if (currentStats.gmHits === undefined) currentStats.gmHits = 0;
    if (currentStats.gmMisses === undefined) currentStats.gmMisses = 0;

    // Initialize Player Hit/Miss Stats
    if (currentStats.playerHits === undefined) currentStats.playerHits = 0;
    if (currentStats.playerMisses === undefined) currentStats.playerMisses = 0;
    // Initialize Action Only Stats
    if (currentStats.playerHopeEarned === undefined) currentStats.playerHopeEarned = 0;
    if (currentStats.playerFearGenerated === undefined) currentStats.playerFearGenerated = 0;

    let rolltype = 0; 
    if (chatMessage.whisper.length > 0) rolltype = chatMessage.blind ? 1 : 2;
    if (rolltype !== 0 && !game.settings.get(MODULE_ID, 'allowhiddenrolls')) return;

    let dataModified = false;

    if (user.isGM) {
         logDebug("Processing GM Roll...");
         let foundGMData = false;
         
         // CHECK FOR HITS / MISSES (Before Roll Check)
         if (chatMessage.system.targetShort) {
            const ts = chatMessage.system.targetShort;
            const hitVal = parseInt(ts.hit) || 0;
            const missVal = parseInt(ts.miss) || 0;
            
            // Only count if non-zero
            if (hitVal >= 1) {
                currentStats.gmHits++;
                dataModified = true;
                logDebug("GM Hits Detected +1");
            }
            if (missVal >= 1) {
                currentStats.gmMisses++;
                dataModified = true;
                logDebug("GM Misses Detected +1");
            }
         }

         if (chatMessage.system?.roll) {
             const sysRoll = chatMessage.system.roll;
             const hasD20 = sysRoll.dice?.some(d => d.dice === "d20" || (d.formula && d.formula.includes("d20")));
             const isD20Title = (chatMessage.title === "D20 Roll") || (chatMessage.system.title === "D20 Roll");
             const formulaHasD20 = sysRoll.formula && sysRoll.formula.includes("d20");

             if (hasD20 || isD20Title || formulaHasD20) {
                 logDebug("Found System Data (system.roll).");
                 const isCrit = sysRoll.isCritical === true;
                 
                 // CHECK FOR FUMBLES (Total 1 on dice[0])
                 if (sysRoll.dice && sysRoll.dice.length > 0 && sysRoll.dice[0].total === 1) {
                     currentStats.gmFumbles++;
                     logDebug("GM Fumble Detected!");
                 }

                 let type = "action";
                 if (sysRoll.type && typeof sysRoll.type === "string") type = sysRoll.type.toLowerCase();
                 let val = sysRoll.total;
                 if (val === undefined || val === null) val = null;
                 currentStats.incrementD20Count(val, isCrit, type);
                 foundGMData = true;
                 dataModified = true;
             }
         }

         if (!foundGMData) {
             const div = document.createElement('div');
             div.innerHTML = chatMessage.content || ""; 
             const d20Dice = div.querySelectorAll('.dice.d20');
             let diceCount = d20Dice.length;
             if (diceCount === 0 && ((chatMessage.content || "").includes("D20 Roll") || chatMessage.flavor?.includes("D20 Roll"))) diceCount = 1; 

             if (diceCount > 0) {
                 let isCrit = false;
                 div.querySelectorAll('.roll-result-desc').forEach(desc => { if (desc.textContent.toLowerCase().includes("critical")) isCrit = true; });
                 
                 if (d20Dice.length > 0) {
                     const valContainer = div.querySelector('.roll-result-value');
                     const totalVal = valContainer ? parseInt(valContainer.innerText.trim()) : null;
                     currentStats.incrementD20Count(totalVal, isCrit, "action"); 
                     for(let i=1; i<d20Dice.length; i++) currentStats.incrementD20Count(null, false, "action"); 
                 } else {
                     currentStats.incrementD20Count(null, isCrit, "action");
                 }
                 dataModified = true;
             }
         }
    } else {
        // Player Logic
        logDebug("Processing Player Roll...");

        let isActionRoll = false; // Flag to determine if current roll is Action to validate Hits/Miss

        if (chatMessage.system?.roll) {
            const r = chatMessage.system.roll;
            const label = r.result?.label;
            const total = r.total;
            const isCrit = chatMessage.system.roll.isCritical || r.isCritical || false;
            
            const isHope = label && label.toLowerCase() === "hope";
            const isFear = label && label.toLowerCase() === "fear";
            
            if (isHope || isFear || isCrit) {
                const type = r.type ? r.type.toLowerCase() : "action"; 
                
                // Confirm if it is Action
                if (type === 'action') isActionRoll = true;

                currentStats.registerDualityRoll(label, isCrit, total, type);
                dataModified = true;
            }
        } 

        // Player Hit/Miss Logic - Depends on Action Context
        if (chatMessage.system.targetShort) {
            const ts = chatMessage.system.targetShort;
            const hitVal = parseInt(ts.hit) || 0;
            const missVal = parseInt(ts.miss) || 0;
            
            if (hitVal >= 1) {
                currentStats.playerHits++;
                dataModified = true;
                logDebug("Player Hits Detected +1");
            }
            if (missVal >= 1) {
                currentStats.playerMisses++;
                dataModified = true;
                logDebug("Player Misses Detected +1");
            }
        }
    }

    if (dataModified) {
        logDebug("Data Saved!");
        userflag[dateString] = currentStats;
        user.setFlag(FLAG_SCOPE, FLAG_KEY, userflag);
    }
}

function updatedata(datefrom, dateto, theuser, filterType = 'all') {
    let theuserObj = game.users.find(f => f.name === theuser);
    let theusercolor = theuserObj ? theuserObj.color : "#000000";
    let isSelectedGM = theuserObj ? theuserObj.isGM : false;
    let userflag = theuserObj.getFlag(FLAG_SCOPE, FLAG_KEY);
    let result = sumInRange(userflag, datefrom, dateto, filterType);

    let appcontent = "";
    let chartData = {};

    if (isSelectedGM) {
        if (filterType === 'action') chartData = result.d20ActionTotals;
        else if (filterType === 'reaction') chartData = result.d20ReactionTotals;
        else chartData = result.d20Totals;
    } else {
        if (filterType === 'action') chartData = result.actionTotals;
        else if (filterType === 'reaction') chartData = result.reactionTotals;
        else chartData = result.dualityTotals; 
    }

    let keys = Object.keys(chartData).map(Number).sort((a,b) => a - b);
    let minVal = 0; 
    let maxVal = 0;

    if (keys.length > 0) { minVal = keys[0]; maxVal = keys[keys.length - 1]; } 
    else { if (isSelectedGM) { minVal = 1; maxVal = 20; } else { minVal = 2; maxVal = 24; } }

    let displayMax = 0;
    for (let val of keys) { if (chartData[val] > displayMax) displayMax = chartData[val]; }
    
    for(let i = minVal; i <= maxVal; i++) {
        let count = chartData[i] || 0;
        let percentage = displayMax !== 0 ? Math.round((100 * count) / displayMax) : 0;
        let totalGraphRolls = Object.values(chartData).reduce((a, b) => a + b, 0);
        let realPerc = totalGraphRolls !== 0 ? Math.round((10000 * count) / totalGraphRolls) / 100 : 0;
        
        appcontent += `
        <div class="bar-group">
            <div class="bar-container">
                <div data-hover-text="${count} (${realPerc}%)" class="bar" style="height: ${percentage}%; background-color: ${theusercolor};"></div>
            </div>
            <div class="dicenlabel">
                <div class="bar-label">${i}</div>
            </div>
        </div>`;
    }

    return {
        chartData: chartData, 
        dualityCount: result.currentStats.count,
        dualityHope: result.currentStats.hope, // No Brackets
        dualityFear: result.currentStats.fear,
        dualityCrit: result.currentStats.crit,
        
        // GM Stats
        gmD20Count: result.gmD20Count,
        gmCrits: result.gmCrits,
        gmFearGain: result.gmFearGain,
        gmFearSpend: result.gmFearSpend,
        gmFumbles: result.gmFumbles, 
        gmHits: result.gmHits,     
        gmMisses: result.gmMisses, 
        
        // Raw Arrays for Math
        d20Totals: result.d20Totals,
        dualityTotals: result.dualityTotals,

        // Player Stats
        playerHits: result.playerHits,
        playerMisses: result.playerMisses,
        playerHopeEarned: result.playerHopeEarned,
        playerFearGenerated: result.playerFearGenerated,

        appcontent: appcontent
    };
}

function sumInRange(data, startDate, endDate, filterType = 'all') {
    let start = new Date(startDate.split('/').reverse().join('-'));
    let end = new Date(endDate.split('/').reverse().join('-'));

    let result = { 
        dualityTotals: {}, actionTotals: {}, reactionTotals: {}, currentStats: { count: 0, hope: 0, fear: 0, crit: 0 },
        gmD20Count: 0, gmCrits: 0, 
        gmFearGain: 0, gmFearSpend: 0, gmFumbles: 0, gmHits: 0, gmMisses: 0,
        playerHits: 0, playerMisses: 0, playerHopeEarned: 0, playerFearGenerated: 0,
        d20Totals: {}, d20ActionTotals: {}, d20ReactionTotals: {}
    };

    if (!data) return result;

    for (let date in data) {
        let currentDate = new Date(date.split('/').reverse().join('-'));
        if (currentDate >= start && currentDate <= end) {
            let dayData = data[date];
            
            // GM D20 Roll Calculation (Filtered)
            let gmDayCount = 0;
            let targetGMArray = dayData.d20Totals; // default 'all'
            if (filterType === 'action') targetGMArray = dayData.d20ActionTotals;
            if (filterType === 'reaction') targetGMArray = dayData.d20ReactionTotals;

            if (targetGMArray) {
                for (let key in targetGMArray) {
                    gmDayCount += targetGMArray[key];
                }
            }
            result.gmD20Count += gmDayCount;

            if (dayData.gmCrits) result.gmCrits += dayData.gmCrits;
            
            // Sum GM Stats
            if (dayData.gmFearGain) result.gmFearGain += dayData.gmFearGain;
            if (dayData.gmFearSpend) result.gmFearSpend += dayData.gmFearSpend;
            if (dayData.gmFumbles) result.gmFumbles += dayData.gmFumbles;
            
            // Filter Hit/Miss for GM (Action Only)
            if (filterType !== 'reaction') {
                if (dayData.gmHits) result.gmHits += dayData.gmHits;
                if (dayData.gmMisses) result.gmMisses += dayData.gmMisses;
            }

            // Sum Player Stats
            // Filter Hit/Miss for Players (Action Only)
            if (filterType !== 'reaction') {
                if (dayData.playerHits) result.playerHits += dayData.playerHits;
                if (dayData.playerMisses) result.playerMisses += dayData.playerMisses;
                if (dayData.playerHopeEarned) result.playerHopeEarned += dayData.playerHopeEarned;
                if (dayData.playerFearGenerated) result.playerFearGenerated += dayData.playerFearGenerated;
            }

            const sumObj = (target, source) => { if(!source) return; for (let val in source) { if (!target[val]) target[val] = 0; target[val] += source[val]; } };
            sumObj(result.d20Totals, dayData.d20Totals);
            sumObj(result.d20ActionTotals, dayData.d20ActionTotals);
            sumObj(result.d20ReactionTotals, dayData.d20ReactionTotals);

            let sourceStats = null;
            let sourceTotals = null;

            if (filterType === 'action') { sourceStats = dayData.actionStats; sourceTotals = dayData.actionTotals; } 
            else if (filterType === 'reaction') { sourceStats = dayData.reactionStats; sourceTotals = dayData.reactionTotals; } 
            else { sourceStats = dayData.duality; sourceTotals = dayData.dualityTotals; }

            if (sourceStats) {
                result.currentStats.count += (sourceStats.count || 0);
                result.currentStats.hope += (sourceStats.hope || 0);
                result.currentStats.fear += (sourceStats.fear || 0);
                result.currentStats.crit += (sourceStats.crit || 0);
            }

            if (sourceTotals) {
                 if (Array.isArray(sourceTotals)) { 
                    sourceTotals.forEach((count, val) => {
                        if (count > 0) {
                            if (filterType === 'action') { if(!result.actionTotals[val]) result.actionTotals[val] = 0; result.actionTotals[val] += count; }
                            else if (filterType === 'reaction') { if(!result.reactionTotals[val]) result.reactionTotals[val] = 0; result.reactionTotals[val] += count; }
                            else { if(!result.dualityTotals[val]) result.dualityTotals[val] = 0; result.dualityTotals[val] += count; }
                        }
                    });
                } else { 
                    for(let val in sourceTotals) {
                        let count = sourceTotals[val];
                        if (filterType === 'action') { if(!result.actionTotals[val]) result.actionTotals[val] = 0; result.actionTotals[val] += count; }
                        else if (filterType === 'reaction') { if(!result.reactionTotals[val]) result.reactionTotals[val] = 0; result.reactionTotals[val] += count; }
                        else { if(!result.dualityTotals[val]) result.dualityTotals[val] = 0; result.dualityTotals[val] += count; }
                    }
                }
            }
        }
    }
    return result;
}

function populatedates(user) {
    let uObj = game.users.find(f => f.name === user);
    if (!uObj) return { messagealldatesfrom: "", messagealldatesto: "" };
    let flags = uObj.getFlag(FLAG_SCOPE, FLAG_KEY);
    if(!flags) return { messagealldatesfrom: "", messagealldatesto: "" };
    let alldates = Object.keys(flags);
    let opts = '';
    for (let d of alldates) opts += `<option value="${d}">${d}</option>`;
    return { messagealldatesfrom: opts, messagealldatesto: opts }
}