const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export { ApplicationV2, HandlebarsApplicationMixin };

export const MODULE_ID = "daggerheart-stats";
export const FLAG_SCOPE = MODULE_ID;
export const FLAG_KEY = "d12stats";

// Default Tag Names mapped to their internal keys (Updated to Clear/Succinct English)
export const DEFAULT_TAGS = {
    fearGen: "Most Fear Generated",      // DM's Best Friend -> generated most fear for the GM
    crits: "Most Criticals",             // God Mode -> Who rolled the most criticals
    hopeEarned: "Most Hope Earned",      // The Beacon -> Who earned the most hope
    hits: "Most Hits",                   // The Professional -> Who hit the most marked targets
    misses: "Most Misses",               // Stormtrooper -> Who missed the most marked targets
    hopeRolls: "Most Hope Rolls",        // Good Vibes Only -> Who rolled the most with hope
    fearRolls: "Most Fear Rolls"         // Chaos Agent -> Who rolled the most with fear
};

export const DEFAULT_TAG_ICONS = {
    fearGen: "fas fa-ghost",
    crits: "fas fa-star",
    hopeEarned: "fas fa-sun",
    hits: "fas fa-swords",
    misses: "fas fa-wind",
    hopeRolls: "fas fa-clover",
    fearRolls: "fas fa-skull"
};

export const AVAILABLE_ICONS = [
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

export function logDebug(...args) {
    if (game.settings.get(MODULE_ID, 'debugmode')) {
        console.log("DHS DEBUG |", ...args);
    }
}
