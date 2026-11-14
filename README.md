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

| Weapon | What it does | Its upgrades |
| --- | --- | --- |
| Laser Beam | A hot beam. It hits all monsters in a line. | Wide Beam, Twin Beam, Overcharge, Rapid Fire |
| Chain Lightning | Lightning jumps from monster to monster. | More Jumps, Static Field, Thunder, Fork, Rapid Fire |
| Orbit Blades | Glowing blades spin around you. | Extra Blade, Wide Orbit, Rapid Fire, Sharp Edge |
| Fire Rockets | Homing rockets. They explode in an area. | Big Boom, Salvo, Napalm, Rapid Fire |

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
| `icons/` | App icons |
