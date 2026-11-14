# Pixel Depths

A small pixel art action RPG for phones. It is a PWA (you can install it and play offline).

## How to play

- Push START, then select a weapon.
- Move with the joystick at the bottom middle of the screen.
- Your weapon attacks the monsters automatically.
- Kill all monsters on the floor. Then stairs show.
- Walk to the stairs to go down one floor.
- At each new level, select 1 of 3 upgrades. At least 1 upgrade is for your weapon.
- Every 5th floor has a boss.
- Your high score is your deepest floor. The game keeps it on your device.

## Look

Dark gothic dungeon: an armored hero with a hood and red cape, zombies, imps,
skeleton warriors and a horned demon boss every 5th floor. Torches give
flickering light; the rest of the dungeon is dark.

## Weapons

| Weapon | What it does | Its own upgrades |
| --- | --- | --- |
| Laser Beam | A hot beam. It hits all monsters in a line. | More Beams, Wider Beam |
| Chain Lightning | Lightning jumps from monster to monster. | More Jumps, More Chains |
| Orbit Blades | Glowing blades spin around you. | More Blades, Bigger Orbit |
| Fire Rockets | Homing rockets. They explode in an area. | More Rockets, Bigger Explosion |

Upgrades for all weapons: Damage, Attack Speed, Move Speed, Max HP,
Heal Over Time, Pickup Range, Attack Range (not for Orbit Blades).

Hits have a 15% chance to be critical (double damage, big gold number).

## Google login setup (Firebase)

Players must sign in with Google to play. Their best scores save to their
account (cloud save) and show on the leaderboard (first name + deepest floor;
no email). Until you finish these steps, the game runs in guest mode.

1. Go to https://console.firebase.google.com and push **Create a project**.
   Give it a name (for example `pixel-depths`). You can turn off Google Analytics.
2. **Build > Authentication > Get started > Sign-in method > Google**:
   turn on **Enable**, select a support email, push **Save**.
3. **Authentication > Settings > Authorized domains > Add domain**:
   add `kisma-code.github.io`.
4. **Build > Firestore Database > Create database**: select a location,
   start in **production mode**.
5. **Firestore Database > Rules**: replace the text with the contents of
   `firestore.rules` from this repository, then push **Publish**.
6. **Project settings** (gear icon) **> Your apps > Web (`</>`)**: register an
   app (for example `Pixel Depths`). Copy `apiKey`, `authDomain`, `projectId`
   and `appId` from the config into `firebase-config.js`.
7. In `sw.js`, change `VERSION` (for example `v13` to `v14`), so phones get the
   new config. Push the change.

The values in `firebase-config.js` are not secret. The rules in
`firestore.rules` protect the data: each player can change only their own
record, and the best floor can only go up.

## How to run

The game uses plain HTML, CSS and JavaScript. No build step.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

The install and offline parts need HTTPS (or `localhost`). GitHub Pages gives HTTPS.

## Files

| File | Use |
| --- | --- |
| `index.html` | Page and screens |
| `style.css` | Look of the HUD, joystick and screens |
| `game.js` | All game code |
| `manifest.webmanifest` | PWA data (name, icons, portrait mode) |
| `sw.js` | Service worker (offline cache). Change `VERSION` when you change a file. |
| `auth.js` | Google login, cloud save and leaderboard (Firebase) |
| `firebase-config.js` | Your Firebase project values (see setup above) |
| `firestore.rules` | Database safety rules to paste in the Firebase console |
| `icons/` | App icons |
