import { MODULE_ID, HandlebarsApplicationMixin, ApplicationV2 } from '../constants.js';
import { updatedata } from '../data.js';

//////////////////////////////////////    SUMMARY WINDOW CLASS    //////////////////////////////////////

/**
 * Application window for displaying the summary of statistics.
 * Extends ApplicationV2 with Handlebars support.
 */
export class SummaryWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} [options] - Application options.
     * @param {string} [options.dateFrom] - Start date for the summary.
     * @param {string} [options.dateTo] - End date for the summary.
     */
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

    /**
     * Prepares the context data for the Handlebars template.
     * Calculates statistics for GM and players based on the selected date range.
     * 
     * @param {object} options - Render options.
     * @returns {Promise<object>} The context data for the template.
     */
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
                    period: periodString,
                    crits: result.gmCrits,
                    fumbles: result.gmFumbles,
                    hits: result.gmHits,
                    misses: result.gmMisses,
                    fearEarned: result.gmFearGain,
                    fearSpent: result.gmFearSpend,
                    min: mathStats.min,
                    max: mathStats.max,
                    avg: mathStats.avg,
                    totalD20: result.gmD20Count
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
                    successes: result.playerSuccesses,
                    failures: result.playerFailures,
                    fearRolls: result.dualityFear,
                    hopeEarned: result.playerHopeEarned,
                    fearGen: result.playerFearGenerated,
                    min: mathStats.min,
                    max: mathStats.max,
                    avg: mathStats.avg,
                    badges: []
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

        findWinners('successes').forEach(p =>
            p.badges.push({ label: tagNames.successes, icon: tagIcons.successes, class: "badge-success", tooltip: "Most Successes against Difficulty" }));

        findWinners('failures').forEach(p =>
            p.badges.push({ label: tagNames.failures, icon: tagIcons.failures, class: "badge-failure", tooltip: "Most Failures against Difficulty" }));

        return {
            gm: gmData,
            players: playersData,
            periodString: periodString,
            isGM: game.user.isGM
        };
    }

    /**
     * Calculates minimum, maximum, and average values from a frequency map of totals.
     * 
     * @param {object} totals - Object where keys are roll results and values are frequency counts.
     * @returns {{min: number|string, max: number|string, avg: string}} Calculated statistics.
     */
    _calculateMathStats(totals) {
        if (!totals || Object.keys(totals).length === 0) return { min: '-', max: '-', avg: '-' };
        const keys = Object.keys(totals).map(Number);
        let totalSum = 0;
        let totalCount = 0;
        for (let val in totals) { totalSum += Number(val) * totals[val]; totalCount += totals[val]; }
        return {
            min: Math.min(...keys),
            max: Math.max(...keys),
            avg: totalCount > 0 ? (totalSum / totalCount).toFixed(1) : '-'
        };
    }
}
