# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Pixel Depths**: a portrait, phone-only pixel-art action RPG (auto-attack, floors with stairs, level-up upgrades), shipped as a PWA on GitHub Pages: https://kisma-code.github.io/First-Web-Game/ (the path is case-sensitive). Plain HTML/CSS/JS with no build step, no package.json, no linter and no test suite.

## Commands

```sh
python3 -m http.server 8123        # run locally, then open http://localhost:8123/
node --check game.js               # syntax check (also sw.js)
node --input-type=module --check < auth.js   # auth.js is an ES module
```

Testing is done with ad-hoc Playwright scripts (Chromium is preinstalled; `require('playwright')` works) using `devices['iPhone 13']`. Touch input is sent with CDP `Input.dispatchTouchEvent`. `game.js` exposes a read-only test hook, `window.__pd` (state, floor, player, enemies, stairs, fx counts). Put scripts in the scratchpad, not in the repo.

## Deploying

GitHub Pages serves `main` from the repo root (`.nojekyll` is present). Work goes on a branch, then a PR; merging deploys in about 1 minute. **Bump `VERSION` in `sw.js` for every change to a shipped file**; phones keep old files otherwise. The service worker is network-first for same-origin files, cache-first only for the fixed-version Firebase SDK on gstatic, and it never intercepts other cross-origin requests (login, Firestore). After an update takes control, `game.js` reloads the page once, but not during a run.

## Architecture

- `game.js`: the whole game in one IIFE, split by `// ---------- Name ----------` section comments. Main loop: `frame()` → `update(dt)` (logic runs only when `state === 'play'`, or for effects when `'dying'`) → `render(dt)` → `updateHud()`. States: `title | play | levelup | paused | dying | over`. Overlay screens are DOM elements in `index.html`, shown or hidden with the `.hidden` class.
- **Rendering:** draws straight to the full-resolution canvas with `setTransform(R, …)`. `R` is a whole number of device pixels per game pixel (about 160 game px across the screen), so sprites stay sharp while positions snap to device pixels (`snap()`) for smooth motion. Do not go back to a low-res offscreen canvas that is scaled up; that made motion look jumpy.
- **Pixel art:** sprites are string grids drawn by `sprite(rows, swap)` from the `PAL` color map (one letter = one color; `.` = transparent). Each sprite also gets a white silhouette for hit flashes.
- **Draw order matters:** room `bg` canvas → stairs/pickups → characters (sorted by y) → normal particles → torch brackets → `drawDarkness()` (darkness layer with light holes from `collectLights()`) → torch flames → weapon fx (additive `lighter` blending) → additive particles → `drawAnimeFx()` → damage numbers → `drawImpactFrame()` → stairs arrow. Anything that must glow goes after the darkness. A new light source also needs an `addLight()` call in `collectLights()`.
- **Weapons:** the `WEAPONS` table holds base stats (copied to `p.w`) and 2 unique `ups` each. Only one weapon per run. Weapon logic and effects: `updateWeapon` / `fire*` / `update*` and `drawWeaponFx`. All damage goes through `hurtEnemy()` (crits, hit sparks, damage numbers, knockback, kill).
- **Upgrades:** `UPGRADES` is the general list (`apply(p)`); weapon `ups` use `apply(w)`. `openLevelUp()` mixes both and always offers at least 1 weapon upgrade. **Do not add options that repeat the same idea** (the owner asked twice): Damage and Attack Speed exist only in the general list. Attack Speed works per weapon (`minCd`; blades use spin and hitCd). Attack Range is hidden for Orbit Blades.
- **Monster type ids are legacy names:** `slime` = Zombie, `bat` = Imp, `skel` = Skeleton Warrior, `boss` = Horned Demon (every 5th floor).
- **Controls:** a fixed joystick at the bottom middle; the touch zone is the bottom 45%. It has no dead zone and full speed from any push (the knob sets only the direction), and the hero's velocity is set at once (no easing). The camera locks to the hero (a delayed camera felt like "dragging"). Keyboard arrows/WASD work for testing.
- **Login and cloud save:** `auth.js` (ES module) loads the Firebase SDK 10.12.2 from gstatic and talks to the game through two globals: `window.PD_CLOUD` (provided by auth.js: `showLogin`, `saveRun`, `saveBest`, `openBoard`, `user`, `required`) and `window.pdGame` (provided by game.js: `getBest`, `setBest`, `setWeapon`). Login is required when `firebase-config.js` is filled in; while its `apiKey` starts with `PASTE`, the game runs in guest mode. Firestore collection `players/{uid}` holds `name` (first name only, no email), `bestFloor`, `bestLevel`, `bestKills`, `weapon`, `runs`, `updatedAt`. `firestore.rules` allows only exactly these fields, and `bestFloor` may only go up, so **a change to the saved fields needs the same change in `firestore.rules`**, which the owner must paste into the Firebase console (project `pixel-roguelike-web-game`). The Firebase config values are public by design.
- `localStorage` keys: `pixelDepths.bestFloor`, `pixelDepths.mute`, `pixelDepths.weapon` (all access wrapped in try/catch via `store`).

## Working with the owner

- The owner plays on an iPhone (Safari and the Home Screen app) and checks changes on the live site after each merge.
- Reply in ASD-STE100 (Simplified Technical English): short, simple sentences.
- Ask clarifying questions before you build a new feature or make a vague change. The owner wants this.
- Make a PR for each change; the owner merges it. Before you start, check whether the previous PR is merged (`git fetch origin` and a fast-forward of the work branch) and start from the latest `main`.
- Design rules from the owner: keep the pixel look and monospace font (the glass/iOS-font theme was rejected and reverted); dark gothic dungeon (original art, not a copy of any existing game); no rings around the hero on attack; no hit stop.
