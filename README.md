# Pixel Depths

A small pixel art action RPG for phones. It is a PWA (you can install it and play offline).

## How to play

- Push START, then select a weapon.
- Move with the joystick at the bottom middle of the screen.
- On a computer: move with WASD or the arrow keys. Push Esc or P to pause.
- Your weapon attacks the monsters automatically.
- Kill all monsters on the floor. Then stairs show.
- Walk to the stairs to go down one floor.
- At each new level, select 1 of 3 upgrades. At least 1 upgrade is for your weapon.
- Every 5th floor has a boss.
- Select 1 of 4 classes: Laser Beam, Chain Lightning, Boomerang, Fire Rockets.
- When a run ends, your class gets Souls for each completed floor (floors 1-5:
  1 each, 6-10: 2 each, 11-15: 3 each, ...) and +5 for each boss killed.
  Spend them on the class screen: ATTACK, ATTACK SPEED, MAX HP (no max level).
  Upgrade costs: 5, 8, 11, 14, ... Souls.
- Floors below your class best are fast: only 1 elite monster with all the EXP.
- Your high score is your deepest floor. The game keeps it on your device.

## Look

Dark gothic dungeon: an armored hero with a hood and red cape, zombies, imps,
skeleton warriors, skeleton archers (from floor 6) and ghosts (from floor 8).
Every 5th floor has a boss: Horned Demon, Bone Lich (rings of slow bolts) and
Plague Brute (charges) take turns. Some monsters shoot slow bullets; walls
stop them. Monsters get more HP on each floor, and faster deeper. Torches give
flickering light; the rest of the dungeon is dark.

The dungeon changes every 5 floors:

| Floors | Area | Floor effect | New monster |
| --- | --- | --- | --- |
| 1-5 | The Crypt | coffins and bones | - |
| 6-10 | Flooded Sewer | water slows you | Sewer Slime (splits in 2) |
| 11-15 | Lava Caves | lava hurts you | Fire Imp |
| 16-20 | Bone Cathedral | pillar rows, carpet, candles | Bone Knight (charges) |
| 21-25 | Frozen Catacombs | ice makes you faster | Frost Wraith (3 bolts) |
| 26-30 | Fungal Hollow | swamp water, glowing mushrooms | Spore Bloater (bursts near you) |
| 31-35 | Haunted Library | rows of bookshelves | Phantom (fades, appears near you) |
| 36-40 | Blood Marsh | blood water slows you | Blood Leech (hops) |
| 41-45 | Obsidian Forge | lava hurts you | Ember Golem (ring of fireballs) |
| 46-50 | Abyss Gate | void pools hurt you | Void Eye (homing orb) |

After floor 50 the areas repeat. Rooms have different shapes (rectangle,
cross, L, ring, cave, hall, library) and sizes (small, medium, large).

## Weapons

| Weapon | What it does | Its own upgrades |
| --- | --- | --- |
| Laser Beam | A hot beam. It hits all monsters in a line. | More Beams, Wider Beam |
| Chain Lightning | Lightning jumps from monster to monster. | More Jumps, More Chains |
| Boomerang | Flies out and comes back. It hits on both ways. | More Boomerangs, Bigger Boomerang |
| Fire Rockets | Homing rockets. They explode in an area. | More Rockets, Bigger Explosion |

Upgrades for all weapons: Damage, Attack Speed, Move Speed, Max HP,
Heal Over Time, Pickup Range, Attack Range.

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
