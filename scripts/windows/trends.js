import { MODULE_ID, FLAG_SCOPE, FLAG_KEY, HandlebarsApplicationMixin, ApplicationV2 } from '../constants.js';

//////////////////////////////////////    TRENDS WINDOW CLASS    //////////////////////////////////////

/**
 * Application window for displaying trend charts.
 * Extends ApplicationV2 with Handlebars support.
 */
export class TrendsWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} [options] - Application options.
     * @param {string} [options.dateFrom] - Start date filter.
     * @param {string} [options.dateTo] - End date filter.
     * @param {string} [options.selectedUser] - Pre-selected user name.
     */
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
            width: 1040,
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

    /**
     * Prepares the context for rendering, including user and date options.
     * 
     * @param {object} options - Render options.
     * @returns {Promise<object>} Context data.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Collect all unique dates across all visible users and build user options
        const hiddenUsers = game.settings.get(MODULE_ID, 'hiddenUsers') || [];
        const allDatesSet = new Set();

        // Build user options (same logic as getUsersOptions)
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

    /**
     * Lifecycle method called after the application renders.
     * Loads Chart.js and attaches event listeners.
     * 
     * @param {object} context - The rendered context.
     * @param {object} options - Render options.
     */
    _onRender(context, options) {
        super._onRender(context, options);

        // Load Chart.js if not already loaded
        this._loadChartJS().then(() => {
            this._attachEventListeners();
        });
    }

    /**
     * Dynamically loads the Chart.js library from a CDN if not already present.
     * 
     * @returns {Promise<void>} Resolves when the script is loaded.
     */
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

    /**
     * Attaches change listeners to inputs and handles initial selection state.
     * 
     * @private
     */
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

    /**
     * Handles date range changes and re-renders the chart.
     * 
     * @private
     */
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

    /**
     * Handles user selection changes, updating available metrics based on user role (GM/Player).
     * 
     * @private
     */
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

    /**
     * Returns a human-readable label for a given metric key.
     * 
     * @param {string} metric - The metric key.
     * @returns {string} Display label.
     * @private
     */
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
            'fearGen': 'Fear Generated',
            'successes': 'Successes',
            'failures': 'Failures'
        };
        return labels[metric] || metric;
    }

    /**
     * Updates the metric selection buttons based on whether the selected user is a GM.
     * 
     * @param {boolean} isGM - Whether the selected user is a GM.
     * @private
     */
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
                { key: 'successes', label: 'Successes', tooltip: 'Rolls against a difficulty threshold that succeeded' },
                { key: 'failures', label: 'Failures', tooltip: 'Rolls against a difficulty threshold that failed' },
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

    /**
     * Handles the click event on a metric button.
     * 
     * @param {Event} event - The click event.
     * @private
     */
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

    /**
     * Renders or updates the Chart.js instance with data for the selected user and metric.
     * 
     * @returns {Promise<void>}
     * @private
     */
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

        // Get canvas height for proper gradient scaling
        const canvasHeight = canvas.offsetHeight || 400;

        // Dark Glass Golden Gradient (Use canvas height for proper scaling)
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, 'rgba(197, 160, 89, 0.5)'); // Daggerheart Gold
        gradient.addColorStop(1, 'rgba(26, 27, 30, 0.0)');   // Fade to dark/transparent

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedLabels,
                datasets: [{
                    data: sortedValues,
                    label: this._getMetricDisplayLabel(this.selectedMetric),
                    borderColor: '#c5a059', // Solid Gold
                    backgroundColor: gradient, // Gradient Fill
                    borderWidth: 2,
                    tension: 0, // Linear segments (no curves) to avoid rendering artifacts
                    fill: true,   // Enable area fill
                    spanGaps: true, // Fill gaps in data

                    // Point Styles (Dark circle with Gold border)
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#1a1b1e', // Dark center
                    pointBorderColor: '#c5a059',     // Gold border
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#c5a059', // Invert on hover
                    pointHoverBorderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1500
                },
                elements: {
                    line: {
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                    },
                    point: {
                        hitRadius: 10
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `${this.selectedUser} - ${this._getMetricDisplayLabel(this.selectedMetric)}`,
                        color: '#e0e0e0',
                        font: {
                            size: 16,
                            family: "'Signika', sans-serif",
                            weight: '300'
                        },
                        padding: { bottom: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 27, 30, 0.9)',
                        titleColor: '#c5a059',
                        bodyColor: '#ffffff',
                        borderColor: '#3f4148',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                return `Value: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.15)',
                            borderColor: '#3f4148'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: { size: 10 },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.15)',
                            borderColor: '#3f4148'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: { size: 10 },
                            beginAtZero: true,
                            precision: 0
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Parses a date string (DD/MM/YYYY) into a Date object.
     * 
     * @param {string} dateStr - The date string.
     * @returns {Date} The parsed Date object.
     * @private
     */
    _parseDate(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(dateStr);
    }

    /**
     * Extracts the specific metric value from a user's daily data object.
     * 
     * @param {UserDices} userData - The data object for a specific day.
     * @param {string} metric - The metric key to extract.
     * @param {boolean} isGM - Whether the user is a GM.
     * @returns {number} The value of the metric.
     * @private
     */
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
                case 'successes': return userData.playerSuccesses || 0;
                case 'failures': return userData.playerFailures || 0;
                case 'min': return this._calculateMin(userData.dualityTotals);
                case 'max': return this._calculateMax(userData.dualityTotals);
                case 'avg': return this._calculateAvg(userData.dualityTotals);
                default: return 0;
            }
        }
    }

    /**
     * Calculates the minimum value from a totals object.
     * 
     * @param {object} totals - Frequency map of values.
     * @returns {number} Minimum value.
     * @private
     */
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

    /**
     * Closes the application and destroys the chart instance.
     * 
     * @param {object} [options] - Close options.
     * @returns {Promise<void>}
     */
    async close(options = {}) {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        return super.close(options);
    }
}
