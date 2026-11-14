# Pixel Depths

A small pixel art action RPG for phones. It is a PWA (you can install it and play offline).

## How to play

- Move with the joystick at the bottom of the screen.
- Your hero attacks the nearest monster automatically.
- Kill all monsters on the floor. Then stairs show.
- Walk to the stairs to go down one floor.
- At each new level, select 1 of 3 upgrades.
- Every 5th floor has a boss.
- Your high score is your deepest floor. The game keeps it on your device.

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
