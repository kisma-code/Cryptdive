'use strict';
/*
 * Pixel Depths - a small pixel art action RPG.
 * Move with the joystick. The hero attacks automatically.
 * Kill all monsters on a floor, then take the stairs down.
 * The high score is the deepest floor.
 */
(() => {
  // ---------- Config ----------
  const TARGET_W = 160;          // about this many game pixels across the screen
  const TILE = 16;
  const ROOM_W = 15, ROOM_H = 23; // room size in tiles
  const RW = ROOM_W * TILE, RH = ROOM_H * TILE;
  const KEY_BEST = 'pixelDepths.bestFloor';
  const KEY_MUTE = 'pixelDepths.mute';
  const KEY_WEAPON = 'pixelDepths.weapon';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } },
  };

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const g = ctx;

  // R = screen pixels per game pixel (a whole number, so pixel art stays sharp).
  // We draw at full screen resolution, so things can move by 1 screen pixel. This makes motion smooth.
  let R = 1;
  let viewW = TARGET_W, viewH = 300;
  const snap = (v) => Math.round(v * R) / R;
  let cssToLogical = 1;
  let topPad = 0, bottomPad = 0;

  // ---------- Pixel art ----------
  const PAL = {
    k: '#1a1c2c', w: '#f4f4f4', s: '#f4b48c', b: '#3b5dc9', B: '#41a6f6', c: '#73eff7',
    g: '#38b764', G: '#a7f070', r: '#b13e53', R: '#ef7d57', y: '#ffcd75', p: '#5d275d',
    P: '#a45fb8', e: '#566c86', E: '#94b0c2', o: '#73464b', d: '#333c57',
    // gothic colors
    h: '#4d3a55', D: '#7a1c2c', m: '#a7adbd', n: '#596079',
    z: '#8a9a6b', Z: '#56663f', q: '#5a4636', Q: '#3a2c24', W: '#d8cfb4',
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

  // Dark gothic pixel art (original designs).
  const HERO_TOP = [
    '...kkkk...',
    '..khhhhk..',
    '.khhhhhhk.',
    '.khkkkkhk.',
    '.khykkyhk.',
    '.kDhkkhDk.',
    'kDmmnnmmDk',
    'kDmnmmnmDk',
    'kDkmyymkDk',
    'kDkmnnmkDk',
  ];
  const ZOMBIE_TOP = [
    '...kkkk...',
    '..kzzzzk..',
    '.kzRzzRzk.',
    '.kzzZZzzk.',
    '..kzzzzk..',
    'kzkqqqqkzk',
    'kzkqQqqkzk',
    '.kkqqQqkk.',
    '..kqqqqk..',
    '..kQkkQk..',
  ];
  const DEMON_TOP = [
    '.k..........k.',
    '.kk........kk.',
    '..kRk.kk.kRk..',
    '...kRkrrkRk...',
    '...krrrrrrk...',
    '..krryrryrrk..',
    '..krrrrrrrrk..',
    '.kkrrkwwkrrkk.',
    'krrkrrrrrrkrrk',
    'krrkrDDDDrkrrk',
  ];

  const SPR = {
    heroA: sprite([...HERO_TOP, '..knk.knk.', '..kk...kk.']),
    heroB: sprite([...HERO_TOP, '.knk...knk', '.kk.....kk']),
    // "slime" type = Zombie (slow)
    slimeA: sprite([...ZOMBIE_TOP, '..kZk.kZk.', '..kk...kk.']),
    slimeB: sprite([...ZOMBIE_TOP, '.kZk..kZk.', '.kk....kk.']),
    // "boss" type = Horned Demon
    bossA: sprite([...DEMON_TOP, 'kRkkrrDDrrkkRk', '.k.krrrrrrk.k.', '...krrkkrrk...', '...kkk..kkk...']),
    bossB: sprite([...DEMON_TOP, '.kRkrrDDrrkRk.', '..kkrrrrrrkk..', '...krrkkrrk...', '..kkk....kkk..']),
    // "bat" type = Imp (fast, flying)
    batA: sprite([
      '....k..k....',
      'k..krkkrk..k',
      'kk.krrrrk.kk',
      'krkryrryrkrk',
      'krrrrrrrrrrk',
      '.kkrrRRrrkk.',
      '...krrrrk...',
      '....k..k....',
    ]),
    batB: sprite([
      '....k..k....',
      '...krkkrk...',
      '...krrrrk...',
      '.kkryrryrkk.',
      'krrrrrrrrrrk',
      'krkrrRRrrkrk',
      'kk.krrrrk.kk',
      '....k..k....',
    ]),
    // "skel" type = Skeleton Warrior (old bone, red eyes, rusty blade)
    skel: sprite([
      '..kkkkkk....',
      '.kWWWWWWk...',
      '.kWrWWrWk...',
      '.kWWWWWWk.k.',
      '..kWkkWk.knk',
      '...kWWk..knk',
      '.kkEWWEkkknk',
      'kWkWkkWkWknk',
      'k.kEWWEk.kok',
      '..kWkkWk..k.',
      '..kWk.kWk...',
      '..kk...kk...',
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
    8: '111101111101111', 9: '111101111001111', '!': '010010010000010', '+': '000010111010000',
  };

  // ---------- Themes per floor ----------
  const THEMES = [
    // Dark stone dungeon. Deeper floors get more red.
    { f1: '#3a3333', f2: '#352f2f', sp: '#4a4140', wall: '#1c1718', top: '#5d504c', blood: '#5a1418', bone: '#9c937f' },
    { f1: '#382c2e', f2: '#33282a', sp: '#4a3739', wall: '#1a1214', top: '#634447', blood: '#62131a', bone: '#968a7a' },
    { f1: '#3c2626', f2: '#372323', sp: '#552d2d', wall: '#1c0e0e', top: '#6e3733', blood: '#6c141b', bone: '#9a8673' },
    { f1: '#302a36', f2: '#2c2632', sp: '#433a4e', wall: '#151118', top: '#554763', blood: '#55122a', bone: '#9893a6' },
  ];

  // ---------- Monsters ----------
  const ETYPES = {
    slime: { r: 4, hp: 6, speed: 22, dmg: 1, xp: 1, color: '#7a8a5a' },  // Zombie
    bat: { r: 4, hp: 3, speed: 44, dmg: 1, xp: 1, color: '#b13e53' },    // Imp
    skel: { r: 4, hp: 13, speed: 27, dmg: 2, xp: 2, color: '#d8cfb4' },  // Skeleton Warrior
    boss: { r: 10, hp: 90, speed: 19, dmg: 3, xp: 15, color: '#b13e53' }, // Horned Demon
  };

  // ---------- Weapons ----------
  // Each weapon has its own base stats and 2 unique upgrades.
  // Damage and Attack Speed are in the general list (one name for all weapons).
  const WEAPONS = {
    laser: {
      name: 'Laser Beam', icon: 'L', color: '#ff3d6e', glow: '#ff9fbf', tags: 'LINE · PIERCE',
      desc: 'A hot beam. It hits all monsters in a line.',
      base: { dmg: 6, cd: 1.15, width: 3, beams: 1, len: 1.5 }, minCd: 0.45,
      ups: [
        { name: 'More Beams', desc: 'Fire 1 more beam.', ok: (w) => w.beams < 3, apply: (w) => { w.beams++; } },
        { name: 'Wider Beam', desc: 'The beam is wider.', ok: (w) => w.width < 9, apply: (w) => { w.width += 2; } },
      ],
    },
    lightning: {
      name: 'Chain Lightning', icon: 'Z', color: '#6ff6ff', glow: '#b98cff', tags: 'CHAIN · FAST',
      desc: 'Lightning jumps from monster to monster.',
      base: { dmg: 4, cd: 0.9, chains: 3, jump: 46, forks: 1 }, minCd: 0.35,
      ups: [
        { name: 'More Jumps', desc: 'Lightning jumps 2 more times, farther.', ok: (w) => w.chains < 11, apply: (w) => { w.chains += 2; w.jump = Math.min(90, w.jump * 1.12); } },
        { name: 'More Chains', desc: 'Start 1 more lightning chain.', ok: (w) => w.forks < 3, apply: (w) => { w.forks++; } },
      ],
    },
    blades: {
      name: 'Orbit Blades', icon: 'O', color: '#ffd23f', glow: '#fff4b8', tags: 'CLOSE · ALWAYS ON',
      desc: 'Glowing blades spin around you.',
      base: { dmg: 3, count: 2, radius: 18, spin: 4.2, hitCd: 0.35 },
      ups: [
        { name: 'More Blades', desc: 'Add 1 more blade.', ok: (w) => w.count < 6, apply: (w) => { w.count++; } },
        { name: 'Bigger Orbit', desc: 'Blades spin farther out.', ok: (w) => w.radius < 38, apply: (w) => { w.radius += 5; } },
      ],
    },
    rockets: {
      name: 'Fire Rockets', icon: 'R', color: '#ff8a2a', glow: '#ffd27a', tags: 'AREA · HOMING',
      desc: 'Homing rockets. They explode in an area.',
      base: { dmg: 8, cd: 1.25, count: 1, radius: 22 }, minCd: 0.5,
      ups: [
        { name: 'More Rockets', desc: 'Fire 1 more rocket.', ok: (w) => w.count < 4, apply: (w) => { w.count++; } },
        { name: 'Bigger Explosion', desc: 'Explosions are larger.', ok: (w) => w.radius < 46, apply: (w) => { w.radius += 6; } },
      ],
    },
  };
  const WEAPON_ORDER = ['laser', 'lightning', 'blades', 'rockets'];

  // ---------- Upgrades (for all weapons) ----------
  const UPGRADES = [
    { name: 'Damage', icon: 'D', color: '#ef4b5b', desc: 'Damage +30%.', ok: () => true, apply: (p) => { p.w.dmg *= 1.3; } },
    {
      name: 'Attack Speed', icon: 'A', color: '#ffcd75', desc: 'Attack 20% faster.',
      ok: (p) => (p.weapon === 'blades' ? p.w.spin < 10 : p.w.cd > WEAPONS[p.weapon].minCd),
      apply: (p) => { if (p.weapon === 'blades') { p.w.spin *= 1.2; p.w.hitCd *= 0.85; } else p.w.cd *= 0.8; },
    },
    { name: 'Move Speed', icon: 'S', color: '#73eff7', desc: 'Move 12% faster.', ok: (p) => p.speed < 105, apply: (p) => { p.speed *= 1.12; } },
    { name: 'Max HP', icon: 'H', color: '#ff7a8a', desc: 'Max HP +4. Heal 4 HP.', ok: () => true, apply: (p) => { p.maxHp += 4; p.hp = Math.min(p.maxHp, p.hp + 4); } },
    { name: 'Heal Over Time', icon: '+', color: '#38b764', desc: 'Heal 0.25 HP each second.', ok: (p) => p.regen < 1.5, apply: (p) => { p.regen += 0.25; } },
    { name: 'Pickup Range', icon: 'P', color: '#a7f070', desc: 'Pick up XP from farther.', ok: (p) => p.magnet < 90, apply: (p) => { p.magnet *= 1.5; } },
    { name: 'Attack Range', icon: 'R', color: '#a45fb8', desc: 'Attack range +20%.', ok: (p) => p.weapon !== 'blades' && p.range < 170, apply: (p) => { p.range *= 1.2; } },
  ];

  // ---------- State ----------
  let state = 'title'; // title | play | levelup | paused | dying | over
  let t = 0;
  let floor = 1, kills = 0, pendingLevels = 0, dieT = 0;
  let best = parseInt(store.get(KEY_BEST, '0'), 10) || 0;
  let map, bg, bgCtx, theme, torches = [];
  let p, enemies, pending, rockets, beams, zaps, booms, gems, hearts, parts, texts, stairs, fl;
  let weaponId = store.get(KEY_WEAPON, 'laser');
  if (!WEAPONS[weaponId]) weaponId = 'laser';
  let camX = 0, camY = 0, camBX = 0, camBY = 0, camSnap = true, shake = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (n) => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function makePlayer() {
    return {
      x: RW / 2, y: RH / 2, vx: 0, vy: 0, r: 4, face: 1, moving: false, anim: 0,
      hp: 10, maxHp: 10, speed: 60, cdT: 0.3, charge: 0,
      magnet: 24, regen: 0, range: 100,
      xp: 0, xpNext: 5, level: 1, inv: 0,
      weapon: weaponId, w: Object.assign({}, WEAPONS[weaponId].base), orbA: 0,
    };
  }
  function clearLists() {
    hitfx = []; rings = [];
    enemies = []; pending = []; rockets = []; beams = []; zaps = []; booms = [];
    gems = []; hearts = []; parts = []; texts = [];
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
    // Torches on wall faces (a wall tile with floor under it), not too close together.
    torches = [];
    for (let ty = 0; ty < ROOM_H - 1; ty++) {
      for (let tx = 1; tx < ROOM_W - 1; tx++) {
        if (!solidTile(tx, ty) || solidTile(tx, ty + 1)) continue;
        if (Math.random() > 0.3) continue;
        const x = tx * TILE + 8, y = ty * TILE + 8;
        if (torches.some((o) => Math.hypot(o.x - x, o.y - y) < TILE * 3)) continue;
        torches.push({ x, y, seed: Math.random() * 10 });
      }
    }
    renderRoom();
  }

  function renderRoom() {
    bg = document.createElement('canvas');
    bg.width = RW; bg.height = RH;
    const b = bg.getContext('2d');
    bgCtx = b;
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
          // Cracks
          if (Math.random() < 0.1) {
            b.fillStyle = theme.wall;
            let cx = x + 2 + randi(10), cy = y + 2 + randi(10);
            for (let i = 0; i < 5; i++) { b.fillRect(cx, cy, 1, 1); cx += randi(3) - 1; cy += 1; }
          }
          // Old blood stains
          if (Math.random() < 0.06) {
            b.fillStyle = theme.blood;
            const bx = x + 3 + randi(8), by = y + 3 + randi(8);
            for (let i = 0; i < 9; i++) b.fillRect(bx + randi(6) - 2, by + randi(4) - 1, 1 + randi(2), 1 + randi(2));
          }
          // Bones and skulls
          const rb = Math.random();
          if (rb < 0.05) {
            b.fillStyle = theme.bone;
            const bx = x + 3 + randi(8), by = y + 4 + randi(8);
            if (Math.random() < 0.5) { b.fillRect(bx, by, 5, 1); b.fillRect(bx - 1, by - 1, 1, 3); b.fillRect(bx + 5, by - 1, 1, 3); }
            else { b.fillRect(bx, by, 1, 5); b.fillRect(bx - 1, by - 1, 3, 1); b.fillRect(bx - 1, by + 5, 3, 1); }
          } else if (rb < 0.065) {
            const bx = x + 4 + randi(7), by = y + 4 + randi(7);
            b.fillStyle = theme.bone; b.fillRect(bx, by, 4, 3); b.fillRect(bx + 1, by + 3, 2, 1);
            b.fillStyle = PAL.k; b.fillRect(bx + 1, by + 1, 1, 1); b.fillRect(bx + 3, by + 1, 1, 1);
          }
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
    if (floor > best) {
      best = floor; store.set(KEY_BEST, best);
      if (window.PD_CLOUD) window.PD_CLOUD.saveBest(best);
    }
    sfx.stairs();
    p.x = RW / 2; p.y = RH / 2; p.vx = 0; p.vy = 0;
    camSnap = true;
    p.hp = Math.min(p.maxHp, p.hp + 2);
    clearLists();
    stairs = null;
    genRoom();
    startFloor();
  }

  function newGame() {
    floor = 1; kills = 0; pendingLevels = 0;
    p = makePlayer();
    camSnap = true;
    clearLists();
    stairs = null;
    genRoom();
  }

  // ---------- Combat ----------
  function nearestFrom(x, y, range, skip) {
    let bestE = null, bd = range * range;
    for (const e of enemies) {
      if (e.dead || (skip && skip.has(e))) continue;
      const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; bestE = e; }
    }
    return bestE;
  }
  const nearestEnemy = (range) => nearestFrom(p.x, p.y, range);
  const wDmg = () => p.w.dmg;

  // Add a glowing spark (drawn with light blending).
  function spark(x, y, color, n, spd = 60, life = 0.35, size = 1.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rand(0.3, 1) * spd, l = rand(0.5, 1) * life;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, color, add: true, size });
    }
  }
  function smoke(x, y, n = 1, size = 1.5, grow = 5) {
    for (let i = 0; i < n; i++) {
      const l = rand(0.4, 0.7);
      parts.push({ x, y, vx: rand(-8, 8), vy: rand(-12, 2), life: l, max: l, smoke: true, size, grow });
    }
  }

  function updateWeapon(dt) {
    if (p.weapon === 'blades') { updateBlades(dt); return; }
    p.cdT -= dt;
    const tg = nearestEnemy(p.range);
    const W = WEAPONS[p.weapon];
    // Charge-up: energy flows into the hero just before the attack.
    const CH = Math.min(0.32, p.w.cd * 0.6);
    p.charge = tg && p.cdT < CH ? 1 - Math.max(0, p.cdT) / CH : 0;
    if (p.charge > 0 && Math.random() < 0.8) {
      const a = Math.random() * 6.283, r0 = rand(13, 18);
      parts.push({ x: p.x + Math.cos(a) * r0, y: p.y - 2 + Math.sin(a) * r0, vx: -Math.cos(a) * r0 * 5, vy: -Math.sin(a) * r0 * 5, life: 0.18, max: 0.18, color: W.glow, add: true, size: 1.3 });
    }
    if (p.cdT > 0 || !tg) return;
    p.cdT = p.w.cd;
    p.charge = 0;
    p.face = tg.x < p.x ? -1 : 1;
    // Energy burst (sparks only, no ring)
    spark(p.x, p.y - 2, W.glow, 8, 90, 0.3, 1.6);
    if (p.weapon === 'laser') fireLaser(tg);
    else if (p.weapon === 'lightning') fireLightning(tg);
    else fireRockets(tg);
  }

  // ----- Laser -----
  function rayLen(x, y, dx, dy, max) {
    for (let d = 2; d < max; d += 2) {
      if (solidTile(Math.floor((x + dx * d) / TILE), Math.floor((y + dy * d) / TILE))) return d;
    }
    return max;
  }
  function fireLaser(tg) {
    const w = p.w, ox = p.x, oy = p.y - 2;
    const base = Math.atan2(tg.y - oy, tg.x - ox);
    for (let i = 0; i < w.beams; i++) {
      const a = base + (i - (w.beams - 1) / 2) * 0.32;
      const dx = Math.cos(a), dy = Math.sin(a);
      const len = rayLen(ox, oy, dx, dy, p.range * w.len);
      beams.push({ x: ox, y: oy, dx, dy, len, width: w.width, life: 0.4, max: 0.4, ticks: 2, tickT: 0 });
      spark(ox + dx * len, oy + dy * len, WEAPONS.laser.glow, 6, 50);
    }
    shake = Math.max(shake, 1.2);
    sfx.laser();
  }
  function updateBeams(dt) {
    const col = WEAPONS.laser;
    for (const b of beams) {
      b.life -= dt;
      b.tickT -= dt;
      // Follow the hero, so the beam stays on the gun.
      b.x = p.x; b.y = p.y - 2;
      if (b.ticks > 0 && b.tickT <= 0) {
        b.ticks--; b.tickT = 0.15;
        for (const e of enemies) {
          if (e.dead) continue;
          const rx = e.x - b.x, ry = e.y - b.y;
          const along = rx * b.dx + ry * b.dy;
          if (along < -e.r || along > b.len + e.r) continue;
          const perp = Math.abs(-rx * b.dy + ry * b.dx);
          if (perp < b.width / 2 + e.r) {
            hurtEnemy(e, wDmg() * 0.6, b.dx, b.dy, 0.4);
            spark(e.x, e.y, col.glow, 5, 70);
          }
        }
      }
      if (Math.random() < 0.6) spark(b.x + b.dx * b.len, b.y + b.dy * b.len, col.color, 1, 40, 0.25);
    }
    beams = beams.filter((b) => b.life > 0);
  }

  // ----- Chain lightning -----
  function fireLightning(tg) {
    const w = p.w, used = new Set();
    const starts = [tg];
    for (let i = 1; i < w.forks; i++) {
      const extra = nearestFrom(p.x, p.y, p.range, new Set(starts));
      if (extra) starts.push(extra);
    }
    for (const st of starts) {
      const pts = [{ x: p.x, y: p.y - 3 }];
      let cur = st, n = 0, prev = pts[0];
      while (cur && n <= w.chains) {
        used.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        const dx = cur.x - prev.x, dy = cur.y - prev.y, d = Math.hypot(dx, dy) || 1;
        const cx = cur.x, cy = cur.y;
        hurtEnemy(cur, wDmg() * Math.pow(0.9, n), dx / d, dy / d, 0.3);
        spark(cx, cy, WEAPONS.lightning.color, 5, 70, 0.3);
        prev = { x: cx, y: cy };
        cur = nearestFrom(cx, cy, w.jump, used);
        n++;
      }
      // Make the zigzag shape once, so the bolt does not flicker.
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const main = jag(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 3);
        let branch = null;
        if (Math.random() < 0.5) { const m = main[randi(main.length)]; branch = jag(m.x, m.y, m.x + rand(-9, 9), m.y + rand(-9, 9), 2); }
        segs.push({ main, branch });
      }
      zaps.push({ pts, segs, life: 0.28, max: 0.28 });
    }
    shake = Math.max(shake, 1);
    sfx.zap();
  }
  function updateZaps(dt) {
    for (const z of zaps) z.life -= dt;
    zaps = zaps.filter((z) => z.life > 0);
  }

  // ----- Orbit blades -----
  function bladePos(i) {
    const w = p.w, a = p.orbA + (i * Math.PI * 2) / w.count;
    return { a, x: p.x + Math.cos(a) * w.radius, y: p.y - 2 + Math.sin(a) * w.radius };
  }
  function updateBlades(dt) {
    const w = p.w;
    p.orbA += w.spin * dt;
    for (let i = 0; i < w.count; i++) {
      const b = bladePos(i);
      for (const e of enemies) {
        if (e.dead || t < (e.bladeT || 0)) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + 3) * (e.r + 3)) {
          const ox = e.x - p.x, oy = e.y - p.y, d = Math.hypot(ox, oy) || 1;
          e.bladeT = t + w.hitCd;
          hurtEnemy(e, wDmg(), ox / d, oy / d, 0.8);
          spark(b.x, b.y, WEAPONS.blades.glow, 5, 60, 0.25);
          sfx.blade();
        }
      }
    }
  }

  // ----- Fire rockets -----
  function fireRockets(tg) {
    const w = p.w;
    const base = Math.atan2(tg.y - p.y, tg.x - p.x);
    for (let i = 0; i < w.count; i++) {
      const a = base + (i - (w.count - 1) / 2) * 0.55 + rand(-0.1, 0.1);
      rockets.push({ x: p.x, y: p.y - 2, a, sp: 35, tg, life: 2.2, smokeT: 0 });
    }
    sfx.launch();
  }
  function explode(x, y) {
    const w = p.w, r = w.radius;
    let nHit = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d < r + e.r) { hurtEnemy(e, wDmg(), dx / (d || 1), dy / (d || 1), 1.3); nHit++; }
    }
    ring(x, y, 4, r * 1.3, '#ffd27a', 0.35, 2.5);
    booms.push({ x, y, r, life: 0.45, max: 0.45 });
    spark(x, y, '#ffd27a', 14, 110, 0.45, 2);
    spark(x, y, '#ff6a1a', 10, 70, 0.5, 2);
    smoke(x, y, 6, 3, 9);
    shake = Math.max(shake, 2.5);
    sfx.boom();
  }
  function updateRockets(dt) {
    for (const r of rockets) {
      if (!r.tg || r.tg.dead) r.tg = nearestFrom(r.x, r.y, 110);
      if (r.tg) {
        // Turn softly to the target.
        const want = Math.atan2(r.tg.y - r.y, r.tg.x - r.x);
        let da = want - r.a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        r.a += clamp(da, -5 * dt, 5 * dt);
      }
      r.sp = Math.min(175, r.sp + 280 * dt);
      r.x += Math.cos(r.a) * r.sp * dt;
      r.y += Math.sin(r.a) * r.sp * dt;
      r.life -= dt;
      r.smokeT -= dt;
      if (r.smokeT <= 0) {
        r.smokeT = 0.018;
        smoke(r.x - Math.cos(r.a) * 3, r.y - Math.sin(r.a) * 3, 1, 1.2, 4);
        spark(r.x - Math.cos(r.a) * 3, r.y - Math.sin(r.a) * 3, '#ff8a2a', 1, 20, 0.15, 1.5);
      }
      let hit = r.life <= 0 || solidTile(Math.floor(r.x / TILE), Math.floor(r.y / TILE));
      if (!hit) {
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - r.x, dy = e.y - r.y;
          if (dx * dx + dy * dy < (e.r + 2) * (e.r + 2)) { hit = true; break; }
        }
      }
      if (hit) { r.dead = true; explode(r.x, r.y); }
    }
    rockets = rockets.filter((r) => !r.dead);
    for (const b of booms) b.life -= dt;
    booms = booms.filter((b) => b.life > 0);
  }

  function updateWeaponFx(dt) {
    updateBeams(dt);
    updateZaps(dt);
    updateRockets(dt);
  }

  function burst(x, y, color, n, spd = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rand(0.3, 1) * spd;
      const life = rand(0.25, 0.55);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color });
    }
  }

  function hurtEnemy(e, dmg, dirX, dirY, kbMul = 1) {
    if (e.dead) return;
    const crit = Math.random() < CRIT_CHANCE;
    if (crit) dmg *= 2;
    e.hp -= dmg;
    e.flash = crit ? 0.16 : 0.1;
    const kb = (e.type === 'boss' ? 25 : 90) * kbMul * (crit ? 1.6 : 1);
    e.kx += dirX * kb; e.ky += dirY * kb;
    const W = WEAPONS[p.weapon];
    hitSpark(e.x, e.y - 1, dirX, dirY, W.color, crit);
    addNum(e.x + rand(-2, 2), e.y - 8, String(Math.max(1, Math.round(dmg))) + (crit ? '!' : ''), crit ? 'crit' : 'hit');
    if (crit) { ring(e.x, e.y, 2, 16, '#ffffff', 0.25, 1.5); shake = Math.max(shake, 1.5); sfx.crit(); } else sfx.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    kills++;
    burst(e.x, e.y, ETYPES[e.type].color, e.type === 'boss' ? 30 : 9, e.type === 'boss' ? 80 : 50);
    burst(e.x, e.y, '#6b0f1a', e.type === 'boss' ? 20 : 6, 60);
    stampBlood(e.x, e.y, e.type === 'boss');
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
    // Ease the speed to the joystick value: soft but fast start and stop.
    // Instant control: the hero moves and stops with the finger.
    p.vx = mx * p.speed;
    p.vy = my * p.speed;
    const ox = p.x, oy = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    collide(p);
    // Do not keep speed into a wall.
    if (dt > 0) { p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt; }
    const sp = Math.hypot(p.vx, p.vy);
    p.moving = sp > 4;
    if (p.moving) p.anim += dt * Math.min(1, sp / p.speed);
    if (mx < -0.1) p.face = -1; else if (mx > 0.1) p.face = 1;
    if (p.inv > 0) p.inv -= dt;
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Weapon (attacks automatically)
    updateWeapon(dt);

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

    updateWeaponFx(dt);
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
        addNum(p.x, p.y - 10, '+3', 'heal');
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
    const drag = Math.exp(-6 * dt);
    for (const q of parts) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= drag; q.vy *= drag; q.life -= dt;
    }
    parts = parts.filter((q) => q.life > 0);
    for (const x of texts) {
      x.vy += 170 * dt; x.vx *= Math.exp(-3 * dt);
      x.x += x.vx * dt; x.y += x.vy * dt; x.life -= dt;
    }
    updateAnimeFx(dt);
    texts = texts.filter((x) => x.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 20);
  }

  // ---------- Render ----------
  function drawSpr(s, x, y, flip, white, k = 1) {
    const w = s.w * k, h = s.h * k;
    const dx = snap(x - camX - w / 2), dy = snap(y - camY - h / 2);
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
    g.fillRect(snap(x - camX - w / 2), snap(y - camY), w, 2);
  }

  // Big pixel numbers: they pop in, fly up, then fall.
  function drawNum(str, x, y, col, sc, alpha) {
    const w = (str.length * 4 - 1) * sc;
    const ox = x - camX - w / 2, oy = y - camY;
    const o = Math.max(0.6, sc * 0.45);
    g.globalAlpha = alpha;
    for (let pass = 0; pass < 2; pass++) {
      g.fillStyle = pass ? col : PAL.k;
      for (let c = 0; c < str.length; c++) {
        const bits = DIG[str[c]];
        if (!bits) continue;
        for (let i = 0; i < 15; i++) {
          if (bits[i] !== '1') continue;
          const px = ox + (c * 4 + (i % 3)) * sc, py = oy + Math.floor(i / 3) * sc;
          if (pass) g.fillRect(px, py, sc, sc);
          else g.fillRect(px - o, py - o, sc + o * 2, sc + o * 2);
        }
      }
    }
    g.globalAlpha = 1;
  }


  function updateCamera(dt) {
    let tx = p.x - viewW / 2;
    let ty = p.y - (viewH - bottomPad + topPad) / 2;
    const minX = 0, maxX = RW - viewW;
    tx = minX > maxX ? (minX + maxX) / 2 : clamp(tx, minX, maxX);
    const minY = -topPad, maxY = RH - viewH + bottomPad;
    ty = minY > maxY ? (minY + maxY) / 2 : clamp(ty, minY, maxY);
    // The camera locks to the hero, so the hero stays still on the screen
    // and only the world moves. (A delayed camera feels like dragging.)
    camBX = tx; camBY = ty; camSnap = false;
    camX = camBX; camY = camBY;
    if (shake > 0) { camX += rand(-shake, shake); camY += rand(-shake, shake); }
    camX = snap(camX); camY = snap(camY);
  }

  // ---------- Glow effects ----------
  // "lighter" blending adds light: overlaps get brighter, like real glow.
  function glow(x, y, r, color, alpha) {
    if (r <= 0 || alpha <= 0) return;
    const sx = x - camX, sy = y - camY;
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, alpha);
    g.fillStyle = gr;
    g.fillRect(sx - r, sy - r, r * 2, r * 2);
    g.restore();
  }

  // Draw a line in some layers: wide and faint outside, thin and white in the core.
  function glowLine(pts, width, color, alpha) {
    const layers = [[3.2, color, 0.14], [1.8, color, 0.35], [1, color, 0.9], [0.35, '#ffffff', 1]];
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [k, c, a] of layers) {
      g.globalAlpha = Math.min(1, a * alpha);
      g.strokeStyle = c;
      g.lineWidth = Math.max(0.3, width * k);
      g.beginPath();
      g.moveTo(pts[0].x - camX, pts[0].y - camY);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x - camX, pts[i].y - camY);
      g.stroke();
    }
    g.restore();
  }

  // A zigzag line between two points (new shape each frame, so it flickers).
  function jag(x0, y0, x1, y1, amp) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    const n = Math.max(2, Math.round(d / 6));
    const pts = [{ x: x0, y: y0 }];
    for (let i = 1; i < n; i++) {
      const f = i / n, o = rand(-amp, amp);
      pts.push({ x: x0 + dx * f + nx * o, y: y0 + dy * f + ny * o });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
  }

  function drawParticles(additive) {
    if (additive) { g.save(); g.globalCompositeOperation = 'lighter'; }
    for (const q of parts) {
      if (!!q.add !== additive) continue;
      const k = q.max ? q.life / q.max : 1;
      if (q.smoke) {
        g.globalAlpha = 0.28 * k;
        g.fillStyle = '#8a8fa6';
        const r = q.size + (1 - k) * q.grow;
        g.beginPath(); g.arc(q.x - camX, q.y - camY, r, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      } else if (q.add) {
        g.globalAlpha = k;
        g.fillStyle = q.color;
        const s = q.size * (0.4 + 0.6 * k);
        g.fillRect(q.x - camX - s / 2, q.y - camY - s / 2, s, s);
      } else {
        g.fillStyle = q.color;
        const s = q.life > 0.3 ? 2 : 1;
        g.fillRect(snap(q.x - camX), snap(q.y - camY), s, s);
      }
    }
    g.globalAlpha = 1;
    if (additive) g.restore();
  }

  function drawWeaponFx() {
    // Laser beams
    const L = WEAPONS.laser;
    for (const b of beams) {
      const k = b.life / b.max;
      const wdt = b.width * (0.35 + 0.65 * k);
      const x1 = b.x + b.dx * b.len, y1 = b.y + b.dy * b.len;
      glowLine([{ x: b.x, y: b.y }, { x: x1, y: y1 }], wdt, L.color, Math.min(1, k * 1.6));
      glow(b.x, b.y, 6 + wdt * 2, L.glow, k);
      glow(x1, y1, 5 + wdt * 2, L.color, k);
    }

    // Lightning
    const Z = WEAPONS.lightning;
    for (const z of zaps) {
      const k = z.life / z.max;
      for (let i = 0; i < z.segs.length; i++) {
        const sg = z.segs[i], b = z.pts[i + 1];
        glowLine(sg.main, 1.6, Z.glow, k * 0.8);
        glowLine(sg.main, 1.1, Z.color, k);
        if (sg.branch) glowLine(sg.branch, 0.7, Z.color, k * 0.8);
        glow(b.x, b.y, 9, Z.color, k * 0.9);
      }
      glow(z.pts[0].x, z.pts[0].y, 8, Z.glow, k);
    }

    // Orbit blades
    if (p && p.weapon === 'blades' && state !== 'dying' && state !== 'over') {
      const B = WEAPONS.blades, w = p.w;
      // faint orbit ring
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.08;
      g.strokeStyle = B.color;
      g.lineWidth = 1;
      g.beginPath(); g.arc(p.x - camX, p.y - 2 - camY, w.radius, 0, Math.PI * 2); g.stroke();
      g.restore();
      const dir = 1;
      for (let i = 0; i < w.count; i++) {
        const bp = bladePos(i);
        // Light trail behind the blade
        const trail = [];
        const steps = 10, span = 0.9;
        for (let j = 0; j <= steps; j++) {
          const a = bp.a - dir * span * (j / steps);
          trail.push({ x: p.x + Math.cos(a) * w.radius, y: p.y - 2 + Math.sin(a) * w.radius });
        }
        for (let j = 0; j < steps; j++) {
          const f = 1 - j / steps;
          glowLine([trail[j], trail[j + 1]], 2.2 * f, B.color, 0.55 * f);
        }
        glow(bp.x, bp.y, 8, B.glow, 0.7);
        // Blade body: a spinning diamond
        g.save();
        g.translate(bp.x - camX, bp.y - camY);
        g.rotate(t * 14 + i);
        g.fillStyle = B.color;
        g.beginPath(); g.moveTo(0, -4); g.lineTo(1.6, 0); g.lineTo(0, 4); g.lineTo(-1.6, 0); g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(0, -2.5); g.lineTo(0.7, 0); g.lineTo(0, 2.5); g.lineTo(-0.7, 0); g.closePath(); g.fill();
        g.restore();
      }
    }

    // Rockets
    for (const r of rockets) {
      const fl = rand(0.7, 1.2);
      glow(r.x - Math.cos(r.a) * 3, r.y - Math.sin(r.a) * 3, 7 * fl, '#ff8a2a', 0.9);
      g.save();
      g.translate(r.x - camX, r.y - camY);
      g.rotate(r.a);
      g.fillStyle = PAL.k; g.fillRect(-3.5, -1.5, 7, 3);
      g.fillStyle = '#c2c3c7'; g.fillRect(-3, -1, 5, 2);
      g.fillStyle = '#ef4b5b'; g.fillRect(1.5, -1, 1.5, 2);
      g.fillStyle = '#ffd27a'; g.fillRect(-4.5 - fl, -0.6, 1.5 + fl, 1.2);
      g.restore();
    }

    // Explosions
    for (const b of booms) {
      const k = b.life / b.max, e = 1 - k;
      const ease = 1 - Math.pow(1 - e, 3);
      glow(b.x, b.y, b.r * (0.5 + 0.7 * ease), '#ff8a2a', k * 1.2);
      glow(b.x, b.y, b.r * (0.3 + 0.4 * ease), '#ffd27a', k);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = k;
      g.strokeStyle = '#ffd27a';
      g.lineWidth = 2.5 * k + 0.3;
      g.beginPath(); g.arc(b.x - camX, b.y - camY, b.r * ease, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  // ---------- Anime hit effects ----------
  // Star sparks and slash arcs on hits, small rings at hit points. No full-screen flashes (photosensitive safety).
  let hitfx = [], rings = [];
  const CRIT_CHANCE = 0.15;

  function addNum(x, y, val, kind) {
    if (texts.length > 50) texts.shift();
    const life = kind === 'crit' ? 0.95 : 0.75;
    texts.push({ x, y, val, kind, vx: rand(-28, 28), vy: kind === 'crit' ? -78 : -58, life, max: life });
  }
  function hitSpark(x, y, dx, dy, color, big) {
    if (hitfx.length > 90) hitfx.splice(0, 10);
    const sl = big ? 0.22 : 0.16;
    hitfx.push({ type: 'star', x, y, a: Math.random() * Math.PI, n: big ? 6 : 4, size: big ? 15 : 9, color, life: sl, max: sl });
    hitfx.push({ type: 'slash', x, y, a: Math.atan2(dy, dx) + rand(-0.6, 0.6), size: big ? 13 : 9, color, life: 0.2, max: 0.2 });
  }
  function ring(x, y, r0, r1, color, life = 0.3, width = 2) {
    rings.push({ x, y, r0, r1, color, width, life, max: life });
  }
  function updateAnimeFx(dt) {
    for (const f of hitfx) f.life -= dt;
    hitfx = hitfx.filter((f) => f.life > 0);
    for (const r of rings) r.life -= dt;
    rings = rings.filter((r) => r.life > 0);
  }

  function drawAnimeFx() {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const f of hitfx) {
      const k = f.life / f.max, e = 1 - k;
      const sx = f.x - camX, sy = f.y - camY;
      if (f.type === 'star') {
        // Sharp spikes: long and short, fast out, then thin.
        const len = f.size * (0.55 + 0.45 * (1 - Math.pow(1 - e, 3)));
        for (let pass = 0; pass < 2; pass++) {
          g.fillStyle = pass ? '#ffffff' : f.color;
          g.globalAlpha = pass ? k : k * 0.8;
          const wd = (pass ? 0.9 : 1.8) * (0.3 + k);
          for (let i = 0; i < f.n * 2; i++) {
            const a = f.a + (i * Math.PI) / f.n;
            const l = (i % 2 ? 0.45 : 1) * len * (pass ? 0.85 : 1);
            const ca = Math.cos(a), sa = Math.sin(a);
            g.beginPath();
            g.moveTo(sx + ca * l, sy + sa * l);
            g.lineTo(sx - sa * wd, sy + ca * wd);
            g.lineTo(sx + sa * wd, sy - ca * wd);
            g.closePath();
            g.fill();
          }
        }
      } else {
        // Crescent slash through the hit point.
        const r = f.size * (0.7 + 0.5 * e);
        const cx = sx - Math.cos(f.a) * r * 0.75, cy = sy - Math.sin(f.a) * r * 0.75;
        const a1 = f.a - 1.15, a2 = f.a + 1.15;
        const ox = Math.cos(f.a) * r * 0.22, oy = Math.sin(f.a) * r * 0.22;
        for (let pass = 0; pass < 2; pass++) {
          g.globalAlpha = pass ? k : k * 0.7;
          g.fillStyle = pass ? '#ffffff' : f.color;
          const rr = pass ? r * 0.96 : r * 1.05;
          g.beginPath();
          g.arc(cx, cy, rr, a1, a2);
          g.arc(cx - ox, cy - oy, rr * 0.92, a2, a1, true);
          g.closePath();
          g.fill();
        }
      }
    }
    for (const r of rings) {
      const k = r.life / r.max, e = 1 - Math.pow(k, 3);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      g.globalAlpha = k;
      g.strokeStyle = r.color; g.lineWidth = r.width * (0.4 + k) * 1.8;
      g.beginPath(); g.arc(r.x - camX, r.y - camY, rad, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = r.width * (0.3 + k) * 0.7;
      g.beginPath(); g.arc(r.x - camX, r.y - camY, rad, 0, Math.PI * 2); g.stroke();
    }
    g.restore();

    // Charge-up: a small light on the hero before an attack (no ring).
    if (p && p.charge > 0 && state === 'play') {
      const W = WEAPONS[p.weapon], c = p.charge;
      glow(p.x, p.y - 2, 3 + 4 * c, W.glow, 0.3 + 0.5 * c);
    }
  }



  // ---------- Torches and light ----------
  // The dungeon is dark. Light shows only around the hero, torches, and weapon effects.
  const lightC = document.createElement('canvas');
  const lg = lightC.getContext('2d');
  const lights = [];
  function addLight(x, y, r, a = 1) { lights.push(x, y, r, a); }

  function collectLights() {
    const fl1 = 1 + Math.sin(t * 9) * 0.03 + Math.sin(t * 23) * 0.02;
    if (p && state !== 'over') addLight(p.x, p.y - 2, 92 * fl1, state === 'dying' ? Math.max(0, dieT) : 1);
    for (const tc of torches) addLight(tc.x, tc.y + 4, 48 * (1 + Math.sin(t * 11 + tc.seed) * 0.05), 0.95);
    if (stairs) addLight(stairs.x, stairs.y, 30, 0.9);
    for (const s of pending) addLight(s.x, s.y, 12, 0.6);
    for (const gm of gems) addLight(gm.x, gm.y, 9, 0.7);
    for (const h of hearts) addLight(h.x, h.y, 11, 0.8);
    for (const b of beams) {
      const k = b.life / b.max;
      for (let d = 0; d <= b.len; d += 24) addLight(b.x + b.dx * d, b.y + b.dy * d, 30, k);
    }
    for (const z of zaps) { const k = z.life / z.max; for (const q of z.pts) addLight(q.x, q.y, 28, k); }
    for (const r of rockets) addLight(r.x, r.y, 22, 0.9);
    for (const b of booms) addLight(b.x, b.y, b.r * 2.4, b.life / b.max);
    if (p && p.weapon === 'blades' && state !== 'dying' && state !== 'over') {
      for (let i = 0; i < p.w.count; i++) { const bp = bladePos(i); addLight(bp.x, bp.y, 16, 0.7); }
    }
  }

  function drawDarkness() {
    collectLights();
    const w = Math.ceil(viewW), h = Math.ceil(viewH);
    if (lightC.width !== w || lightC.height !== h) { lightC.width = w; lightC.height = h; }
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, w, h);
    lg.fillStyle = 'rgba(4, 2, 6, 0.8)';
    lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < lights.length; i += 4) {
      const x = lights[i] - camX, y = lights[i + 1] - camY, r = lights[i + 2], a = Math.min(1, lights[i + 3]);
      if (r <= 0 || a <= 0 || x < -r || y < -r || x > w + r || y > h + r) continue;
      const gr = lg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.5, `rgba(0,0,0,${a * 0.7})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr;
      lg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    lights.length = 0;
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(lightC, 0, 0, w, h);
    g.restore();
  }

  // Torch bracket (drawn before the darkness) and flame (drawn after, so it is bright).
  function drawTorchBrackets() {
    for (const tc of torches) {
      const x = snap(tc.x - camX), y = snap(tc.y - camY);
      g.fillStyle = PAL.k; g.fillRect(x - 1.5, y + 1, 3, 5);
      g.fillStyle = '#5a4428'; g.fillRect(x - 1, y + 1, 2, 4);
    }
  }
  function drawTorchFlames() {
    for (const tc of torches) {
      const f = Math.floor(t * 10 + tc.seed) % 3;
      const x = tc.x - camX, y = tc.y - camY;
      glow(tc.x, tc.y - 1, 16 + f, '#ff7a1a', 0.45);
      g.fillStyle = '#ef7d57'; g.fillRect(x - 1.5, y - 3 - (f === 1 ? 1 : 0), 3, 4);
      g.fillStyle = '#ffcd75'; g.fillRect(x - 1, y - 2 - (f === 2 ? 1 : 0), 2, 3);
      g.fillStyle = '#ffffff'; g.fillRect(x - 0.5, y - 1, 1, 1);
    }
  }

  // Blood on the floor where a monster dies (stays for the floor).
  function stampBlood(x, y, big) {
    if (!bgCtx) return;
    bgCtx.fillStyle = theme.blood;
    const n = big ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, d = Math.random() * (big ? 9 : 4);
      const s = 1 + randi(big ? 3 : 2);
      bgCtx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + 2 + Math.sin(a) * d * 0.6), s, s);
    }
  }

  function render(dt) {
    updateCamera(dt);
    g.setTransform(R, 0, 0, R, 0, 0);
    g.fillStyle = '#050304';
    g.fillRect(0, 0, viewW, viewH);
    g.drawImage(bg, -camX, -camY);

    // Stairs
    if (stairs) {
      const x = snap(stairs.x - 8 - camX), y = snap(stairs.y - 8 - camY);
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
    for (const h of hearts) drawSpr(SPR.heart, h.x, h.y + Math.sin(t * 4), false, false);
    for (const gm of gems) drawSpr(gm.v > 1 ? SPR.gemBig : SPR.gem, gm.x, gm.y, false, false);

    // Soft light of the weapon color under the hero
    if (state !== 'dying' && state !== 'over') glow(p.x, p.y, 16, WEAPONS[p.weapon].color, 0.16 + 0.04 * Math.sin(t * 5));

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
        shadow(e.x, e.y + 12, 22);
        drawSpr(fast ? SPR.bossB : SPR.bossA, e.x, e.y, false, white, 2);
        const bw = 24, bx = snap(e.x - camX - bw / 2), by = snap(e.y - camY - 19);
        g.fillStyle = PAL.k; g.fillRect(bx - 1, by - 1, bw + 2, 4);
        g.fillStyle = '#ef4b5b'; g.fillRect(bx, by, Math.max(0, Math.round(bw * e.hp / e.maxHp)), 2);
      }
    }

    drawParticles(false);
    drawTorchBrackets();
    drawDarkness();
    drawTorchFlames();
    drawWeaponFx();
    drawParticles(true);
    drawAnimeFx();
    for (const x of texts) {
      const age = 1 - x.life / x.max;
      const base = x.kind === 'crit' ? 2 : 1.3;
      const sc = base * (1 + 0.9 * Math.max(0, 1 - age / 0.14));
      const col = x.kind === 'crit' ? '#ffcd75' : x.kind === 'heal' ? '#a7f070' : '#ffffff';
      drawNum(x.val, x.x, x.y, col, sc, Math.min(1, x.life / 0.2));
    }

    // Arrow to stairs when they are off screen
    if (stairs && state === 'play') {
      const sx = stairs.x - camX, sy = stairs.y - camY;
      const top = topPad + 4, bottom = viewH - bottomPad - 4;
      if (sx < 0 || sx > viewW || sy < top || sy > bottom) {
        const cx = viewW / 2, cy = (top + bottom) / 2;
        const a = Math.atan2(sy - cy, sx - cx);
        const ax = clamp(cx + Math.cos(a) * 200, 8, viewW - 8);
        const ay = clamp(cy + Math.sin(a) * 200, top + 4, bottom - 4);
        g.save();
        g.translate(snap(ax), snap(ay));
        g.rotate(a);
        g.fillStyle = Math.floor(t * 4) % 2 ? PAL.y : PAL.R;
        g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill();
        g.restore();
      }
    }

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

  function openWeaponSelect() {
    unlockAudio();
    const cloud = window.PD_CLOUD;
    if (cloud && cloud.required && !cloud.user) { cloud.showLogin(); return; }
    state = 'title';
    hide('scrTitle'); hide('scrOver'); hide('scrPause');
    const box = $('weaponCards');
    box.innerHTML = '';
    for (const id of WEAPON_ORDER) {
      const W = WEAPONS[id];
      const btn = document.createElement('button');
      btn.className = 'card weapon' + (id === weaponId ? ' last' : '');
      btn.style.setProperty('--wc', W.color);
      btn.style.setProperty('--wg', W.glow);
      const ico = document.createElement('span');
      ico.className = 'ico'; ico.textContent = W.icon;
      const txt = document.createElement('span');
      const name = document.createElement('b'); name.textContent = W.name;
      const desc = document.createElement('small'); desc.textContent = W.desc;
      const tags = document.createElement('i'); tags.textContent = W.tags;
      txt.append(name, document.createElement('br'), desc, document.createElement('br'), tags);
      btn.append(ico, txt);
      btn.addEventListener('click', () => {
        weaponId = id;
        store.set(KEY_WEAPON, id);
        startGame();
      });
      box.appendChild(btn);
    }
    show('scrWeapon');
  }

  function startGame() {
    unlockAudio();
    hide('scrWeapon');
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
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = randi(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const W = WEAPONS[p.weapon];
    const wPool = shuffle(W.ups.filter((u) => u.ok(p.w)).map((u) => ({
      name: u.name, desc: u.desc, icon: W.icon, color: W.color, weapon: true, apply: () => u.apply(p.w),
    })));
    const gPool = UPGRADES.filter((u) => u.ok(p)).map((u) => ({ ...u, apply: () => u.apply(p) }));
    // Always give at least 1 weapon upgrade (when one is available).
    const picks = wPool.slice(0, 1);
    const rest = shuffle([...wPool.slice(1), ...gPool]);
    while (picks.length < 3 && rest.length) picks.push(rest.pop());
    shuffle(picks);
    const cards = $('cards');
    cards.innerHTML = '';
    for (const u of picks) {
      const btn = document.createElement('button');
      btn.className = 'card' + (u.weapon ? ' weapon' : '');
      if (u.weapon) { btn.style.setProperty('--wc', W.color); btn.style.setProperty('--wg', W.glow); }
      btn.disabled = true;
      const ico = document.createElement('span');
      ico.className = 'ico'; ico.style.background = u.color; ico.textContent = u.icon;
      const txt = document.createElement('span');
      const name = document.createElement('b'); name.textContent = u.name;
      const desc = document.createElement('small'); desc.textContent = u.desc;
      txt.append(name, document.createElement('br'), desc);
      btn.append(ico, txt);
      btn.addEventListener('click', () => {
        u.apply();
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
    $('ovWeapon').textContent = WEAPONS[p.weapon].name;
    $('newBest').classList.toggle('hidden', !isNew);
    hide('hud'); hide('stick');
    show('scrOver');
    cloudSaveRun($('ovSave'));
  }

  // Save the run to the player's account (when login is on).
  function cloudSaveRun(el) {
    const cloud = window.PD_CLOUD;
    if (el) el.textContent = '';
    if (!cloud || !cloud.user) return;
    if (el) el.textContent = 'SAVING...';
    cloud.saveRun({ floor, level: p.level, kills, weapon: p.weapon }).then((r) => {
      if (el) el.textContent = r === 'ok' ? 'SAVED TO YOUR ACCOUNT' : r === 'fail' ? 'SAVE FAILED. CHECK INTERNET.' : '';
    });
  }

  function toTitle() {
    state = 'title';
    hide('scrPause'); hide('scrOver'); hide('hud'); hide('stick');
    $('titleBest').textContent = best;
    show('scrTitle');
  }

  // ---------- Input: fixed joystick (bottom middle) ----------
  // The knob sets only the direction. There is no dead zone: any push gives
  // full speed. The hero stops only when you lift your finger.
  const input = { x: 0, y: 0, id: null };
  const stick = $('stick'), knob = $('knob'), zone = $('touchZone');

  const stickC = { x: 0, y: 0, max: 50 };
  function readStick() {
    const r = stick.getBoundingClientRect();
    stickC.x = r.left + r.width / 2; stickC.y = r.top + r.height / 2; stickC.max = r.width * 0.4;
  }
  function moveStick(e) {
    let dx = e.clientX - stickC.x, dy = e.clientY - stickC.y;
    const max = stickC.max;
    const d = Math.hypot(dx, dy);
    const kd = Math.min(d, max);
    if (d > 0) { knob.style.transform = `translate(calc(-50% + ${(dx / d) * kd}px), calc(-50% + ${(dy / d) * kd}px))`; }
    // Exactly on the center (less than 1 px): keep the last direction.
    if (d < 1) return;
    input.x = dx / d;
    input.y = dy / d;
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
    readStick();
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
  let noiseBuf = null;
  function noise(dur, vol, freq, delay = 0) {
    if (muted || !actx) return;
    if (!noiseBuf) {
      noiseBuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.6), actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = actx.currentTime + delay;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), gn = actx.createGain();
    src.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(gn).connect(actx.destination);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function limited(name, ms, fn) {
    return () => {
      const now = performance.now();
      if (lastPlay[name] && now - lastPlay[name] < ms) return;
      lastPlay[name] = now; fn();
    };
  }
  const sfx = {
    laser: limited('laser', 80, () => { beep(1500, 0.3, 'sawtooth', 0.025, -1200); beep(760, 0.3, 'square', 0.012, -600); }),
    zap: limited('zap', 60, () => { noise(0.12, 0.05, 4000); beep(rand(1400, 2200), 0.08, 'square', 0.02, -1200); }),
    blade: limited('blade', 70, () => beep(1900, 0.05, 'triangle', 0.025, -900)),
    launch: limited('launch', 60, () => { noise(0.25, 0.035, 900); beep(260, 0.22, 'sawtooth', 0.015, 260); }),
    boom: limited('boom', 50, () => { noise(0.5, 0.09, 600); beep(110, 0.4, 'sine', 0.09, -70); }),
    hit: limited('hit', 40, () => beep(240, 0.05, 'square', 0.025, -120)),
    crit: limited('crit', 60, () => { beep(1200, 0.07, 'square', 0.03, -600); noise(0.08, 0.04, 3000); }),
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
  $('btnStart').addEventListener('click', openWeaponSelect);
  $('btnAgain').addEventListener('click', openWeaponSelect);
  $('btnWeaponBack').addEventListener('click', () => { hide('scrWeapon'); toTitle(); });
  $('btnPause').addEventListener('click', pauseGame);
  $('btnResume').addEventListener('click', resumeGame);
  $('btnQuit').addEventListener('click', () => {
    if (floor > best) { best = floor; store.set(KEY_BEST, best); }
    cloudSaveRun(null);
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

  // iPhone / iPad: Safari has no install prompt, so show a short help text.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (isIOS && !isStandalone) show('iosHint');

  // ---------- Resize ----------
  function resize() {
    const r = app.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    R = Math.max(1, Math.round(canvas.width / TARGET_W));
    viewW = canvas.width / R;
    viewH = canvas.height / R;
    cssToLogical = viewW / w;
    ctx.imageSmoothingEnabled = false;
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
    render(dt);
    updateHud();
    requestAnimationFrame(frame);
  }

  resize();
  newGame();
  $('titleBest').textContent = best;
  requestAnimationFrame(frame);

  // Test hook (read only use in automatic tests)
  // Used by auth.js (cloud save).
  window.pdGame = {
    getBest: () => best,
    setBest: (n) => { best = n; store.set(KEY_BEST, n); $('titleBest').textContent = n; },
    setWeapon: (id) => { if (WEAPONS[id]) { weaponId = id; store.set(KEY_WEAPON, id); } },
  };

  window.__pd = { get state() { return state; }, get floor() { return floor; }, get player() { return p; }, get enemies() { return enemies; }, get stairs() { return stairs; }, get fx() { return { beams: beams.length, zaps: zaps.length, rockets: rockets.length, booms: booms.length, parts: parts.length, hits: hitfx.length }; } };

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
    });
    // When a new version takes over, reload once (only if no run is in progress).
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      if (state === 'play' || state === 'levelup' || state === 'paused' || state === 'dying') return;
      reloaded = true;
      location.reload();
    });
  }
})();
