# Beyond the Horizon — Voyages of the Age of Exploration

An educational sailing game for the classroom. Students start on a map of the world **as Europeans pictured it around 1490**: Western Europe is fairly accurate, Africa and Asia are distorted, there's an imaginary southern continent and mythical islands, and the Americas are missing entirely. They choose one of four explorers and captain a caravel through **uncharted waters** to recreate that explorer's voyage.

| Explorer | Voyage | Goal |
|---|---|---|
| **Bartolomeu Dias** | 1487–1488 | Find the southern tip of Africa |
| **Christopher Columbus** | 1492–1493 | Reach "the Indies" by sailing west |
| **Vasco da Gama** | 1497–1498 | Sail around Africa to India |
| **Ferdinand Magellan** (and Elcano) | 1519–1522 | Sail west around the world to the Spice Islands |

Each completed voyage **redraws the world map** with what that explorer discovered. For example, Dias erases the imaginary southern land, Columbus adds the Caribbean, da Gama corrects India, and Magellan adds South America and the Pacific.

## How to play

- **Steer by the compass.** Arrow keys or WASD steer North, East, South and West. Press two at once for the in-between directions: ↓+← sails **southwest** and ↑+→ sails **northeast**. You can also tap a point on the compass rose, or click and hold on the sea.
- **Use the wind.** Sailing with the wind is fast and sailing straight into it barely moves you. The game uses the real wind belts (trade winds, westerlies, doldrums, monsoon), so historical routes like Columbus's trade-wind crossing and da Gama's *volta do mar* really are the fast way.
- **Keep your crew alive.** Food, water, health, morale and hull all run down at sea. Sail through **schools of fish** for food and under **rain squalls** for water. Reaching ports cures **scurvy**. In storms, press **Space** to **reef your sails**.
- **Explore.** The sea is covered in fog until you sail into it. Floating bottles hold **Codex scrolls** (key terms). Glowing wind streaks give a speed boost.
- **Learn at each landmark.** Each stop opens a journal page with an illustration, the history of that moment, key-term cards and a question from the pilot. Some stops are *Captain's Decisions* that show what really happened.
- **Pilot's Challenges** ask which compass direction leads to the next destination.
- **Report to the Crown.** After the voyage, the student reports to the monarch who paid for it: King John II (Dias), Ferdinand & Isabella (Columbus), King Manuel I (da Gama) or King Charles I (Elcano reports for Magellan). The monarch asks six recall questions, four about the explorer and two key terms from that voyage, then gives a verdict and a reward.

Other keys: **C** opens the chart, **P** or **Esc** pauses, **M** mutes, and **+**/**−** zoom.

## What students learn

- **Geography:** continents, oceans, seas, capes, straits, the Equator and the Tropics, latitude and longitude, plus the real coastlines of the routes.
- **Key terms:** 76 cards in the Navigator's Codex, sorted into Ships, Navigation, Winds, Places, People and Big Ideas. Examples include caravel, astrolabe, dead reckoning, trade winds, volta do mar, padrão, scurvy, Treaty of Tordesillas, circumnavigation and the Columbian Exchange.
- **People and outcomes:** each explorer's sponsor, ships, accomplishments and discoveries, and what happened next. This includes the Indigenous peoples they met (the Taíno, the Khoikhoi, Lapu-Lapu) and the consequences of the voyages.

## Rewards that keep students playing

- **Stars (up to 3 per voyage):** one for finishing, one for answering 70% of the pilot's and the Crown's questions correctly, and one for finding 70% of the Codex scrolls.
- **Ducats:** spend them at the Royal Shipyard on better sails, hull, hold, navigation kit and crew. Upgrades carry over to every voyage.
- **Ranks:** Ship's Boy → Sailor → Pilot → Captain → Captain-Major → *Admiral of the Ocean Sea*.
- **Saving:** progress is saved in the browser automatically. Voyages save at every landmark, so a student can stop at the end of class and continue next time.

## Running it

This is a plain static website with no build step and no server code. All graphics, music and sound effects are generated in the browser.

- **Locally:** open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari). The period fonts load from Google Fonts when online and fall back to serif fonts offline.
- **GitHub Pages:** in the repository go to *Settings → Pages* and deploy from the branch. Students then open `https://<user>.github.io/<repo>/`.
- Works with keyboard, mouse or touch, on Chromebooks, laptops and tablets.

## Files

| File | Purpose |
|---|---|
| `index.html`, `css/style.css` | Page layout and all screens |
| `js/content.js` | All educational content: explorers, landmarks, journal text, quizzes and Codex terms. Edit here to change the content. |
| `js/sailing.js` | Sailing gameplay: wind model, ship physics, fog of war, events and hazards |
| `js/world.js` | Coastlines, terrain painting and the land mask |
| `js/oldmap.js` | The "world in 1490" map and how it gets redrawn |
| `js/art.js` | Procedural art: ships, portraits, compass roses and journal illustrations |
| `js/audio.js` | Procedural Renaissance-style music (including *La Folia*), ocean ambience and sound effects |
| `js/ui.js`, `js/main.js` | Screens, HUD, Codex, Shipyard and game flow |
| `js/geo-data.js` | Natural Earth 1:50m land outlines (public domain) |

Coastline data: [Natural Earth](https://www.naturalearthdata.com/) (public domain), via the `world-atlas` package.
