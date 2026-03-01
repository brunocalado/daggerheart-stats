import { MODULE_ID, FLAG_SCOPE, FLAG_KEY } from './constants.js';

//////////////////////////////////////    DATA CLASS    //////////////////////////////////////

/**
 * Data structure representing a user's dice statistics for a specific period (usually a day).
 */
export class UserDices {
    /**
     * @param {string} username - The name of the user.
     */
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
        // Player Success and Failure (when difficulty threshold is set)
        this.playerSuccesses = 0;
        this.playerFailures = 0;
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

    /**
     * Increments the count for a specific dice roll (d12).
     * 
     * @param {number} diceNumber - The result of the die roll (1-12).
     */
    incrementDiceRoll(diceNumber) {
        if (diceNumber >= 1 && diceNumber <= 12) {
            this.diceRolls[diceNumber - 1]++;
            this.totalRolls++;
        }
    }

    /**
     * Updates statistics for a D20 roll.
     * 
     * @param {number|null} val - The total value of the roll.
     * @param {boolean} [isCritical=false] - Whether the roll was a critical success.
     * @param {string} [type="action"] - The type of roll ("action" or "reaction").
     */
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

    /**
     * Updates statistics for a Duality roll (Hope/Fear).
     * 
     * @param {string} outcomeLabel - The label of the result ("Hope", "Fear", etc.).
     * @param {boolean} isCrit - Whether the roll was a critical success.
     * @param {number} totalVal - The total value of the roll.
     * @param {string} type - The type of roll ("action", "reaction", etc.).
     */
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

//////////////////////////////////////    UTILITY FUNCTIONS    //////////////////////////////////////

/**
 * Generates HTML options for the user selection dropdown.
 * Filters out hidden users based on settings.
 * 
 * @returns {string} HTML string of <option> elements.
 */
export function getUsersOptions() {
    let usnames = [];

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

/**
 * Aggregates data for a specific user over a date range and prepares chart data.
 * 
 * @param {string} datefrom - Start date (DD/MM/YYYY).
 * @param {string} dateto - End date (DD/MM/YYYY).
 * @param {string} theuser - The username to aggregate data for.
 * @param {string} [filterType='all'] - Filter for roll type ('all', 'action', 'reaction').
 * @returns {object} Aggregated statistics and HTML content for the chart.
 */
export function updatedata(datefrom, dateto, theuser, filterType = 'all') {
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
                <div data-hover-text="${count} (${realPerc}%)" class="bar" style="--bar-height: ${percentage}%; --user-color: ${theusercolor};"></div>
            </div>
            <div class="dicenlabel">
                <div class="bar-label">${i}</div>
            </div>
        </div>`;
    }

    return {
        chartData: chartData,
        dualityCount: result.currentStats.count,
        dualityHope: result.currentStats.hope,
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
        playerSuccesses: result.playerSuccesses,
        playerFailures: result.playerFailures,
        playerHopeEarned: result.playerHopeEarned,
        playerFearGenerated: result.playerFearGenerated,

        appcontent: appcontent
    };
}

/**
 * Sums up statistics from the stored flag data within a specified date range.
 * 
 * @param {object} data - The user's flag data object containing daily stats.
 * @param {string} startDate - Start date string.
 * @param {string} endDate - End date string.
 * @param {string} [filterType='all'] - Filter type.
 * @returns {object} An object containing summed totals and statistics.
 */
export function sumInRange(data, startDate, endDate, filterType = 'all') {
    let start = new Date(startDate.split('/').reverse().join('-'));
    let end = new Date(endDate.split('/').reverse().join('-'));

    let result = {
        dualityTotals: {}, actionTotals: {}, reactionTotals: {}, currentStats: { count: 0, hope: 0, fear: 0, crit: 0 },
        gmD20Count: 0, gmCrits: 0,
        gmFearGain: 0, gmFearSpend: 0, gmFumbles: 0, gmHits: 0, gmMisses: 0,
        playerHits: 0, playerMisses: 0, playerSuccesses: 0, playerFailures: 0, playerHopeEarned: 0, playerFearGenerated: 0,
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
                if (dayData.playerSuccesses) result.playerSuccesses += dayData.playerSuccesses;
                if (dayData.playerFailures) result.playerFailures += dayData.playerFailures;
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

/**
 * Generates HTML options for date selection based on available data for a user.
 * 
 * @param {string} user - The username.
 * @returns {{messagealldatesfrom: string, messagealldatesto: string}} HTML options for from/to selects.
 */
export function populatedates(user) {
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
    return { messagealldatesfrom: opts, messagealldatesto: opts };
}
