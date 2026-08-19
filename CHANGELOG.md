# 0.2.2

- [Removed] `avatar.webp` (AI-generated image, unused in `module.json`).
- [Changed] `banner.webp` and `thumbnail.webp` replaced with solid black placeholders (were AI-generated), same dimensions as before.
- [Verified] Roll-tracking field paths (`roll.withHope`/`withFear`, `roll.isCritical`, `roll.options.actionType`, `roll.options.roll.difficulty`/`success`, and the `dualityRoll`/`adversaryRoll`/`fateRoll` message-type mapping) checked against the Daggerheart system source at v2.7.4 — all still match; no code change needed.

# 0.2.1

- [Fixed] Rolls not being recorded on Daggerheart 2.5.0: the system moved the chat-message roll fields. Hope/Fear now read from `roll.withHope`/`roll.withFear`, action/reaction from `roll.options.actionType`, difficulty/success from `roll.options.roll`, and adversary rolls from the message type.
- [Fixed] Stats were never persisting to the database and never synced to other clients (data appeared locally but was lost on reload and invisible to the GM). Cause: stats were stored as `UserDices` class instances, which Foundry v14's `ObjectField._cast` silently wipes to `{}` on save. Flags are now written as plain objects.
- [Fixed] `getFlag` results are now cloned before mutation to avoid diffed updates being dropped as no-ops.
- https://github.com/brunocalado/daggerheart-stats/issues/1

# 0.2.0

- v14 only
- [Fixed] CSS variable leak: moved `:root` variables to `.dhs-app-window` scope to prevent conflicts with other modules
- [Changed] Split monolithic `dhs.css` into per-Application stylesheets for better maintainability: `base.css`, `chart.css`, `manage.css`, `summary.css`, `trends.css`
- [Fixed] Database write optimization: replaced sequential `setFlag()` calls with batch `updateDocuments()` in ready hook and fullWipe method

# 0.1.0

- code refactor
- will track success/failure

# 0.0.9
- visual glitch fixed

# 0.0.8
- Improved debug
- Visual alert for player about record on/off
- Ignores Tag Team final choice
- Tag char limit
- New visual for Summary
- Config template memory
- New Feature: Trends

# 0.0.7
- You can set the current GM (in case you have multiple GMs)
- You can hide users
- Most fear rolls tag fixed