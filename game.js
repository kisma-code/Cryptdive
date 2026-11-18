'use strict';
/*
 * Pixel Depths - a small pixel art action RPG.
 * Move with the joystick (phone) or WASD / arrow keys (computer).
 * The hero attacks automatically.
 * Kill all monsters on a floor, then take the stairs down.
 * The high score is the deepest floor.
 */
(() => {
  // ---------- Config ----------
  const TARGET_W = 160;          // about this many game pixels across the screen
  const TILE = 16;
  // Room size in tiles. It changes for each floor (small, medium, large).
  let ROOM_W = 15, ROOM_H = 23;
  let RW = ROOM_W * TILE, RH = ROOM_H * TILE;
  const KEY_BEST = 'pixelDepths.bestFloor';
  const KEY_MUTE = 'pixelDepths.mute';
  const KEY_WEAPON = 'pixelDepths.weapon';
  const KEY_CLASSES = 'pixelDepths.classes';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked */ } },
  };

  const $ = (id) => document.getElementById(id);
  const app = $('app');
  // Computer with no touch screen: hide the joystick and use the keyboard.
  const DESKTOP = !matchMedia('(any-pointer: coarse)').matches && !(navigator.maxTouchPoints > 0);
  if (DESKTOP) {
    document.documentElement.classList.add('desktop');
    $('howMove').textContent = 'Use WASD to move.';
  }
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
    u: '#5b7a3a', U: '#8fae5a',
    // upgrade icon colors
    H: '#ef4b5b', O: '#ff8a2a', Y: '#ffd23f',
    // deep area monsters
    i: '#9be7ff', I: '#4a7fa8', v: '#5a2f8a', V: '#c06bff', F: '#d77fae', f: '#8a3f6a',
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

  // ---------- Upgrade icons (12x12 pixel art for the level-up cards) ----------
  const ICONS = {
    damage: [
      '.........www',
      '........wwEw',
      '.......wwEw.',
      '......wwEw..',
      '.....wwEw...',
      '.y..wwEw....',
      '.yyyEEw.....',
      '..yyyw......',
      '..qyyy......',
      '.qqq.yy.....',
      'qqq.........',
      'qq..........',
    ],
    speed: [
      '.qqqqqqqqqq.',
      '..mmmmmmmm..',
      '..myyyyyym..',
      '...myyyym...',
      '....myym....',
      '.....yy.....',
      '.....yy.....',
      '....m..m....',
      '...m.yy.m...',
      '..myyyyyym..',
      '..mmmmmmmm..',
      '.qqqqqqqqqq.',
    ],
    move: [
      '.....qqqq...',
      '.....qooq...',
      '.....qooq...',
      'cc...qooq...',
      '.....qooq...',
      'ccc..qoooqq.',
      '.....qoooooq',
      'cc...qoooooq',
      '.....qqqqqqq',
      '.....WWWWWWW',
      '............',
      '............',
    ],
    hp: [
      '............',
      '.HHH....HHH.',
      'HHwHH..HHHHH',
      'HwHHHHHHHHHH',
      'HHHHHHHHHHHH',
      'HHHHHHHHHHHH',
      '.HHHHHHHHHH.',
      '..HHHHHHHH..',
      '...HHHHHH...',
      '....HHHH....',
      '.....HH.....',
      '............',
    ],
    regen: [
      '....qqqq....',
      '....qqqq....',
      '.....EE.....',
      '....EEEE....',
      '...EEEEEE...',
      '..gggggggg..',
      '.gggggwgggg.',
      '.ggggwwwggg.',
      '.gggggwgggg.',
      '.gggggggggg.',
      '..gggggggg..',
      '...gggggg...',
    ],
    magnet: [
      '..........G.',
      '.mmm..mmm.GG',
      '.mmm..mmm...',
      '.HHH..HHH...',
      '.HHH..HHH...',
      '.HHH..HHH...',
      '.HHH..HHH...',
      '.HHHHHHHH...',
      '..HHHHHH....',
      '...HHHH.....',
      '............',
      '............',
    ],
    range: [
      '.....PP.....',
      '...PPPPPP...',
      '..P..PP..P..',
      '.P...PP...P.',
      '.P........P.',
      'PPPP....PPPP',
      'PPPP....PPPP',
      '.P........P.',
      '.P...PP...P.',
      '..P..PP..P..',
      '...PPPPPP...',
      '.....PP.....',
    ],
    beams: [
      '............',
      'cccccccccccc',
      'wwwwwwwwwwww',
      'cccccccccccc',
      '............',
      'cccccccccccc',
      'wwwwwwwwwwww',
      'cccccccccccc',
      '............',
      'cccccccccccc',
      'wwwwwwwwwwww',
      'cccccccccccc',
    ],
    wide: [
      '.....ww.....',
      '....wwww....',
      '............',
      'cccccccccccc',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'cccccccccccc',
      '............',
      '....wwww....',
      '.....ww.....',
      '............',
    ],
    jumps: [
      '............',
      '......cccc..',
      '.....cwwc...',
      '....cwwc....',
      '...cwwc.....',
      '..cwwwwwwc..',
      '.....cwwc...',
      '....cwwc....',
      '...cwwc.....',
      '..cwc.......',
      '..cc........',
      '............',
    ],
    forks: [
      '............',
      '............',
      '...cc....cc.',
      '..cwc...cwc.',
      '.cwc...cwc..',
      'cwwwc.cwwwc.',
      '..cwc...cwc.',
      '.cwc...cwc..',
      '.cc....cc...',
      '............',
      '............',
      '............',
    ],
    rangs: [
      '...Y........',
      '..YYY.......',
      '.YYYYY......',
      'YYY.YYY.....',
      'YY...YY.....',
      'w.....w.....',
      '........Y...',
      '.......YYY..',
      '......YYYYY.',
      '.....YYY.YYY',
      '.....YY...YY',
      '.....w.....w',
    ],
    bigrang: [
      '............',
      '............',
      '.....YY.....',
      '....YYYY....',
      '...YYYYYY...',
      '..YYYYYYYY..',
      '.YYYY..YYYY.',
      'YYYY....YYYY',
      'YYY......YYY',
      'wY........Yw',
      '............',
      '............',
    ],
    rocket: [
      '.........www',
      '........wwHw',
      '.......mmmHw',
      '......mmmmm.',
      '.....mmmmm..',
      '..m.mmmmm...',
      '..mmmmmm....',
      '...mmmm.....',
      '..Ommmm.....',
      '.OyOm.m.....',
      'OyOO........',
      'OO..........',
    ],
    boom: [
      '.....OO.....',
      '..O..OO..O..',
      '...OOyyOO...',
      '...OyyyyO...',
      '.OOyywwyyOO.',
      'OOyywwwwyyOO',
      'OOyywwwwyyOO',
      '.OOyywwyyOO.',
      '...OyyyyO...',
      '...OOyyOO...',
      '..O..OO..O..',
      '.....OO.....',
    ],
  };
  const iconCache = {};
  function iconCanvas(id) {
    if (!iconCache[id]) iconCache[id] = sprite(ICONS[id]).img;
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    c.getContext('2d').drawImage(iconCache[id], 0, 0);
    return c;
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

  const SLIME_A = [
    '..........',
    '...kkkk...',
    '..kUUUUk..',
    '.kUuuuuUk.',
    'kuwkuuwkuk',
    'kuuuuuuuuk',
    'kuuuuuuuuk',
    '.kkkkkkkk.',
  ];
  const SLIME_B = [
    '..........',
    '..........',
    '...kkkk...',
    '.kkUUUUkk.',
    'kUuwkuwkUk',
    'kuuuuuuuuk',
    'kuuuuuuuuk',
    'kkkkkkkkkk',
  ];
  const IMP_A = [
    '....k..k....',
    'k..krkkrk..k',
    'kk.krrrrk.kk',
    'krkryrryrkrk',
    'krrrrrrrrrrk',
    '.kkrrRRrrkk.',
    '...krrrrk...',
    '....k..k....',
  ];
  const IMP_B = [
    '....k..k....',
    '...krkkrk...',
    '...krrrrk...',
    '.kkryrryrkk.',
    'krrrrrrrrrrk',
    'krkrrRRrrkrk',
    'kk.krrrrk.kk',
    '....k..k....',
  ];

  const LICH_TOP = [
    '..kyk.kyk.kyk.',
    '..kyyyyyyyyyk.',
    '..kWWWWWWWWWk.',
    '..kWkkWWWkkWk.',
    '..kWkcWWWkcWk.',
    '..kWWWWkWWWWk.',
    '...kWkWkWkWk..',
    '.kkpppppppppkk',
    'kPkpppWppppkPk',
    'kPkppWWWpppkPk',
    '.k.pppWppppk.k',
    '...ppppppppk..',
  ];
  const BRUTE_TOP = [
    '....kkkkkk....',
    '...ksssssk....',
    '...ksRssRsk...',
    '...kssssssk...',
    '..kkskkkkskk..',
    '.kssssssssssk.',
    'ksskssDssksssk',
    'kssksDsssksssk',
    'ksskssssDksssk',
    '.kkkssssssk.kk',
    '...ksskssk....',
    '...ksskssk....',
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
    batA: sprite(IMP_A),
    batB: sprite(IMP_B),
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
    // Area monsters
    sewerA: sprite(SLIME_A, { g: 'u', G: 'U' }),
    sewerB: sprite(SLIME_B, { g: 'u', G: 'U' }),
    fireA: sprite(IMP_A, { r: 'R', R: 'y', y: 'w' }),
    fireB: sprite(IMP_B, { r: 'R', R: 'y', y: 'w' }),
    knight: sprite([
      '...kkkkkk...',
      '..kmmmmmmk..',
      '..kmkkkkmk..',
      '..kmkrrkmk..',
      '..kmmmmmmk..',
      '.kkWkWWkWkk.',
      'knnkWWWWknnk',
      'knnkWkkWknnk',
      'knnkkWWkknnk',
      '.kk.kWWk.kk.',
      '....kWkWk...',
      '....kk.kk...',
    ]),
    // Monsters for all areas (deeper floors)
    archer: sprite([
      '..kkkkkk..k.',
      '.kWWWWWWk.kok',
      '.kWrWWrWk..ko',
      '.kWWWWWWk..ko',
      '..kWkkWk...ko',
      '...kWWk....ko',
      '.kkqWWqkkkkok',
      'kWkqkkqkWWkok',
      '..kqWWqk...ko',
      '..kWkkWk...ko',
      '..kWk.kWk.kok',
      '..kk...kk..k.',
    ]),
    ghostA: sprite(['...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwkwwkwk.', '.kwkwwkwk.', '.kwwwwwwk.', '.kwwEEwwk.', '.kwwwwwwk.', '.kwkwwkwk.', '..k.kk.k..']),
    ghostB: sprite(['...kkkk...', '..kwwwwk..', '.kwwwwwwk.', '.kwkwwkwk.', '.kwkwwkwk.', '.kwwwwwwk.', '.kwwEEwwk.', '.kwwwwwwk.', '.kkwwkwwk.', '...k..k...']),
    // Area monsters (floors 21-50)
    wraithA: sprite(['....kkkk....', '...kIIIIk...', '..kIkkkkIk..', '..kIkiikIk..', '..kIkkkkIk..', '.kIIIIIIIIk.', 'kiIIIiiIIIik', 'kikIIIIIIkik', '.k.kIIIIk.k.', '...kIIIIk...', '....kIIk....', '.....kk.....']),
    wraithB: sprite(['....kkkk....', '...kIIIIk...', '..kIkkkkIk..', '..kIkiikIk..', '..kIkkkkIk..', '.kIIIIIIIIk.', 'kiIIIiiIIIik', 'kikIIIIIIkik', '.k.kIIIIk.k.', '...kIIIk....', '...kIIk.....', '....kk......']),
    bloater: sprite(['....kkkk....', '..kkFFFFkk..', '.kFFwFFFFFk.', '.kFFFFFfFFk.', 'kFfFFkFFkFFk', 'kFFFFkFFkFFk', 'kFFFFFFFFfFk', '.kFFFFFFFFk.', '..kffffffk..', '...kkkkkk...']),
    phantom: sprite(['...kkkk...', '..kppppk..', '.kpkkkkpk.', '.kpkcckpk.', '.kpkkkkpk.', '.kppppppk.', 'kPppppppPk', 'kPkppppkPk', '.k.kppk.k.', '...kppk...', '...kpk....', '....k.....']),
    leechA: sprite(['...kkkkkk...', '.kkDHDHDHkk.', 'kwDHDHDHDHDk', 'kDHDHDHDHDk.', '.kkkkkkkkk..']),
    leechB: sprite(['............', 'kkkkkkkkkkk.', 'wDHDHDHDHDHk', 'kkkkkkkkkkk.']),
    golem: sprite([
      '...kkkkkkkk...',
      '..knnnnnnnnk..',
      '..knyknnkynk..',
      '..knnnnnnnnk..',
      '.kknOOnnOOnkk.',
      'knnnnOnnOnnnnk',
      'knnnnnOOnnnnnk',
      'knnkknnnnkknnk',
      'knnk.knnk.knnk',
      '.kk..knnk..kk.',
      '....knnnnk....',
      '...knnkknnk...',
      '...knk..knk...',
      '...kk....kk...',
    ]),
    eye: sprite(['...kkkk...', '.kkvvvvkk.', '.kvvVVvvk.', 'kvVwwwwVvk', 'kvVwkkwVvk', 'kvVwkkwVvk', 'kvVwwwwVvk', '.kvvVVvvk.', '.kkvvvvkk.', '...kkkk...']),
    // Bosses (drawn at 2x)
    lichA: sprite(LICH_TOP.concat(['..kppppppppk..', '..kpkpkpkpk...'])),
    lichB: sprite(LICH_TOP.concat(['..kppppppppk..', '...kpkpkpkpk..'])),
    bruteA: sprite(BRUTE_TOP.concat(['..kssk.kssk...', '..kkk...kkk...']), { s: 'z', R: 'y' }),
    bruteB: sprite(BRUTE_TOP.concat(['...ksskssk....', '...kkk.kkk....']), { s: 'z', R: 'y' }),
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

  // ---------- Monsters ----------
  const ETYPES = {
    slime: { r: 4, hp: 6, speed: 22, dmg: 1, xp: 1, color: '#7a8a5a' },  // Zombie
    bat: { r: 4, hp: 3, speed: 44, dmg: 1, xp: 1, color: '#b13e53', fly: true }, // Imp
    skel: { r: 4, hp: 13, speed: 27, dmg: 2, xp: 2, color: '#d8cfb4' },  // Skeleton Warrior
    boss: { r: 10, hp: 90, speed: 19, dmg: 3, xp: 15, color: '#b13e53', boss: true }, // Horned Demon
    lich: { r: 10, hp: 80, speed: 20, dmg: 3, xp: 15, color: '#a45fb8', boss: true },  // Bone Lich (bullet rings)
    brute: { r: 10, hp: 120, speed: 17, dmg: 4, xp: 15, color: '#8a9a6b', boss: true }, // Plague Brute (charges)
    // Monsters for all areas, on deeper floors
    archer: { r: 4, hp: 9, speed: 24, dmg: 1, xp: 2, color: '#d8cfb4', shoot: true }, // Skeleton Archer
    ghost: { r: 4, hp: 5, speed: 40, dmg: 1, xp: 2, color: '#c8d6e5', fly: true },     // Ghost
    // Area monsters
    sewer: { r: 4, hp: 10, speed: 20, dmg: 1, xp: 2, color: '#6f8f45' },   // Sewer Slime (splits in 2)
    fireimp: { r: 4, hp: 6, speed: 46, dmg: 2, xp: 2, color: '#f97316', fly: true }, // Fire Imp
    knight: { r: 5, hp: 32, speed: 18, dmg: 3, xp: 4, color: '#a7adbd' }, // Bone Knight (charges)
    wraith: { r: 4, hp: 14, speed: 22, dmg: 2, xp: 3, color: '#9be7ff', fly: true, shoot: true }, // Frost Wraith (3 bolts)
    bloater: { r: 5, hp: 16, speed: 20, dmg: 3, xp: 3, color: '#d77fae' },  // Spore Bloater (bursts near you)
    phantom: { r: 4, hp: 12, speed: 30, dmg: 2, xp: 3, color: '#a45fb8', fly: true }, // Phantom (fades, appears near you)
    leech: { r: 4, hp: 12, speed: 30, dmg: 2, xp: 3, color: '#7a1c2c' },   // Blood Leech (hops)
    golem: { r: 6, hp: 45, speed: 15, dmg: 3, xp: 5, color: '#596079' },   // Ember Golem (fire ring)
    eye: { r: 4, hp: 14, speed: 24, dmg: 2, xp: 3, color: '#c06bff', fly: true, shoot: true }, // Void Eye (homing orb)
  };
  const isBoss = (e) => !!ETYPES[e.type].boss;
  // Boss floors (every 5th) take turns: Horned Demon, Bone Lich, Plague Brute.
  const BOSSES = ['boss', 'lich', 'brute'];
  const BOSS_NAMES = { boss: 'HORNED DEMON', lich: 'BONE LICH', brute: 'PLAGUE BRUTE' };

  // ---------- Weapons ----------
  // Each weapon has its own base stats and 2 unique upgrades.
  // Damage and Attack Speed are in the general list (one name for all weapons).
  // Upgrade value sign, for example 0.4 -> '+40%'.
  const pct = (v) => '+' + Math.round(v * 100) + '%';
  const WEAPONS = {
    laser: {
      name: 'Laser Beam', icon: 'L', color: '#ff3d6e', glow: '#ff9fbf', tags: 'LINE · PIERCE',
      desc: 'A hot beam. It hits all monsters in a line.',
      base: { dmg: 6, cd: 1.15, width: 3, beams: 1, len: 1.5 }, minCd: 0.45,
      ups: [
        { name: 'More Beams', pic: 'beams', tag: '+1', desc: 'Fire 1 more beam.', ok: (w) => w.beams < 3, apply: (w) => { w.beams++; } },
        { name: 'Wider Beam', pic: 'wide', tag: (w) => pct(2 / w.width), desc: 'The beam is wider.', ok: (w) => w.width < 9, apply: (w) => { w.width += 2; } },
      ],
    },
    lightning: {
      name: 'Chain Lightning', icon: 'Z', color: '#6ff6ff', glow: '#b98cff', tags: 'CHAIN · FAST',
      desc: 'Lightning jumps from monster to monster.',
      base: { dmg: 4, cd: 0.9, chains: 3, jump: 46, forks: 1 }, minCd: 0.35,
      ups: [
        { name: 'More Jumps', pic: 'jumps', tag: '+2', desc: 'Lightning jumps 2 more times, farther.', ok: (w) => w.chains < 11, apply: (w) => { w.chains += 2; w.jump = Math.min(90, w.jump * 1.12); } },
        { name: 'More Chains', pic: 'forks', tag: '+1', desc: 'Start 1 more lightning chain.', ok: (w) => w.forks < 3, apply: (w) => { w.forks++; } },
      ],
    },
    boomerang: {
      name: 'Boomerang', icon: 'B', color: '#ffd23f', glow: '#fff4b8', tags: 'OUT · AND BACK',
      desc: 'Flies out and comes back. It hits on both ways.',
      base: { dmg: 5, cd: 1.0, count: 1, size: 5, dist: 1 }, minCd: 0.4,
      ups: [
        { name: 'More Boomerangs', pic: 'rangs', tag: '+1', desc: 'Throw 1 more boomerang.', ok: (w) => w.count < 4, apply: (w) => { w.count++; } },
        { name: 'Bigger Boomerang', pic: 'bigrang', tag: (w) => pct(2 / w.size), desc: 'Bigger, and flies farther.', ok: (w) => w.size < 11, apply: (w) => { w.size += 2; w.dist *= 1.15; } },
      ],
    },
    rockets: {
      name: 'Fire Rockets', icon: 'R', color: '#ff8a2a', glow: '#ffd27a', tags: 'AREA · HOMING',
      desc: 'Homing rockets. They explode in an area.',
      base: { dmg: 8, cd: 1.25, count: 1, radius: 22 }, minCd: 0.5,
      ups: [
        { name: 'More Rockets', pic: 'rocket', tag: '+1', desc: 'Fire 1 more rocket.', ok: (w) => w.count < 4, apply: (w) => { w.count++; } },
        { name: 'Bigger Explosion', pic: 'boom', tag: (w) => pct(6 / w.radius), desc: 'Explosions are larger.', ok: (w) => w.radius < 46, apply: (w) => { w.radius += 6; } },
      ],
    },
  };
  const WEAPON_ORDER = ['laser', 'lightning', 'boomerang', 'rockets'];

  // ---------- Classes (permanent upgrades) ----------
  // Each class (= weapon) has its own Souls and 3 upgrades with no max level.
  // Souls come at the end of a run (game over or quit), for each COMPLETED floor:
  // floors 1-5 give 1 each, 6-10 give 2 each, 11-15 give 3 each, ... and +5 for each boss killed.
  // Example: end on floor 30 (floors 1-29 completed) = 99 Souls + bosses.
  const CLASS_UPS = [
    { id: 'atk', name: 'ATTACK', pic: 'damage', color: '#ef4b5b', tag: (l) => '+' + l * 10 + '%' },
    { id: 'spd', name: 'ATTACK SPEED', pic: 'speed', color: '#ffcd75', tag: (l) => '+' + l * 5 + '%' },
    { id: 'hp', name: 'MAX HP', pic: 'hp', color: '#ff7a8a', tag: (l) => '+' + l * 2 },
  ];
  const classCost = (lvl) => 5 + 3 * lvl; // 5, 8, 11, 14, ...
  function floorSouls(done) {
    let n = 0;
    for (let f = 1; f <= done; f++) n += 1 + Math.floor((f - 1) / 5);
    return n;
  }
  function cleanClass(c) {
    const n = (v) => Math.max(0, Math.min(1e6, Math.floor(+v || 0)));
    c = c || {};
    return { souls: n(c.souls), earned: n(c.earned), atk: n(c.atk), spd: n(c.spd), hp: n(c.hp), best: n(c.best) };
  }
  function loadClasses(raw) {
    const out = {};
    for (const id of WEAPON_ORDER) out[id] = cleanClass(raw && raw[id]);
    return out;
  }
  let classes = (() => { try { return loadClasses(JSON.parse(store.get(KEY_CLASSES, '{}'))); } catch (e) { return loadClasses(null); } })();
  function saveClasses(cloudToo) {
    store.set(KEY_CLASSES, JSON.stringify(classes));
    const cloud = window.PD_CLOUD;
    if (cloudToo && cloud && cloud.saveClasses) cloud.saveClasses(classes);
  }

  // ---------- Upgrades (for all weapons) ----------
  const UPGRADES = [
    { name: 'Damage', icon: 'D', pic: 'damage', tag: '+30%', color: '#ef4b5b', desc: 'Damage +30%.', ok: () => true, apply: (p) => { p.w.dmg *= 1.3; } },
    {
      name: 'Attack Speed', icon: 'A', pic: 'speed', tag: '+20%', color: '#ffcd75', desc: 'Attack 20% faster.',
      ok: (p) => p.w.cd > WEAPONS[p.weapon].minCd,
      apply: (p) => { p.w.cd *= 0.8; },
    },
    { name: 'Move Speed', icon: 'S', pic: 'move', tag: '+12%', color: '#73eff7', desc: 'Move 12% faster.', ok: (p) => p.speed < 105, apply: (p) => { p.speed *= 1.12; } },
    { name: 'Max HP', icon: 'H', pic: 'hp', tag: '+4', color: '#ff7a8a', desc: 'Max HP +4. Heal 4 HP.', ok: () => true, apply: (p) => { p.maxHp += 4; p.hp = Math.min(p.maxHp, p.hp + 4); } },
    { name: 'Heal Over Time', icon: '+', pic: 'regen', tag: '+0.25/s', color: '#38b764', desc: 'Heal 0.25 HP each second.', ok: (p) => p.regen < 1.5, apply: (p) => { p.regen += 0.25; } },
    { name: 'Pickup Range', icon: 'P', pic: 'magnet', tag: '+50%', color: '#a7f070', desc: 'Pick up XP from farther.', ok: (p) => p.magnet < 90, apply: (p) => { p.magnet *= 1.5; } },
    { name: 'Attack Range', icon: 'R', pic: 'range', tag: '+20%', color: '#a45fb8', desc: 'Attack range +20%.', ok: (p) => p.range < 170, apply: (p) => { p.range *= 1.2; } },
  ];

  // ---------- State ----------
  let state = 'title'; // title | play | levelup | paused | dying | over
  let t = 0;
  let floor = 1, kills = 0, pendingLevels = 0, dieT = 0;
  // Class best floor at the start of the run (floors below it are fast floors), boss kills, souls paid.
  let runBest = 0, bossKills = 0, soulsGiven = true;
  let best = parseInt(store.get(KEY_BEST, '0'), 10) || 0;
  let map, bg, bgCtx, theme, torches = [];
  let shots = []; // monster bullets
  let p, enemies, pending, rangs = [], rockets, beams, zaps, booms, gems, hearts, parts, texts, stairs, fl;
  // Orbit Blades was replaced by the Boomerang.
  const weaponFix = (id) => (id === 'blades' ? 'boomerang' : id);
  let weaponId = weaponFix(store.get(KEY_WEAPON, 'laser'));
  if (!WEAPONS[weaponId]) weaponId = 'laser';
  let camX = 0, camY = 0, camBX = 0, camBY = 0, camSnap = true, shake = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (n) => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function makePlayer() {
    // Class upgrades: ATTACK +10%, ATTACK SPEED +5%, MAX HP +2 for each level.
    const c = classes[weaponId], W = WEAPONS[weaponId];
    const w = Object.assign({}, W.base);
    w.dmg *= 1 + 0.1 * c.atk;
    w.cd = Math.max(W.minCd, w.cd / (1 + 0.05 * c.spd));
    const hp = 10 + 2 * c.hp;
    return {
      x: RW / 2, y: RH / 2, vx: 0, vy: 0, r: 4, face: 1, moving: false, anim: 0,
      hp, maxHp: hp, speed: 60, cdT: 0.3, charge: 0,
      magnet: 24, regen: 0, range: 100,
      xp: 0, xpNext: 5, level: 1, inv: 0,
      weapon: weaponId, w,
    };
  }
  function clearLists() {
    hitfx = []; rings = [];
    enemies = []; pending = []; rockets = []; beams = []; zaps = []; booms = []; rangs = [];
    gems = []; hearts = []; parts = []; texts = []; shots = [];
  }

  // ---------- Room ----------
  // ---------- Areas (the dungeon changes every 5 floors) ----------
  const AREAS = [
    {
      id: 'crypt', name: 'THE CRYPT', monster: null, shapes: ['rect', 'cross', 'L'],
      theme: { f1: '#3a3333', f2: '#352f2f', sp: '#4a4140', wall: '#1c1718', top: '#5d504c', blood: '#5a1418', bone: '#9c937f' },
    },
    {
      id: 'sewer', name: 'FLOODED SEWER', monster: 'sewer', shapes: ['rect', 'cross', 'ring'],
      theme: { f1: '#2c3329', f2: '#283025', sp: '#3b4634', wall: '#141a13', top: '#3f4d3a', blood: '#3d2a1a', bone: '#8c8a70', water: '#1d4448', waterHi: '#3f7f7a' },
    },
    {
      id: 'lava', name: 'LAVA CAVES', monster: 'fireimp', shapes: ['cave', 'cave', 'ring'],
      theme: { f1: '#2f1d19', f2: '#2a1a16', sp: '#4a2a22', wall: '#170b09', top: '#5c2a20', blood: '#6c141b', bone: '#8a7a6a', lava: '#c2410c', lavaHi: '#fbbf24' },
    },
    {
      id: 'cathedral', name: 'BONE CATHEDRAL', monster: 'knight', shapes: ['hall', 'hall', 'cross'],
      theme: { f1: '#2a2430', f2: '#26202c', sp: '#3a3044', wall: '#120e16', top: '#4f4060', blood: '#55122a', bone: '#a29cb0', carpet: '#5a1420', trim: '#b8912a' },
    },
    {
      id: 'frost', name: 'FROZEN CATACOMBS', monster: 'wraith', shapes: ['rect', 'ring', 'cross'],
      theme: { f1: '#2c3440', f2: '#28303b', sp: '#3f4b5c', wall: '#121820', top: '#5a6f88', blood: '#3a2a40', bone: '#b8c4d0', ice: '#6f9fc0', iceHi: '#d6f1ff' },
    },
    {
      id: 'fungal', name: 'FUNGAL HOLLOW', monster: 'bloater', shapes: ['cave', 'cave', 'L'],
      theme: { f1: '#2a2530', f2: '#26212c', sp: '#3d3346', wall: '#120e15', top: '#4a3550', blood: '#3a1a2a', bone: '#9a8f88', water: '#2f3d1f', waterHi: '#6f8f3a' },
    },
    {
      id: 'library', name: 'HAUNTED LIBRARY', monster: 'phantom', shapes: ['library', 'library', 'rect'],
      theme: { f1: '#2e2622', f2: '#2a221e', sp: '#3f342c', wall: '#160f0c', top: '#5a4232', blood: '#4a1418', bone: '#a89a84' },
    },
    {
      id: 'marsh', name: 'BLOOD MARSH', monster: 'leech', shapes: ['ring', 'cave', 'cross'],
      theme: { f1: '#2f2424', f2: '#2b2020', sp: '#432e2c', wall: '#170d0d', top: '#4f2a2a', blood: '#5a1418', bone: '#9c8a7f', water: '#4a0f18', waterHi: '#8a2a35' },
    },
    {
      id: 'forge', name: 'OBSIDIAN FORGE', monster: 'golem', shapes: ['rect', 'hall', 'ring'],
      theme: { f1: '#26262c', f2: '#222228', sp: '#36363f', wall: '#0e0e12', top: '#45454f', blood: '#4a1a12', bone: '#8a8580', lava: '#c2410c', lavaHi: '#fbbf24', carpet: '#3a2a20', trim: '#b85a1a' },
    },
    {
      id: 'abyss', name: 'ABYSS GATE', monster: 'eye', shapes: ['ring', 'cross', 'cave'],
      theme: { f1: '#1e1a26', f2: '#1b1722', sp: '#2c2538', wall: '#0a0810', top: '#3a2d50', blood: '#3a1450', bone: '#8a80a0', lava: '#3a1a5a', lavaLo: '#1a0a2a', lavaHi: '#c06bff', glow: '#9a4bff' },
    },
  ];
  const SIZES = [[13, 17], [15, 23], [19, 29]]; // small, medium, large (tiles)
  const T_FLOOR = 0, T_WALL = 1, T_WATER = 2, T_LAVA = 3, T_ICE = 4;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let area = AREAS[0], spawn = { x: 120, y: 184 }, carpetCols = null, candles = [], shrooms = [];
  let lavaTiles = [], waterTiles = [], distMap = null, distTile = -1;
  const areaIndex = (f) => Math.floor((f - 1) / 5) % AREAS.length;
  const tileAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return T_WALL;
    return map[ty * ROOM_W + tx];
  };

  // Count (and mark) tiles reachable from the spawn tile.
  function flood(pass) {
    const W = ROOM_W, seen = new Uint8Array(W * ROOM_H);
    const sx = Math.floor(spawn.x / TILE), sy = Math.floor(spawn.y / TILE);
    const q = [sy * W + sx];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const id = q[i], x = id % W, y = (id / W) | 0;
      for (const [ox, oy] of DIRS4) {
        const nx = x + ox, ny = y + oy, nid = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= ROOM_H || seen[nid] || !pass(map[nid])) continue;
        seen[nid] = 1; q.push(nid);
      }
    }
    return seen;
  }

  // Monsters follow this distance map around walls (updated when the hero changes tile).
  function updateFlow() {
    const W = ROOM_W, ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE), id = pty * W + ptx;
    if (id === distTile || ptx < 0 || pty < 0 || ptx >= W || pty >= ROOM_H) return;
    distTile = id;
    distMap.fill(-1);
    const q = [id];
    distMap[id] = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % W, y = (c / W) | 0, d = distMap[c];
      for (const [ox, oy] of DIRS4) {
        const nx = x + ox, ny = y + oy, n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= ROOM_H || distMap[n] >= 0 || map[n] === T_WALL) continue;
        distMap[n] = d + 1; q.push(n);
      }
    }
  }
  function steer(e) {
    const W = ROOM_W, tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= ROOM_H) return null;
    const d0 = distMap[ty * W + tx];
    if (d0 <= 1) return null; // close (or no path): go straight to the hero
    let best = d0, bx = 0, by = 0;
    for (const [ox, oy] of DIRS8) {
      const nx = tx + ox, ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= ROOM_H) continue;
      const v = distMap[ny * W + nx];
      if (v < 0 || v >= best) continue;
      if (ox && oy && (solidTile(tx + ox, ty) || solidTile(tx, ty + oy))) continue; // no corner cutting
      best = v; bx = ox; by = oy;
    }
    if (best === d0) return null;
    const gx = (tx + bx) * TILE + 8 - e.x, gy = (ty + by) * TILE + 8 - e.y, gl = Math.hypot(gx, gy) || 1;
    return { x: gx / gl, y: gy / gl };
  }

  // ----- Boss path finding -----
  // The boss is bigger than 1 tile, so it moves on "big nodes": each node is a block of
  // 2x2 open tiles, and the boss stands on the corner point in the middle of the block.
  let bigDist = null, bigTile = -1;
  const bigOpen = (i, j) => !solidTile(i, j) && !solidTile(i + 1, j) && !solidTile(i, j + 1) && !solidTile(i + 1, j + 1);
  const bigCenter = (id) => ({ x: ((id % ROOM_W) + 1) * TILE, y: (((id / ROOM_W) | 0) + 1) * TILE });
  function bigNodeNear(x, y) {
    const pi = Math.round(x / TILE) - 1, pj = Math.round(y / TILE) - 1;
    let best = -1, bd = 1e9;
    for (let oj = -1; oj <= 1; oj++) {
      for (let oi = -1; oi <= 1; oi++) {
        const i = pi + oi, j = pj + oj;
        if (i < 0 || j < 0 || i >= ROOM_W - 1 || j >= ROOM_H - 1 || !bigOpen(i, j)) continue;
        const c = bigCenter(j * ROOM_W + i), d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = j * ROOM_W + i; }
      }
    }
    return best;
  }
  function bigFlood(start, out) {
    const W = ROOM_W;
    out.fill(-1);
    if (start < 0) return;
    out[start] = 0;
    const q = [start];
    for (let k = 0; k < q.length; k++) {
      const c = q[k], i = c % W, j = (c / W) | 0;
      for (const [oi, oj] of DIRS4) {
        const ni = i + oi, nj = j + oj, n = nj * W + ni;
        if (ni < 0 || nj < 0 || ni >= W - 1 || nj >= ROOM_H - 1 || out[n] >= 0 || !bigOpen(ni, nj)) continue;
        out[n] = out[c] + 1; q.push(n);
      }
    }
  }
  // Turn every open tile that no reachable big node covers into wall.
  function fillBossGaps() {
    const W = ROOM_W, H = ROOM_H, reach = new Int16Array(W * H);
    const start = bigNodeNear(spawn.x, spawn.y);
    if (start < 0) return; // should not happen; never wall off the whole room
    bigFlood(start, reach);
    const covered = new Uint8Array(W * H);
    for (let id = 0; id < reach.length; id++) {
      if (reach[id] < 0) continue;
      const i = id % W, j = (id / W) | 0;
      covered[j * W + i] = covered[j * W + i + 1] = covered[(j + 1) * W + i] = covered[(j + 1) * W + i + 1] = 1;
    }
    for (let i = 0; i < map.length; i++) if (map[i] !== T_WALL && !covered[i]) map[i] = T_WALL;
  }
  function updateBigFlow() {
    const start = bigNodeNear(p.x, p.y);
    if (start < 0 || start === bigTile) return;
    bigTile = start;
    bigFlood(start, bigDist);
  }
  function steerBig(e) {
    const W = ROOM_W, cur = bigNodeNear(e.x, e.y);
    if (cur < 0) return null;
    const d0 = bigDist[cur];
    if (d0 < 0) return null;
    if (d0 <= 1) return null; // close: go straight to the hero
    const i = cur % W, j = (cur / W) | 0;
    let best = d0, target = -1;
    for (const [oi, oj] of DIRS8) {
      const ni = i + oi, nj = j + oj;
      if (ni < 0 || nj < 0 || ni >= W - 1 || nj >= ROOM_H - 1) continue;
      const v = bigDist[nj * W + ni];
      if (v < 0 || v >= best) continue;
      if (oi && oj && (!bigOpen(i + oi, j) || !bigOpen(i, j + oj))) continue;
      best = v; target = nj * W + ni;
    }
    if (target < 0) return null;
    const c = bigCenter(target), gx = c.x - e.x, gy = c.y - e.y, gl = Math.hypot(gx, gy) || 1;
    return { x: gx / gl, y: gy / gl };
  }
  // A random place where the boss fits, far from the hero.
  function bossSpot(minDist) {
    const W = ROOM_W, nodes = [];
    for (let j = 1; j < ROOM_H - 2; j++) {
      for (let i = 1; i < W - 2; i++) {
        if (!bigOpen(i, j)) continue;
        const c = bigCenter(j * W + i);
        if (Math.hypot(c.x - p.x, c.y - p.y) >= minDist) nodes.push(c);
      }
    }
    return nodes.length ? nodes[randi(nodes.length)] : freeSpot(minDist);
  }

  function addPillars(W, H, gap = 1) {
    const want = 3 + randi(3) + Math.min(4, floor >> 1) + (W > 15 ? 3 : 0);
    const sx = Math.floor(spawn.x / TILE), sy = Math.floor(spawn.y / TILE);
    for (let i = 0, made = 0; i < 120 && made < want; i++) {
      const size = Math.random() < 0.4 ? 2 : 1;
      const tx = 2 + randi(W - 4 - size + 1), ty = 2 + randi(H - 4 - size + 1);
      if (Math.abs(tx - sx) < 3 && Math.abs(ty - sy) < 3) continue;
      let free = true;
      // Each pillar keeps a free ring around it (2 tiles wide on boss floors), so no area is closed.
      for (let y = ty - gap; y <= ty + size - 1 + gap && free; y++) {
        for (let x = tx - gap; x <= tx + size - 1 + gap; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (map[y * W + x]) { free = false; break; }
        }
      }
      if (!free) continue;
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) map[y * W + x] = T_WALL;
      made++;
    }
  }

  // Water or lava pools. Lava never cuts off a part of the room.
  function addPools(type, count) {
    const W = ROOM_W, H = ROOM_H;
    const sx = Math.floor(spawn.x / TILE), sy = Math.floor(spawn.y / TILE);
    let floorCount = 0;
    for (let i = 0; i < map.length; i++) if (map[i] === T_FLOOR) floorCount++;
    for (let n = 0, tries = 0; n < count && tries < 40; tries++) {
      let x = 2 + randi(W - 4), y = 2 + randi(H - 4);
      if (map[y * W + x] !== T_FLOOR || Math.abs(x - sx) + Math.abs(y - sy) < 4) continue;
      const cells = [];
      const len = 4 + randi(7);
      for (let k = 0; k < len * 3 && cells.length < len; k++) {
        const id = y * W + x;
        if (map[id] === T_FLOOR && Math.abs(x - sx) + Math.abs(y - sy) >= 3) { map[id] = type; cells.push(id); }
        const [ox, oy] = DIRS4[randi(4)];
        x = clamp(x + ox, 1, W - 2); y = clamp(y + oy, 1, H - 2);
      }
      if (type === T_LAVA) {
        const seen = flood((v) => v === T_FLOOR);
        let reach = 0;
        for (let i = 0; i < map.length; i++) if (seen[i] && map[i] === T_FLOOR) reach++;
        if (reach < floorCount - cells.length) { for (const id of cells) map[id] = T_FLOOR; continue; }
      }
      floorCount -= cells.length;
      n++;
    }
  }

  function genRoom() {
    area = AREAS[areaIndex(floor)];
    theme = area.theme;
    const sz = floor === 1 ? SIZES[1] : SIZES[randi(SIZES.length)];
    ROOM_W = sz[0]; ROOM_H = sz[1]; RW = ROOM_W * TILE; RH = ROOM_H * TILE;
    const W = ROOM_W, H = ROOM_H, cx = W >> 1, cy = H >> 1;
    map = new Uint8Array(W * H);
    const wallRect = (x0, y0, x1, y1) => {
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) map[y * W + x] = T_WALL;
    };
    wallRect(0, 0, W - 1, 0); wallRect(0, H - 1, W - 1, H - 1); wallRect(0, 0, 0, H - 1); wallRect(W - 1, 0, W - 1, H - 1);

    // Boss floors: no caves (they have narrow gaps where the big boss gets stuck).
    const bossFloor = floor % 5 === 0;
    // (The library shelves also make narrow paths.)
    const shapes = bossFloor ? area.shapes.filter((sh) => sh !== 'cave' && sh !== 'library') : area.shapes;
    const shape = shapes.length ? shapes[randi(shapes.length)] : 'ring';
    carpetCols = null;
    if (shape === 'cross') {
      const bw = Math.round(W * 0.3), bh = Math.round(H * 0.28);
      wallRect(1, 1, bw, bh); wallRect(W - 1 - bw, 1, W - 2, bh);
      wallRect(1, H - 1 - bh, bw, H - 2); wallRect(W - 1 - bw, H - 1 - bh, W - 2, H - 2);
    } else if (shape === 'L') {
      const bw = Math.round(W * 0.45), bh = Math.round(H * 0.42);
      const left = Math.random() < 0.5, top = Math.random() < 0.5;
      const x0 = left ? 1 : W - 1 - bw, y0 = top ? 1 : H - 1 - bh;
      wallRect(x0, y0, x0 + bw - 1, y0 + bh - 1);
    } else if (shape === 'ring') {
      const hw = Math.max(1, Math.round(W * 0.15)), hh = Math.max(2, Math.round(H * 0.14));
      wallRect(cx - hw, cy - hh, cx + hw, cy + hh);
    } else if (shape === 'cave') {
      // Round cave: an oval with rough edges and rocks, then smoothed.
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const ex = (x - cx) / (W / 2 - 1), ey = (y - cy) / (H / 2 - 1);
          if (ex * ex + ey * ey > 0.8 + rand(-0.18, 0.18) || Math.random() < 0.1) map[y * W + x] = T_WALL;
        }
      }
      for (let pass = 0; pass < 3; pass++) {
        const next = map.slice();
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            let n = 0;
            for (const [ox, oy] of DIRS8) n += map[(y + oy) * W + x + ox] === T_WALL ? 1 : 0;
            next[y * W + x] = n >= 5 ? T_WALL : n <= 2 ? T_FLOOR : map[y * W + x];
          }
        }
        map = next;
      }
    } else if (shape === 'hall') {
      // Long rows of pillars, with a carpet down the middle.
      for (let y = 3; y < H - 3; y += 3) { map[y * W + 3] = T_WALL; map[y * W + W - 4] = T_WALL; }
      carpetCols = [cx - 1, cx, cx + 1];
    } else if (shape === 'library') {
      // Rows of bookshelves, each with 2 gaps to walk through.
      for (let y = 3; y < H - 3; y += 4) {
        if (Math.abs(y - cy) < 2) continue;
        const g1 = 2 + randi(Math.max(1, (W >> 1) - 4)), g2 = (W >> 1) + randi(Math.max(1, (W >> 1) - 3));
        for (let x = 2; x < W - 2; x++) {
          if ((x >= g1 && x < g1 + 2) || (x >= g2 && x < g2 + 2)) continue;
          map[y * W + x] = T_WALL;
        }
      }
    }

    // Start point: the open tile nearest to the center.
    let bestD = 1e9;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (map[y * W + x] !== T_FLOOR) continue;
        const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d < bestD) { bestD = d; spawn = { x: x * TILE + 8, y: y * TILE + 8 }; }
      }
    }
    if (shape === 'rect' || shape === 'cross' || shape === 'L') addPillars(W, H, bossFloor ? 2 : 1);

    // Close parts that the hero cannot reach.
    const seen = flood((v) => v !== T_WALL);
    for (let i = 0; i < map.length; i++) if (!seen[i]) map[i] = T_WALL;
    // Boss floors: fill small corners where the big boss cannot fit (it needs 2x2 open tiles).
    if (bossFloor) fillBossGaps();

    const pool = { sewer: T_WATER, fungal: T_WATER, marsh: T_WATER, frost: T_ICE, lava: T_LAVA, forge: T_LAVA, abyss: T_LAVA }[area.id];
    if (pool !== undefined) addPools(pool, 3 + randi(3) + (W > 15 ? 2 : 0) + (area.id === 'marsh' ? 2 : 0));
    lavaTiles = []; waterTiles = [];
    for (let i = 0; i < map.length; i++) {
      if (map[i] === T_LAVA) lavaTiles.push(i);
      else if (map[i] === T_WATER) waterTiles.push(i);
    }
    distMap = new Int16Array(W * H);
    distTile = -1;
    bigDist = new Int16Array(W * H);
    bigTile = -1;

    // Torches on wall faces (a wall tile with floor under it), not too close together.
    torches = [];
    for (let ty = 0; ty < H - 1; ty++) {
      for (let tx = 1; tx < W - 1; tx++) {
        if (!solidTile(tx, ty) || solidTile(tx, ty + 1)) continue;
        if (Math.random() > 0.3) continue;
        const x = tx * TILE + 8, y = ty * TILE + 8;
        if (torches.some((o) => Math.hypot(o.x - x, o.y - y) < TILE * 3)) continue;
        torches.push({ x, y, seed: Math.random() * 10 });
      }
    }
    // Candles next to the cathedral pillars
    candles = [];
    if (shape === 'hall') {
      for (let y = 3; y < H - 3; y += 3) {
        for (const x of [4, W - 5]) if (map[y * W + x] === T_FLOOR && Math.random() < 0.7) candles.push({ x: x * TILE + 5 + randi(6), y: y * TILE + 6, seed: Math.random() * 10 });
      }
    }
    // Glowing mushrooms in the Fungal Hollow
    shrooms = [];
    if (area.id === 'fungal') {
      const want = 6 + (W > 15 ? 4 : 0);
      for (let i = 0; i < 80 && shrooms.length < want; i++) {
        const tx = 1 + randi(W - 2), ty = 1 + randi(H - 2);
        if (map[ty * W + tx] !== T_FLOOR) continue;
        shrooms.push({ x: tx * TILE + 4 + randi(8), y: ty * TILE + 6 + randi(6), seed: Math.random() * 10 });
      }
    }
    renderRoom();
  }

  function solidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
    return map[ty * ROOM_W + tx] === 1;
  }

  function renderRoom() {
    bg = document.createElement('canvas');
    bg.width = RW; bg.height = RH;
    const b = bg.getContext('2d');
    bgCtx = b;
    const W = ROOM_W;
    for (let ty = 0; ty < ROOM_H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const x = tx * TILE, y = ty * TILE, v = map[ty * W + tx];
        if (v === T_WALL && area.id === 'library' && tx > 0 && ty > 0 && tx < W - 1 && ty < ROOM_H - 1) {
          // Bookshelf
          b.fillStyle = '#3a2418'; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.top; b.fillRect(x, y, TILE, 2);
          for (const row of [3, 9]) {
            for (let bx = x + 1; bx < x + 15;) {
              const bw = Math.min(1 + randi(2), x + 15 - bx);
              b.fillStyle = BOOKS[randi(BOOKS.length)];
              b.fillRect(bx, y + row + randi(2), bw, 5);
              bx += bw;
            }
          }
          b.fillStyle = '#1a0f0a'; b.fillRect(x, y + 8, TILE, 1); b.fillRect(x, y + 14, TILE, 2);
          continue;
        }
        if (v === T_WALL) {
          b.fillStyle = theme.wall; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.top; b.fillRect(x, y, TILE, 2);
          b.fillStyle = PAL.k;
          b.fillRect(x, y + 7, TILE, 1);
          b.fillRect(x + ((ty & 1) ? 4 : 11), y + 2, 1, 5);
          b.fillRect(x + ((ty & 1) ? 11 : 4), y + 8, 1, 8);
          continue;
        }
        if (v === T_WATER) {
          b.fillStyle = theme.water; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.waterHi;
          for (let i = 0; i < 3; i++) b.fillRect(x + 1 + randi(10), y + 2 + randi(12), 3 + randi(3), 1);
          // Stone edge where the water meets the floor
          b.fillStyle = 'rgba(0,0,0,.35)';
          if (tileIs(tx, ty - 1, T_FLOOR)) b.fillRect(x, y, TILE, 2);
          continue;
        }
        if (v === T_LAVA) {
          b.fillStyle = theme.lava; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.lavaLo || '#7c2d12';
          for (let i = 0; i < 4; i++) b.fillRect(x + randi(13), y + randi(13), 2 + randi(3), 2 + randi(2));
          b.fillStyle = theme.lavaHi;
          for (let i = 0; i < 3; i++) b.fillRect(x + randi(14), y + randi(14), 2, 1);
          continue;
        }
        if (v === T_ICE) {
          b.fillStyle = theme.ice; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.iceHi;
          for (let i = 0; i < 2; i++) { const ix = x + 1 + randi(9), iy = y + 2 + randi(11); b.fillRect(ix, iy, 4, 1); b.fillRect(ix + 4, iy - 1, 2, 1); }
          b.fillStyle = 'rgba(0,0,0,.25)';
          if (tileIs(tx, ty - 1, T_FLOOR)) b.fillRect(x, y, TILE, 1);
          continue;
        }
        // Floor
        b.fillStyle = ((tx + ty) & 1) ? theme.f1 : theme.f2;
        b.fillRect(x, y, TILE, TILE);
        b.fillStyle = theme.sp;
        for (let i = 0; i < 3; i++) b.fillRect(x + randi(15), y + randi(15), 1, 1);
        if (Math.random() < 0.12) b.fillRect(x + 3 + randi(8), y + 3 + randi(8), 3, 1);
        if (carpetCols && carpetCols.includes(tx)) {
          b.fillStyle = theme.carpet; b.fillRect(x, y, TILE, TILE);
          b.fillStyle = theme.trim;
          if (tx === carpetCols[0]) b.fillRect(x + 1, y, 1, TILE);
          if (tx === carpetCols[carpetCols.length - 1]) b.fillRect(x + TILE - 2, y, 1, TILE);
          if (tx === carpetCols[1] && ty % 3 === 0) { b.fillRect(x + 6, y + 6, 4, 4); b.fillStyle = theme.carpet; b.fillRect(x + 7, y + 7, 2, 2); }
          continue;
        }
        // Cracks (glowing in the lava caves)
        if (Math.random() < (area.id === 'lava' ? 0.22 : 0.1)) {
          b.fillStyle = area.id === 'lava' ? '#9a3412' : theme.wall;
          let cx = x + 2 + randi(10), cy = y + 2 + randi(10);
          for (let i = 0; i < 5; i++) { b.fillRect(cx, cy, 1, 1); cx += randi(3) - 1; cy += 1; }
        }
        // Moss in the sewer
        if (area.id === 'sewer' && Math.random() < 0.25) {
          b.fillStyle = '#3f5a2a';
          const mx = x + randi(12), my = y + randi(12);
          for (let i = 0; i < 5; i++) b.fillRect(mx + randi(4), my + randi(3), 1, 1);
        }
        // Frost on the floor
        if (area.id === 'frost' && Math.random() < 0.3) {
          b.fillStyle = '#5f7790';
          const fx = x + randi(12), fy = y + randi(12);
          for (let i = 0; i < 4; i++) b.fillRect(fx + randi(4), fy + randi(4), 1, 1);
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
        } else if (area.id === 'crypt' && rb < 0.085) {
          // Coffin (flat, you can walk over it)
          const bx = x + 4, by = y + 1;
          b.fillStyle = PAL.k; b.fillRect(bx - 1, by - 1, 9, 15);
          b.fillStyle = '#4a3226'; b.fillRect(bx, by, 7, 13);
          b.fillStyle = '#6b4a35'; b.fillRect(bx + 1, by + 1, 5, 11);
          b.fillStyle = '#9c937f'; b.fillRect(bx + 3, by + 3, 1, 5); b.fillRect(bx + 2, by + 4, 3, 1);
        } else if (area.id === 'sewer' && rb < 0.08) {
          // Drain grate
          const bx = x + 4, by = y + 4;
          b.fillStyle = PAL.k; b.fillRect(bx, by, 8, 8);
          b.fillStyle = '#4a5250';
          for (let i = 0; i < 4; i++) b.fillRect(bx + 1 + i * 2, by + 1, 1, 6);
        } else if (area.id === 'fungal' && rb < 0.12) {
          // Small mushrooms
          const bx = x + 3 + randi(9), by = y + 4 + randi(8);
          b.fillStyle = '#c8bfa0'; b.fillRect(bx + 1, by + 1, 1, 2);
          b.fillStyle = '#8a3f6a'; b.fillRect(bx, by, 3, 1);
          if (Math.random() < 0.5) { b.fillStyle = '#c8bfa0'; b.fillRect(bx + 4, by + 3, 1, 1); b.fillStyle = '#d77fae'; b.fillRect(bx + 3, by + 2, 3, 1); }
        } else if (area.id === 'library' && rb < 0.1) {
          // Old pages
          b.fillStyle = '#a89a84'; b.fillRect(x + 3 + randi(8), y + 3 + randi(9), 3, 2);
        } else if (area.id === 'marsh' && rb < 0.1) {
          // Dead reeds
          const bx = x + 3 + randi(9), by = y + 6 + randi(6);
          b.fillStyle = '#4a3226';
          for (let i = 0; i < 3; i++) b.fillRect(bx + i * 2, by - randi(3), 1, 4 + randi(2));
        } else if (area.id === 'forge' && rb < 0.08) {
          // Hot grate
          const bx = x + 4, by = y + 4;
          b.fillStyle = PAL.k; b.fillRect(bx, by, 8, 8);
          b.fillStyle = '#7c2d12'; b.fillRect(bx + 1, by + 1, 6, 6);
          b.fillStyle = '#2a2a30';
          for (let i = 0; i < 4; i++) b.fillRect(bx + 1 + i * 2, by + 1, 1, 6);
        } else if (area.id === 'abyss' && rb < 0.08) {
          // Rune circle
          const bx = x + 4, by = y + 4;
          b.fillStyle = '#4a2a70';
          b.fillRect(bx + 2, by, 4, 1); b.fillRect(bx + 2, by + 7, 4, 1); b.fillRect(bx, by + 2, 1, 4); b.fillRect(bx + 7, by + 2, 1, 4);
          b.fillRect(bx + 3, by + 3, 2, 2);
        }
      }
    }
    // Shadow on the floor under each wall face
    for (let ty = 0; ty < ROOM_H - 1; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (solidTile(tx, ty) && !solidTile(tx, ty + 1)) {
          b.fillStyle = 'rgba(0,0,0,.3)';
          b.fillRect(tx * TILE, (ty + 1) * TILE, TILE, 3);
        }
      }
    }
  }
  const BOOKS = ['#5a1420', '#2a3f5a', '#3a5a2a', '#6b4a2a', '#4a2a5a', '#8a7a3a'];
  function tileIs(tx, ty, v) {
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return false;
    return map[ty * ROOM_W + tx] === v;
  }

  // Moving light lines on water (drawn before the darkness).
  function drawWater() {
    if (!waterTiles.length) return;
    g.fillStyle = theme.waterHi;
    g.globalAlpha = 0.35;
    for (const id of waterTiles) {
      const tx = id % ROOM_W, ty = (id / ROOM_W) | 0;
      const x = tx * TILE - camX, y = ty * TILE - camY;
      if (x < -TILE || y < -TILE || x > viewW || y > viewH) continue;
      for (let i = 0; i < 2; i++) {
        const ox = ((t * 6 + i * 8 + tx * 5 + ty * 3) % 14);
        g.fillRect(x + ox, y + 4 + i * 7, 3, 1);
      }
    }
    g.globalAlpha = 1;
  }
  // Slow lava glow (drawn after the darkness, so it shines). Slow pulse, no flashing.
  function drawLavaGlow() {
    if (!lavaTiles.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const id of lavaTiles) {
      const tx = id % ROOM_W, ty = (id / ROOM_W) | 0;
      const x = tx * TILE - camX, y = ty * TILE - camY;
      if (x < -TILE || y < -TILE || x > viewW || y > viewH) continue;
      g.globalAlpha = 0.2 + 0.08 * Math.sin(t * 1.4 + tx * 0.7 + ty * 0.5);
      g.fillStyle = theme.glow || '#ff7a1a';
      g.fillRect(x, y, TILE, TILE);
    }
    g.restore();
  }
  function drawShrooms() {
    for (const c of shrooms) {
      const x = c.x - camX, y = c.y - camY;
      glow(c.x, c.y - 1, 10, '#5ff5c8', 0.3 + 0.08 * Math.sin(t * 1.5 + c.seed)); // slow pulse, no flashing
      g.fillStyle = '#c8bfa0'; g.fillRect(x - 0.5, y - 1, 1.5, 3);
      g.fillStyle = '#5ff5c8'; g.fillRect(x - 2, y - 2, 5, 1.5);
      g.fillStyle = '#b8fff0'; g.fillRect(x - 1, y - 2.5, 2, 1);
    }
  }
  function drawCandles() {
    for (const c of candles) {
      const x = c.x - camX, y = c.y - camY;
      const f = Math.sin(t * 7 + c.seed) * 0.5;
      g.fillStyle = PAL.k; g.fillRect(x - 1.5, y, 3, 5);
      g.fillStyle = '#e8e0c8'; g.fillRect(x - 1, y, 2, 4);
      glow(c.x, c.y - 2, 6, '#ffb347', 0.5);
      g.fillStyle = '#ffcd75'; g.fillRect(x - 0.5, y - 3 + f * 0.5, 1, 2.5);
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
      if (map[ty * ROOM_W + tx] !== T_FLOOR) continue;
      const x = tx * TILE + 8, y = ty * TILE + 8;
      if (Math.hypot(x - p.x, y - p.y) >= minDist) return { x, y };
    }
    return { x: spawn.x, y: spawn.y };
  }

  // ---------- Floors ----------
  function startFloor() {
    const boss = floor % 5 === 0;
    const normal = Math.min(6 + floor * 3, 70);
    // Fast floor: below the class best (not a boss floor), only 1 elite monster with all the EXP.
    const fast = !boss && floor < runBest;
    const total = boss ? 4 + floor : fast ? 1 : normal;
    fl = {
      toSpawn: total,
      fast, fastXp: Math.round(normal * 1.6),
      rate: Math.max(0.25, 0.85 - floor * 0.04),
      spawnT: fast ? 0.6 : 1.2,
      maxAlive: Math.min(10 + floor * 2, 40),
      cleared: false,
    };
    const bt = BOSSES[(floor / 5 - 1) % BOSSES.length];
    if (boss) {
      const s = bossSpot(90);
      pending.push({ type: bt, x: s.x, y: s.y, t: 1.4 });
    }
    let text = 'FLOOR ' + floor;
    if ((floor - 1) % 5 === 0) text += '\n' + area.name; // a new area starts
    if (boss) text += '\n' + BOSS_NAMES[bt] + '!';
    if (fast) text += '\nFAST FLOOR';
    showBanner(text);
  }

  function pickType() {
    const w = [['slime', 5]];
    if (floor >= 2) w.push(['bat', 2 + Math.min(4, floor * 0.5)]);
    if (floor >= 3) w.push(['skel', 1 + Math.min(5, floor * 0.6)]);
    if (floor >= 6) w.push(['archer', 1 + Math.min(3, floor * 0.12)]);
    if (floor >= 8) w.push(['ghost', 1 + Math.min(3, floor * 0.12)]);
    if (area.monster) w.push([area.monster, 3 + Math.min(4, floor * 0.15)]);
    let sum = 0; for (const [, n] of w) sum += n;
    let r = Math.random() * sum;
    for (const [k, n] of w) { r -= n; if (r <= 0) return k; }
    return 'slime';
  }

  function makeEnemy(type, x, y) {
    const d = ETYPES[type];
    // HP grows faster on each floor: floor 10 = about 4.7x, floor 20 = 11x, floor 30 = 20x.
    const f1 = floor - 1;
    const hm = 1 + 0.3 * f1 + 0.013 * f1 * f1;
    const sm = 1 + Math.min(0.4, (floor - 1) * 0.03);
    return {
      type, x, y, r: d.r, hp: d.hp * hm, maxHp: d.hp * hm,
      speed: d.speed * sm * rand(0.9, 1.1),
      dmg: d.dmg + Math.floor((floor - 1) / 4), xp: d.xp,
      flash: 0, anim: Math.random() * 2, kx: 0, ky: 0, summonT: 4, phase: Math.random() * 6.28,
      dashCd: 2 + Math.random(), dash: 0, warn: 0, ddx: 0, ddy: 0,
      shotT: 1 + Math.random() * 1.5, blinkT: 3 + Math.random() * 2, fade: 0, appear: 0, swell: 0,
      hopT: Math.random(), stompT: 2 + Math.random() * 2, ringT: 2.5,
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
    const cb = classes[p.weapon];
    if (floor > cb.best) { cb.best = floor; saveClasses(false); }
    if (floor > best) {
      best = floor; store.set(KEY_BEST, best);
      if (window.PD_CLOUD) window.PD_CLOUD.saveBest(best);
    }
    sfx.stairs();
    p.vx = 0; p.vy = 0;
    camSnap = true;
    p.hp = Math.min(p.maxHp, p.hp + 2);
    clearLists();
    stairs = null;
    genRoom();
    p.x = spawn.x; p.y = spawn.y;
    startFloor();
  }

  function newGame() {
    floor = 1; kills = 0; pendingLevels = 0;
    runBest = classes[weaponId].best; bossKills = 0; soulsGiven = false;
    p = makePlayer();
    camSnap = true;
    clearLists();
    stairs = null;
    genRoom();
    p.x = spawn.x; p.y = spawn.y;
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
    else if (p.weapon === 'boomerang') fireBoomerangs(tg);
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

  // ----- Boomerang -----
  // Thrown toward a monster; a pull back to the hero makes it slow down and return.
  // Each monster can be hit once on the way out and once on the way back.
  const RANG_SPEED = 170;
  function fireBoomerangs(tg) {
    const w = p.w, base = Math.atan2(tg.y - p.y, tg.x - p.x);
    const maxD = p.range * 0.85 * w.dist;
    for (let i = 0; i < w.count; i++) {
      const a = base + (i - (w.count - 1) / 2) * 0.38;
      rangs.push({
        x: p.x, y: p.y - 2, vx: Math.cos(a) * RANG_SPEED, vy: Math.sin(a) * RANG_SPEED,
        pull: (RANG_SPEED * RANG_SPEED) / (2 * maxD), back: false, life: 4, spin: Math.random() * 6,
        hitOut: new Set(), hitBack: new Set(), trail: [],
      });
    }
    sfx.throw();
  }
  function updateRangs(dt) {
    const w = p.w, W = WEAPONS.boomerang;
    for (const r of rangs) {
      r.life -= dt;
      r.spin += dt * 22;
      const hx = p.x - r.x, hy = p.y - 2 - r.y, hd = Math.hypot(hx, hy) || 1;
      if (!r.back) {
        r.vx += (hx / hd) * r.pull * dt;
        r.vy += (hy / hd) * r.pull * dt;
        if (r.vx * hx + r.vy * hy > 0) r.back = true; // it turned around
        if (solidTile(Math.floor(r.x / TILE), Math.floor(r.y / TILE))) { r.back = true; spark(r.x, r.y, W.glow, 4, 40, 0.25); }
      } else {
        // Fly back to the hero (over walls), a little faster each moment.
        const sp = Math.min(260, Math.hypot(r.vx, r.vy) + 300 * dt);
        r.vx = (hx / hd) * sp; r.vy = (hy / hd) * sp;
        if (hd < 7) { r.dead = true; continue; }
      }
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.trail.unshift({ x: r.x, y: r.y });
      if (r.trail.length > 9) r.trail.pop();
      if (r.life <= 0) { r.dead = true; continue; }
      const set = r.back ? r.hitBack : r.hitOut;
      const sp = Math.hypot(r.vx, r.vy) || 1;
      for (const e of enemies) {
        if (e.dead || set.has(e)) continue;
        const dx = e.x - r.x, dy = e.y - r.y, rr = e.r + w.size * 0.6;
        if (dx * dx + dy * dy < rr * rr) {
          set.add(e);
          hurtEnemy(e, wDmg(), r.vx / sp, r.vy / sp, 0.8);
          spark(r.x, r.y, W.glow, 5, 60, 0.25);
          sfx.blade();
        }
      }
    }
    rangs = rangs.filter((r) => !r.dead);
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
    updateRangs(dt);
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
    const kb = (isBoss(e) ? 25 : 90) * kbMul * (crit ? 1.6 : 1);
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
    const big = isBoss(e);
    burst(e.x, e.y, ETYPES[e.type].color, big ? 30 : 9, big ? 80 : 50);
    burst(e.x, e.y, '#6b0f1a', big ? 20 : 6, 60);
    stampBlood(e.x, e.y, big);
    if (e.type === 'bloater') { spark(e.x, e.y, '#d77fae', 12, 70, 0.45, 2); smoke(e.x, e.y, 5, 3, 8); }
    sfx.kill();
    if (big) bossKills++;
    if (e.elite) {
      // The elite drops all the EXP of the floor.
      const n = Math.min(8, Math.ceil(e.xp / 5));
      for (let i = 0; i < n; i++) gems.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), v: Math.ceil(e.xp / n) });
      hearts.push({ x: e.x, y: e.y });
    } else if (big) {
      for (let i = 0; i < 6; i++) gems.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), v: 3 });
      hearts.push({ x: e.x, y: e.y });
      shake = 6;
    } else {
      gems.push({ x: e.x, y: e.y, vx: rand(-20, 20), vy: rand(-20, 20), v: e.xp });
      if (e.type === 'sewer' && !e.small) {
        for (let i = 0; i < 2; i++) pending.push({ type: 'sewer', small: true, x: e.x + rand(-5, 5), y: e.y + rand(-5, 5), t: 0.05 });
      }
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

  // ---------- Monster moves and bullets ----------
  // Is there no wall between 2 points?
  function los(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (solidTile(Math.floor((x0 + (x1 - x0) * k) / TILE), Math.floor((y0 + (y1 - y0) * k) / TILE))) return false;
    }
    return true;
  }
  // A free spot at a distance between a and b from (x, y).
  function nearSpot(x, y, a, b) {
    for (let i = 0; i < 24; i++) {
      const ang = Math.random() * 6.283, r = rand(a, b);
      const nx = x + Math.cos(ang) * r, ny = y + Math.sin(ang) * r;
      const tx = Math.floor(nx / TILE), ty = Math.floor(ny / TILE);
      if (solidTile(tx, ty) || map[ty * ROOM_W + tx] === T_LAVA) continue;
      return { x: tx * TILE + 8, y: ty * TILE + 8 };
    }
    return null;
  }
  function phantomAlpha(e) {
    if (e.type !== 'phantom') return 1;
    if (e.fade > 0) return e.fade / 0.5;
    if (e.appear > 0) return 1 - e.appear / 0.5;
    return 1;
  }
  // Slow bullets. They stop at walls. home > 0: the bullet turns to the hero.
  function fireShot(x, y, a, sp, dmg, color, home = 0) {
    shots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, dmg, color, home, life: home ? 4 : 3.5 });
  }
  function updateShots(dt) {
    for (const s of shots) {
      if (s.home) {
        let a = Math.atan2(s.vy, s.vx), da = Math.atan2(p.y - s.y, p.x - s.x) - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        a += clamp(da, -s.home * dt, s.home * dt);
        s.vx = Math.cos(a) * s.sp; s.vy = Math.sin(a) * s.sp;
      }
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || solidTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) {
        s.dead = true; spark(s.x, s.y, s.color, 3, 30, 0.25, 1.5);
      } else if (Math.hypot(p.x - s.x, p.y - s.y) < p.r + 2) {
        s.dead = true; spark(s.x, s.y, s.color, 5, 40, 0.3, 1.5);
        hurtPlayer(s.dmg, null);
      }
    }
    shots = shots.filter((s) => !s.dead);
  }
  function drawShots() {
    for (const s of shots) {
      glow(s.x, s.y, 7, s.color, 0.55);
      const x = snap(s.x - camX), y = snap(s.y - camY);
      g.fillStyle = s.color; g.fillRect(x - 1.5, y - 1.5, 3, 3);
      g.fillStyle = '#ffffff'; g.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  }
  // Special moves of the newer monsters. Returns how to change the walk:
  // 'away' (step back), 'stop', 'slow', a speed factor, 'gone' (the monster died), or nothing.
  function monsterMove(e, dt, d, ux, uy) {
    const T = e.type, dm = Math.max(1, e.dmg - 1);
    const aim = Math.atan2(p.y - e.y, p.x - e.x);
    if (ETYPES[T].shoot) {
      // Shooters keep some distance, and shoot when they can see the hero.
      const see = d < 130 && los(e.x, e.y, p.x, p.y);
      e.shotT -= dt;
      if (see && e.shotT <= 0) {
        if (T === 'archer') { e.shotT = 2.4; fireShot(e.x, e.y, aim, 55, dm, '#ffcd75'); }
        else if (T === 'wraith') { e.shotT = 3; for (const o of [-0.3, 0, 0.3]) fireShot(e.x, e.y, aim + o, 45, dm, '#9be7ff'); }
        else { e.shotT = 2.8; fireShot(e.x, e.y, aim, 38, dm, '#c06bff', 1.3); }
        sfx.shoot();
      }
      if (see && d < 50) return 'away';
      if (see && d < 85) return 'stop';
      return;
    }
    if (T === 'phantom') {
      e.blinkT -= dt;
      if (e.fade > 0) {
        e.fade -= dt;
        if (e.fade <= 0) {
          const s = nearSpot(p.x, p.y, 36, 60);
          if (s) { e.x = s.x; e.y = s.y; }
          e.appear = 0.5;
        }
        return 'stop';
      }
      if (e.appear > 0) { e.appear -= dt; return 'slow'; }
      if (e.blinkT <= 0 && d > 45) { e.fade = 0.5; e.blinkT = 4 + Math.random() * 2; }
      return;
    }
    if (T === 'bloater') {
      if (e.swell > 0) {
        e.swell -= dt;
        if (e.swell <= 0) {
          // Burst: hurts the hero when close.
          if (Math.hypot(p.x - e.x, p.y - e.y) < 26) hurtPlayer(e.dmg, null);
          ring(e.x, e.y, 3, 26, '#d77fae', 0.35, 2);
          e.hp = 0; killEnemy(e);
          return 'gone';
        }
        return 'stop';
      }
      if (d < 20) e.swell = 0.7;
      return;
    }
    if (T === 'leech') {
      // Hops: a fast jump, then a short rest.
      e.hopT -= dt;
      if (e.hopT <= 0) e.hopT = 0.85;
      return e.hopT > 0.5 ? 2.6 : 0.15;
    }
    if (T === 'golem') {
      e.stompT -= dt;
      if (e.warn > 0) {
        e.warn -= dt;
        if (e.warn <= 0) {
          const a0 = Math.random() * 6.283;
          for (let i = 0; i < 6; i++) fireShot(e.x, e.y, a0 + (i * Math.PI) / 3, 40, dm, '#ff8a2a');
          shake = Math.max(shake, 1.5); sfx.shoot();
        }
        return 'stop';
      }
      if (e.stompT <= 0 && d < 110) { e.warn = 0.6; e.stompT = 4.5; }
      return;
    }
    if (T === 'lich') {
      e.ringT -= dt;
      if (e.ringT <= 0 && d < 170) {
        e.ringT = 3.2;
        const a0 = Math.random() * 6.283;
        for (let i = 0; i < 8; i++) fireShot(e.x, e.y, a0 + (i * Math.PI) / 4, 36, dm, '#b98cff');
        sfx.shoot();
      }
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
    const under = tileAt(p.x, p.y);
    const slow = under === T_WATER ? 0.6 : under === T_ICE ? 1.25 : 1; // water slows, ice is fast
    p.vx = mx * p.speed * slow;
    p.vy = my * p.speed * slow;
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
    if (tileAt(p.x, p.y) === T_LAVA && p.inv <= 0) {
      spark(p.x, p.y + 3, '#ff7a1a', 6, 40, 0.35, 1.5);
      hurtPlayer(1, null);
      if (state !== 'play') return;
    }
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Weapon (attacks automatically)
    updateWeapon(dt);

    // Spawning
    fl.spawnT -= dt;
    if (fl.toSpawn > 0 && fl.spawnT <= 0 && enemies.length + pending.length < fl.maxAlive) {
      const s = freeSpot(64);
      pending.push({ type: pickType(), x: s.x, y: s.y, t: 0.7, elite: fl.fast });
      fl.toSpawn--;
      fl.spawnT = fl.rate;
    }
    for (const s of pending) {
      s.t -= dt;
      if (s.t <= 0) {
        const en = makeEnemy(s.type, s.x, s.y);
        if (s.small) { en.small = true; en.r = 3; en.hp = en.maxHp = en.maxHp * 0.35; en.speed *= 1.5; en.xp = 1; }
        if (s.elite) { en.elite = true; en.hp = en.maxHp = en.maxHp * 3; en.xp = fl.fastXp; }
        enemies.push(en); s.done = true;
      }
    }
    pending = pending.filter((s) => !s.done);

    // Enemies (they walk around walls with the distance map)
    updateFlow();
    if (floor % 5 === 0) updateBigFlow();
    for (const e of enemies) {
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      let dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const ux = dx, uy = dy; // straight to the hero
      const path = isBoss(e) ? steerBig(e) : steer(e);
      if (path) { dx = path.x; dy = path.y; }
      if (e.type === 'bat' || e.type === 'fireimp' || e.type === 'ghost') {
        const wob = Math.sin(t * 6 + e.phase) * 0.7;
        const ox = dx;
        dx += -dy * wob; dy += ox * wob;
      }
      let spd = e.speed;
      if (!ETYPES[e.type].fly) {
        const under = tileAt(e.x, e.y);
        if (under === T_WATER) spd *= 0.6; else if (under === T_ICE) spd *= 1.25;
      }
      if (e.type === 'knight' || e.type === 'brute') {
        // Bone Knight and Plague Brute: stop for a moment, then charge.
        const bk = e.type === 'brute';
        e.dashCd -= dt;
        if (e.dash > 0) { e.dash -= dt; dx = e.ddx; dy = e.ddy; spd *= bk ? 2.8 : 3.2; }
        else if (e.warn > 0) {
          e.warn -= dt; spd = 0;
          if (e.warn <= 0) { e.dash = bk ? 0.6 : 0.45; e.ddx = ux; e.ddy = uy; }
        } else if (e.dashCd <= 0 && d < (bk ? 130 : 80) && d > 18) { e.warn = bk ? 0.7 : 0.4; e.dashCd = bk ? 4 : 3.2; }
      }
      const r = monsterMove(e, dt, d, ux, uy);
      if (r === 'gone') continue;
      if (r === 'away') { dx = -ux; dy = -uy; spd *= 0.8; } else if (r === 'stop') spd = 0;
      else if (r === 'slow') spd *= 0.3; else if (typeof r === 'number') spd *= r;
      e.x += (dx * spd + e.kx) * dt;
      e.y += (dy * spd + e.ky) * dt;
      const f = Math.exp(-9 * dt);
      e.kx *= f; e.ky *= f;
      collide(e);

      if (e.type === 'boss' || e.type === 'lich') {
        // The Horned Demon calls zombies; the Bone Lich calls skeletons.
        e.summonT -= dt;
        if (e.summonT <= 0 && enemies.length < 30) {
          e.summonT = e.type === 'lich' ? 7 : 5;
          for (let i = 0; i < 2; i++) pending.push({ type: e.type === 'lich' ? 'skel' : 'slime', x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), t: 0.6 });
        }
      }

      // A faded phantom cannot touch the hero.
      if (d < e.r + p.r && phantomAlpha(e) > 0.6) hurtPlayer(e.dmg, e);
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
          const wa = isBoss(b) ? 1.6 : isBoss(a) ? 0.4 : 1;
          a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
          b.x += (dx / d) * push * (2 - wa); b.y += (dy / d) * push * (2 - wa);
        }
      }
    }

    updateShots(dt);
    if (state !== 'play' && state !== 'dying') return;
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
    // The hero always stays in the middle of the play area
    // (halfway between the top bar and the joystick), also at the room edges.
    const tx = p.x - viewW / 2;
    const ty = p.y - (viewH - bottomPad + topPad) / 2;
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

    // Boomerangs: light trail and a spinning gold boomerang
    const BW = WEAPONS.boomerang;
    for (const r of rangs) {
      const k = p.w.size / 5;
      for (let j = 0; j < r.trail.length - 1; j++) {
        const f = 1 - j / r.trail.length;
        glowLine([r.trail[j], r.trail[j + 1]], 2.4 * k * f, BW.color, 0.5 * f);
      }
      glow(r.x, r.y, 7 * k, BW.glow, 0.6);
      g.save();
      g.translate(r.x - camX, r.y - camY);
      g.rotate(r.spin);
      g.scale(k, k);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = PAL.k; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-3.5, -3); g.lineTo(0, 0); g.lineTo(-3.5, 3); g.stroke();
      g.strokeStyle = BW.color; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-3.5, -3); g.lineTo(0, 0); g.lineTo(-3.5, 3); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(-3, -2.4); g.lineTo(-0.3, 0); g.stroke();
      g.restore();
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
    for (const c of candles) addLight(c.x, c.y, 30, 0.85);
    for (const c of shrooms) addLight(c.x, c.y, 26, 0.8);
    for (const s of shots) addLight(s.x, s.y, 12, 0.8);
    for (const id of lavaTiles) addLight((id % ROOM_W) * TILE + 8, ((id / ROOM_W) | 0) * TILE + 8, 22, 0.55);
    for (const e of enemies) {
      if (e.type === 'fireimp') addLight(e.x, e.y, 18, 0.7);
      else if (e.type === 'eye' || e.type === 'wraith') addLight(e.x, e.y, 14, 0.6);
      else if (e.type === 'golem') addLight(e.x, e.y, 16, 0.5);
      if (e.elite) addLight(e.x, e.y, 26, 0.9);
    }
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
    for (const r of rangs) addLight(r.x, r.y, 18, 0.75);
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
    drawWater();

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
      if (Math.floor(s.t * 10) % 2) drawSpr(SPR.mark, s.x, s.y, false, false, isBoss(s) ? 2 : 1);
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
      if (e.elite) glow(e.x, e.y, 16, '#ffcd75', 0.4);
      const fast = Math.floor(e.anim * (e.type === 'bat' ? 10 : 4)) % 2;
      if (e.type === 'slime') { shadow(e.x, e.y + 3, 8); drawSpr(fast ? SPR.slimeB : SPR.slimeA, e.x, e.y, false, white); }
      else if (e.type === 'bat') { shadow(e.x, e.y + 6, 6); drawSpr(fast ? SPR.batB : SPR.batA, e.x, e.y - 2, false, white); }
      else if (e.type === 'skel') { shadow(e.x, e.y + 5, 8); drawSpr(SPR.skel, e.x, e.y - 1 - fast, p.x < e.x, white); }
      else if (e.type === 'sewer') { const k = e.small ? 0.7 : 1; shadow(e.x, e.y + 3 * k, 8 * k); drawSpr(fast ? SPR.sewerB : SPR.sewerA, e.x, e.y, false, white, k); }
      else if (e.type === 'fireimp') { shadow(e.x, e.y + 6, 6); drawSpr(fast ? SPR.fireB : SPR.fireA, e.x, e.y - 2, false, white); }
      else if (e.type === 'knight') { shadow(e.x, e.y + 6, 10); drawSpr(SPR.knight, e.x, e.y - 1 - (e.dash > 0 ? 0 : fast), p.x < e.x, white || e.warn > 0); }
      else if (e.type === 'archer') { shadow(e.x, e.y + 5, 8); drawSpr(SPR.archer, e.x, e.y - 1 - fast, p.x < e.x, white); }
      else if (e.type === 'ghost') {
        g.globalAlpha = 0.6 + 0.2 * Math.sin(t * 2 + e.phase);
        drawSpr(fast ? SPR.ghostA : SPR.ghostB, e.x, e.y - 3 + Math.sin(t * 3 + e.phase), p.x < e.x, white);
        g.globalAlpha = 1;
      }
      else if (e.type === 'wraith') { shadow(e.x, e.y + 7, 8); drawSpr(fast ? SPR.wraithA : SPR.wraithB, e.x, e.y - 3 + Math.sin(t * 3 + e.phase), p.x < e.x, white); }
      else if (e.type === 'bloater') {
        const k = 1 + (e.swell > 0 ? (0.7 - e.swell) / 0.7 * 0.4 : 0.04 * Math.sin(t * 3 + e.phase));
        shadow(e.x, e.y + 5 * k, 10 * k); drawSpr(SPR.bloater, e.x, e.y, false, white, k);
      }
      else if (e.type === 'phantom') {
        g.globalAlpha = Math.max(0, Math.min(1, phantomAlpha(e)));
        shadow(e.x, e.y + 6, 7); drawSpr(SPR.phantom, e.x, e.y - 2 + Math.sin(t * 2.5 + e.phase), p.x < e.x, white);
        g.globalAlpha = 1;
      }
      else if (e.type === 'leech') { shadow(e.x, e.y + 3, 10); drawSpr(e.hopT > 0.5 ? SPR.leechB : SPR.leechA, e.x, e.y, p.x > e.x, white); }
      else if (e.type === 'golem') { shadow(e.x, e.y + 7, 12); drawSpr(SPR.golem, e.x, e.y - 1 - (e.warn > 0 ? 1 : fast), false, white); }
      else if (e.type === 'eye') { shadow(e.x, e.y + 7, 6); drawSpr(SPR.eye, e.x, e.y - 3 + Math.sin(t * 3 + e.phase), false, white); }
      else if (isBoss(e)) {
        shadow(e.x, e.y + 12, 22);
        const BS = { boss: [SPR.bossA, SPR.bossB], lich: [SPR.lichA, SPR.lichB], brute: [SPR.bruteA, SPR.bruteB] }[e.type];
        drawSpr(fast ? BS[1] : BS[0], e.x, e.y - (e.type === 'lich' ? 2 + Math.sin(t * 2) : 0), false, white, 2);
        const bw = 24, bx = snap(e.x - camX - bw / 2), by = snap(e.y - camY - 19);
        g.fillStyle = PAL.k; g.fillRect(bx - 1, by - 1, bw + 2, 4);
        g.fillStyle = '#ef4b5b'; g.fillRect(bx, by, Math.max(0, Math.round(bw * e.hp / e.maxHp)), 2);
      }
      if (e.elite) {
        const bw = 16, bx = snap(e.x - camX - bw / 2), by = snap(e.y - camY - 13);
        g.fillStyle = PAL.k; g.fillRect(bx - 1, by - 1, bw + 2, 4);
        g.fillStyle = '#ffcd75'; g.fillRect(bx, by, Math.max(0, Math.round(bw * e.hp / e.maxHp)), 2);
      }
    }

    drawParticles(false);
    drawTorchBrackets();
    drawDarkness();
    drawLavaGlow();
    drawTorchFlames();
    drawCandles();
    drawShrooms();
    drawShots();
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
    setText(hud.foe, 'foe', fl && fl.cleared ? 'GO TO STAIRS' : 'ENEMIES ' + left);
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
      const c = classes[id];
      const prog = document.createElement('em'); prog.className = 'cls-line';
      prog.textContent = 'SOULS ' + c.souls + ' · LV ' + (c.atk + c.spd + c.hp) + ' · BEST F' + c.best;
      txt.append(name, document.createElement('br'), desc, document.createElement('br'), tags, document.createElement('br'), prog);
      btn.append(ico, txt);
      btn.addEventListener('click', () => openClass(id));
      box.appendChild(btn);
    }
    show('scrWeapon');
  }

  // Class screen: spend Souls on upgrades, then PLAY.
  let clsId = null;
  function openClass(id) {
    clsId = id;
    const W = WEAPONS[id], c = classes[id];
    $('clsName').textContent = W.name.toUpperCase();
    $('clsName').style.color = W.color;
    $('clsSouls').textContent = c.souls;
    $('clsBest').textContent = c.best;
    const box = $('clsUps');
    box.innerHTML = '';
    for (const u of CLASS_UPS) {
      const lvl = c[u.id], cost = classCost(lvl);
      const row = document.createElement('div');
      row.className = 'card cls-up';
      const ico = document.createElement('span');
      ico.className = 'ico pic'; ico.style.setProperty('--ic', u.color);
      const sign = document.createElement('em'); sign.textContent = u.tag(lvl);
      ico.append(iconCanvas(u.pic), sign);
      const txt = document.createElement('span');
      const name = document.createElement('b'); name.textContent = u.name;
      const info = document.createElement('small'); info.textContent = 'LV ' + lvl + ' → ' + u.tag(lvl + 1);
      txt.append(name, document.createElement('br'), info);
      const up = document.createElement('button');
      up.className = 'up-btn';
      up.textContent = cost + ' SOULS';
      up.disabled = c.souls < cost;
      up.addEventListener('click', () => {
        if (c.souls < cost) return;
        c.souls -= cost; c[u.id]++;
        saveClasses(true);
        sfx.gem();
        openClass(id);
      });
      row.append(ico, txt, up);
      box.appendChild(row);
    }
    hide('scrWeapon');
    show('scrClass');
  }

  // Give the Souls of this run to the class (once per run).
  function giveSouls() {
    if (soulsGiven || !p) return 0;
    soulsGiven = true;
    const c = classes[p.weapon], n = floorSouls(floor - 1) + bossKills * 5;
    c.souls += n; c.earned += n; c.best = Math.max(c.best, floor);
    saveClasses(false);
    return n;
  }

  function startGame() {
    unlockAudio();
    hide('scrWeapon'); hide('scrClass');
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
      name: u.name, desc: u.desc, pic: u.pic, tag: typeof u.tag === 'function' ? u.tag(p.w) : u.tag,
      color: W.color, weapon: true, apply: () => u.apply(p.w),
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
      // Pixel icon with a value sign (for example a rocket and "+1").
      ico.className = 'ico pic'; ico.style.setProperty('--ic', u.color);
      const sign = document.createElement('em'); sign.textContent = u.tag;
      ico.append(iconCanvas(u.pic), sign);
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
    // The cards slide in one by one (style.css). The short delay also stops
    // a finger on the joystick from selecting a card by accident.
    setTimeout(() => cards.querySelectorAll('button').forEach((b) => { b.disabled = false; }), 500);
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
    const souls = giveSouls();
    $('ovSouls').textContent = '+' + souls + ' SOULS FOR ' + WEAPONS[p.weapon].name.toUpperCase();
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
    cloud.saveRun({ floor, level: p.level, kills, weapon: p.weapon, classes }).then((r) => {
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

  // Keyboard (computer): WASD or arrow keys to move, Esc or P to pause.
  // e.code is the key position, so WASD also works with other keyboard layouts.
  const key = { x: 0, y: 0 };
  const down = new Set();
  const MOVE_KEYS = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
  function keyAxis() {
    key.x = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
    key.y = (down.has('ArrowDown') || down.has('KeyS') ? 1 : 0) - (down.has('ArrowUp') || down.has('KeyW') ? 1 : 0);
  }
  addEventListener('keydown', (e) => {
    if (MOVE_KEYS[e.code]) {
      down.add(e.code); keyAxis();
      if (state === 'play') e.preventDefault();
      return;
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
      if (state === 'play') pauseGame();
      else if (state === 'paused') resumeGame();
    }
  });
  addEventListener('keyup', (e) => { down.delete(e.code); keyAxis(); });
  // Do not keep walking when the window loses focus (the key-up is lost).
  addEventListener('blur', () => { down.clear(); keyAxis(); });

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
    throw: limited('throw', 80, () => { noise(0.18, 0.03, 1800); beep(520, 0.15, 'triangle', 0.015, 300); }),
    launch: limited('launch', 60, () => { noise(0.25, 0.035, 900); beep(260, 0.22, 'sawtooth', 0.015, 260); }),
    boom: limited('boom', 50, () => { noise(0.5, 0.09, 600); beep(110, 0.4, 'sine', 0.09, -70); }),
    hit: limited('hit', 40, () => beep(240, 0.05, 'square', 0.025, -120)),
    crit: limited('crit', 60, () => { beep(1200, 0.07, 'square', 0.03, -600); noise(0.08, 0.04, 3000); }),
    kill: limited('kill', 50, () => beep(180, 0.14, 'sawtooth', 0.035, -130)),
    gem: limited('gem', 45, () => beep(1100, 0.06, 'triangle', 0.035, 500)),
    hurt: () => beep(140, 0.25, 'sawtooth', 0.07, -80),
    shoot: limited('shoot', 120, () => beep(420, 0.1, 'triangle', 0.02, -160)),
    heal: () => { beep(660, 0.08, 'triangle', 0.05); beep(990, 0.12, 'triangle', 0.05, 0, 0.08); },
    level: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.035, 0, i * 0.08)); },
    clear: () => { [784, 988, 1175].forEach((f, i) => beep(f, 0.1, 'triangle', 0.05, 0, i * 0.09)); },
    stairs: () => { [523, 392, 330, 262].forEach((f, i) => beep(f, 0.1, 'square', 0.04, 0, i * 0.07)); },
  };

  const btnMute = $('btnMute');
  // The sound switch is in the pause menu.
  function syncMute() { btnMute.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON'; }
  btnMute.addEventListener('click', () => { muted = !muted; store.set(KEY_MUTE, muted ? '1' : '0'); syncMute(); unlockAudio(); });
  syncMute();

  // ---------- Buttons ----------
  $('btnStart').addEventListener('click', openWeaponSelect);
  $('btnAgain').addEventListener('click', openWeaponSelect);
  $('btnWeaponBack').addEventListener('click', () => { hide('scrWeapon'); toTitle(); });
  $('btnClassPlay').addEventListener('click', () => {
    weaponId = clsId;
    store.set(KEY_WEAPON, clsId);
    startGame();
  });
  $('btnClassBack').addEventListener('click', () => { hide('scrClass'); openWeaponSelect(); });
  $('btnPause').addEventListener('click', pauseGame);
  $('btnResume').addEventListener('click', resumeGame);
  $('btnQuit').addEventListener('click', () => {
    if (floor > best) { best = floor; store.set(KEY_BEST, best); }
    giveSouls();
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
    topPad = Math.round((hb + 4) * cssToLogical);
    if (DESKTOP) {
      // No joystick on a computer: the play area goes down to the bottom.
      bottomPad = Math.round(8 * cssToLogical);
    } else {
      const stWasHidden = stick.classList.contains('hidden');
      stick.classList.remove('hidden');
      const st = stick.getBoundingClientRect().top - r.top;
      if (stWasHidden) stick.classList.add('hidden');
      bottomPad = Math.round((h - st + 8) * cssToLogical);
    }
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
    setWeapon: (id) => { id = weaponFix(id); if (WEAPONS[id]) { weaponId = id; store.set(KEY_WEAPON, id); } },
    getClasses: () => classes,
    // Merge the cloud classes with the device: for each class, keep the one with more Souls earned.
    // Returns true when the device has newer data (then auth.js saves it to the cloud).
    mergeClasses: (remote) => {
      const r = loadClasses(remote);
      let localNewer = false;
      for (const id of WEAPON_ORDER) {
        if (r[id].earned > classes[id].earned) classes[id] = r[id];
        else if (JSON.stringify(r[id]) !== JSON.stringify(classes[id])) localNewer = true;
      }
      saveClasses(false);
      return localNewer;
    },
  };

  window.__pd = { get state() { return state; }, get floor() { return floor; }, get player() { return p; }, get enemies() { return enemies; }, get stairs() { return stairs; }, get area() { return area.id; }, get room() { return { w: ROOM_W, h: ROOM_H }; }, get shots() { return shots.length; }, get fx() { return { beams: beams.length, zaps: zaps.length, rockets: rockets.length, rangs: rangs.length, booms: booms.length, parts: parts.length, hits: hitfx.length }; } };

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
