const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "daggerheart-stats";
const FLAG_SCOPE = MODULE_ID;
const FLAG_KEY = "d12stats";

// Default Tag Names mapped to their internal keys (Updated to Clear/Succinct English)
const DEFAULT_TAGS = {
    fearGen: "Most Fear Generated",      // DM's Best Friend -> generated most fear for the GM
    crits: "Most Criticals",             // God Mode -> Who rolled the most criticals
    hopeEarned: "Most Hope Earned",      // The Beacon -> Who earned the most hope
    hits: "Most Hits",                   // The Professional -> Who hit the most marked targets
    misses: "Most Misses",               // Stormtrooper -> Who missed the most marked targets
    hopeRolls: "Most Hope Rolls",        // Good Vibes Only -> Who rolled the most with hope
    fearRolls: "Most Fear Rolls"         // Chaos Agent -> Who rolled the most with fear
};

const DEFAULT_TAG_ICONS = {
    fearGen: "fas fa-ghost",
    crits: "fas fa-star",
    hopeEarned: "fas fa-sun",
    hits: "fas fa-swords",
    misses: "fas fa-wind",
    hopeRolls: "fas fa-clover",
    fearRolls: "fas fa-skull"
};

const AVAILABLE_ICONS = [
    "",
    "fas fa-shield-halved", "fas fa-skull", "fas fa-dragon", "fas fa-hand-fist",
    "fas fa-map-location-dot", "fas fa-compass", "fas fa-key", "fas fa-eye",
    "fas fa-mountain", "fas fa-ghost", "fas fa-hat-wizard", "fas fa-book", "fas fa-flask",
    "fas fa-bolt", "fas fa-sun", "fas fa-moon", "fas fa-crown", "fas fa-feather", "fas fa-mask",
    "fas fa-hand-holding-heart", "fas fa-music", "fas fa-balance-scale", "fas fa-trophy", "fas fa-gem",
    "fas fa-hammer", "fas fa-leaf", "fas fa-anchor", "fas fa-star", "fas fa-khanda", "fas fa-wand-magic-sparkles",
    "fas fa-scroll", "fas fa-coins", "fas fa-dice", "fas fa-fire", "fas fa-snowflake", "fas fa-droplet",
    "fas fa-wind", "fas fa-cloud-bolt", "fas fa-brain", "fas fa-person-running",
    "fas fa-campground", "fas fa-landmark", "fas fa-biohazard", "fas fa-eye-slash",
    "fas fa-heart-pulse", "fas fa-clover",
    "fas fa-vial", "fas fa-hourglass-half", "fas fa-spider", "fas fa-hand-sparkles", "fas fa-crosshairs",
    "fas fa-explosion", "fas fa-ban", "fas fa-handcuffs", "fas fa-magnifying-glass", "fas fa-mountain-sun",
    "fas fa-wand-magic", "fas fa-user-ninja", "fas fa-shoe-prints", "fas fa-puzzle-piece",
    "fas fa-dungeon", "fas fa-mound", "fas fa-vault", "fas fa-ring", "fas fa-envelope-open-text",
    "fas fa-lightbulb", "fas fa-bullseye", "fas fa-seedling", "fas fa-virus",
    "fas fa-link", "fas fa-gears", "fas fa-user-shield", "fas fa-burst", "fas fa-chess-knight"
];

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
        // Get hidden users list
        const hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];

        // Get current GM setting
        let currentGM = game.settings.get(MODULE_ID, 'currentGM') || '';
        const allGMs = game.users.contents.filter(u => u.isGM);
        if (!currentGM && allGMs.length > 0) {
            currentGM = allGMs[0].name;
        }

        // Filter out hidden users from statistics
        const users = game.users.contents.filter(u => !hiddenUsers.includes(u.name));
        let gmData = null;
        let playersData = [];

        // Create period string once to inject directly
        const periodString = `${this.dateFrom} - ${this.dateTo}`;

        // Get Tag Names (Custom or Default)
        const tagNames = game.settings.get(MODULE_ID, 'tagOverrides');
        const tagIcons = game.settings.get(MODULE_ID, 'tagIcons');

        // 1. Gather Data
        for (const user of users) {
            const result = updatedata(this.dateFrom, this.dateTo, user.name, 'all');
            let mathStats = { min: '-', max: '-', avg: '-' };

            // Only show GM data for the currentGM
            if (user.isGM && user.name === currentGM) {
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
            } else if (!user.isGM) {
                mathStats = this._calculateMathStats(result.dualityTotals);
                playersData.push({
                    name: user.name,
                    actorName: user.character?.name || null,
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

        // 2. Assign All Badges Independently (no mutual exclusions)
        findWinners('fearGen').forEach(p =>
            p.badges.push({ label: tagNames.fearGen, icon: tagIcons.fearGen, class: "badge-fear-gen", tooltip: "Most Fear Generated" }));

        findWinners('crits').forEach(p =>
            p.badges.push({ label: tagNames.crits, icon: tagIcons.crits, class: "badge-crit", tooltip: "Most Critical Successes" }));

        findWinners('hopeEarned').forEach(p =>
            p.badges.push({ label: tagNames.hopeEarned, icon: tagIcons.hopeEarned, class: "badge-hope-earn", tooltip: "Most Hope Earned" }));

        findWinners('hits').forEach(p =>
            p.badges.push({ label: tagNames.hits, icon: tagIcons.hits, class: "badge-hit", tooltip: "Most Hits on Target" }));

        findWinners('misses').forEach(p =>
            p.badges.push({ label: tagNames.misses, icon: tagIcons.misses, class: "badge-miss", tooltip: "Most Misses on Target" }));

        findWinners('hopeRolls').forEach(p =>
            p.badges.push({ label: tagNames.hopeRolls, icon: tagIcons.hopeRolls, class: "badge-hope-roll", tooltip: "Most Rolls with Hope" }));

        findWinners('fearRolls').forEach(p =>
            p.badges.push({ label: tagNames.fearRolls, icon: tagIcons.fearRolls, class: "badge-fear-roll", tooltip: "Most Rolls with Fear" }));

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

//////////////////////////////////////    TRENDS WINDOW CLASS    //////////////////////////////////////

class TrendsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
        constructor(options = {}) {
            super(options);
            this.dateFrom = options.dateFrom;
            this.dateTo = options.dateTo;
            this.selectedUser = options.selectedUser || null;
            this.selectedMetric = null;
            this.chart = null;
        }

        static DEFAULT_OPTIONS = {
            id: "dhs-trends-win",
            tag: "div",
            classes: ["dhs-app-window", "dhs-trends-ui"],
            window: {
                title: "Daggerheart: Trends",
                icon: "fas fa-chart-line",
                resizable: true,
                contentClasses: ["trends-content"]
            },
            position: {
                width: 920,
                height: 670
            }
        };

        static get PARTS() {
            return {
                content: {
                    template: `modules/${MODULE_ID}/templates/trends.hbs`,
                }
            };
        }

        async _prepareContext(options) {
            const context = await super._prepareContext(options);

            // Collect all unique dates across all visible users and build user options
            const hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];
            const allDatesSet = new Set();

            // Build user options (same logic as ChartWindow._getUsersOptions)
            let userNames = [];
            if (!game.settings.get(MODULE_ID, 'allowviewgmstats') && !game.user.isGM) {
                userNames = game.users.contents.filter(u => !u.isGM && !hiddenUsers.includes(u.name)).map(u => u.name);
            } else {
                userNames = game.users.contents.filter(u => !hiddenUsers.includes(u.name)).map(u => u.name);
            }

            let userOpts = '';
            for (const name of userNames) {
                userOpts += `<option value="${name}"${name === this.selectedUser ? ' selected' : ''}>${name}</option>`;
            }
            context.userOptions = userOpts;

            // Collect dates from all visible users
            for (let user of game.users) {
                if (hiddenUsers.includes(user.name)) continue;
                const flags = user.getFlag(FLAG_SCOPE, FLAG_KEY);
                if (flags) {
                    Object.keys(flags).forEach(d => allDatesSet.add(d));
                }
            }

            // Sort dates chronologically
            const allDates = [...allDatesSet].sort((a, b) => {
                const dateA = new Date(a.split('/').reverse().join('-'));
                const dateB = new Date(b.split('/').reverse().join('-'));
                return dateA - dateB;
            });

            // Build date option HTML with pre-selection
            let optsFrom = '';
            let optsTo = '';
            for (const d of allDates) {
                optsFrom += `<option value="${d}"${d === this.dateFrom ? ' selected' : ''}>${d}</option>`;
                optsTo += `<option value="${d}"${d === this.dateTo ? ' selected' : ''}>${d}</option>`;
            }
            context.dateOptionsFrom = optsFrom;
            context.dateOptionsTo = optsTo;

            return context;
        }

        _onRender(context, options) {
            super._onRender(context, options);

            // Load Chart.js if not already loaded
            this._loadChartJS().then(() => {
                this._attachEventListeners();
            });
        }

        async _loadChartJS() {
            if (typeof Chart !== 'undefined') return;

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        _attachEventListeners() {
            const userSelect = this.element.querySelector('#trends-user-select');
            if (userSelect) {
                userSelect.addEventListener('change', () => this._onUserChange());
                // If a user is already pre-selected, show metric buttons immediately
                if (this.selectedUser) this._onUserChange();
            }

            const fromSelect = this.element.querySelector('#trends-from-date');
            const toSelect = this.element.querySelector('#trends-to-date');
            if (fromSelect) fromSelect.addEventListener('change', () => this._onDateChange());
            if (toSelect) toSelect.addEventListener('change', () => this._onDateChange());
        }

        _onDateChange() {
            const fromSelect = this.element.querySelector('#trends-from-date');
            const toSelect = this.element.querySelector('#trends-to-date');
            if (!fromSelect || !toSelect) return;

            const fromVal = fromSelect.value;
            const toVal = toSelect.value;

            const start = this._parseDate(fromVal);
            const end = this._parseDate(toVal);
            if (start > end) {
                ui.notifications.error("Wrong date selection");
                return;
            }

            this.dateFrom = fromVal;
            this.dateTo = toVal;
            this._renderChart();
        }

        _onUserChange() {
            const userSelect = this.element.querySelector('#trends-user-select');
            if (!userSelect) return;

            const userName = userSelect.value;
            const userObj = game.users.getName(userName);
            const isGM = userObj ? userObj.isGM : false;

            this.selectedUser = userName;
            this.selectedMetric = null;

            this._updateMetricButtons(isGM);
        }

        _getMetricDisplayLabel(metric) {
            const labels = {
                'rolls': 'D20 Rolls',
                'crits': 'Critical Hits',
                'fumbles': 'Fumbles',
                'hits': 'Successful Hits',
                'misses': 'Missed Rolls',
                'min': 'Minimum Value',
                'max': 'Maximum Value',
                'avg': 'Average Value',
                'fearEarned': 'Fear Earned',
                'fearSpent': 'Fear Spent',
                'hopeRolls': 'Hope Rolls',
                'fearRolls': 'Fear Rolls',
                'hopeGain': 'Hope Earned',
                'fearGen': 'Fear Generated'
            };
            return labels[metric] || metric;
        }

        _updateMetricButtons(isGM) {
            const container = this.element.querySelector('#trends-metric-buttons');
            container.innerHTML = '';

            let metrics = [];
            if (isGM) {
                metrics = [
                    { key: 'rolls', label: 'Rolls', tooltip: 'Total number of d20 rolls' },
                    { key: 'crits', label: 'Crits', tooltip: 'Number of critical successes' },
                    { key: 'fumbles', label: 'Fumbles', tooltip: 'Number of fumbles (natural 1s)' },
                    { key: 'hits', label: 'Hits', tooltip: 'Number of successful attacks on marked targets' },
                    { key: 'misses', label: 'Misses', tooltip: 'Number of missed attacks on marked targets' },
                    { key: 'min', label: 'Min', tooltip: 'Minimum roll value in the period' },
                    { key: 'max', label: 'Max', tooltip: 'Maximum roll value in the period' },
                    { key: 'avg', label: 'Avg', tooltip: 'Average roll value in the period' },
                    { key: 'fearEarned', label: 'Fear Earned', tooltip: 'Total Fear gained' },
                    { key: 'fearSpent', label: 'Fear Spent', tooltip: 'Total Fear spent' }
                ];
            } else {
                metrics = [
                    { key: 'crits', label: 'Crits', tooltip: 'Number of critical successes' },
                    { key: 'hits', label: 'Hits', tooltip: 'Number of successful attacks on marked targets' },
                    { key: 'misses', label: 'Misses', tooltip: 'Number of missed attacks on marked targets' },
                    { key: 'min', label: 'Min', tooltip: 'Minimum duality roll value in the period' },
                    { key: 'max', label: 'Max', tooltip: 'Maximum duality roll value in the period' },
                    { key: 'avg', label: 'Avg', tooltip: 'Average duality roll value in the period' },
                    { key: 'hopeRolls', label: 'Hope Rolls', tooltip: 'Number of rolls that resulted in Hope' },
                    { key: 'fearRolls', label: 'Fear Rolls', tooltip: 'Number of rolls that resulted in Fear' },
                    { key: 'hopeGain', label: 'Hope Gain', tooltip: 'Number of action rolls that earned Hope' },
                    { key: 'fearGen', label: 'Fear Gen', tooltip: 'Number of action rolls that generated Fear' }
                ];
            }

            metrics.forEach(metric => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'trends-metric-btn';
                btn.textContent = metric.label;
                btn.dataset.metric = metric.key;
                btn.title = metric.tooltip;
                btn.addEventListener('click', (e) => this._onMetricSelect(e));
                container.appendChild(btn);
            });

            // Auto-select first metric button
            const firstBtn = container.querySelector('.trends-metric-btn');
            if (firstBtn) firstBtn.click();
        }

        _onMetricSelect(event) {
            const button = event.currentTarget;
            const metric = button.dataset.metric;

            // Update active button
            this.element.querySelectorAll('.trends-metric-btn').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            this.selectedMetric = metric;

            // Render chart
            this._renderChart();
        }

        async _renderChart() {
            if (!this.selectedUser || !this.selectedMetric) return;

            const user = game.users.getName(this.selectedUser);
            if (!user) return;

            const flagData = user.getFlag(FLAG_SCOPE, FLAG_KEY) || {};

            // Collect data points for the selected period
            const dataPoints = [];
            const labels = [];

            const startDate = this._parseDate(this.dateFrom);
            const endDate = this._parseDate(this.dateTo);

            for (let date in flagData) {
                const dateObj = this._parseDate(date);
                if (dateObj >= startDate && dateObj <= endDate) {
                    const userData = flagData[date];
                    const value = this._extractMetricValue(userData, this.selectedMetric, user.isGM);

                    labels.push(date);
                    dataPoints.push({ x: date, y: value });
                }
            }

            // Sort by date
            const sortedData = dataPoints.sort((a, b) => {
                return this._parseDate(a.x) - this._parseDate(b.x);
            });

            const sortedLabels = sortedData.map(d => d.x);
            const sortedValues = sortedData.map(d => d.y);

            // Destroy existing chart
            if (this.chart) {
                this.chart.destroy();
            }

            // Create new chart
            const canvas = this.element.querySelector('#trends-chart');
            const ctx = canvas.getContext('2d');

            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: sortedLabels,
                    datasets: [{
                        data: sortedValues,
                        borderColor: user.isGM ? '#deb887' : '#C19A56',
                        backgroundColor: user.isGM ? 'rgba(222, 184, 135, 0.1)' : 'rgba(193, 154, 86, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: `${this.selectedUser} - ${this._getMetricDisplayLabel(this.selectedMetric)}`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        tooltip: {
                            displayColors: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#C19A56',
                            bodyColor: '#ffffff',
                            borderColor: '#C19A56',
                            borderWidth: 1,
                            padding: 10,
                            titleFont: {
                                size: 13,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 12
                            },
                            callbacks: {
                                label: function(context) {
                                    return 'Value: ' + context.parsed.y;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: false
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Value'
                            },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        _parseDate(dateStr) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
            return new Date(dateStr);
        }

        _extractMetricValue(userData, metric, isGM) {
            if (isGM) {
                switch(metric) {
                    case 'rolls': return userData.d20Count || 0;
                    case 'crits': return userData.gmCrits || 0;
                    case 'fumbles': return userData.gmFumbles || 0;
                    case 'hits': return userData.gmHits || 0;
                    case 'misses': return userData.gmMisses || 0;
                    case 'fearEarned': return userData.gmFearGain || 0;
                    case 'fearSpent': return userData.gmFearSpend || 0;
                    case 'min': return this._calculateMin(userData.d20Totals);
                    case 'max': return this._calculateMax(userData.d20Totals);
                    case 'avg': return this._calculateAvg(userData.d20Totals);
                    default: return 0;
                }
            } else {
                switch(metric) {
                    case 'crits': return userData.duality?.crit || 0;
                    case 'hits': return userData.playerHits || 0;
                    case 'misses': return userData.playerMisses || 0;
                    case 'hopeRolls': return userData.duality?.hope || 0;
                    case 'fearRolls': return userData.duality?.fear || 0;
                    case 'hopeGain': return userData.playerHopeEarned || 0;
                    case 'fearGen': return userData.playerFearGenerated || 0;
                    case 'min': return this._calculateMin(userData.dualityTotals);
                    case 'max': return this._calculateMax(userData.dualityTotals);
                    case 'avg': return this._calculateAvg(userData.dualityTotals);
                    default: return 0;
                }
            }
        }

        _calculateMin(totals) {
            if (!totals || Object.keys(totals).length === 0) return 0;
            const values = Object.keys(totals).map(k => parseInt(k));
            return Math.min(...values);
        }

        _calculateMax(totals) {
            if (!totals || Object.keys(totals).length === 0) return 0;
            const values = Object.keys(totals).map(k => parseInt(k));
            return Math.max(...values);
        }

        _calculateAvg(totals) {
            if (!totals || Object.keys(totals).length === 0) return 0;
            let sum = 0;
            let count = 0;
            for (let val in totals) {
                const frequency = totals[val];
                sum += parseInt(val) * frequency;
                count += frequency;
            }
            return count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;
        }

        async close(options = {}) {
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
            return super.close(options);
        }
    }

//////////////////////////////////////    CHART WINDOW CLASS    //////////////////////////////////////    

class ChartWindow extends HandlebarsApplicationMixin(ApplicationV2) {
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

    static _onOpenTrends(event, target) {
        // 'this' refers to the Application instance when invoked by Foundry actions
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
        this.render(); // Re-render the application to fetch fresh data
        // Notification removed as requested
    }

    _getUsersOptions() {
        let usnames = [];

        // Get hidden users list
        const hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];

        if (!game.settings.get(MODULE_ID, 'allowviewgmstats') && !game.user.isGM) {
            usnames = game.users.contents.filter(u => !u.isGM && !hiddenUsers.includes(u.name)).map(u => u.name);
        } else {
            usnames = game.users.contents.filter(u => !hiddenUsers.includes(u.name)).map(obj => obj.name);
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
        const chartWin = new ChartWindow();
        let whichuser = chartWin._getUsersOptions();
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
        const lastTab = game.settings.get(MODULE_ID, 'lastManageTab');
        if (lastTab) {
            const activeBtn = this.element.querySelector(`.dhs-tab-btn[data-tab="${lastTab}"]`);
            const activeContent = this.element.querySelector(`#tab-${lastTab}`);
            
            if (activeBtn && activeContent) {
                // Deactivate defaults (usually first one is hardcoded active in HBS)
                this.element.querySelectorAll('.dhs-tab-btn').forEach(b => b.classList.remove('active'));
                this.element.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Activate saved
                activeBtn.classList.add('active');
                activeContent.classList.add('active');
            }
        }

        const tabBtns = this.element.querySelectorAll('.dhs-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                tabBtns.forEach(b => b.classList.remove('active'));
                this.element.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                const tabId = e.target.dataset.tab;
                const content = this.element.querySelector(`#tab-${tabId}`);
                if(content) content.classList.add('active');
                
                // Save state
                await game.settings.set(MODULE_ID, 'lastManageTab', tabId);
            });
        });

        // Icon Picker Logic
        const iconPickers = this.element.querySelectorAll('.icon-picker-container');
        
        iconPickers.forEach(picker => {
            const trigger = picker.querySelector('.icon-picker-trigger');
            const input = picker.querySelector('input[type="hidden"]');
            const options = picker.querySelectorAll('.icon-option');

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                iconPickers.forEach(p => { if (p !== picker) p.classList.remove('active'); });
                picker.classList.toggle('active');
            });

            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = opt.dataset.value;
                    input.value = val;
                    
                    const triggerIcon = trigger.querySelector('i');
                    triggerIcon.className = val;

                    options.forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');

                    picker.classList.remove('active');
                });
            });
        });

        document.addEventListener('click', (e) => { if (!e.target.closest('.icon-picker-container')) iconPickers.forEach(p => p.classList.remove('active')); });
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
        
        // ADDED SORTING HERE FOR CONSISTENCY
        alldates.sort((a, b) => {
            let dateA = new Date(a.split('/').reverse().join('-'));
            let dateB = new Date(b.split('/').reverse().join('-'));
            return dateA - dateB;
        });

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
    
    static async _onSaveTags(event, target) {
        const form = target.closest('.management-section');
        const inputs = form.querySelectorAll('input.tag-input');
        const iconInputs = form.querySelectorAll('input.tag-icon-input');

        const newTags = { ...DEFAULT_TAGS }; // Start with defaults to ensure structure
        const newIcons = { ...DEFAULT_TAG_ICONS };

        inputs.forEach(input => {
            if (input.name && input.value) {
                newTags[input.name] = input.value;
            }
        });
        iconInputs.forEach(input => {
            const key = input.name.replace('_icon', '');
            if (key && input.value) newIcons[key] = input.value;
        });

        await game.settings.set(MODULE_ID, 'tagOverrides', newTags);
        await game.settings.set(MODULE_ID, 'tagIcons', newIcons);
        ui.notifications.info("Daggerheart Stats: Tag names updated successfully.");
    }

    static async _onResetTags(event, target) {
        await game.settings.set(MODULE_ID, 'tagOverrides', DEFAULT_TAGS);
        await game.settings.set(MODULE_ID, 'tagIcons', DEFAULT_TAG_ICONS);
        // Re-render the app to show defaults
        // Note: ApplicationV2 doesn't have a direct reference to instance here easily without weakmap or searching,
        // but since we are changing data, a render request usually follows or we can just close/reopen.
        // For now, let's try finding the app in the registry or just notifying.
        // Since we are inside the static context, the simplest way to refresh the UI is just notifying.
        // If the user switches tabs or re-opens, it will be refreshed.
        ui.notifications.info("Daggerheart Stats: Tags reset to default.");

        // Attempt to re-render if we can find the open app window
        const app = Object.values(ui.windows).find(w => w.id === "dhs-winapp-mngdata");
        if(app) app.render();
    }

    static async _onToggleVisibility(event, target) {
        const userName = target.dataset.user;
        const user = game.users.getName(userName);
        let hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];
        const currentGM = game.settings.get(MODULE_ID, 'currentGM') || '';

        // Check if trying to hide the current GM
        if (!hiddenUsers.includes(userName) && userName === currentGM) {
            ui.notifications.warn("Cannot hide the Current GM.");
            return;
        }

        // Check if trying to hide a GM when there's only one visible GM
        if (!hiddenUsers.includes(userName) && user && user.isGM) {
            const visibleGMs = game.users.contents.filter(u => u.isGM && !hiddenUsers.includes(u.name));
            if (visibleGMs.length <= 1) {
                ui.notifications.warn("Cannot hide the only visible GM.");
                return;
            }
        }

        if (hiddenUsers.includes(userName)) {
            // Remove from hidden list (show user)
            hiddenUsers = hiddenUsers.filter(name => name !== userName);
        } else {
            // Add to hidden list (hide user)
            hiddenUsers.push(userName);
        }

        await game.settings.set(MODULE_ID, 'hiddenUsers', hiddenUsers);

        // Re-render using 'this' context from ApplicationV2 action
        this.render();
    }

    static async _onSetCurrentGM(event, target) {
        const userName = target.dataset.user;

        // If the user is hidden, remove them from hidden list
        let hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];
        if (hiddenUsers.includes(userName)) {
            hiddenUsers = hiddenUsers.filter(name => name !== userName);
            await game.settings.set(MODULE_ID, 'hiddenUsers', hiddenUsers);
        }

        await game.settings.set(MODULE_ID, 'currentGM', userName);
        this.render();
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
    
    // Register Tags Settings
    game.settings.register(MODULE_ID, 'tagOverrides', {
        name: 'Custom Tag Names',
        scope: 'world',
        config: false, // Hidden from standard menu
        type: Object,
        default: DEFAULT_TAGS
    });
    
    game.settings.register(MODULE_ID, 'tagIcons', {
        name: 'Custom Tag Icons',
        scope: 'world',
        config: false,
        type: Object,
        default: DEFAULT_TAG_ICONS
    });

    // Register Hidden Users Setting (users hidden from statistics/summary but still tracked)
    game.settings.register(MODULE_ID, 'hiddenUsers', {
        name: 'Hidden Users',
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    // Register Current GM Setting (which GM is displayed as the "active" GM)
    game.settings.register(MODULE_ID, 'currentGM', {
        name: 'Current GM',
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });

    // Register Last Manage Tab (For UX Memory)
    game.settings.register(MODULE_ID, 'lastManageTab', {
        name: 'Last Manage Tab',
        scope: 'client',
        config: false,
        type: String,
        default: 'manage-data'
    });
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

    if (setting.key === `${MODULE_ID}.pausedataacq`) {
        Object.values(ui.windows).forEach(app => {
            if (app.id === "dhs-winapp") app.render();
        });
        return;
    }

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
    
    if (game.settings.get(MODULE_ID, 'debugmode')) {
        console.log("==============");
        logDebug("Message Created:", chatMessage);
        const title = chatMessage.title || chatMessage.system?.title || "N/A";
        logDebug("Chat Title:", title);
        let isCrit = false;
        if (chatMessage.system?.roll) {
            isCrit = chatMessage.system.roll.isCritical || chatMessage.system.roll.result?.isCritical || false;
        }
        if (!isCrit && (chatMessage.content || "").toLowerCase().includes("critical")) isCrit = true;
        logDebug("system.roll.isCritical:", chatMessage.system?.roll?.isCritical);
        logDebug("system.roll.result.isCritical:", chatMessage.system?.roll?.result?.isCritical);
        logDebug("system.isGM:", chatMessage.system?.isGM);
        logDebug("type:", chatMessage.type);
        logDebug("system.roll.type:", chatMessage.system?.roll?.type);
        logDebug("system.roll.success:", chatMessage.system?.roll?.success);
        logDebug("system.hasTarget:", chatMessage.system?.hasTarget);
        logDebug("system.roll.result.label:", chatMessage.system?.roll?.result?.label);
    }

    if (game.settings.get(MODULE_ID, 'pausedataacq')) {
        if (game.settings.get(MODULE_ID, 'debugmode')) console.log("==============");
        return;
    }

    const hasSystemRoll = chatMessage.system?.roll !== undefined;
    const hasChatRollClass = (chatMessage.content || "").includes("chat-roll");
    if (!hasChatRollClass && !hasSystemRoll) { logDebug("Ignored message"); if (game.settings.get(MODULE_ID, 'debugmode')) console.log("=============="); return; }
    detectroll(chatMessage);
    if (game.settings.get(MODULE_ID, 'debugmode')) console.log("==============");
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
             const isAdversary = sysRoll.type === "adversaryRoll";

             if ((hasD20 || isD20Title) && isAdversary) {
                 logDebug("Found System Data (system.roll).");
                 const isCrit = sysRoll.isCritical === true || sysRoll.result?.isCritical === true;
                 
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

        // Check for Tag Team Event
        // Modified: Ignore the combined "Tag Team Roll" and count individual rolls instead.
        const msgTitle = chatMessage.title || "";
        if (msgTitle === "Tag Team Roll") {
            logDebug("Ignored Tag Team Roll combined result (counting individual rolls instead).");
            return;
        }

        let isActionRoll = false; // Flag to determine if current roll is Action to validate Hits/Miss

        if (chatMessage.system?.roll) {
            const r = chatMessage.system.roll;
            const label = r.result?.label;
            const total = r.total;
            const isCrit = chatMessage.system.roll.isCritical || r.result?.isCritical || false;
            
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
    
    // Sort dates chronologically
    alldates.sort((a, b) => {
        let dateA = new Date(a.split('/').reverse().join('-'));
        let dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    let opts = '';
    for (let d of alldates) opts += `<option value="${d}">${d}</option>`;
    return { messagealldatesfrom: opts, messagealldatesto: opts }
}