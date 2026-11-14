'use strict';
/*
 * Pixel Depths - a small pixel art action RPG.
 * Move with the joystick. The hero attacks automatically.
 * Kill all monsters on a floor, then take the stairs down.
 * The high score is the deepest floor.
 */
(() => {
  // ---------- Config ----------
  const VIEW_W = 160;            // logical screen width in pixels
  const TILE = 16;
  const ROOM_W = 15, ROOM_H = 23; // room size in tiles
  const RW = ROOM_W * TILE, RH = ROOM_H * TILE;
  const BOLT_SPEED = 150;
  const KEY_BEST = 'pixelDepths.bestFloor';
  const KEY_MUTE = 'pixelDepths.mute';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } },
  };

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const view = document.createElement('canvas');
  const g = view.getContext('2d');

  let viewH = 300;
  let cssToLogical = 1;
  let topPad = 0, bottomPad = 0;

  // ---------- Pixel art ----------
  const PAL = {
    k: '#1a1c2c', w: '#f4f4f4', s: '#f4b48c', b: '#3b5dc9', B: '#41a6f6', c: '#73eff7',
    g: '#38b764', G: '#a7f070', r: '#b13e53', R: '#ef7d57', y: '#ffcd75', p: '#5d275d',
    P: '#a45fb8', e: '#566c86', E: '#94b0c2', o: '#73464b', d: '#333c57',
  };

  function sprite(rows, swap) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cg = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        let ch = rows[y][x];
        if (ch === '.') continue;
        if (swap && swap[ch]) ch = swap[ch];
        cg.fillStyle = PAL[ch];
        cg.fillRect(x, y, 1, 1);
      }
    }
    const wc = document.createElement('canvas');
    wc.width = w; wc.height = h;
    const wg = wc.getContext('2d');
    wg.drawImage(c, 0, 0);
    wg.globalCompositeOperation = 'source-in';
    wg.fillStyle = '#ffffff';
    wg.fillRect(0, 0, w, h);
    return { img: c, white: wc, w, h };
  }

  const HERO_TOP = [
    '...kkkk...',
    '..kbbbbk..',
    '.kbBBBBbk.',
    '.kbkkkkbk.',
    '.kssssssk.',
    '.kskssksk.',
    '..kssssk..',
    '.kbbyybbk.',
    'kskbbbbksk',
    '.kkbbbbkk.',
  ];
  const SLIME_A = [
    '..........',
    '...kkkk...',
    '..kGGGGk..',
    '.kGggggGk.',
    'kgwkggwkgk',
    'kggggggggk',
    'kggggggggk',
    '.kkkkkkkk.',
  ];
  const SLIME_B = [
    '..........',
    '..........',
    '...kkkk...',
    '.kkGGGGkk.',
    'kGgwkgwkGk',
    'kggggggggk',
    'kggggggggk',
    'kkkkkkkkkk',
  ];

  const SPR = {
    heroA: sprite([...HERO_TOP, '..kok.kok.', '..kk..kk..']),
    heroB: sprite([...HERO_TOP, '.kok...kok', '.kk.....kk']),
    slimeA: sprite(SLIME_A),
    slimeB: sprite(SLIME_B),
    bossA: sprite(SLIME_A, { g: 'r', G: 'R', w: 'y' }),
    bossB: sprite(SLIME_B, { g: 'r', G: 'R', w: 'y' }),
    batA: sprite([
      'kk..k..k..kk',
      'kpkkpkkpkkpk',
      'kpppprrppppk',
      '.kppwppwppk.',
      '..kpppppppk.',
      '...kkkkkkk..',
    ], { p: 'P' }),
    batB: sprite([
      '....k..k....',
      '...kpkkpk...',
      '.kkpprrppkk.',
      'kpppwppwpppk',
      'kpkkpppkkpk.',
      'k...kkkk...k',
    ], { p: 'P' }),
    skel: sprite([
      '..kkkkkk..',
      '.kwwwwwwk.',
      '.kwrwwrwk.',
      '.kwwwwwwk.',
      '..kwkkwk..',
      '...kwwk...',
      '.kkEwwEkk.',
      'kwkwkkwkwk',
      'k.kEwwEk.k',
      '..kwkkwk..',
      '..kwk.kwk.',
      '..kk...kk.',
    ]),
    gem: sprite(['..k..', '.kck.', 'kcwck', '.kck.', '..k..']),
    gemBig: sprite(['..k..', '.kGk.', 'kGwGk', '.kGk.', '..k..']),
    heart: sprite(['.kk.kk.', 'krRkrrk', 'kRrrrrk', '.krrrk.', '..krk..', '...k...']),
    bolt: sprite(['.kkk.', 'kcwck', 'kwwwk', 'kcwck', '.kkk.']),
    mark: sprite([
      '..rrr..',
      '.r...r.',
      'r.....r',
      'r..R..r',
      'r.....r',
      '.r...r.',
      '..rrr..',
    ]),
  };

  // 3x5 pixel digits for damage numbers
  const DIG = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001',
    8: '111101111101111', 9: '111101111001111',
  };

  // ---------- Themes per floor ----------
  const THEMES = [
    { f1: '#3a4466', f2: '#343d5c', sp: '#4b5680', wall: '#262b44', top: '#5a6988' },
    { f1: '#2f4a3a', f2: '#2a4334', sp: '#3f6b4c', wall: '#1d2b22', top: '#4f7d5a' },
    { f1: '#4a3352', f2: '#432e4a', sp: '#634470', wall: '#2a1c30', top: '#7a5585' },
    { f1: '#55352f', f2: '#4d302a', sp: '#7a463a', wall: '#2e1b18', top: '#8a5444' },
  ];

  // ---------- Monsters ----------
  const ETYPES = {
    slime: { r: 4, hp: 6, speed: 22, dmg: 1, xp: 1, color: '#38b764' },
    bat: { r: 4, hp: 3, speed: 44, dmg: 1, xp: 1, color: '#a45fb8' },
    skel: { r: 4, hp: 13, speed: 27, dmg: 2, xp: 2, color: '#f4f4f4' },
    boss: { r: 9, hp: 90, speed: 19, dmg: 3, xp: 15, color: '#ef7d57' },
  };

  // ---------- Upgrades ----------
  const UPGRADES = [
    { name: 'Power', icon: 'P', color: '#ef7d57', desc: 'Damage +25%.', ok: () => true, apply: (p) => { p.dmg *= 1.25; } },
    { name: 'Haste', icon: 'H', color: '#ffcd75', desc: 'Attack speed +18%.', ok: (p) => p.cd > 0.15, apply: (p) => { p.cd *= 0.85; } },
    { name: 'Swift Boots', icon: 'S', color: '#73eff7', desc: 'Move speed +12%.', ok: (p) => p.speed < 95, apply: (p) => { p.speed *= 1.12; } },
    { name: 'Vitality', icon: 'V', color: '#ef4b5b', desc: 'Max HP +4. Heal 4 HP.', ok: () => true, apply: (p) => { p.maxHp += 4; p.hp = Math.min(p.maxHp, p.hp + 4); } },
    { name: 'Multishot', icon: 'M', color: '#41a6f6', desc: 'Shoot 1 more bolt.', ok: (p) => p.bolts < 5, apply: (p) => { p.bolts++; } },
    { name: 'Pierce', icon: 'X', color: '#94b0c2', desc: 'Bolts go through 1 more monster.', ok: (p) => p.pierce < 4, apply: (p) => { p.pierce++; } },
    { name: 'Magnet', icon: 'G', color: '#a7f070', desc: 'Pick up XP from farther.', ok: (p) => p.magnet < 90, apply: (p) => { p.magnet *= 1.5; } },
    { name: 'Regen', icon: 'R', color: '#38b764', desc: 'Heal 0.25 HP each second.', ok: (p) => p.regen < 1.5, apply: (p) => { p.regen += 0.25; } },
    { name: 'Far Sight', icon: 'F', color: '#a45fb8', desc: 'Attack range +20%.', ok: (p) => p.range < 170, apply: (p) => { p.range *= 1.2; } },
  ];

  // ---------- State ----------
  let state = 'title'; // title | play | levelup | paused | dying | over
  let t = 0;
  let floor = 1, kills = 0, pendingLevels = 0, dieT = 0;
  let best = parseInt(store.get(KEY_BEST, '0'), 10) || 0;
  let map, bg, theme;
  let p, enemies, pending, bolts, gems, hearts, parts, texts, stairs, fl;
  let camX = 0, camY = 0, shake = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (n) => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function makePlayer() {
    return {
      x: RW / 2, y: RH / 2, r: 4, face: 1, moving: false, anim: 0,
      hp: 10, maxHp: 10, speed: 52, dmg: 3, cd: 0.7, cdT: 0.3,
      bolts: 1, pierce: 0, magnet: 24, regen: 0, range: 100,
      xp: 0, xpNext: 5, level: 1, inv: 0,
    };
  }

  // ---------- Room ----------
  function solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
    return map[ty * ROOM_W + tx] === 1;
  }

  function genRoom() {
    map = new Uint8Array(ROOM_W * ROOM_H);
    for (let x = 0; x < ROOM_W; x++) { map[x] = 1; map[(ROOM_H - 1) * ROOM_W + x] = 1; }
    for (let y = 0; y < ROOM_H; y++) { map[y * ROOM_W] = 1; map[y * ROOM_W + ROOM_W - 1] = 1; }

    // Pillars. Each pillar keeps a free ring around it, so no area is closed.
    const want = 3 + randi(3) + Math.min(4, floor >> 1);
    const cx = ROOM_W >> 1, cy = ROOM_H >> 1;
    for (let i = 0, made = 0; i < 80 && made < want; i++) {
      const size = Math.random() < 0.4 ? 2 : 1;
      const tx = 2 + randi(ROOM_W - 4 - size + 1);
      const ty = 2 + randi(ROOM_H - 4 - size + 1);
      if (Math.abs(tx - cx) < 3 && Math.abs(ty - cy) < 3) continue;
      let free = true;
      for (let y = ty - 1; y <= ty + size && free; y++) {
        for (let x = tx - 1; x <= tx + size; x++) { if (map[y * ROOM_W + x]) { free = false; break; } }
      }
      if (!free) continue;
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) map[y * ROOM_W + x] = 1;
      made++;
    }
    theme = THEMES[Math.floor((floor - 1) / 2) % THEMES.length];
    renderRoom();
  }

  function renderRoom() {
    bg = document.createElement('canvas');
    bg.width = RW; bg.height = RH;
    const b = bg.getContext('2d');
    for (let ty = 0; ty < ROOM_H; ty++) {
      for (let tx = 0; tx < ROOM_W; tx++) {
        const x = tx * TILE, y = ty * TILE;
        if (solidTile(tx, ty)) {
          b.fillStyle = theme.wall; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.top; b.fillRect(x, y, TILE, 2);
          b.fillStyle = PAL.k;
          b.fillRect(x, y + 7, TILE, 1);
          b.fillRect(x + ((ty & 1) ? 4 : 11), y + 2, 1, 5);
          b.fillRect(x + ((ty & 1) ? 11 : 4), y + 8, 1, 8);
          if (!solidTile(tx, ty + 1)) { b.fillStyle = 'rgba(0,0,0,.35)'; b.fillRect(x, y + TILE, TILE, 3); }
        } else {
          b.fillStyle = ((tx + ty) & 1) ? theme.f1 : theme.f2;
          b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.sp;
          for (let i = 0; i < 3; i++) b.fillRect(x + randi(15), y + randi(15), 1, 1);
          if (Math.random() < 0.12) { b.fillRect(x + 3 + randi(8), y + 3 + randi(8), 3, 1); }
        }
      }
    }
    // Wall shadows on floor below walls are drawn after, so draw once more for cover.
    for (let ty = 0; ty < ROOM_H - 1; ty++) {
      for (let tx = 0; tx < ROOM_W; tx++) {
        if (solidTile(tx, ty) && !solidTile(tx, ty + 1)) {
          b.fillStyle = 'rgba(0,0,0,.3)';
          b.fillRect(tx * TILE, (ty + 1) * TILE, TILE, 3);
        }
      }
    }
  }

  function collide(ent) {
    const r = ent.r;
    const x0 = Math.floor((ent.x - r) / TILE), x1 = Math.floor((ent.x + r) / TILE);
    const y0 = Math.floor((ent.y - r) / TILE), y1 = Math.floor((ent.y + r) / TILE);
    let hit = false;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!solidTile(tx, ty)) continue;
        const nx = clamp(ent.x, tx * TILE, tx * TILE + TILE);
        const ny = clamp(ent.y, ty * TILE, ty * TILE + TILE);
        const dx = ent.x - nx, dy = ent.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2), push = r - d;
            ent.x += (dx / d) * push; ent.y += (dy / d) * push;
          } else {
            ent.y = ty * TILE + TILE + r; // inside a tile: push out
          }
        }
      }
    }
    ent.x = clamp(ent.x, TILE + r, RW - TILE - r);
    ent.y = clamp(ent.y, TILE + r, RH - TILE - r);
    return hit;
  }

  function freeSpot(minDist) {
    for (let i = 0; i < 60; i++) {
      const tx = 1 + randi(ROOM_W - 2), ty = 1 + randi(ROOM_H - 2);
      if (solidTile(tx, ty)) continue;
      const x = tx * TILE + 8, y = ty * TILE + 8;
      if (Math.hypot(x - p.x, y - p.y) >= minDist) return { x, y };
    }
    return { x: RW / 2, y: TILE * 2 + 8 };
  }

  // ---------- Floors ----------
  function startFloor() {
    const boss = floor % 5 === 0;
    const total = boss ? 4 + floor : Math.min(6 + floor * 3, 70);
    fl = {
      toSpawn: total,
      rate: Math.max(0.25, 0.85 - floor * 0.04),
      spawnT: 1.2,
      maxAlive: Math.min(10 + floor * 2, 40),
      cleared: false,
    };
    if (boss) {
      const s = freeSpot(90);
      pending.push({ type: 'boss', x: s.x, y: s.y, t: 1.4 });
    }
    showBanner(boss ? 'FLOOR ' + floor + '\nBOSS!' : 'FLOOR ' + floor);
  }

  function pickType() {
    const w = [['slime', 5]];
    if (floor >= 2) w.push(['bat', 2 + Math.min(4, floor * 0.5)]);
    if (floor >= 3) w.push(['skel', 1 + Math.min(5, floor * 0.6)]);
    let sum = 0; for (const [, n] of w) sum += n;
    let r = Math.random() * sum;
    for (const [k, n] of w) { r -= n; if (r <= 0) return k; }
    return 'slime';
  }

  function makeEnemy(type, x, y) {
    const d = ETYPES[type];
    const hm = 1 + 0.3 * (floor - 1);
    const sm = 1 + Math.min(0.4, (floor - 1) * 0.03);
    return {
      type, x, y, r: d.r, hp: d.hp * hm, maxHp: d.hp * hm,
      speed: d.speed * sm * rand(0.9, 1.1),
      dmg: d.dmg + Math.floor((floor - 1) / 4), xp: d.xp,
      flash: 0, anim: Math.random() * 2, kx: 0, ky: 0, summonT: 4, phase: Math.random() * 6.28,
    };
  }

  function clearFloor() {
    fl.cleared = true;
    const s = freeSpot(70);
    stairs = { x: s.x, y: s.y };
    showBanner('CLEAR!\nFIND THE STAIRS');
    sfx.clear();
  }

  function nextFloor() {
    floor++;
    if (floor > best) { best = floor; store.set(KEY_BEST, best); }
    sfx.stairs();
    p.x = RW / 2; p.y = RH / 2;
    p.hp = Math.min(p.maxHp, p.hp + 2);
    enemies = []; pending = []; bolts = []; gems = []; hearts = []; parts = []; texts = [];
    stairs = null;
    genRoom();
    startFloor();
  }

  function newGame() {
    floor = 1; kills = 0; pendingLevels = 0;
    p = makePlayer();
    enemies = []; pending = []; bolts = []; gems = []; hearts = []; parts = []; texts = [];
    stairs = null;
    genRoom();
  }

  // ---------- Combat ----------
  function nearestEnemy(range) {
    let bestE = null, bd = range * range;
    for (const e of enemies) {
      const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; bestE = e; }
    }
    return bestE;
  }

  function fire(tg) {
    const base = Math.atan2(tg.y - p.y, tg.x - p.x);
    const n = p.bolts, spread = 0.22;
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      bolts.push({
        x: p.x, y: p.y - 2, vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED,
        r: 2, life: (p.range / BOLT_SPEED) * 1.4, pierce: p.pierce, hit: [],
      });
    }
    p.face = Math.cos(base) < 0 ? -1 : 1;
    sfx.shoot();
  }

  function burst(x, y, color, n, spd = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rand(0.3, 1) * spd;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), color });
    }
  }

  function hurtEnemy(e, dmg, dirX, dirY) {
    e.hp -= dmg;
    e.flash = 0.1;
    const kb = e.type === 'boss' ? 25 : 90;
    e.kx += dirX * kb; e.ky += dirY * kb;
    texts.push({ x: e.x, y: e.y - 8, val: String(Math.max(1, Math.round(dmg))), life: 0.6 });
    sfx.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    burst(e.x, e.y, ETYPES[e.type].color, e.type === 'boss' ? 30 : 9, e.type === 'boss' ? 80 : 50);
    burst(e.x, e.y, PAL.k, 4);
    sfx.kill();
    if (e.type === 'boss') {
      for (let i = 0; i < 6; i++) gems.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), v: 3 });
      hearts.push({ x: e.x, y: e.y });
      shake = 6;
    } else {
      gems.push({ x: e.x, y: e.y, vx: rand(-20, 20), vy: rand(-20, 20), v: e.xp });
      if (Math.random() < 0.04) hearts.push({ x: e.x + rand(-4, 4), y: e.y + rand(-4, 4) });
    }
  }

  function gainXp(v) {
    p.xp += v;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.floor(5 + p.level * 3.5);
      pendingLevels++;
    }
  }

  function hurtPlayer(dmg, from) {
    if (p.inv > 0 || state !== 'play') return;
    p.hp -= dmg;
    p.inv = 0.8;
    shake = 4;
    burst(p.x, p.y, '#ef4b5b', 6);
    sfx.hurt();
    if (from) {
      const dx = from.x - p.x, dy = from.y - p.y, d = Math.hypot(dx, dy) || 1;
      from.kx += (dx / d) * 120; from.ky += (dy / d) * 120;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      state = 'dying';
      dieT = 1.2;
      burst(p.x, p.y, PAL.B, 24, 70);
      burst(p.x, p.y, PAL.s, 10, 50);
      $('stick').classList.add('hidden');
    }
  }

  // ---------- Update ----------
  function update(dt) {
    t += dt;
    if (state === 'dying') {
      updateFx(dt);
      dieT -= dt;
      if (dieT <= 0) gameOver();
      return;
    }
    if (state !== 'play') return;

    // Player move
    let mx = input.x + key.x, my = input.y + key.y;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    p.x += mx * p.speed * dt;
    p.y += my * p.speed * dt;
    collide(p);
    p.moving = m > 0.05;
    if (p.moving) p.anim += dt * Math.min(1, m);
    if (mx < -0.1) p.face = -1; else if (mx > 0.1) p.face = 1;
    if (p.inv > 0) p.inv -= dt;
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Auto attack
    p.cdT -= dt;
    if (p.cdT <= 0) {
      const tg = nearestEnemy(p.range);
      if (tg) { fire(tg); p.cdT = p.cd; }
    }

    // Spawning
    fl.spawnT -= dt;
    if (fl.toSpawn > 0 && fl.spawnT <= 0 && enemies.length + pending.length < fl.maxAlive) {
      const s = freeSpot(64);
      pending.push({ type: pickType(), x: s.x, y: s.y, t: 0.7 });
      fl.toSpawn--;
      fl.spawnT = fl.rate;
    }
    for (const s of pending) {
      s.t -= dt;
      if (s.t <= 0) { enemies.push(makeEnemy(s.type, s.x, s.y)); s.done = true; }
    }
    pending = pending.filter((s) => !s.done);

    // Enemies
    for (const e of enemies) {
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      if (e.type === 'bat') {
        const wob = Math.sin(t * 6 + e.phase) * 0.7;
        const ox = dx;
        dx += -dy * wob; dy += ox * wob;
      }
      e.x += (dx * e.speed + e.kx) * dt;
      e.y += (dy * e.speed + e.ky) * dt;
      const f = Math.exp(-9 * dt);
      e.kx *= f; e.ky *= f;
      collide(e);

      if (e.type === 'boss') {
        e.summonT -= dt;
        if (e.summonT <= 0 && enemies.length < 30) {
          e.summonT = 5;
          for (let i = 0; i < 2; i++) pending.push({ type: 'slime', x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), t: 0.6 });
        }
      }

      if (d < e.r + p.r) hurtPlayer(e.dmg, e);
    }

    // Keep monsters apart
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (min - d) / 2;
          const wa = b.type === 'boss' ? 1.6 : a.type === 'boss' ? 0.4 : 1;
          a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
          b.x += (dx / d) * push * (2 - wa); b.y += (dy / d) * push * (2 - wa);
        }
      }
    }

    // Bolts
    for (const b of bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }
      if (solidTile(Math.floor(b.x / TILE), Math.floor(b.y / TILE))) {
        b.dead = true; burst(b.x, b.y, PAL.c, 3, 30); continue;
      }
      for (const e of enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          b.hit.push(e);
          const sp = Math.hypot(b.vx, b.vy);
          hurtEnemy(e, p.dmg, b.vx / sp, b.vy / sp);
          if (b.pierce-- <= 0) { b.dead = true; break; }
        }
      }
    }
    bolts = bolts.filter((b) => !b.dead);
    enemies = enemies.filter((e) => !e.dead);

    // Gems
    const mag = fl.cleared ? 9999 : p.magnet;
    for (const gm of gems) {
      const dx = p.x - gm.x, dy = p.y - gm.y, d = Math.hypot(dx, dy) || 1;
      if (d < mag) {
        const s = fl.cleared ? 180 : 130;
        gm.vx = (dx / d) * s; gm.vy = (dy / d) * s;
      } else {
        const f = Math.exp(-5 * dt); gm.vx *= f; gm.vy *= f;
      }
      gm.x += gm.vx * dt; gm.y += gm.vy * dt;
      if (d < 6) { gm.dead = true; gainXp(gm.v); sfx.gem(); }
    }
    gems = gems.filter((x) => !x.dead);

    // Hearts
    for (const h of hearts) {
      if (p.hp < p.maxHp && Math.hypot(p.x - h.x, p.y - h.y) < 8) {
        h.dead = true;
        p.hp = Math.min(p.maxHp, p.hp + 3);
        texts.push({ x: p.x, y: p.y - 10, val: '3', life: 0.8, heal: true });
        sfx.heal();
      }
    }
    hearts = hearts.filter((h) => !h.dead);

    // Floor state
    if (!fl.cleared && fl.toSpawn === 0 && pending.length === 0 && enemies.length === 0) clearFloor();
    if (stairs && gems.length === 0 && Math.hypot(p.x - stairs.x, p.y - stairs.y) < 8) nextFloor();

    updateFx(dt);

    if (pendingLevels > 0 && state === 'play') openLevelUp();
  }

  function updateFx(dt) {
    for (const q of parts) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.9; q.vy *= 0.9; q.life -= dt;
    }
    parts = parts.filter((q) => q.life > 0);
    for (const x of texts) { x.y -= 18 * dt; x.life -= dt; }
    texts = texts.filter((x) => x.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 20);
  }

  // ---------- Render ----------
  function drawSpr(s, x, y, flip, white, k = 1) {
    const w = s.w * k, h = s.h * k;
    const dx = Math.round(x - camX - w / 2), dy = Math.round(y - camY - h / 2);
    const img = white ? s.white : s.img;
    if (flip) {
      g.save(); g.translate(dx + w, dy); g.scale(-1, 1);
      g.drawImage(img, 0, 0, w, h);
      g.restore();
    } else {
      g.drawImage(img, dx, dy, w, h);
    }
  }

  function shadow(x, y, w) {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(Math.round(x - camX - w / 2), Math.round(y - camY), w, 2);
  }

  function drawNum(str, x, y, col) {
    const w = str.length * 4 - 1;
    const ox = Math.round(x - camX - w / 2), oy = Math.round(y - camY);
    for (let pass = 0; pass < 2; pass++) {
      g.fillStyle = pass ? col : PAL.k;
      const o = pass ? 0 : 1;
      for (let c = 0; c < str.length; c++) {
        const bits = DIG[str[c]];
        if (!bits) continue;
        for (let i = 0; i < 15; i++) {
          if (bits[i] === '1') g.fillRect(ox + c * 4 + (i % 3) + o, oy + Math.floor(i / 3) + o, 1, 1);
        }
      }
    }
  }

  function updateCamera() {
    let tx = p.x - VIEW_W / 2;
    let ty = p.y - (viewH - bottomPad + topPad) / 2;
    tx = clamp(tx, 0, Math.max(0, RW - VIEW_W));
    const minY = -topPad, maxY = RH - viewH + bottomPad;
    ty = minY > maxY ? (minY + maxY) / 2 : clamp(ty, minY, maxY);
    camX = tx; camY = ty;
    if (shake > 0) { camX += rand(-shake, shake); camY += rand(-shake, shake); }
    camX = Math.round(camX); camY = Math.round(camY);
  }

  function render() {
    updateCamera();
    g.fillStyle = '#0e1122';
    g.fillRect(0, 0, VIEW_W, viewH);
    g.drawImage(bg, -camX, -camY);

    // Stairs
    if (stairs) {
      const x = Math.round(stairs.x - 8 - camX), y = Math.round(stairs.y - 8 - camY);
      g.fillStyle = PAL.k; g.fillRect(x, y, 16, 16);
      const cols = ['#ffcd75', '#c99a52', '#8a6a3a', '#5a4428'];
      for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(x + 1 + i, y + 2 + i * 3, 14 - i * 2, 2); }
      if (Math.floor(t * 3) % 2) {
        g.fillStyle = PAL.y;
        g.fillRect(x - 1, y - 1, 18, 1); g.fillRect(x - 1, y + 16, 18, 1);
        g.fillRect(x - 1, y, 1, 16); g.fillRect(x + 16, y, 1, 16);
      }
    }

    // Spawn marks
    for (const s of pending) {
      if (Math.floor(s.t * 10) % 2) drawSpr(SPR.mark, s.x, s.y, false, false, s.type === 'boss' ? 2 : 1);
    }

    // Pickups
    for (const h of hearts) drawSpr(SPR.heart, h.x, h.y + Math.round(Math.sin(t * 4)), false, false);
    for (const gm of gems) drawSpr(gm.v > 1 ? SPR.gemBig : SPR.gem, gm.x, gm.y, false, false);

    // Characters, sorted by y
    const list = enemies.slice();
    if (state !== 'dying' && state !== 'over') list.push(p);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e === p) {
        shadow(p.x, p.y + 5, 8);
        if (p.inv > 0 && Math.floor(p.inv * 15) % 2) continue;
        const fr = p.moving && Math.floor(p.anim * 8) % 2 ? SPR.heroB : SPR.heroA;
        drawSpr(fr, p.x, p.y - 1, p.face < 0, false);
        continue;
      }
      const white = e.flash > 0;
      const fast = Math.floor(e.anim * (e.type === 'bat' ? 10 : 4)) % 2;
      if (e.type === 'slime') { shadow(e.x, e.y + 3, 8); drawSpr(fast ? SPR.slimeB : SPR.slimeA, e.x, e.y, false, white); }
      else if (e.type === 'bat') { shadow(e.x, e.y + 6, 6); drawSpr(fast ? SPR.batB : SPR.batA, e.x, e.y - 2, false, white); }
      else if (e.type === 'skel') { shadow(e.x, e.y + 5, 8); drawSpr(SPR.skel, e.x, e.y - 1 - fast, p.x < e.x, white); }
      else if (e.type === 'boss') {
        shadow(e.x, e.y + 7, 18);
        drawSpr(fast ? SPR.bossB : SPR.bossA, e.x, e.y, false, white, 2);
        const bw = 22, bx = Math.round(e.x - camX - bw / 2), by = Math.round(e.y - camY - 14);
        g.fillStyle = PAL.k; g.fillRect(bx - 1, by - 1, bw + 2, 4);
        g.fillStyle = '#ef4b5b'; g.fillRect(bx, by, Math.max(0, Math.round(bw * e.hp / e.maxHp)), 2);
      }
    }

    for (const b of bolts) drawSpr(SPR.bolt, b.x, b.y, false, false);
    for (const q of parts) {
      g.fillStyle = q.color;
      g.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), q.life > 0.3 ? 2 : 1, q.life > 0.3 ? 2 : 1);
    }
    for (const x of texts) drawNum(x.val, x.x, x.y, x.heal ? '#a7f070' : '#ffffff');

    // Arrow to stairs when they are off screen
    if (stairs && state === 'play') {
      const sx = stairs.x - camX, sy = stairs.y - camY;
      const top = topPad + 4, bottom = viewH - bottomPad - 4;
      if (sx < 0 || sx > VIEW_W || sy < top || sy > bottom) {
        const cx = VIEW_W / 2, cy = (top + bottom) / 2;
        const a = Math.atan2(sy - cy, sx - cx);
        const ax = clamp(cx + Math.cos(a) * 200, 8, VIEW_W - 8);
        const ay = clamp(cy + Math.sin(a) * 200, top + 4, bottom - 4);
        g.save();
        g.translate(Math.round(ax), Math.round(ay));
        g.rotate(a);
        g.fillStyle = Math.floor(t * 4) % 2 ? PAL.y : PAL.R;
        g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill();
        g.restore();
      }
    }

    ctx.drawImage(view, 0, 0, canvas.width, canvas.height);
  }

  // ---------- HUD ----------
  const hud = {
    hpFill: $('hpFill'), hpText: $('hpText'), xpFill: $('xpFill'),
    lv: $('lvText'), floor: $('floorText'), foe: $('foeText'), cache: {},
  };
  function setText(el, key, val) {
    if (hud.cache[key] !== val) { hud.cache[key] = val; el.textContent = val; }
  }
  function updateHud() {
    if (!p) return;
    hud.hpFill.style.transform = `scaleX(${p.hp / p.maxHp})`;
    hud.xpFill.style.transform = `scaleX(${p.xp / p.xpNext})`;
    setText(hud.hpText, 'hp', Math.ceil(p.hp) + '/' + p.maxHp);
    setText(hud.lv, 'lv', 'LV ' + p.level);
    setText(hud.floor, 'fl', 'FLOOR ' + floor);
    const left = fl ? fl.toSpawn + pending.length + enemies.length : 0;
    setText(hud.foe, 'foe', fl && fl.cleared ? 'GO TO STAIRS' : 'FOES ' + left);
  }

  // ---------- Screens ----------
  const show = (id) => $(id).classList.remove('hidden');
  const hide = (id) => $(id).classList.add('hidden');

  function showBanner(text) {
    const b = $('banner');
    b.innerText = text;
    b.classList.remove('show');
    void b.offsetWidth; // restart the animation
    b.classList.add('show');
  }

  function startGame() {
    unlockAudio();
    newGame();
    if (best < 1) { best = 1; store.set(KEY_BEST, best); }
    hide('scrTitle'); hide('scrOver'); hide('scrPause'); hide('scrLevel');
    show('hud'); show('stick');
    state = 'play';
    startFloor();
  }

  function openLevelUp() {
    state = 'levelup';
    sfx.level();
    const pool = UPGRADES.filter((u) => u.ok(p));
    for (let i = pool.length - 1; i > 0; i--) { const j = randi(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const cards = $('cards');
    cards.innerHTML = '';
    for (const u of pool.slice(0, 3)) {
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.disabled = true;
      const ico = document.createElement('span');
      ico.className = 'ico'; ico.style.background = u.color; ico.textContent = u.icon;
      const txt = document.createElement('span');
      const name = document.createElement('b'); name.textContent = u.name;
      const desc = document.createElement('small'); desc.textContent = u.desc;
      txt.append(name, document.createElement('br'), desc);
      btn.append(ico, txt);
      btn.addEventListener('click', () => {
        u.apply(p);
        pendingLevels--;
        hide('scrLevel');
        if (pendingLevels > 0) openLevelUp(); else state = 'play';
      });
      cards.appendChild(btn);
    }
    $('lvNum').textContent = p.level - pendingLevels + 1;
    show('scrLevel');
    // Short delay, so a finger on the joystick does not select a card by accident.
    setTimeout(() => cards.querySelectorAll('button').forEach((b) => { b.disabled = false; }), 450);
  }

  function pauseGame() {
    if (state !== 'play') return;
    state = 'paused';
    show('scrPause');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    hide('scrPause');
    state = 'play';
  }

  function gameOver() {
    state = 'over';
    const isNew = floor >= best && floor > 1;
    if (floor > best) { best = floor; store.set(KEY_BEST, best); }
    $('ovFloor').textContent = floor;
    $('ovBest').textContent = best;
    $('ovLevel').textContent = p.level;
    $('ovKills').textContent = kills;
    $('newBest').classList.toggle('hidden', !isNew);
    hide('hud'); hide('stick');
    show('scrOver');
  }

  function toTitle() {
    state = 'title';
    hide('scrPause'); hide('scrOver'); hide('hud'); hide('stick');
    $('titleBest').textContent = best;
    show('scrTitle');
  }

  // ---------- Input: joystick ----------
  const input = { x: 0, y: 0, id: null };
  const stick = $('stick'), knob = $('knob'), zone = $('touchZone');

  function moveStick(e) {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width * 0.4;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    if (Math.min(d, max) / max < 0.15) { input.x = 0; input.y = 0; }
    else { input.x = dx / max; input.y = dy / max; }
  }
  function endStick(e) {
    if (e.pointerId !== input.id) return;
    input.id = null; input.x = 0; input.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
    stick.classList.remove('active');
  }
  zone.addEventListener('pointerdown', (e) => {
    if (input.id !== null) return;
    input.id = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    stick.classList.add('active');
    moveStick(e);
    unlockAudio();
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === input.id) moveStick(e); });
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  // Keyboard (for tests on a computer)
  const key = { x: 0, y: 0 };
  const down = new Set();
  function keyAxis() {
    key.x = (down.has('ArrowRight') || down.has('d') ? 1 : 0) - (down.has('ArrowLeft') || down.has('a') ? 1 : 0);
    key.y = (down.has('ArrowDown') || down.has('s') ? 1 : 0) - (down.has('ArrowUp') || down.has('w') ? 1 : 0);
  }
  addEventListener('keydown', (e) => { down.add(e.key.length === 1 ? e.key.toLowerCase() : e.key); keyAxis(); });
  addEventListener('keyup', (e) => { down.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); keyAxis(); });

  // ---------- Sound ----------
  let actx = null;
  let muted = store.get(KEY_MUTE, '0') === '1';
  const lastPlay = {};
  function unlockAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }
  function beep(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
    if (muted || !actx) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function limited(name, ms, fn) {
    return () => {
      const now = performance.now();
      if (lastPlay[name] && now - lastPlay[name] < ms) return;
      lastPlay[name] = now; fn();
    };
  }
  const sfx = {
    shoot: limited('shoot', 60, () => beep(900, 0.05, 'square', 0.012, -400)),
    hit: limited('hit', 40, () => beep(240, 0.05, 'square', 0.025, -120)),
    kill: limited('kill', 50, () => beep(180, 0.14, 'sawtooth', 0.035, -130)),
    gem: limited('gem', 45, () => beep(1100, 0.06, 'triangle', 0.035, 500)),
    hurt: () => beep(140, 0.25, 'sawtooth', 0.07, -80),
    heal: () => { beep(660, 0.08, 'triangle', 0.05); beep(990, 0.12, 'triangle', 0.05, 0, 0.08); },
    level: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.035, 0, i * 0.08)); },
    clear: () => { [784, 988, 1175].forEach((f, i) => beep(f, 0.1, 'triangle', 0.05, 0, i * 0.09)); },
    stairs: () => { [523, 392, 330, 262].forEach((f, i) => beep(f, 0.1, 'square', 0.04, 0, i * 0.07)); },
  };

  const btnMute = $('btnMute');
  function syncMute() { btnMute.classList.toggle('off', muted); }
  btnMute.addEventListener('click', () => { muted = !muted; store.set(KEY_MUTE, muted ? '1' : '0'); syncMute(); unlockAudio(); });
  syncMute();

  // ---------- Buttons ----------
  $('btnStart').addEventListener('click', startGame);
  $('btnAgain').addEventListener('click', startGame);
  $('btnPause').addEventListener('click', pauseGame);
  $('btnResume').addEventListener('click', resumeGame);
  $('btnQuit').addEventListener('click', () => {
    if (floor > best) { best = floor; store.set(KEY_BEST, best); }
    toTitle();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  // Install button (Android / Chrome)
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    show('btnInstall');
  });
  $('btnInstall').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* ignore */ }
    installEvt = null;
    hide('btnInstall');
  });
  addEventListener('appinstalled', () => hide('btnInstall'));

  // ---------- Resize ----------
  function resize() {
    const r = app.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    viewH = Math.max(180, Math.round((VIEW_W * h) / w));
    view.width = VIEW_W; view.height = viewH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    cssToLogical = VIEW_W / w;
    ctx.imageSmoothingEnabled = false;
    g.imageSmoothingEnabled = false;
    // Space under the HUD and over the joystick, so the room edges stay visible.
    const hudEl = $('hud');
    const wasHidden = hudEl.classList.contains('hidden');
    hudEl.classList.remove('hidden');
    const hb = hudEl.getBoundingClientRect().bottom - r.top;
    if (wasHidden) hudEl.classList.add('hidden');
    const stWasHidden = stick.classList.contains('hidden');
    stick.classList.remove('hidden');
    const st = stick.getBoundingClientRect().top - r.top;
    if (stWasHidden) stick.classList.add('hidden');
    topPad = Math.round((hb + 4) * cssToLogical);
    bottomPad = Math.round((h - st + 8) * cssToLogical);
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------- Title hero ----------
  const th = $('titleHero');
  th.getContext('2d').drawImage(SPR.heroA.img, 0, 0);

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    update(dt);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  resize();
  newGame();
  $('titleBest').textContent = best;
  requestAnimationFrame(frame);

  // Test hook (read only use in automatic tests)
  window.__pd = { get state() { return state; }, get floor() { return floor; }, get player() { return p; }, get enemies() { return enemies; }, get stairs() { return stairs; } };

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
