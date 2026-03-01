import { MODULE_ID, FLAG_SCOPE, FLAG_KEY, DEFAULT_TAGS, DEFAULT_TAG_ICONS, logDebug } from './constants.js';
import { UserDices } from './data.js';
import { ChartWindow } from './windows/chart.js';
import { manageDiceData } from './windows/manage.js';

let currentFearValue = 0; // Tracks the last known Fear value for GM

window.DaggerheartStats = {
    FullWipe: manageDiceData.fullWipe,
    Open: () => {
        logDebug("Opening Statistics Window (API)");
        new ChartWindow().render(true);
    }
};

//////////////////////////////////////    HOOKS    //////////////////////////////////////

/**
 * Initializes module settings and registers the API.
 * Hook: init
 */
Hooks.once('init', function () {
    game.settings.register(MODULE_ID, 'allowhiddenrolls', { name: 'Allow to Save Hidden Rolls', hint: 'If enabled, Blind and Whisper rolls will be included in the statistics.', scope: 'world', config: true, type: Boolean, default: true });
    game.settings.register(MODULE_ID, 'allowviewgmstats', { name: 'Players can see GM Stats', hint: 'If enabled, players can select the GM in the User dropdown and view their statistics.', scope: 'world', config: true, type: Boolean, default: true });
    game.settings.register(MODULE_ID, 'pausedataacq', { name: 'Pause the acquisition of data', hint: 'Stop recording new rolls temporarily.', scope: 'world', config: true, type: Boolean, default: false });
    game.settings.register(MODULE_ID, 'debugmode', { name: 'Enable Debug Mode', hint: 'Prints roll detection info to console (F12) for troubleshooting.', scope: 'world', config: true, type: Boolean, default: false });

    // Register Tags Settings
    game.settings.register(MODULE_ID, 'tagOverrides', {
        name: 'Custom Tag Names',
        scope: 'world',
        config: false,
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

/**
 * Sets up initial data structures for users and checks for system compatibility.
 * Hook: ready
 */
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

/**
 * Reacts to setting changes, specifically for Fear resource updates to track GM Fear usage.
 * Hook: updateSetting
 */
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

/**
 * Adds the Statistics button to the Scene Controls (left sidebar).
 * Hook: getSceneControlButtons
 */
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

/**
 * Adds the Statistics button to the Daggerheart System Menu (right sidebar).
 * Hook: renderDaggerheartMenu
 */
Hooks.on("renderDaggerheartMenu", (app, element, data) => {
    const html = element instanceof jQuery ? element[0] : element;

    const myButton = document.createElement("button");
    myButton.type = "button";
    myButton.innerHTML = `<i class="fas fa-chart-bar"></i> Stats`;
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

/**
 * Intercepts chat messages to detect and record rolls.
 * Hook: createChatMessage
 */
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

/**
 * Analyzes a chat message to extract roll data and update user statistics.
 * 
 * @param {ChatMessage} chatMessage - The chat message document being created.
 * @returns {void}
 */
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
        const msgTitle = chatMessage.title || "";
        if (msgTitle === "Tag Team Roll") {
            logDebug("Ignored Tag Team Roll combined result (counting individual rolls instead).");
            return;
        }

        let isActionRoll = false;

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

        // Player Success/Failure Logic (only when difficulty threshold is set)
        const rollDifficulty = chatMessage.system?.roll?.difficulty ?? null;
        if (rollDifficulty !== null && rollDifficulty !== undefined) {
            const isSuccess = chatMessage.system?.roll?.success;
            if (isSuccess === true) {
                currentStats.playerSuccesses = (currentStats.playerSuccesses ?? 0) + 1;
                dataModified = true;
                logDebug("Player Success Detected +1");
            } else if (isSuccess === false) {
                currentStats.playerFailures = (currentStats.playerFailures ?? 0) + 1;
                dataModified = true;
                logDebug("Player Failure Detected +1");
            }
        }
    }

    if (dataModified) {
        logDebug("Data Saved!");
        userflag[dateString] = currentStats;
        user.setFlag(FLAG_SCOPE, FLAG_KEY, userflag);
    }
}
