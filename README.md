# Daggerheart: Statistics

<p align="center"><img width="900" src="assets/images/avatar.webp" alt="Avatar"></p>

## What is it?
This module tracks all rolls made by the GM and the players. It automatically calculates Fear gains, critical hits, and rolls involving Hope and Fear.

## Why?
Reviewing the session's dice rolls is a great way to wrap up the night. Additionally, GMs can use this data to spot players who struggled with poor rolls and may need a special moment in the upcoming adventure.

<p align="center"><img width="900" src="docs/preview.webp" alt="preview"></p>

## 🚀 Key Features

* **Automated Roll Tracking:** Automatically captures and logs D20 rolls, Duality Dice (Hope/Fear), and Critical Successes from chat messages.

* **Visual Charts:** Displays an interactive bar chart of roll distributions, allowing users to visualize probability trends.

* **Detailed Statistics:**

  * **For GMs:** Tracks Total Rolls, Criticals, Fumbles, Fear Earned/Spent, and Hits/Misses.

  * **For Players:** Tracks Hope/Fear rolls, Criticals, Hits/Misses, and Hope Earned/Fear Generated from Action Rolls.

* **Data Management:** Powerful tools for the GM to Export (JSON), Import, and Delete user data, including a "Full Wipe" option.

* **Filtering:** Filter statistics by Date Range and Roll Type (Action, Reaction, or All).

* **Privacy Controls:** Settings to control visibility of hidden rolls and GM statistics for players.

## 🛠️ How to Use

1. **Access:** Click the "Chart" icon in the Token Controls (left sidebar) or the "Stats" button in the Daggerheart System Menu (right sidebar). You can use a macro too: `DaggerheartStats.Open();`.

2. **Recording:** Ensure the "Pause Data Acquisition" setting is OFF (default). The module automatically listens to chat rolls.

3. **Management:** GMs can access the management panel via the "Gear" icon inside the main statistics window to handle data maintenance.

## 🚀 Installation

Install via the Foundry VTT Module browser or use this manifest link:

```js
https://raw.githubusercontent.com/brunocalado/daggerheart-stats/main/module.json
```

## ⚖️ Credits

* **License:** MIT License.

* **Assets:** AI Audio and images provided are [CC0 1.0 Universal Public Domain](https://creativecommons.org/publicdomain/zero/1.0/).

**Disclaimer:** This module is an independent creation and is not affiliated with Darrington Press. This product includes materials from the Daggerheart System Reference Document 1.0, Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at [https://www.daggerheart.com](https://www.daggerheart.com).