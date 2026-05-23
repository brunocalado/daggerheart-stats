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