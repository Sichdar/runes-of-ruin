/* Runes of Ruin - acts, story, the 15 hand-made levels of Act I, and the endless level generator.
   Layout characters:
     .  no cell            #  plain cell
     b B X  bone pile with 1 / 2 / 3 hits
     k K    bone pile (1 / 2 hits) on cursed ground
     g G    cursed ground, 1 / 2 layers, with a tile on it
     c      chained tile           h H  chained tile on cursed ground (1 / 2 layers)
     r      relic placed at start
   Goals: {type:'color', color:0..5, n}, {type:'bone'}, {type:'ground'}, {type:'chain'}, {type:'relic'}
   (n for obstacle goals is counted from the layout; relic n = level.relics). */
(function (G) {
  'use strict';

  // Board colours per theme (backgrounds are drawn by art.js)
  G.THEMES = {
    moors:  { cellA: '#2b2722', cellB: '#231f1b', frame: '#3a2c20', frameHi: '#8a6a42', accent: '#b0281a' },
    desert: { cellA: '#3a2d20', cellB: '#30251a', frame: '#4a3420', frameHi: '#b08a50', accent: '#d07020' },
    jungle: { cellA: '#1f2a21', cellB: '#19221b', frame: '#26301f', frameHi: '#6e8a4a', accent: '#40b060' },
    hell:   { cellA: '#2c1614', cellB: '#24100e', frame: '#3a120c', frameHi: '#a0402a', accent: '#ff5020' },
    frost:  { cellA: '#1f2731', cellB: '#192029', frame: '#2a3442', frameHi: '#8aa0b8', accent: '#80c0ff' },
    abyss:  { cellA: '#1b151f', cellB: '#151019', frame: '#2a1a30', frameHi: '#7a5090', accent: '#c060ff' }
  };

  G.COLOR_NAMES = ['Blood Vials', 'Sapphires', 'Emeralds', 'Cursed Coins', 'Soul Shards', 'Skulls'];
  G.GOAL_NAMES = { bone: 'Bone Piles', ground: 'Cursed Ground', chain: 'Chains', relic: 'Relics' };

  const ACTS = [
    { roman: 'I', name: 'The Hollow Moors', theme: 'moors',
      story: 'Three nights ago the bells of the Pale Spear cloister fell silent. The sisters who raised you now walk its halls as hollow things, bound to the Widow of Thorns.\n\nTake up your javelins, Kaela. Purge the moors, and do not look the dead in the eye.' },
    { roman: 'II', name: 'The Scorched Wastes', theme: 'desert',
      story: 'The Widow\'s heart crumbled to ash, but the darkness inside it fled east on the hot wind. Beneath the dunes lie tombs older than any kingdom.\n\nSomething down there is waking.' },
    { roman: 'III', name: 'The Drowned Jungle', theme: 'jungle',
      story: 'The trail of rot leads into the drowned jungle, where the temples of a vanished faith sink into black water.\n\nThe priests still pray here. Not to their old gods.' },
    { roman: 'IV', name: 'The Burning Gate', theme: 'hell',
      story: 'Beneath the last temple the ground opens onto fire. This is the Burning Gate, where the darkness was born.\n\nNo huntress has walked here and returned. You will be the first.' },
    { roman: 'V', name: 'The Frostspire', theme: 'frost',
      story: 'The thing you hunt has fled up the frozen spire, toward the old stone that holds the world together. If the stone breaks, everything breaks.\n\nOne climb left, Kaela.' }
  ];
  const ABYSS_STORY = 'The stone holds. The mountain is quiet.\n\nBut beneath every grave there is another, and the Abyss has no floor. Descend as far as you dare.';
  const ACT_BOSS = ['The Widow\'s Throne', 'Tomb of the Sand Wyrm', 'Altar of the Drowned Council', 'Pit of the First Flame', 'The Heartstone Summit'];
  const WORDS = [
    null,
    { a: ['Sunken', 'Bleached', 'Howling', 'Forgotten', 'Sealed', 'Cracked', 'Silent', 'Gilded', 'Thirsting'], b: ['Tombs', 'Oasis', 'Dunes', 'Necropolis', 'Canyon', 'Vault', 'Bazaar', 'Pits', 'Colonnade'] },
    { a: ['Weeping', 'Rotting', 'Flooded', 'Strangled', 'Serpent', 'Black', 'Hollow', 'Fevered', 'Moonless'], b: ['Temple', 'Marsh', 'Causeway', 'Shrine', 'Ziggurat', 'Delta', 'Canopy', 'Sluice', 'Reliquary'] },
    { a: ['Burning', 'Screaming', 'Molten', 'Chained', 'Flayed', 'Ashen', 'Writhing', 'Sulphur', 'Bleeding'], b: ['Steps', 'Forge', 'River', 'Plains', 'Bastion', 'Spires', 'Pits', 'Gate', 'Throne Road'] },
    { a: ['Frozen', 'Bitter', 'Shattered', 'White', 'Howling', 'Pale', 'Glacial', 'Silent', 'Iron'], b: ['Pass', 'Crags', 'Halls', 'Ridge', 'Barrows', 'Glacier', 'Bridge', 'Watch', 'Ascent'] }
  ];
  const ACT1_NAMES = ['Moorside Camp', 'The Weeping Fen', 'Burial Barrows', 'Cold Hollow', 'Ravenhill', 'The Drowned Chapel',
    'Gallows Road', 'Ashen Field', 'Bonewood', 'The Old Mill', 'Tower of Bells', 'The Outer Cloister',
    'Barracks of the Fallen', 'The Inner Sanctum', 'The Widow\'s Throne'];

  // ---------- Act I: hand-made ----------
  const ACT1 = [
    { moves: 16, colors: 5, goals: [{ type: 'color', color: 0, n: 20 }],
      tip: 'Swipe a tile into its neighbour to line up 3 or more of a kind.',
      layout: ['#######', '#######', '#######', '#######', '#######', '#######', '#######', '#######'] },
    { moves: 19, colors: 5, goals: [{ type: 'color', color: 1, n: 22 }, { type: 'color', color: 2, n: 22 }],
      tip: 'Match 4 in a line to forge a Javelin. Tap it, or swipe it, to hurl it across the board.',
      layout: ['########', '########', '########', '########', '########', '########', '########', '########'] },
    { moves: 15, colors: 5, goals: [{ type: 'bone' }],
      tip: 'Bone piles block the way. Match right beside them to smash them.',
      layout: ['########', '########', '#bb##bb#', '#bB##Bb#', '########', 'b######b', 'bb####bb', '########', '########'] },
    { moves: 22, colors: 5, goals: [{ type: 'bone' }, { type: 'color', color: 3, n: 30 }],
      tip: 'Match 4 in a square to summon a Raven. It flies to whatever you need most.',
      layout: ['########', '########', '########', '#B####B#', '#BB##BB#', '########', '##BBBB##', '########', '########'] },
    { moves: 24, colors: 5, goals: [{ type: 'ground' }],
      tip: 'Cursed ground lies under some tiles. Clear the tiles on top of it to purge it.',
      layout: ['########', '########', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg', 'gggggggg'] },
    { moves: 21, colors: 5, goals: [{ type: 'bone' }, { type: 'color', color: 0, n: 25 }],
      tip: 'Match in an L or T shape to light a Fire Bomb.',
      layout: ['#########', '#########', '#########', 'BBB###BBB', '#########', '#########', '##BBBBB##', '#########', '#########'] },
    { moves: 21, colors: 5, goals: [{ type: 'chain' }, { type: 'color', color: 4, n: 30 }],
      tip: 'Chained tiles can\'t move. Use them in a match to break the chains.',
      layout: ['########', '########', '#cc##cc#', '#cc##cc#', '########', '##cccc##', '#c####c#', '########', '########'] },
    { moves: 28, colors: 5, relics: 4, goals: [{ type: 'relic' }],
      tip: 'Bring the Relics down to the bottom of the board to claim them.',
      layout: ['#########', '#########', '#r#####r#', '#########', '#########', '#########', '.#######.', '..#####..', '...###...'] },
    { moves: 22, colors: 5, goals: [{ type: 'ground' }, { type: 'bone' }],
      tip: 'Match 5 in a line to create a Chaos Orb. Swipe it into a tile to destroy every tile of that kind.',
      layout: ['#########', '#########', '#GGGGGGG#', '#GB###BG#', '#G##X##G#', '#GB###BG#', '#GGGGGGG#', '#########', '#########'] },
    { moves: 30, colors: 5, relics: 3, goals: [{ type: 'relic' }, { type: 'chain' }],
      tip: 'Swipe two power-ups into each other for a devastating combo.',
      layout: ['...###...', '...###...', '..#####..', '#########', 'cc#####cc', 'cc#c#c#cc', '#########', '..#####..', '...###...', '...###...'] },
    { moves: 22, colors: 5, goals: [{ type: 'bone' }],
      tip: 'Bone piles before a gravestone take three blows.',
      layout: ['#########', '#########', '#XbbbbbX#', '#b#####b#', '#b#####b#', '#b#####b#', '#XbbbbbX#', '#########', '#########'] },
    { moves: 24, colors: 5, goals: [{ type: 'ground' }, { type: 'chain' }],
      tip: 'The curse runs deep here. Every tile you clear purges the ground beneath it.',
      layout: ['gggggggg', 'gggggggg', 'ghgggghg', 'gggggggg', 'ggghhggg', 'gggggggg', 'ghgggghg', 'gggggggg', 'gggggggg'] },
    { moves: 38, colors: 6, relics: 3, goals: [{ type: 'color', color: 0, n: 20 }, { type: 'color', color: 5, n: 20 }, { type: 'relic' }],
      tip: 'Six kinds of tiles now. Matches are rarer, so make every power-up count.',
      layout: ['#########', '#########', '#########', '#########', '#########', '#########', '#########', '#########', '#########'] },
    { moves: 26, colors: 5, goals: [{ type: 'bone' }, { type: 'chain' }, { type: 'ground' }],
      tip: 'Dark cursed ground takes two clears to purge.',
      layout: ['.#######.', '#########', 'XBB###BBX', '#BB#c#BB#', '###ccc###', 'GGGG#GGGG', 'GGGGHGGGG', 'GGGG#GGGG', '#########', '.#######.'] },
    { moves: 38, colors: 5, relics: 4, goals: [{ type: 'bone' }, { type: 'chain' }, { type: 'ground' }, { type: 'relic' }],
      tip: 'The Widow waits on her throne of thorns. End this.',
      layout: ['#########', '#X##r##X#', '#GgggggG#', 'BbhGGGhbB', 'BbGGXGGbB', 'BbhGGGhbB', '#GgggggG#', '##ggggg##', '#########', '#########'] }
  ];

  // ---------- endless generator ----------
  function sym(rows, C, r, c, ch) { rows[r][c] = ch; rows[r][C - 1 - c] = ch; }

  function generate(n) {
    const rng = G.rng(n * 7919 + 1013);
    const actIdx = Math.floor((n - 1) / 15), pos = (n - 1) % 15;
    const tier = Math.min(actIdx, 6);
    const C = rng.pick(tier < 2 ? [8, 9, 9] : [9, 9, 8]);
    const R = 8 + rng.int(3);
    const rows = [];
    for (let r = 0; r < R; r++) rows.push(new Array(C).fill('#'));
    // shape
    const shape = rng.int(6);
    if (shape === 1) { sym(rows, C, 0, 0, '.'); sym(rows, C, R - 1, 0, '.'); }
    if (shape === 2) { sym(rows, C, 0, 0, '.'); sym(rows, C, 0, 1, '.'); sym(rows, C, 1, 0, '.'); }
    if (shape === 3) { for (let r = R - 3; r < R; r++) for (let c = 0; c < r - (R - 4); c++) sym(rows, C, r, c, '.'); }
    if (shape === 4) { const mr = Math.floor(R / 2); sym(rows, C, mr, 0, '.'); sym(rows, C, mr - 1, 0, '.'); }
    if (shape === 5 && C === 9) { for (let r = 0; r < 2; r++) { sym(rows, C, r, 0, '.'); sym(rows, C, r, 1, '.'); } }
    const free = (r, c) => rows[r][c] === '#';
    // goals
    const pool = ['bone', 'ground', 'chain', 'relic', 'color'];
    rng.shuffle(pool);
    const nGoals = pos === 14 ? 3 : (rng() < .15 ? 1 : 2);
    const kinds = pool.slice(0, nGoals);
    const goals = [];
    const colors = tier >= 2 && rng() < .25 ? 6 : 5;
    let relics = 0, colorNeed = 0;
    const hpMax = Math.min(3, 1 + Math.floor((tier + pos / 15) / 1.5));
    const hpCh = hp => hp === 3 ? 'X' : hp === 2 ? 'B' : 'b';
    let boneHp = 0, groundLayers = 0, chains = 0;
    for (const k of kinds) {
      if (k === 'bone') {
        const style = rng.int(3);
        const hp = 1 + rng.int(hpMax);
        if (style === 0) { const r = 2 + rng.int(R - 5); for (let c = 0; c < C; c++) if (free(r, c) && (c < 2 || c > C - 3 || rng() < .5)) { rows[r][c] = hpCh(hp); boneHp += hp; } }
        else if (style === 1) { const r = 2 + rng.int(R - 5); for (const c of [1, 2]) for (const dr of [0, 1]) if (free(r + dr, c)) { sym(rows, C, r + dr, c, hpCh(hp)); boneHp += hp * 2; } }
        else { const r = 2 + rng.int(R - 4); for (let c = 1; c < Math.ceil(C / 2); c += 2) if (free(r, c)) { sym(rows, C, r, c, hpCh(hp)); boneHp += hp * 2; } }
        goals.push({ type: 'bone' });
      } else if (k === 'ground') {
        const lv = tier >= 1 && rng() < .4 ? 2 : 1;
        const ch = lv === 2 ? 'G' : 'g';
        const r0 = 1 + rng.int(2), r1 = R - 2 - rng.int(2), c0 = rng.int(3);
        for (let r = r0; r <= r1; r++) for (let c = c0; c < C - c0; c++) if (free(r, c) && (rng() < .85)) { rows[r][c] = ch; groundLayers += lv; }
        goals.push({ type: 'ground' });
      } else if (k === 'chain') {
        const cnt = 3 + rng.int(3 + tier);
        for (let i = 0; i < cnt; i++) { const r = 1 + rng.int(R - 2), c = rng.int(Math.floor(C / 2)); if (free(r, c) || rows[r][c] === 'g') { sym(rows, C, r, c, rows[r][c] === 'g' ? 'h' : 'c'); chains += 2; } }
        goals.push({ type: 'chain' });
      } else if (k === 'relic') {
        relics = 3 + rng.int(1 + Math.min(tier, 2));
        goals.push({ type: 'relic' });
      } else {
        const col = rng.int(colors);
        colorNeed = 24 + rng.int(10) + tier * 4;
        goals.push({ type: 'color', color: col, n: colorNeed });
      }
    }
    // bone piles must not seal a column off completely at the top: open top rows
    for (let c = 0; c < C; c++) for (let r = 0; r < 2; r++) if ('bBX'.includes(rows[r][c])) rows[r][c] = '#';
    const layout = rows.map(r => r.join(''));
    return { moves: 0, colors, goals, layout, relics, tier, pos };
  }

  // Move budget for a generated level: a quick greedy bot plays it a few times with fixed seeds,
  // and the player gets a margin over what the bot needed. The margin shrinks act by act.
  // Result is remembered in the save so it runs once per level.
  const SLACK = [1.6, 1.5, 1.42, 1.36, 1.3, 1.25, 1.2];
  function botMovesNeeded(lvl, seed) {
    const L = Object.assign({}, lvl, { moves: 99 });
    const b = new G.Board(L, seed);
    const rng = G.rng(seed + 99);
    let used = 0;
    while (b.moves > 0 && !b.isWon() && used < 70) {
      let moves = b.listMoves(true);
      if (!moves.length) break;
      if (moves.length > 14) moves = rng.shuffle(moves).slice(0, 14);
      let best = -1, pick = moves[0];
      for (const m of moves) {
        const c = b.clone();
        c.rng.setState((rng() * 4294967296) >>> 0);
        m.tap ? c.tap(m.tap.r, m.tap.c) : c.trySwap(m.a, m.b);
        const s = c.progress() + rng() * .01;
        if (s > best) { best = s; pick = m; }
      }
      pick.tap ? b.tap(pick.tap.r, pick.tap.c) : b.trySwap(pick.a, pick.b);
      used++;
    }
    return b.isWon() ? used : 70;
  }
  function calibrate(n, lvl) {
    const S = G.Save && G.Save.data;
    const key = (lvl.bossInfo ? 'b' : 'm') + n; // boss fights got their own key when bosses came in [S07]
    if (S && S.calib && S.calib[key]) return S.calib[key];
    const runs = [];
    for (let i = 0; i < 7; i++) runs.push(botMovesNeeded(lvl, n * 101 + i * 7));
    runs.sort((a, b) => a - b);
    const need = runs[4];
    const slack = SLACK[Math.min(lvl.tier + 1, SLACK.length - 1)] - lvl.pos * 0.005;
    const moves = G.clamp(Math.ceil(need * slack) + 1, 15, 45);
    if (S) { S.calib = S.calib || {}; S.calib[key] = moves; G.Save.save(); }
    return moves;
  }

  // ---------- public ----------
  G.Levels = {
    count: Infinity,
    actOf(n) { return Math.floor((n - 1) / 15); },
    act(idx) {
      if (idx < ACTS.length) return Object.assign({ idx, first: idx * 15 + 1 }, ACTS[idx]);
      const circle = idx - ACTS.length + 1;
      return { idx, first: idx * 15 + 1, roman: 'Abyss ' + circle, name: 'The Abyss · Circle ' + circle, theme: 'abyss', story: ABYSS_STORY };
    },
    name(n) {
      const a = this.actOf(n), pos = (n - 1) % 15;
      if (a === 0) return ACT1_NAMES[pos];
      if (pos === 14 && a < ACTS.length) return ACT_BOSS[a];
      const w = WORDS[a < ACTS.length ? a : 1 + (a % 4)];
      const rng = G.rng(n * 31 + 7);
      if (a >= ACTS.length) return 'Depth ' + (n - ACTS.length * 15);
      return 'The ' + rng.pick(w.a) + ' ' + rng.pick(w.b);
    },
    get(n) {
      let base;
      const boss = (n - 1) % 15 === 14;
      if (n <= 15) base = JSON.parse(JSON.stringify(ACT1[n - 1]));
      else base = generate(n);
      // Boss fight [S07]: the boss's health is the only goal; obstacles stay, relics go
      if (boss && G.Boss) {
        const B = G.Boss.forLevel(n);
        base.bossInfo = B;
        base.goals = [{ type: 'boss', n: B.hp, boss: B.id }];
        base.relics = 0;
        base.layout = base.layout.map(row => row.replace(/r/g, '#'));
        base.tip = B.tip;
      }
      if (n > 15) base.moves = calibrate(n, base);
      const act = this.act(this.actOf(n));
      base.n = n;
      base.name = this.name(n);
      base.act = act;
      base.theme = act.theme;
      base.boss = boss;
      return base;
    }
  };
})(window.G);
