/* Runes of Ruin - the home screen: the Cloister and the places beyond it, rune stones, small jobs, perks,
   and the win streak. [S06; jobs, home, second place and streak S10]
   Stones are not stored: every level won for the first time gives 1 (an act's last level gives 3),
   so the total follows from Save.data.unlocked; what is left = earned - jobs done (each job costs 1 stone).
   Each area is a list of jobs. A job with a prop puts that small thing into the picture; a job without one
   is a building step (ruin -> scaffold -> roofed -> lit) and moves the area's perk up one stage.
   Save: data.camp.jobs = { gate: jobs done, ... }; data.camp.perksOff = true turns every perk off;
   data.winStreak = 0..3. Old saves (data.camp.built = stages) are moved over once. */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const snd = (n, o) => { if (G.Audio && G.Audio.play) G.Audio.play(n, o); };
  const J = (n, p) => ({ n, p }); // a job: its name, and the prop it adds [type, x, y] (none = a building step)
  const AREA_GIFT = 100;          // gold for finishing an area
  // an iron-bound chest whose lid flies open (CSS in index.html, .chest) [S12]
  const CHEST_SVG = '<svg class="chest" viewBox="0 0 120 100" aria-hidden="true">' +
    '<defs><radialGradient id="chGlow"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a30" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="chWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a26"/><stop offset="1" stop-color="#3a200e"/></linearGradient></defs>' +
    '<ellipse class="ch-glow" cx="60" cy="46" rx="58" ry="40" fill="url(#chGlow)"/>' +
    '<g class="ch-body"><rect x="18" y="50" width="84" height="40" rx="3" fill="url(#chWood)" stroke="#1a0c04" stroke-width="2"/>' +
    '<rect x="18" y="58" width="84" height="5" fill="#5a5a62"/><rect x="18" y="80" width="84" height="5" fill="#5a5a62"/>' +
    '<rect x="30" y="50" width="6" height="40" fill="#6a6a74"/><rect x="84" y="50" width="6" height="40" fill="#6a6a74"/>' +
    '<rect x="53" y="52" width="14" height="16" rx="2" fill="#c8a040" stroke="#5a3a10" stroke-width="1.5"/><circle cx="60" cy="59" r="2.4" fill="#2a1606"/></g>' +
    '<g class="ch-lid"><path d="M18 50 V36 Q60 14 102 36 V50 Z" fill="url(#chWood)" stroke="#1a0c04" stroke-width="2"/>' +
    '<path d="M30 50 V31 M90 50 V31" stroke="#6a6a74" stroke-width="6"/><path d="M18 44 Q60 24 102 44" stroke="#5a5a62" stroke-width="4" fill="none"/></g></svg>';

  const PLACES = [
    { name: 'The Cloister', sub: 'Raise the huntress\'s sanctuary',
      done: 'The Cloister stands again, and the huntress keeps her vigil in the light.\n\nBelow the hill, the old hamlet of Greywater lies dark and empty. Its people fled long ago. Perhaps they would come back.' },
    { name: 'Greywater Hamlet', short: 'Greywater', sub: 'Bring the valley back to life',
      done: 'Smoke rises from Greywater\'s chimneys again, and the mill sails turn.\n\nBeyond the river more ruins wait, for another day.' }
  ];

  // A job's p: [prop, x, y, z?] puts a small thing on the ground; {d, f, a, z, b?} hangs a decoration on a wall
  // (f = 'y' left face, 'x' right face, 'T0y'/'T1x' the gate towers; a = along the wall 0..1; z = height 0..1;
  // b = 2: the second cottage). Spots were picked so nothing stands behind a building or a front wall. [S10]
  const AREAS = [
    // ---------- the Cloister ----------
    { id: 'gate', place: 0, name: 'The Gate', what: 'Guards the way in.',
      perks: ['+1 move in every level', '+2 moves in every level', '+3 moves in every level'],
      jobs: [J('Haul away the rubble', ['cart', 8.6, 5.6]), J('Raise the gate towers'), J('Stack fresh timber', ['wood', 8.5, 6.6]),
        J('Hang the gate shield', { d: 'shield', f: 'T0y', a: .5, z: .62 }), J('Rebuild the battlements'), J('Set a watch brazier', ['brazier', 8.3, 7.6]),
        J('Hang a lamp by the road', ['lantern', 7.6, 7.0]), J('Paint the second shield', { d: 'shield', f: 'T1x', a: .5, z: .62 }),
        J('Put out a bench for the watch', ['bench', 8.6, 4.6]), J('Light the gate torches')] },
    { id: 'treasury', place: 0, name: 'The Treasury', what: 'Keeps what the dead leave behind.',
      perks: ['+10% gold for every win', '+20% gold for every win', '+30% gold for every win'],
      jobs: [J('Dig out the vault', ['sacks', 5.3, 8.6]), J('Raise the vault walls'), J('Carry in an iron chest', ['chest', 6.2, 8.6]),
        J('Hang a lamp by the door', { d: 'lamp', f: 'y', a: .34, z: .55 }), J('Roof the treasury'), J('Roll in the wine barrels', ['barrel', 7.1, 8.6]),
        J('Hang the coin-house shield', { d: 'shield', f: 'y', a: .5, z: .82 }), J('Set a lamp on the path', ['lantern', 4.4, 8.5]),
        J('Plant a window box', { d: 'box', f: 'x', a: .5, z: .42 }), J('Fill the coffers')] },
    { id: 'forge', place: 0, name: 'The Forge', what: 'Arms you before each fight.',
      perks: ['Every level starts with a javelin', 'Every level starts with a javelin, and a loss lowers your win streak by one instead of ending it',
        'Every level starts with a javelin and a fire bomb, and a loss lowers your win streak by one'],
      jobs: [J('Clear the old forge floor', ['wood', 5.6, 3.8]), J('Rebuild the forge walls'), J('Drag in the great anvil', ['anvil', 8.6, 2.6]),
        J('Stack the charcoal', ['sacks', 8.5, 0.7]), J('Raise the forge roof'), J('Fill the quench barrel', ['barrel', 8.7, 1.6]),
        J('Hang the tongs and hammers', ['crates', 8.6, 3.6]), J('Build a water trough', ['trough', 6.6, 3.8]), J('Set up the whetstone', ['bench', 7.6, 4.1]),
        J('Light the great forge')] },
    { id: 'chapel', place: 0, name: 'The Chapel', what: 'Its prayers buy you time.',
      perks: ['Extra moves cost 25% less', 'Extra moves cost half', 'Extra moves cost half, and the first in each level is free'],
      jobs: [J('Pull the weeds from the graves', ['grave', 1.5, 8.7]), J('Rebuild the chapel walls'), J('Plant a yew tree', ['tree', 0.6, 8.4]),
        J('Hang a lamp by the door', { d: 'lamp', f: 'y', a: .25, z: .45 }), J('Raise the chapel roof'), J('Carve new pews', ['bench', 2.5, 8.6]),
        J('Plant a flower box', { d: 'box', f: 'x', a: .26, z: .36 }), J('Hang a second lamp', { d: 'lamp', f: 'y', a: .75, z: .45 }),
        J('Set a stone urn by the path', ['urn', 3.5, 8.6]), J('Ring the bell at dusk')] },
    { id: 'shrine', place: 0, name: 'Shrine of the Huntress', what: 'Her statue, raised again.', needs: 'Opens when the other four are fully restored.',
      perks: ['The plinth stands again', 'Her statue rises from the dust', 'Her statue shines, and the title screen shows your cloister'],
      jobs: [J('Sweep the shrine steps', ['candles', 4.0, 4.0, .25]), J('Set pilgrim candles', ['candles', 2.6, 4.0, .25]), J('Rebuild the plinth'),
        J('Bring an offering urn', ['urn', 4.0, 2.6, .25]), J('Plant moon lilies', ['herbs', 1.9, 2.6]), J('Raise her statue'),
        J('Lay a pilgrims\' bench', ['bench', 3.6, 1.9]), J('Hang the prayer bell', ['bell', 4.7, 3.0]), J('Fly her banner', ['flag', 2.8, 0.9]),
        J('Light her spear')] },
    // ---------- Greywater Hamlet ----------
    { id: 'well', place: 1, name: 'The Well', what: 'The heart of the village square.',
      perks: ['The hammer costs 80 gold', 'The hammer costs 65 gold', 'The hammer costs 50 gold'],
      jobs: [J('Clear the choked well', ['cart', 6.3, 4.3]), J('Rebuild the well ring'), J('Set out a water trough', ['trough', 4.3, 6.3]),
        J('Plant herbs by the path', ['herbs', 6.2, 6.2]), J('Raise the well roof'), J('Put up a lamp post', ['lantern', 7.2, 6.6]),
        J('Bring the village bench', ['bench', 3.4, 6.4]), J('Stack the water barrels', ['barrel', 5.6, 7.2]), J('Hang a bell by the well', ['bell', 4.2, 7.4]),
        J('Draw the first clean water')] },
    { id: 'cottages', place: 1, name: 'The Cottages', what: 'Homes for the people who come back.',
      perks: ['The villagers gave you 100 gold', 'The villagers gave you 200 gold', 'The villagers gave you 300 gold'], gifts: [100, 200, 300],
      jobs: [J('Clear the burnt beams', ['wood', 3.4, 9.0]), J('Rebuild the cottage walls'), J('Set out hay for the goats', ['hay', 3.6, 7.9]),
        J('Raise the village banner', ['flag', 4.4, 9.0]), J('Thatch the cottage roofs'), J('Plant a window box', { d: 'box', f: 'y', a: .26, z: .3 }),
        J('Plant an apple tree', ['tree', 6.4, 9.0]), J('Fix the cottage doors', ['crates', 5.4, 9.0]), J('Hang a lamp by the door', { d: 'lamp', f: 'x', a: .82, z: .55, b: 2 }),
        J('Light the cottage hearths')] },
    { id: 'tavern', place: 1, name: 'The Tavern', what: 'Warm ale and old stories.',
      perks: ['Daily Trial wins give 50 gold more', 'Daily Trial wins give 1 rune stone more', 'Daily Trial wins give 1 rune stone and 100 gold more'],
      jobs: [J('Clear the tavern cellar', ['barrel', 3.4, 2.8]), J('Rebuild the tavern walls'), J('Roll in the ale crates', ['crates', 7.0, 3.6]),
        J('Set tables in the yard', ['bench', 5.4, 3.2]), J('Roof the tavern'), J('Hang a lamp by the door', { d: 'lamp', f: 'y', a: .47, z: .55 }),
        J('Light a fire pit outside', ['fire', 4.2, 3.6]), J('Plant a window box', { d: 'box', f: 'y', a: .26, z: .3 }), J('Plant a second box', { d: 'box', f: 'x', a: .48, z: .3 }),
        J('Open the tavern doors')] },
    { id: 'tower', place: 1, name: 'The Watchtower', what: 'Sees the bosses coming.',
      perks: ['Boss levels start with a javelin', 'Boss levels start with a javelin and a raven', 'Boss levels start with a javelin, a raven and a fire bomb'],
      jobs: [J('Clear the fallen stones', ['cart', 2.4, 3.4]), J('Rebuild the tower base'), J('Hang the watch shield', { d: 'shield', f: 'y', a: .5, z: .88 }),
        J('Post a banner at the gate', ['flag', 7.4, 9.0]), J('Raise the tower roof'), J('Hang a lamp at the door', { d: 'lamp', f: 'x', a: .25, z: .4 }),
        J('Store the arrows', ['barrel', 6.6, 8.0]), J('Set the signal brazier', ['brazier', 8.0, 7.6]), J('Fly a banner from the tower', { d: 'banner', f: 'x', a: .75, z: .9 }),
        J('Light the tower beacon')] },
    { id: 'mill', place: 1, name: 'The Mill', what: 'Bread, and gold from the grain trade.',
      perks: ['+5% gold for every win', '+10% gold for every win', '+20% gold for every win'],
      jobs: [J('Clear the millstones', ['sacks', 9.0, 4.0]), J('Rebuild the mill walls'), J('Bring in sacks of grain', ['sacks', 9.0, 5.2]),
        J('Mend the grain cart', ['cart', 9.0, 6.4]), J('Raise the mill roof'), J('Stack the hay', ['hay', 9.0, 7.6]),
        J('Hang a lamp by the mill', { d: 'lamp', f: 'y', a: .3, z: .4 }), J('Patch the grain loft', ['crates', 8.6, 8.8]), J('Plant a window box', { d: 'box', f: 'y', a: .7, z: .35 }),
        J('Turn the sails again')] }
  ];
  const BYID = {};
  AREAS.forEach(a => { BYID[a.id] = a; a.steps = []; a.jobs.forEach((j, i) => { if (!j.p) a.steps.push(i + 1); }); });

  const camp = () => {
    const S = G.Save.data;
    if (!S.camp || typeof S.camp !== 'object') S.camp = {};
    const c = S.camp;
    if (!c.jobs) { // move an old save (stages) over to jobs: same stones spent [S10]
      c.jobs = {};
      const b = c.built || {};
      for (const a of AREAS) {
        const s = b[a.id] || 0;
        if (s) c.jobs[a.id] = a.id === 'shrine' ? a.jobs.length : a.steps[Math.min(s, a.steps.length) - 1];
      }
    }
    return c;
  };
  const done = id => camp().jobs[id] || 0;
  const stage = id => { const a = BYID[id], d = done(id); let s = 0; for (const x of a.steps) if (d >= x) s++; return s; };
  const complete = a => done(a.id) >= a.jobs.length;

  const Cloister = {
    AREAS, PLACES,
    stage, done, complete,
    // stones a first win of level n gives
    stonesFor(level) { return level && level.boss ? 3 : level && level.cursed ? 2 : 1; }, // Cursed levels pay 2 (S9) [S12]
    // camp.bonus = stones won in daily trials and chests, the only stones that are stored [S08, S12]
    earned() { const n = Math.max(0, G.Save.data.unlocked - 1); return n + 2 * Math.floor(n / 15) + G.Levels.cursedUpTo(n) + (camp().bonus || 0); },
    addBonus(k) { camp().bonus = (camp().bonus || 0) + k; G.Save.save(); },
    spent() { let s = 0; for (const a of AREAS) s += done(a.id); return s; },
    stones() { return this.earned() - this.spent(); },
    perksOn() { return !camp().perksOff; },
    setPerks(on) { camp().perksOff = !on; G.Save.save(); },
    perk(id) { return this.perksOn() ? stage(id) : 0; },
    placeDone(pi) { return AREAS.every(a => a.place !== pi || complete(a)); },
    placeOpen(pi) { return pi === 0 || this.placeDone(pi - 1); },
    // the place being rebuilt now: the first one not finished (or the last)
    curPlace() { for (let i = 0; i < PLACES.length; i++) if (!this.placeDone(i)) return i; return PLACES.length - 1; },
    isOpen(a) { return this.placeOpen(a.place) && (!a.needs || AREAS.every(b => b === a || b.place !== a.place || complete(b))); },
    nextJob(a) { return complete(a) ? null : a.jobs[done(a.id)]; },
    canBuild(a) { return !complete(a) && this.isOpen(a) && this.stones() >= 1; },
    anyAffordable() { return AREAS.some(a => this.canBuild(a)); },
    shrineDone() { return stage('shrine') >= 3; },
    // do the next job of an area for 1 stone; says what changed
    build(id) {
      const a = BYID[id];
      if (!a || !this.canBuild(a)) return null;
      const S = G.Save.data, s0 = stage(id), job = a.jobs[done(id)], pd0 = this.placeDone(a.place);
      camp().jobs[id] = done(id) + 1;
      const s1 = stage(id), r = { area: a, job, stageUp: s1 > s0, stage: s1, gold: 0, areaDone: complete(a), placeDone: !pd0 && this.placeDone(a.place) };
      if (r.stageUp && a.gifts) r.gold += a.gifts[s1 - 1];
      if (r.areaDone) r.gold += AREA_GIFT;
      S.gold += r.gold;
      G.Save.save();
      return r;
    },

    // ---------- perks used by main.js and daily.js ----------
    extraMoves() { return this.perk('gate'); },
    goldMult() { return 1 + 0.1 * this.perk('treasury') + [0, .05, .1, .2][this.perk('mill')]; },
    forgeKinds() { const f = this.perk('forge'); return f >= 3 ? ['jav', 'bomb'] : f >= 1 ? ['jav'] : []; },
    towerKinds() { return ['jav', 'raven', 'bomb'].slice(0, this.perk('tower')); },
    movePrice(base, buys) {
      const s = this.perk('chapel');
      if (s >= 3 && buys === 0) return 0;
      return Math.round(base * (s >= 2 ? 0.5 : s === 1 ? 0.75 : 1));
    },
    hammerPrice(base) { return [base, 80, 65, 50][this.perk('well')]; },
    dailyExtra() { const t = this.perk('tavern'); return { gold: t === 1 ? 50 : t === 3 ? 100 : 0, stones: t >= 2 ? 1 : 0 }; },

    // ---------- the win streak (S6) [S10]: 1, 2, 3 wins in a row start the next level with helpers ----------
    streak() { return G.clamp(G.Save.data.winStreak || 0, 0, 3); },
    streakKinds() { return ['jav', 'bomb', 'raven'].slice(0, this.streak()); },
    streakWords(n) { return ['nothing', 'a javelin', 'a javelin and a fire bomb', 'a javelin, a fire bomb and a raven'][G.clamp(n, 0, 3)]; },
    streakUp() { G.Save.data.winStreak = Math.min(3, this.streak() + 1); G.Save.save(); return this.streak(); },
    // a lost or abandoned level; the Forge (stage 2+) only lowers it by one. Returns the new streak.
    streakDown() { const n = this.perk('forge') >= 2 ? Math.max(0, this.streak() - 1) : 0; G.Save.data.winStreak = n; G.Save.save(); return n; },

    // ---------- chests (S9) [S12]: one every 10 levels won, one every 10 jobs done ----------
    // camp.chestL / camp.chestB = chests of each kind already opened. Old saves start counting from now.
    chestInit() {
      const c = camp();
      if (c.chestL === undefined) { c.chestL = Math.floor((G.Save.data.unlocked - 1) / 10); c.chestB = Math.floor(this.spent() / 10); G.Save.save(); }
      return c;
    },
    chestState() {
      const c = this.chestInit(), lv = Math.max(0, G.Save.data.unlocked - 1), sp = this.spent();
      return { L: { have: lv % 10, ready: Math.floor(lv / 10) - c.chestL }, B: { have: sp % 10, ready: Math.floor(sp / 10) - c.chestB } };
    },
    nextChest() { const s = this.chestState(); return s.L.ready > 0 ? 'L' : s.B.ready > 0 ? 'B' : null; },
    // free helpers won from chests, used instead of gold: data.items = { bomb, hammer }
    items() { const S = G.Save.data; if (!S.items || typeof S.items !== 'object') S.items = { bomb: 0, hammer: 0 }; return S.items; },
    useItem(k) { const it = this.items(); if (!(it[k] > 0)) return false; it[k]--; G.Save.save(); return true; },
    itemWords(k, n) { return n + ' ' + (k === 'bomb' ? 'fire bomb' : k === 'hammer' ? 'free hammer' : 'rune stone') + (n > 1 ? 's' : ''); },
    // open one chest: gold, plus 2 (level chest) or 1 (builder's chest) helpers or stones
    openChest(kind) {
      const c = this.chestInit(), S = G.Save.data, it = this.items();
      const big = kind === 'L';
      if (big) c.chestL++; else c.chestB++;
      const gold = 10 * Math.round((big ? 80 + Math.random() * 70 : 50 + Math.random() * 50) / 10);
      const got = { bomb: 0, hammer: 0, stone: 0 };
      for (let i = 0; i < (big ? 2 : 1); i++) { const r = Math.random(); got[r < .35 ? 'bomb' : r < .7 ? 'hammer' : 'stone']++; }
      it.bomb += got.bomb; it.hammer += got.hammer;
      if (got.stone) c.bonus = (c.bonus || 0) + got.stone;
      S.gold += gold;
      G.Save.save();
      return { kind, gold, got };
    },
    // show the next ready chest, then the one after it, if any
    checkChests(after) {
      const k = this.nextChest();
      if (!k || G.UI.modalOpen()) { if (after) after(); return false; }
      const r = this.openChest(k);
      const lines = ['+' + r.gold + ' gold'];
      for (const x of ['bomb', 'hammer', 'stone']) if (r.got[x]) lines.push(this.itemWords(x, r.got[x]));
      snd('forge'); setTimeout(() => snd('coin'), 700);
      G.UI.modal({
        title: k === 'L' ? 'Level Chest' : 'Builder\'s Chest', sub: k === 'L' ? '10 more levels won' : '10 more jobs done',
        html: CHEST_SVG + '<div class="chest-loot">' + lines.map(s => '<div>' + s + '</div>').join('') + '</div>' +
          (r.got.bomb || r.got.hammer ? '<span class="perk-note">Free helpers are used before gold</span>' : ''),
        buttons: [{ label: 'Take it', cls: 'big', fn: () => { this.refresh(); this.checkChests(after); } }]
      });
      if (G.Cast) G.Cast.event('chest');
      return true;
    },

    // Put power-ups on plain tiles of a new board (before the view copies it).
    arm(board, kindsIn) {
      const kinds = kindsIn || this.forgeKinds(); // kindsIn: the fire bomb bought with gold, streak or tower helpers
      if (!kinds.length) return 0;
      const spots = [];
      for (let r = 0; r < board.R; r++) for (let c = 0; c < board.C; c++) {
        const x = board.cells[r][c];
        if (!x.v && x.t && x.t.kind === 'n' && !x.t.chained && !x.bone) spots.push(x); // v = a hole in the board
      }
      let n = 0;
      for (const k of kinds) {
        if (!spots.length) break;
        const x = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
        x.t = new G.Tile(k === 'jav' ? (Math.random() < .5 ? 'jh' : 'jv') : k);
        n++;
      }
      return n;
    },

    // ---------- the home screen ----------
    open(onBack) {
      this.onBack = onBack;
      this.view = this.curPlace();
      $('btnClBack').onclick = () => { snd('click'); this.close(); onBack && onBack(); };
      $('btnPerks').onclick = () => { snd('click'); this.setPerks(!this.perksOn()); this.refresh(); };
      $('btnPlacePrev').onclick = () => { snd('click'); this.view = Math.max(0, this.view - 1); this.say(''); this.refresh(); };
      $('btnPlaceNext').onclick = () => { snd('click'); if (this.placeOpen(this.view + 1)) this.view++; this.say(''); this.refresh(); };
      this.fx = []; this.pop = null; this.say('');
      this.refresh();
      this.sizeArt();
      $('cloisterList').scrollTop = 0;
      // a chest that filled up while away opens on arrival [S12]
      clearTimeout(this.chestTimer);
      this.chestTimer = setTimeout(() => { if (this.raf) this.checkChests(); }, 450);
      if (!this.raf) {
        let last = performance.now();
        const loop = now => {
          if (!this.raf) return;
          const dt = Math.min(.05, (now - last) / 1000); last = now;
          this.t = (this.t || 0) + dt;
          this.drawArt(dt);
          this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
      }
    },
    close() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
    sizeArt() {
      const cv = $('cloisterArt');
      const w = Math.min(480, window.innerWidth);
      const h = Math.round(Math.min(w * 0.62, window.innerHeight * 0.3));
      const d = Math.min(2.5, window.devicePixelRatio || 1);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      this.aw = w; this.ah = h; this.ad = d;
    },
    // the line under the play buttons: what was just built, or what to do next
    say(text, good) { this.said = text; this.saidGood = !!good; },
    refresh() {
      const S = G.Save.data, pi = this.view || 0, P = PLACES[pi];
      $('clPlace').textContent = (P.short || P.name).toUpperCase();
      $('clSub').textContent = P.sub;
      $('clStones').textContent = this.stones();
      $('clGold').textContent = S.gold;
      $('btnPerks').textContent = 'Perks: ' + (this.perksOn() ? 'On' : 'Off');
      $('btnPlacePrev').classList.toggle('hidden', pi <= 0);
      $('btnPlaceNext').classList.toggle('hidden', !this.placeOpen(pi + 1) || pi >= PLACES.length - 1);
      const LV = G.Levels, nx = S.unlocked; // the next level says if it is a rescue or Cursed [S12]
      $('btnHomePlay').innerHTML = 'Level ' + nx + (LV.isRescue(nx) ? '<span class="tag rescue">Rescue Kaela</span>' : LV.isCursed(nx) ? '<span class="tag cursed">Cursed · 2 stones</span>' : '');
      // the win streak: three flames and what the next level starts with
      const n = this.streak();
      let fl = '';
      for (let i = 0; i < 3; i++) fl += '<i class="fl' + (i < n ? ' on' : '') + '"></i>';
      $('clStreak').innerHTML = 'Win streak ' + fl + ' ' + (n
        ? '<span>next level starts with <b>' + this.streakWords(n) + '</b></span>'
        : '<span>win levels in a row to start with helpers</span>');
      // the note: what just happened, else what to do
      const st = this.stones(), off = !this.perksOn();
      const note = $('clNote');
      note.textContent = this.said || (off ? 'Perks are off: levels play as if nothing were rebuilt.'
        : st > 0 && this.anyAffordable() ? 'You have ' + st + ' rune stone' + (st > 1 ? 's' : '') + '. Each one does a job below.'
        : this.placeDone(PLACES.length - 1) ? 'Everything here is rebuilt. More places come in a later version.'
        : 'Win new levels to earn rune stones. Each stone does one job.');
      note.classList.toggle('warn', off && !this.said);
      note.classList.toggle('good', !!this.said && this.saidGood);
      // the area cards of the place on show
      const list = $('cloisterList');
      [...list.querySelectorAll('.cl-card')].forEach(c => c.remove());
      const foot = $('clFoot');
      // chests and free helpers first (S9) [S12]
      const cs = this.chestState(), it = this.items();
      const chestRow = (label, x) => '<div class="ch-row"><i class="ch-ico"></i><span class="ch-name">' + label + '</span>' +
        '<div class="bar"><i style="width:' + (x.ready > 0 ? 100 : x.have * 10) + '%"></i></div><span>' + (x.ready > 0 ? 'ready' : x.have + '/10') + '</span></div>';
      const pack = ['bomb', 'hammer'].filter(k => it[k] > 0).map(k => this.itemWords(k, it[k]));
      const cc = document.createElement('div');
      cc.className = 'cl-card chests';
      cc.innerHTML = chestRow('Level chest', cs.L) + chestRow('Builder\'s chest', cs.B) +
        '<div class="cl-next">' + (pack.length ? 'In your pack: ' + pack.join(' · ') : 'A chest every 10 levels won and every 10 jobs done') + '</div>';
      list.insertBefore(cc, list.firstChild);
      for (const a of AREAS) {
        if (a.place !== pi) continue;
        const d = done(a.id), max = a.jobs.length, s = stage(a.id), open = this.isOpen(a);
        const card = document.createElement('div');
        card.className = 'cl-card' + (d >= max ? ' done' : '') + (!open ? ' locked' : '');
        let pips = '';
        for (let i = 0; i < a.steps.length; i++) pips += '<i class="' + (i < s ? 'on' : '') + '"></i>';
        const now = s > 0 ? a.perks[s - 1] : d > 0 ? 'Being cleared. ' + a.what : 'In ruins. ' + a.what;
        let html = '<div class="cl-row"><div class="cl-name">' + a.name + '</div><div class="cl-pips">' + pips + '</div></div>' +
          '<div class="cl-prog"><div class="bar"><i style="width:' + Math.round(100 * d / max) + '%"></i></div><span>' + d + '/' + max + '</span></div>' +
          '<div class="cl-perk">' + (d >= max ? 'Restored: ' : s > 0 ? 'Now: ' : '') + now + '</div>';
        if (d < max) {
          const nextStep = a.steps.find(x => x > d);
          html += '<div class="cl-next">' + (open ? 'At ' + nextStep + '/' + max + ': ' + a.perks[s] : a.needs) + '</div>';
        }
        card.innerHTML = html;
        if (d < max && open) {
          const b = document.createElement('button');
          b.className = 'btn cl-build';
          b.innerHTML = a.jobs[d].n + ' · 1 <span class="stone-ico"></span>';
          if (st < 1) b.disabled = true;
          b.onclick = () => this.doJob(a.id);
          card.appendChild(b);
        }
        list.insertBefore(card, foot);
      }
    },
    doJob(id) {
      const r = this.build(id);
      if (!r) return;
      const a = r.area;
      snd('forge'); setTimeout(() => snd('coin'), 160);
      if (r.job.p) { this.pop = { id, i: done(id) - 1, t: 0 }; this.burstAt = Array.isArray(r.job.p) ? [r.job.p[1], r.job.p[2]] : this.centerOf(id); }
      else { this.flashId = this.mainPart(a.id); this.flashT = 1; this.burstAt = this.centerOf(a.id); }
      let msg = 'Done: ' + r.job.n.charAt(0).toLowerCase() + r.job.n.slice(1) + '.';
      if (r.stageUp && !a.gifts) msg = a.name + ': ' + a.perks[r.stage - 1].charAt(0).toLowerCase() + a.perks[r.stage - 1].slice(1) + '.';
      if (r.gold) msg += ' +' + r.gold + ' gold';
      if (r.areaDone) msg = a.name + ' is restored! ' + (r.gold ? '+' + r.gold + ' gold' : '');
      this.say(msg, true);
      this.refresh();
      if (this.onChange) this.onChange();
      if (G.Cast) G.Cast.event(r.areaDone ? 'areaDone' : r.stageUp ? 'stageUp' : 'job', a.id); // S8 [S12]
      clearTimeout(this.chestTimer);
      if (!r.placeDone && this.nextChest()) this.chestTimer = setTimeout(() => { if (this.raf) this.checkChests(); }, 800); // [S12]
      if (r.placeDone) {
        const P = PLACES[a.place], next = a.place + 1 < PLACES.length;
        setTimeout(() => {
          snd('win');
          G.UI.modal({
            title: P.name, sub: 'Restored', body: P.done, story: true,
            buttons: [{ label: next ? 'To ' + PLACES[a.place + 1].name : 'Splendid', cls: 'big', fn: () => {
              if (next) { this.view = a.place + 1; this.say(''); }
              this.refresh();
              this.checkChests(); // [S12]
            } }]
          });
        }, 900);
      }
    },
    // where a building step shows in the picture: the area's building (cottages: the first house)
    mainPart(id) { return id; },
    centerOf(id) {
      const D = this.LAYOUT[id] || this.HLAYOUT[id];
      if (id === 'gate') return [9.1, 9.1];
      return D ? [D.x + (D.sx || 1) / 2, D.y + (D.sy || 1) / 2] : [5, 5];
    },

    // ---------- drawing: an angled 2.5D view [S09; props and the hamlet S10] ----------
    // The ground is a 10 x 10 diamond: gx runs to the lower right, gy to the lower left, z is up.
    // Moonlight comes from the upper right: faces turned right are lit, faces turned left are in shade,
    // and every building throws a shadow toward the lower left. The camera sways slowly, so near
    // things drift a little more than far ones.
    LAYOUT: {
      shrine:   { x: 3.3, y: 3.3, sx: 1.8, sy: 1.8 },
      chapel:   { kind: 'chapel', x: 2.0, y: 6.4, sx: 2.2, sy: 2.8, h: 2.0, roof: 'gableY', rh: 1.2, seed: 6 },
      forge:    { kind: 'forge', x: 6.6, y: 2.0, sx: 2.8, sy: 2.0, h: 1.4, roof: 'gableX', rh: .9, seed: 5 },
      treasury: { kind: 'treasury', x: 5.9, y: 7.0, sx: 2.0, sy: 1.8, h: 1.5, roof: 'pyramid', rh: 1.0, seed: 8 }
    },
    HLAYOUT: {
      // buildings stand in the back half, so the open front half is free for the props
      well:      { x: 5.0, y: 5.0, sx: 1.2, sy: 1.2 },
      tower:     { kind: 'tower', x: 1.6, y: 1.6, sx: 1.5, sy: 1.5, h: 3.4, roof: 'pyramid', rh: 1.3, seed: 4 },
      tavern:    { kind: 'tavern', x: 5.2, y: 1.4, sx: 2.6, sy: 1.8, h: 1.6, roof: 'gableX', rh: 1.0, seed: 6, pal: 'wood' },
      mill:      { kind: 'mill', x: 8.5, y: 2.2, sx: 1.6, sy: 1.6, h: 2.2, roof: 'pyramid', rh: .9, seed: 4, pal: 'wood' },
      cottages:  { kind: 'house', x: 1.8, y: 8.4, sx: 1.8, sy: 1.5, h: 1.3, roof: 'gableX', rh: .9, seed: 8, pal: 'wood', thatch: true },
      cottages2: { kind: 'house', area: 'cottages', x: 1.4, y: 5.2, sx: 1.6, sy: 1.8, h: 1.3, roof: 'gableY', rh: .9, seed: 3, pal: 'wood', thatch: true }
    },
    drawArt(dt) {
      const cv = $('cloisterArt');
      if (!cv || !this.aw) return;
      const g = cv.getContext('2d');
      g.setTransform(this.ad, 0, 0, this.ad, 0, 0);
      this.drawScene(g, 0, 0, this.aw, this.ah, this.t || 0, dt, false, this.view || 0);
      // a burst of sparks where the job was done
      if (this.burstAt && this.I) {
        const p = this.I.P(this.burstAt[0], this.burstAt[1], .4);
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
          this.fx.push({ x: p[0], y: p[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1 + Math.random() * .6, gold: Math.random() < .7 });
        }
        this.burstAt = null;
      }
      const fx = this.fx || [];
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life -= dt; if (p.life <= 0) { fx.splice(i, 1); continue; }
        p.vy += 140 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = Math.min(1, p.life);
        g.fillStyle = p.gold ? '#ffd870' : '#c8c0b8';
        g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      g.globalAlpha = 1;
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
      if (this.pop) { this.pop.t += dt * 1.6; if (this.pop.t >= 1) this.pop = null; }
    },

    // --- small helpers for the angled view ---
    shade(col, f) { return f < 0 ? G.mix(col, '#000000', -f) : G.mix(col, '#ffe8c8', f); },
    poly3(g, pts, fill, stroke) {
      const P = this.I.P;
      g.beginPath();
      pts.forEach((p, i) => { const q = P(p[0], p[1], p[2] || 0); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
    },
    // a solid block: left face (shade), right face (lit), top
    box(g, x0, y0, x1, y1, z0, z1, col, noTop) {
      this.poly3(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], this.shade(col, -.34));
      this.poly3(g, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], this.shade(col, .07));
      if (!noTop) this.poly3(g, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], this.shade(col, .2));
      // a thin moonlit edge on the nearest corner
      const P = this.I.P, a = P(x1, y1, z0), b = P(x1, y1, z1);
      g.strokeStyle = 'rgba(255,235,210,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    },
    // battlements along the top of a block's two front edges
    merlons(g, x0, y0, x1, y1, z, col) {
      const m = .28;
      for (let x = x0; x < x1 - m * .5; x += m * 2) this.box(g, x, y1 - m, Math.min(x + m, x1), y1, z, z + m * .9, col);
      for (let y = y0; y < y1 - m * 1.5; y += m * 2) this.box(g, x1 - m, y, x1, Math.min(y + m, y1 - m), z, z + m * .9, col);
    },
    hull(p) {
      p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
      for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    },
    // the shadow a block of height hz throws toward the lower left
    shadow(g, x0, y0, x1, y1, hz) {
      if (hz <= 0) return;
      const dx = -.1 * hz, dy = .62 * hz;
      const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1 + dx, y1 + dy], [x0 + dx, y1 + dy]];
      this.poly3(g, this.hull(pts).map(p => [p[0], p[1], 0]), 'rgba(0,0,0,.33)');
    },
    // a window or door on a front face: face 'y' = the left face (y = y1), 'x' = the right face (x = x1)
    // a, b = where along the face (0..1); z0, z1 = how high
    hole(g, face, L, a, b, z0, z1, lit, warm, t) {
      const pts = face === 'y'
        ? [[L.x0 + (L.x1 - L.x0) * a, L.y1, z0], [L.x0 + (L.x1 - L.x0) * b, L.y1, z0], [L.x0 + (L.x1 - L.x0) * b, L.y1, z1], [L.x0 + (L.x1 - L.x0) * a, L.y1, z1]]
        : [[L.x1, L.y0 + (L.y1 - L.y0) * a, z0], [L.x1, L.y0 + (L.y1 - L.y0) * b, z0], [L.x1, L.y0 + (L.y1 - L.y0) * b, z1], [L.x1, L.y0 + (L.y1 - L.y0) * a, z1]];
      if (lit) { g.save(); g.shadowColor = warm ? '#ff6020' : '#ffa040'; g.shadowBlur = 10 + 3 * Math.sin(t * 7 + a * 9); }
      this.poly3(g, pts, lit ? (warm ? '#ff8a30' : '#ffc860') : '#0c0908');
      if (lit) g.restore();
    },
    roof(g, L, z, type, rh, col, wall, tiles) {
      const o = .18, a0 = L.x0 - o, a1 = L.x1 + o, b0 = L.y0 - o, b1 = L.y1 + o;
      const xm = (L.x0 + L.x1) / 2, ym = (L.y0 + L.y1) / 2;
      const lit = this.shade(col, .1), dark = this.shade(col, -.32);
      const lines = (p0, p1, q0, q1) => { // tile rows across a slope
        if (!tiles) return;
        const P = this.I.P; g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.beginPath();
        for (let k = 1; k < 4; k++) {
          const f = k / 4, u = [p0[0] + (q0[0] - p0[0]) * f, p0[1] + (q0[1] - p0[1]) * f, p0[2] + (q0[2] - p0[2]) * f];
          const v = [p1[0] + (q1[0] - p1[0]) * f, p1[1] + (q1[1] - p1[1]) * f, p1[2] + (q1[2] - p1[2]) * f];
          const A = P(u[0], u[1], u[2]), B = P(v[0], v[1], v[2]); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]);
        }
        g.stroke();
      };
      if (type === 'gableX') { // ridge runs along gx; slopes face back (-gy) and left (+gy)
        this.poly3(g, [[a0, b0, z], [a1, b0, z], [a1, ym, z + rh], [a0, ym, z + rh]], lit);
        this.poly3(g, [[L.x1, L.y0, z], [L.x1, L.y1, z], [L.x1, ym, z + rh]], this.shade(wall, .07));
        this.poly3(g, [[a0, b1, z], [a1, b1, z], [a1, ym, z + rh], [a0, ym, z + rh]], dark);
        lines([a0, b1, z], [a1, b1, z], [a0, ym, z + rh], [a1, ym, z + rh]);
      } else if (type === 'gableY') { // ridge runs along gy; slopes face back (-gx) and right (+gx)
        this.poly3(g, [[a0, b0, z], [a0, b1, z], [xm, b1, z + rh], [xm, b0, z + rh]], dark);
        this.poly3(g, [[L.x0, L.y1, z], [L.x1, L.y1, z], [xm, L.y1, z + rh]], this.shade(wall, -.34));
        this.poly3(g, [[a1, b0, z], [a1, b1, z], [xm, b1, z + rh], [xm, b0, z + rh]], lit);
        lines([a1, b0, z], [a1, b1, z], [xm, b0, z + rh], [xm, b1, z + rh]);
      } else { // pyramid
        const ap = [xm, ym, z + rh];
        this.poly3(g, [[a0, b0, z], [a1, b0, z], ap], lit);
        this.poly3(g, [[a0, b0, z], [a0, b1, z], ap], dark);
        this.poly3(g, [[a0, b1, z], [a1, b1, z], ap], dark);
        this.poly3(g, [[a1, b0, z], [a1, b1, z], ap], lit);
        lines([a1, b0, z], [a1, b1, z], ap, ap);
      }
    },

    // sky, stars, moon and hills behind a place (left out on the title screen, which has its own)
    drawSky(g, w, h, t, total, sway, P) {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, G.mix('#07060c', '#141026', total));
      sky.addColorStop(.7, G.mix('#1c1214', '#3a2418', total));
      sky.addColorStop(1, '#0c0807');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,240,220,.7)';
      for (let i = 1; i <= 26; i++) {
        g.globalAlpha = .3 + .3 * Math.sin(t * 1.3 + i);
        g.fillRect((i * 0.6180339 % 1) * w - sway * 4, (i * 0.3819 * 7 % 1) * h * .4, 1.2, 1.2);
      }
      g.globalAlpha = 1;
      const mx = w * .88, my = h * .15, mr = h * .07;
      const mg = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4);
      mg.addColorStop(0, 'rgba(230,210,180,.25)'); mg.addColorStop(1, 'rgba(230,210,180,0)');
      g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(40,30,30,.35)'; g.beginPath(); g.arc(mx - mr * .3, my - mr * .2, mr * .25, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120d10';
      g.beginPath(); g.moveTo(0, h * .5);
      for (let i = 0; i <= 12; i++) g.lineTo(w * i / 12 - sway * 6, h * (.4 + .06 * Math.sin(i * 1.7) + .03 * Math.sin(i * 4.1)));
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      const land = g.createLinearGradient(0, h * .45, 0, h);
      land.addColorStop(0, '#120d0c'); land.addColorStop(1, '#070504');
      g.fillStyle = land; g.fillRect(0, P(0, 0, 0)[1] + 2, w, h);
    },
    // the props of a place's areas that are done, as things to depth-sort with the buildings
    propItems(pi) {
      const out = [];
      for (const a of AREAS) {
        if (a.place !== pi) continue;
        const d = done(a.id);
        a.jobs.forEach((j, i) => {
          if (!Array.isArray(j.p) || i >= d) return;
          const pop = this.pop && this.pop.id === a.id && this.pop.i === i ? this.pop.t : 1;
          out.push({ depth: j.p[1] + j.p[2], draw: (g, t) => this.prop(g, j.p[0], j.p[1], j.p[2], t, pop, j.p[3] || 0) });
        });
      }
      return out;
    },

    // Draws a place into a box. pi: 0 = the Cloister (also used by the title screen once the Shrine shines), 1 = the hamlet.
    drawScene(g, X, Y, w, h, t, dt, bare, pi) {
      g.save();
      g.translate(X, Y);
      g.beginPath(); g.rect(0, 0, w, h); g.clip();
      const ids = AREAS.filter(a => a.place === (pi || 0));
      const total = ids.reduce((n, a) => n + done(a.id), 0) / ids.reduce((n, a) => n + a.jobs.length, 0);
      // the angled view: unit k on screen, a 2:1 diamond, origin so the front corner sits at the bottom
      const k = Math.min(w / 22, h / 12.6), ky = k / 2, cx = w / 2, top = h * .985 - 20 * ky;
      const sway = Math.sin(t * .35) * k * .015;
      const P = (x, y, z) => [cx + (x - y) * k + (x + y - 10) * sway, top + (x + y) * ky - z * k];
      this.I = { P, k };
      this.smoke = [];
      if (!bare) this.drawSky(g, w, h, t, total, sway, P);
      if (pi === 1) this.drawHamlet(g, w, h, t, total);
      else this.drawCloister(g, w, h, t, total);
      // chimney smoke, over everything
      for (const [fx, fy] of this.smoke) {
        for (let i = 0; i < 6; i++) {
          const q = ((t * .25 + i / 6) % 1);
          g.fillStyle = 'rgba(120,110,110,' + (.4 * (1 - q)) + ')';
          g.beginPath(); g.arc(fx + Math.sin(q * 6 + i) * 4, fy - q * h * .3, 3 + q * 9, 0, Math.PI * 2); g.fill();
        }
      }
      // ground mist
      const mist = g.createLinearGradient(0, h * .8, 0, h);
      mist.addColorStop(0, 'rgba(60,50,60,0)'); mist.addColorStop(1, 'rgba(60,50,60,.3)');
      g.fillStyle = mist; g.fillRect(0, h * .8, w, h * .2);
      // highlight the building step just done
      if (this.flashT > 0 && this.flashId && !bare) {
        const c = this.centerOf(this.flashId), p = P(c[0], c[1], 0);
        const rg = g.createRadialGradient(p[0], p[1] - k * 1.5, 2, p[0], p[1] - k * 1.5, k * 5);
        rg.addColorStop(0, 'rgba(255,210,120,' + (.45 * this.flashT) + ')'); rg.addColorStop(1, 'rgba(255,210,120,0)');
        g.fillStyle = rg; g.fillRect(p[0] - k * 6, p[1] - k * 8, k * 12, k * 10);
      }
      g.restore();
    },
    drawCloister(g, w, h, t, total) {
      const P = this.I.P;
      // courtyard: flagstones, a lighter path from the gate to the shrine
      const yard = G.mix('#1e1714', '#2e2620', total);
      this.poly3(g, [[0, 0], [10, 0], [10, 10], [0, 10]], yard);
      this.poly3(g, [[3.6, 4.2], [4.2, 3.6], [9.3, 8.7], [8.7, 9.3]], 'rgba(255,225,180,' + (.03 + .05 * total) + ')');
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < 10; i++) {
        let a = P(i, 0, 0), b = P(i, 10, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
        a = P(0, i, 0); b = P(10, i, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      }
      g.stroke();
      // shadows first, so no building is ever darkened by its own
      for (const id of ['chapel', 'forge', 'treasury']) {
        const D = this.LAYOUT[id];
        this.shadow(g, D.x - D.sx / 2, D.y - D.sy / 2, D.x + D.sx / 2, D.y + D.sy / 2, this.hOf(D, stage(id)));
      }
      const sh = this.LAYOUT.shrine;
      this.shadow(g, sh.x - .9, sh.y - .9, sh.x + .9, sh.y + .9, stage('shrine') >= 2 ? 2.6 : .4);
      // back walls, then buildings and props far to near, then the front walls and the gate
      this.drawWalls(g, t, true);
      const items = this.propItems(0);
      for (const id of ['shrine', 'chapel', 'forge', 'treasury']) {
        const D = this.LAYOUT[id];
        items.push({ depth: D.x + D.y + (id === 'shrine' ? 0 : .6), draw: (g2, t2) => id === 'shrine' ? this.drawShrine(g2, t2) : this.drawBuilding(g2, D, stage(id), t2) });
      }
      items.sort((a, b) => a.depth - b.depth).forEach(it => it.draw(g, t));
      this.drawWalls(g, t, false);
      this.drawGate(g, t);
    },
    hOf(D, s) { return !s ? D.h * .45 : s === 1 ? D.h * .6 : D.h + D.rh * .6; },
    stoneCol(s) { return ['#2e2824', '#433a33', '#51463d', '#605244'][s]; },
    wallCol(D, s) { return D.pal === 'wood' ? ['#2e2622', '#45392e', '#56473a', '#6a5844'][s] : this.stoneCol(s); },
    rubble(g, x, y, w, seed) {
      for (let i = 0; i < 7; i++) {
        const q = (seed * 31 + i * 17) % 13 / 13;
        g.fillStyle = i % 2 ? '#2a2420' : '#3a322c';
        g.beginPath(); g.ellipse(x - w / 2 + q * w, y - 1, 2 + q * 4, 1.5 + q * 2.5, 0, 0, Math.PI * 2); g.fill();
      }
    },
    // wooden scaffolding around the two front faces of a block
    scaffold(g, L, hz) {
      const P = this.I.P, line = (a, b) => { const A = P(...a), B = P(...b); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); };
      const x0 = L.x0 - .15, x1 = L.x1 + .15, y0 = L.y0 - .15, y1 = L.y1 + .15, top = hz + .4;
      g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.5; g.beginPath();
      for (const p of [[x0, y1], [x1, y1], [x1, y0]]) line([p[0], p[1], 0], [p[0], p[1], top]);
      for (const z of [hz * .45, hz * .9]) { line([x0, y1, z], [x1, y1, z]); line([x1, y1, z], [x1, y0, z]); }
      line([x0, y1, 0], [x1, y1, hz * .9]);
      g.stroke();
    },
    torch(g, x, y, t, sz) {
      const f = .8 + .2 * Math.sin(t * 13 + x) + .1 * Math.sin(t * 29 + y);
      const rg = g.createRadialGradient(x, y, 0, x, y, sz * 5 * f);
      rg.addColorStop(0, 'rgba(255,170,60,.45)'); rg.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = rg; g.fillRect(x - sz * 6, y - sz * 6, sz * 12, sz * 12);
      g.fillStyle = '#ffcf6a'; g.beginPath(); g.ellipse(x, y - sz * .4, sz * .45, sz * f, 0, 0, Math.PI * 2); g.fill();
    },
    banner(g, x, y, len, t) {
      g.fillStyle = '#8a1410';
      const sway = Math.sin(t * 1.6 + x) * 1.5;
      g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.lineTo(x + 3 + sway, y + len); g.lineTo(x + sway, y + len * .82); g.lineTo(x - 3 + sway, y + len); g.closePath(); g.fill();
      g.fillStyle = '#d8b070'; g.fillRect(x - 1, y + len * .25, 2, len * .3);
    },
    // A building (chapel, forge, treasury, house, tavern, tower, mill); stage 0 ruined .. 3 restored
    drawBuilding(g, D, s, t) {
      const kind = D.kind, col = this.wallCol(D, s), P = this.I.P, k = this.I.k;
      const L = { x0: D.x - D.sx / 2, x1: D.x + D.sx / 2, y0: D.y - D.sy / 2, y1: D.y + D.sy / 2 };
      if (s === 0) {
        // a roofless shell: the back walls, then the broken front walls with jagged tops
        const hh = Math.min(D.h, 2), J = [.55, .3, .62, .2, .45, .1, .38, .5, .25].map(v => v * hh);
        this.poly3(g, [[L.x0, L.y0, 0], [L.x1, L.y0, 0], [L.x1, L.y0, J[1]], [L.x0 + D.sx * .5, L.y0, J[2]], [L.x0, L.y0, J[0]]], this.shade(col, -.15));
        this.poly3(g, [[L.x0, L.y0, 0], [L.x0, L.y1, 0], [L.x0, L.y1, J[3]], [L.x0, L.y0 + D.sy * .5, J[4]], [L.x0, L.y0, J[0]]], this.shade(col, -.05));
        const right = [[L.x1, L.y0, 0], [L.x1, L.y1, 0]], left = [[L.x0, L.y1, 0], [L.x1, L.y1, 0]];
        for (let i = 0; i <= 4; i++) right.push([L.x1, L.y1 - D.sy * i / 4, J[(i + 3) % J.length] * .9]);
        for (let i = 4; i >= 0; i--) left.push([L.x0 + D.sx * i / 4, L.y1, J[(i + D.seed) % J.length] * .8]);
        this.poly3(g, right, this.shade(col, .07));
        this.poly3(g, left, this.shade(col, -.34));
        const p = P(D.x, L.y1 + .3, 0);
        this.rubble(g, p[0], p[1], k * D.sx * 1.4, D.seed);
        return;
      }
      const hz = s === 1 ? D.h * .6 : D.h;
      this.box(g, L.x0, L.y0, L.x1, L.y1, 0, hz, col, s >= 2);
      if (s === 1) this.poly3(g, [[L.x0 + .15, L.y0 + .15, hz], [L.x1 - .15, L.y0 + .15, hz], [L.x1 - .15, L.y1 - .15, hz], [L.x0 + .15, L.y1 - .15, hz]], '#0c0908');
      const lit = s >= 3, warm = kind === 'forge' || kind === 'tavern' || kind === 'house';
      // timber frame on the hamlet's buildings
      if (D.pal === 'wood' && s >= 2) {
        g.strokeStyle = 'rgba(30,18,10,.75)'; g.lineWidth = 1.4; g.beginPath();
        const ln = (a, b) => { const A = P(...a), B = P(...b); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); };
        ln([L.x0, L.y1, hz * .5], [L.x1, L.y1, hz * .5]); ln([L.x1, L.y0, hz * .5], [L.x1, L.y1, hz * .5]);
        ln([L.x0, L.y1, hz], [L.x1, L.y1, hz]);
        for (const f of [.02, .5, .98]) { ln([L.x0 + D.sx * f, L.y1, 0], [L.x0 + D.sx * f, L.y1, hz]); ln([L.x1, L.y0 + D.sy * f, 0], [L.x1, L.y0 + D.sy * f, hz]); }
        g.stroke();
      }
      // windows and doors
      if (kind === 'chapel') {
        if (s >= 2) { this.hole(g, 'x', L, .2, .32, hz * .4, hz * .85, lit, false, t); this.hole(g, 'x', L, .62, .74, hz * .4, hz * .85, lit, false, t); }
        this.hole(g, 'y', L, .4, .6, 0, hz * .5, lit, false, t);
      } else if (kind === 'forge') {
        this.hole(g, 'y', L, .25, .6, 0, hz * .6, lit, true, t);
        if (s >= 2) this.hole(g, 'x', L, .4, .6, hz * .45, hz * .75, lit, true, t);
      } else if (kind === 'tower') {
        this.hole(g, 'y', L, .38, .62, 0, hz * .28, lit, false, t);
        if (s >= 2) { this.hole(g, 'y', L, .44, .56, hz * .55, hz * .72, lit, false, t); this.hole(g, 'x', L, .44, .56, hz * .7, hz * .86, lit, false, t); }
      } else if (kind === 'mill') {
        this.hole(g, 'x', L, .38, .62, 0, hz * .42, lit, true, t);
        if (s >= 2) this.hole(g, 'x', L, .4, .6, hz * .62, hz * .8, lit, true, t);
      } else if (kind === 'house' || kind === 'tavern') {
        this.hole(g, 'y', L, .58, .76, 0, hz * .62, lit, true, t);
        if (s >= 2) { this.hole(g, 'y', L, .16, .36, hz * .38, hz * .7, lit, true, t); this.hole(g, 'x', L, .35, .6, hz * .38, hz * .7, lit, true, t); }
      } else {
        this.hole(g, 'y', L, .42, .58, 0, hz * .5, lit, false, t);
        if (s >= 2) { this.hole(g, 'y', L, .12, .26, hz * .5, hz * .75, lit, false, t); this.hole(g, 'y', L, .74, .88, hz * .5, hz * .75, lit, false, t); this.hole(g, 'x', L, .4, .6, hz * .5, hz * .75, lit, false, t); }
      }
      this.drawDecos(g, D.area || D.id, L, hz, t, D.area ? 2 : 1);
      if (s === 1) { this.scaffold(g, L, hz); return; }
      const roofCol = s >= 3 ? (D.thatch ? '#7a6030' : '#6a2a1a') : '#34303a';
      this.roof(g, L, hz, D.roof, D.rh, roofCol, col, s >= 3);
      // chapel steeple with a rune at its tip
      if (kind === 'chapel') {
        const sx0 = D.x - .35, sx1 = D.x + .35, sy0 = L.y1 - .9, sy1 = L.y1 - .2, sz = hz + D.rh + .3;
        this.box(g, sx0, sy0, sx1, sy1, hz, sz, col, true);
        this.roof(g, { x0: sx0, x1: sx1, y0: sy0, y1: sy1 }, sz, 'pyramid', 1.1, roofCol, col, false);
        if (s >= 3) {
          const tp = P((sx0 + sx1) / 2, (sy0 + sy1) / 2, sz + 1.1);
          g.save(); g.strokeStyle = '#ffd890'; g.lineWidth = 1.6; g.shadowColor = '#ffb040'; g.shadowBlur = 8;
          g.beginPath(); g.moveTo(tp[0], tp[1] - 2); g.lineTo(tp[0], tp[1] - 12); g.moveTo(tp[0] - 4, tp[1] - 9); g.lineTo(tp[0], tp[1] - 6); g.lineTo(tp[0] + 4, tp[1] - 9); g.stroke();
          g.restore();
        }
      }
      // chimneys (their smoke is drawn later, over everything)
      if (kind === 'forge' || kind === 'house' || kind === 'tavern') {
        const big = kind === 'forge';
        const c0 = L.x1 - (big ? .75 : .6), c1 = L.x1 - (big ? .3 : .3), d0 = D.y - .2, d1 = D.y + .15, cz = hz + D.rh + (big ? 1.1 : .5);
        this.box(g, c0, d0, c1, d1, hz, cz, big ? col : '#3a302a');
        if (big ? s >= 2 : s >= 3) this.smoke.push(P((c0 + c1) / 2, (d0 + d1) / 2, cz));
      }
      if (kind === 'treasury' && s >= 3) {
        const tp = P(D.x, D.y, hz + D.rh);
        for (let i = 0; i < 3; i++) {
          const a = (Math.sin(t * 2.2 + i * 2.1) + 1) / 2;
          g.fillStyle = 'rgba(255,225,120,' + a + ')';
          g.fillRect(tp[0] - k + i * k, tp[1] - 4 - a * 4, 2, 2);
        }
      }
      if (kind === 'tower' && s >= 3) { const tp = P(D.x, D.y, hz + D.rh + .15); this.torch(g, tp[0], tp[1], t, k * .22); }
      if (kind === 'tavern' && s >= 2) { // a hanging sign by the door
        const a = P(L.x0 + D.sx * .85, L.y1 + .05, hz * .78), sw = Math.sin(t * 1.4) * 1.2;
        g.strokeStyle = '#2a1a10'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + k * .45, a[1] + k * .22); g.stroke();
        g.fillStyle = '#6a4424'; g.fillRect(a[0] + k * .2 + sw, a[1] + k * .26, k * .36, k * .26);
        g.fillStyle = '#d8b070'; g.fillRect(a[0] + k * .31 + sw, a[1] + k * .33, k * .14, k * .1);
      }
      if (kind === 'mill' && s >= 2) { // sails on the right face; they turn once the mill is lit
        const hub = P(L.x1 + .08, D.y, hz * .82), ang = s >= 3 ? t * .7 : .35, R = k * 1.45;
        g.save(); g.translate(hub[0], hub[1]);
        for (let i = 0; i < 4; i++) {
          const a = ang + i * Math.PI / 2, cx = Math.cos(a), sy = Math.sin(a) * .9;
          g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(cx * R, sy * R); g.stroke();
          g.fillStyle = s >= 3 ? 'rgba(200,180,150,.75)' : 'rgba(120,100,80,.55)';
          const px = -Math.sin(a) * .9, py = Math.cos(a);
          g.beginPath();
          g.moveTo(cx * R * .25, sy * R * .25); g.lineTo(cx * R, sy * R);
          g.lineTo(cx * R + px * k * .32, sy * R + py * k * .32); g.lineTo(cx * R * .25 + px * k * .32, sy * R * .25 + py * k * .32);
          g.closePath(); g.fill();
        }
        g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(0, 0, 2.5, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      if (s >= 3 && (kind === 'chapel' || kind === 'forge' || kind === 'treasury' || kind === 'tavern')) {
        const b1 = P(L.x0 + .25, L.y1, hz * .95), b2 = P(L.x1, L.y1 - .25, hz * .95);
        this.banner(g, b1[0], b1[1], k * .9, t); this.banner(g, b2[0], b2[1], k * .9, t);
      }
    },
    // The outer walls (the Gate's area): back = the two far edges, otherwise the two near edges
    drawWalls(g, t, back) {
      const s = stage('gate'), col = this.stoneCol(s), d = .35;
      const wh = back ? .8 : .7; // front walls lower, so the props behind them show [S10]
      const runs = back
        ? [[0, 0, 10, d], [0, d, d, 10]]               // far right edge, far left edge
        : [[0, 10 - d, 7.35, 10], [10 - d, 0, 10, 7.35]]; // near left edge, near right edge (up to the gate towers)
      for (const [x0, y0, x1, y1] of runs) {
        if (s === 0) {
          // broken stretches with gaps
          const along = x1 - x0 > y1 - y0, len = along ? x1 - x0 : y1 - y0;
          for (let i = 0; i < len; i += 1.25) {
            const hz = wh * (.25 + .5 * (((i * 37) | 0) % 7) / 7);
            if (((i * 13) | 0) % 5 === 2) continue;
            if (along) this.box(g, x0 + i, y0, Math.min(x0 + i + 1, x1), y1, 0, hz, col);
            else this.box(g, x0, y0 + i, x1, Math.min(y0 + i + 1, y1), 0, hz, col);
          }
        } else {
          this.box(g, x0, y0, x1, y1, 0, wh, col);
          if (s >= 2) this.merlons(g, x0, y0, x1, y1, wh, col);
        }
      }
      void t;
    },
    drawGate(g, t) {
      const s = stage('gate'), col = this.stoneCol(s), P = this.I.P, k = this.I.k;
      const towers = [[7.35, 9.25, 8.45, 10.35], [9.25, 7.35, 10.35, 8.45]];
      const th = s === 0 ? 0 : 2.2;
      if (s === 0) {
        this.box(g, ...towers[0], 0, 1.1, col); this.box(g, ...towers[1], 0, .8, col);
        const p = P(9.2, 9.2, 0); this.rubble(g, p[0], p[1], k * 2.4, 5);
        return;
      }
      // the arch wall between the towers faces the viewer
      const ah = 1.6, A = [8.45, 9.6], B = [9.6, 8.45];
      this.poly3(g, [[A[0], A[1], 0], [B[0], B[1], 0], [B[0], B[1], ah], [A[0], A[1], ah]], this.shade(col, -.12));
      const c = P(9.025, 9.025, 0), aw = Math.abs(P(B[0], B[1], 0)[0] - P(A[0], A[1], 0)[0]), ahp = ah * k;
      g.fillStyle = '#080605';
      g.beginPath(); g.moveTo(c[0] - aw * .3, c[1]); g.lineTo(c[0] - aw * .3, c[1] - ahp * .5); g.arc(c[0], c[1] - ahp * .5, aw * .3, Math.PI, 0); g.lineTo(c[0] + aw * .3, c[1]); g.fill();
      if (s >= 2) {
        g.strokeStyle = '#5a5048'; g.lineWidth = 1.2; g.beginPath();
        for (let i = -2; i <= 2; i++) { g.moveTo(c[0] + i * aw * .11, c[1] - ahp * .78); g.lineTo(c[0] + i * aw * .11, c[1] - ahp * .42); }
        g.moveTo(c[0] - aw * .28, c[1] - ahp * .58); g.lineTo(c[0] + aw * .28, c[1] - ahp * .58); g.stroke();
        g.fillStyle = '#3a2414'; g.fillRect(c[0] - aw * .28, c[1] - ahp * .38, aw * .12, ahp * .38); g.fillRect(c[0] + aw * .16, c[1] - ahp * .38, aw * .12, ahp * .38);
      }
      for (const T of towers) {
        this.box(g, ...T, 0, th, col, false);
        if (s >= 2) this.merlons(g, ...T, th, col);
        const wp = P(T[2], (T[1] + T[3]) / 2, th * .7);
        g.fillStyle = s >= 3 ? '#ffc860' : '#0c0908';
        if (s >= 3) { g.save(); g.shadowColor = '#ffa040'; g.shadowBlur = 8; }
        g.fillRect(wp[0] - 1.5, wp[1] - 4, 3, 7);
        if (s >= 3) g.restore();
      }
      // wall decorations on the two towers' outer faces
      for (const o of this.decos('gate')) {
        const L = o.q.f === 'T0y' ? { x0: towers[0][0], y0: towers[0][1], x1: towers[0][2], y1: towers[0][3] } : { x0: towers[1][0], y0: towers[1][1], x1: towers[1][2], y1: towers[1][3] };
        this.deco(g, L, th, Object.assign({}, o.q, { f: o.q.f === 'T0y' ? 'y' : 'x' }), t, o.pop);
      }
      if (s === 1) this.scaffold(g, { x0: 8.45, x1: 9.6, y0: 8.45, y1: 9.6 }, ah);
      if (s >= 3) {
        this.torch(g, c[0] - aw * .42, c[1] - ahp * .55, t, 3);
        this.torch(g, c[0] + aw * .42, c[1] - ahp * .55, t, 3);
        const b1 = P(7.9, 10.35, th), b2 = P(10.35, 7.9, th);
        this.banner(g, b1[0], b1[1], k * 1.1, t); this.banner(g, b2[0], b2[1], k * 1.1, t);
      }
    },
    // the shrine: 0 fallen, 1 plinth rebuilt, 2 statue raised (dark), 3 statue lit
    drawShrine(g, t) {
      const s = stage('shrine'), D = this.LAYOUT.shrine, P = this.I.P, k = this.I.k;
      // a stepped stone dais in the middle of the far courtyard
      const st = this.stoneCol(s ? 3 : 1);
      this.box(g, D.x - .9, D.y - .9, D.x + .9, D.y + .9, 0, .25, this.stoneCol(s ? 2 : 0));
      if (s < 2) {
        // the plinth (cracked, or rebuilt), the fallen statue lying beside it
        if (s) this.box(g, D.x - .55, D.y - .55, D.x + .55, D.y + .55, .25, .75, st);
        else this.box(g, D.x - .5, D.y - .5, D.x + .5, D.y + .5, .25, .5, st);
        const p = P(D.x + .2, D.y + 1.1, .25);
        g.fillStyle = '#4a4440';
        g.save(); g.translate(p[0], p[1] - 3); g.rotate(-.42);
        g.fillRect(-k * 1.2, -3, k * 1.6, 6); g.beginPath(); g.arc(k * .6, 0, 4, 0, Math.PI * 2); g.fill();
        g.restore();
        return;
      }
      this.box(g, D.x - .55, D.y - .55, D.x + .55, D.y + .55, .25, .75, st);
      const base = P(D.x, D.y, .75), x = base[0], sy = base[1];
      const lit = s >= 3, q = .75 + .25 * Math.sin(t * 1.5);
      if (lit) { // light rays
        const rg = g.createRadialGradient(x, sy - k * 1.3, 2, x, sy - k * 1.3, k * 3.4);
        rg.addColorStop(0, 'rgba(200,220,255,' + (.35 * q) + ')'); rg.addColorStop(1, 'rgba(200,220,255,0)');
        g.fillStyle = rg; g.fillRect(x - k * 3.6, sy - k * 5, k * 7.2, k * 5.4);
      }
      // the huntress: body, head, raised spear (lit on her right side)
      const sh = k * 2.4;
      const body = () => { g.beginPath(); g.moveTo(x - sh * .14, sy); g.lineTo(x - sh * .08, sy - sh * .55); g.lineTo(x - sh * .12, sy - sh * .72);
        g.lineTo(x + sh * .1, sy - sh * .72); g.lineTo(x + sh * .07, sy - sh * .55); g.lineTo(x + sh * .14, sy); g.closePath(); };
      g.fillStyle = lit ? '#6a6870' : '#4a4850'; body(); g.fill();
      g.save(); body(); g.clip(); g.fillStyle = lit ? '#9a98a2' : '#62606a'; g.fillRect(x, sy - sh, sh, sh); g.restore();
      g.fillStyle = lit ? '#8a8890' : '#5a5860'; g.beginPath(); g.arc(x, sy - sh * .82, sh * .09, 0, Math.PI * 2); g.fill();
      g.strokeStyle = lit ? '#a8a6ae' : '#6a6870'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + sh * .08, sy - sh * .68); g.lineTo(x + sh * .3, sy - sh * 1.05); g.stroke();
      g.beginPath(); g.moveTo(x + sh * .3, sy - sh * 1.05); g.lineTo(x + sh * .26, sy - sh * .94); g.lineTo(x + sh * .36, sy - sh * .98); g.closePath();
      g.save(); g.fillStyle = lit ? '#d8e0ff' : '#7a7a86'; if (lit) { g.shadowColor = '#a0c0ff'; g.shadowBlur = 10 * q; } g.fill(); g.restore();
    },

    // ---------- Greywater Hamlet [S10] ----------
    drawHamlet(g, w, h, t, total) {
      const P = this.I.P, k = this.I.k, H = this.HLAYOUT;
      // earth and grass, two dirt lanes crossing at the well
      this.poly3(g, [[0, 0], [10, 0], [10, 10], [0, 10]], G.mix('#16140e', '#232016', total));
      const lane = 'rgba(120,96,64,' + (.12 + .1 * total) + ')';
      this.poly3(g, [[4.4, 0], [5.6, 0], [5.6, 10], [4.4, 10]], lane);
      this.poly3(g, [[0, 4.4], [10, 4.4], [10, 5.6], [0, 5.6]], lane);
      for (let i = 0; i < 46; i++) { // grass tufts, greener as the hamlet comes back
        const x = (i * 0.618 * 10) % 10, y = (i * 0.382 * 17) % 10;
        if (Math.abs(x - 5) < .7 || Math.abs(y - 5) < .7) continue;
        const p = P(x, y, 0);
        g.strokeStyle = G.mix('#2a2a1a', '#3e4a24', total); g.lineWidth = 1; g.beginPath();
        g.moveTo(p[0] - 2, p[1]); g.lineTo(p[0] - 3, p[1] - 4); g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - 5); g.moveTo(p[0] + 2, p[1]); g.lineTo(p[0] + 3, p[1] - 4); g.stroke();
      }
      // shadows
      for (const id of ['tower', 'tavern', 'mill', 'cottages', 'cottages2']) {
        const D = H[id], s = stage(D.area || id);
        this.shadow(g, D.x - D.sx / 2, D.y - D.sy / 2, D.x + D.sx / 2, D.y + D.sy / 2, this.hOf(D, s));
      }
      this.fence(g, true, total);
      const items = this.propItems(1);
      for (const id of ['tower', 'tavern', 'mill', 'cottages', 'cottages2', 'well']) {
        const D = H[id];
        items.push({ depth: D.x + D.y + .6, draw: (g2, t2) => id === 'well' ? this.drawWell(g2, D, stage('well'), t2) : this.drawBuilding(g2, D, stage(D.area || id), t2) });
      }
      items.sort((a, b) => a.depth - b.depth).forEach(it => it.draw(g, t));
      this.fence(g, false, total);
      void w; void h; void k;
    },
    // a low wooden fence round the hamlet; broken until the cottages are rebuilt
    fence(g, back, total) {
      const P = this.I.P, whole = stage('cottages') >= 2;
      const runs = back ? [[[0, 0], [10, 0]], [[0, 0], [0, 10]]] : [[[0, 10], [10, 10]], [[10, 0], [10, 10]]];
      g.strokeStyle = G.mix('#2a1e14', '#5a4028', total); g.lineWidth = 1.6; g.beginPath();
      for (const [a, b] of runs) {
        for (let i = 0; i <= 20; i++) {
          if (!whole && (i * 7) % 5 === 1) continue;
          const f = i / 20, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
          if (Math.abs(x - 5) < .6 && Math.abs(y - 5) > 4) continue; // gaps where the lanes leave
          if (Math.abs(y - 5) < .6 && Math.abs(x - 5) > 4) continue;
          const p0 = P(x, y, 0), p1 = P(x, y, .45);
          g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]);
          if (i < 20 && (whole || (i * 3) % 4 !== 2)) {
            const f2 = (i + 1) / 20, q = P(a[0] + (b[0] - a[0]) * f2, a[1] + (b[1] - a[1]) * f2, .32), r = P(x, y, .32);
            if (!(Math.abs(x - 5) < 1.1 && (y === 0 || y === 10)) && !(Math.abs(y - 5) < 1.1 && (x === 0 || x === 10))) { g.moveTo(r[0], r[1]); g.lineTo(q[0], q[1]); }
          }
        }
      }
      g.stroke();
    },
    // the village well: 0 choked rubble, 1 stone ring, 2 roof on posts, 3 bucket, rope and lamp
    drawWell(g, D, s, t) {
      const P = this.I.P, k = this.I.k, c = P(D.x, D.y, 0), rx = k * .78, ry = rx * .5, hh = k * .45;
      if (s === 0) { this.rubble(g, c[0], c[1], k * 1.6, 2); this.rubble(g, c[0] + k * .3, c[1] - 3, k, 7); return; }
      const st = this.stoneCol(Math.min(3, s + 1));
      g.fillStyle = this.shade(st, -.25);
      g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.lineTo(c[0] - rx, c[1] - hh); g.ellipse(c[0], c[1] - hh, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
      g.fillStyle = this.shade(st, .15); g.beginPath(); g.ellipse(c[0], c[1] - hh, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = s >= 3 ? '#0a1420' : '#080605'; g.beginPath(); g.ellipse(c[0], c[1] - hh, rx * .72, ry * .72, 0, 0, Math.PI * 2); g.fill();
      if (s >= 3) { g.fillStyle = 'rgba(160,190,230,' + (.25 + .1 * Math.sin(t * 2)) + ')'; g.beginPath(); g.ellipse(c[0], c[1] - hh, rx * .4, ry * .3, 0, 0, Math.PI * 2); g.fill(); }
      if (s >= 2) { // two posts, a beam and a little roof
        const top = hh + k * 1.1;
        g.strokeStyle = '#4a3220'; g.lineWidth = 2.5; g.beginPath();
        g.moveTo(c[0] - rx * .85, c[1] - hh * .6); g.lineTo(c[0] - rx * .85, c[1] - top);
        g.moveTo(c[0] + rx * .85, c[1] - hh * .6); g.lineTo(c[0] + rx * .85, c[1] - top);
        g.moveTo(c[0] - rx * .9, c[1] - top + 3); g.lineTo(c[0] + rx * .9, c[1] - top + 3); g.stroke();
        g.fillStyle = s >= 3 ? '#6a2a1a' : '#34303a';
        g.beginPath(); g.moveTo(c[0] - rx * 1.15, c[1] - top + 2); g.lineTo(c[0], c[1] - top - k * .6); g.lineTo(c[0] + rx * 1.15, c[1] - top + 2); g.closePath(); g.fill();
        if (s >= 3) {
          g.strokeStyle = '#8a7a60'; g.lineWidth = 1; g.beginPath(); g.moveTo(c[0], c[1] - top + 3); g.lineTo(c[0], c[1] - hh - k * .35); g.stroke();
          g.fillStyle = '#5a3a20'; g.fillRect(c[0] - 3, c[1] - hh - k * .35, 6, 5);
          this.torch(g, c[0] + rx * .85, c[1] - top - 2, t, k * .14);
        }
      }
    },

    // ---------- props: the small things each job adds ----------
    // pop = 0..1 while a prop is appearing (it grows in with a little bounce)
    // z: standing on something (the shrine's dais). Props are drawn 1.35x so they read on a phone.
    prop(g, type, x, y, t, pop, z) {
      const P = this.I.P, k = this.I.k, b = P(x, y, 0);
      g.save();
      if (z) g.translate(0, -z * k);
      const sc = 1.35 * (pop < 1 ? G.ease.outBack(Math.max(0, pop)) : 1);
      g.translate(b[0], b[1]); g.scale(sc, sc); g.translate(-b[0], -b[1]);
      const W = '#5a3e24', Wd = '#4a321e';
      const pole = (z1, col) => { const a = P(x, y, 0), c = P(x, y, z1); g.strokeStyle = col || '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); return c; };
      const blob = (px, py, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
      const cyl = (z1, r, col, band) => { // a short upright cylinder (barrel, urn)
        const hh = z1 * k, rx = r * k, ry = rx * .5;
        g.fillStyle = this.shade(col, -.25);
        g.beginPath(); g.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI); g.lineTo(b[0] - rx, b[1] - hh); g.ellipse(b[0], b[1] - hh, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
        g.fillStyle = this.shade(col, .12); g.beginPath(); g.ellipse(b[0], b[1] - hh, rx, ry, 0, 0, Math.PI * 2); g.fill();
        if (band) { g.strokeStyle = band; g.lineWidth = 1; for (const f of [.25, .75]) { g.beginPath(); g.ellipse(b[0], b[1] - hh * f, rx, ry, 0, 0, Math.PI); g.stroke(); } }
      };
      switch (type) {
        case 'crates':
          this.box(g, x - .3, y - .25, x + .05, y + .1, 0, .35, W);
          this.box(g, x - .02, y - .05, x + .3, y + .27, 0, .3, Wd);
          this.box(g, x - .25, y - .2, x + .02, y + .07, .35, .6, '#6a4a2a');
          break;
        case 'cart': {
          this.box(g, x - .45, y - .22, x + .45, y + .22, .14, .34, W);
          for (let i = 0; i < 3; i++) { const p = P(x - .25 + i * .22, y, .38); blob(p[0], p[1], k * .1, k * .07, i % 2 ? '#4a423a' : '#5a5048'); }
          for (const dx of [-.25, .25]) { const p = P(x + dx, y + .24, .14); g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.beginPath(); g.ellipse(p[0], p[1], k * .15, k * .15, 0, 0, Math.PI * 2); g.stroke(); }
          break;
        }
        case 'wood':
          this.box(g, x - .4, y - .15, x + .4, y + .15, 0, .24, Wd);
          for (let i = 0; i < 3; i++) { const p = P(x + .4, y - .08 + (i % 2) * .14, .06 + .07 * i); blob(p[0], p[1], k * .06, k * .05, '#9a7a4a'); }
          break;
        case 'brazier': {
          const a = P(x, y, .42);
          g.strokeStyle = '#1e1a18'; g.lineWidth = 1.5; g.beginPath();
          for (const dx of [-.15, .15]) { const q = P(x + dx, y + .12, 0); g.moveTo(q[0], q[1]); g.lineTo(a[0], a[1]); }
          g.stroke();
          blob(a[0], a[1], k * .22, k * .1, '#2a2624');
          this.torch(g, a[0], a[1] - 2, t, k * .14);
          break;
        }
        case 'lantern': {
          const c = pole(1.05);
          g.fillStyle = '#1e1a18'; g.fillRect(c[0] - 3, c[1] - 1, 6, 7);
          this.torch(g, c[0], c[1] + 4, t, k * .08);
          break;
        }
        case 'flag': { const c = pole(1.6, '#4a3a2a'); this.banner(g, c[0], c[1], k * .75, t); break; }
        case 'bench':
          this.box(g, x - .35, y - .08, x - .27, y + .08, 0, .18, Wd); this.box(g, x + .27, y - .08, x + .35, y + .08, 0, .18, Wd);
          this.box(g, x - .42, y - .12, x + .42, y + .12, .18, .25, W);
          break;
        case 'sacks':
          for (let i = 0; i < 3; i++) { const p = P(x - .15 + i * .15, y + (i === 1 ? -.12 : .05), 0); blob(p[0], p[1] - k * .14, k * .16, k * .17, i === 1 ? '#7a6a4a' : '#8a7a58'); }
          { const p = P(x, y, .3); blob(p[0], p[1] - k * .1, k * .14, k * .14, '#9a8a62'); }
          break;
        case 'chest': {
          this.box(g, x - .24, y - .15, x + .24, y + .15, 0, .28, '#5a3418');
          const a = P(x - .24, y + .15, .2), c = P(x + .24, y + .15, .2);
          g.strokeStyle = '#c89a48'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke();
          const p = P(x, y, .3), a2 = (Math.sin(t * 2.5 + x) + 1) / 2;
          g.fillStyle = 'rgba(255,225,120,' + a2 + ')'; g.fillRect(p[0] - 1, p[1] - 6 - a2 * 3, 2, 2);
          break;
        }
        case 'barrel': cyl(.42, .19, '#6a4424', 'rgba(20,14,10,.8)'); break;
        case 'urn': {
          cyl(.18, .2, '#5a524a');
          const p = P(x, y, .18); blob(p[0], p[1] - k * .14, k * .17, k * .16, '#6a625a');
          blob(p[0], p[1] - k * .3, k * .09, k * .04, '#4a443e');
          break;
        }
        case 'anvil':
          this.box(g, x - .22, y - .1, x + .22, y + .1, 0, .12, '#2a2a2e');
          this.box(g, x - .08, y - .06, x + .08, y + .06, .12, .28, '#2a2a2e');
          this.box(g, x - .3, y - .12, x + .3, y + .12, .28, .4, '#3a3a40');
          break;
        case 'candles':
          for (let i = 0; i < 3; i++) {
            const p = P(x - .15 + i * .15, y + (i % 2) * .12, 0), hh = k * (.18 + .08 * i);
            g.fillStyle = '#d8ccb0'; g.fillRect(p[0] - 1.5, p[1] - hh, 3, hh);
            this.torch(g, p[0], p[1] - hh - 1, t + i, k * .05);
          }
          break;
        case 'grave': {
          blob(b[0], b[1], k * .32, k * .14, '#1e1814');
          g.fillStyle = '#4a4440'; g.beginPath();
          g.moveTo(b[0] - k * .16, b[1]); g.lineTo(b[0] - k * .16, b[1] - k * .38); g.arc(b[0], b[1] - k * .38, k * .16, Math.PI, 0); g.lineTo(b[0] + k * .16, b[1]); g.closePath(); g.fill();
          g.fillStyle = '#5a5450'; g.fillRect(b[0] - 1, b[1] - k * .45, 2, k * .2); g.fillRect(b[0] - k * .07, b[1] - k * .38, k * .14, 2);
          break;
        }
        case 'tree': {
          const c = pole(.9, '#2a1e14');
          g.lineWidth = 3; g.strokeStyle = '#2a1e14'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
          for (const [dx, dy, r] of [[0, -.25, .42], [-.25, .05, .32], [.27, .02, .32], [0, -.55, .3]]) blob(c[0] + dx * k, c[1] + dy * k, r * k, r * k * .85, dy < -.4 ? '#2a3a1e' : '#1e2a16');
          break;
        }
        case 'herbs':
          this.box(g, x - .3, y - .2, x + .3, y + .2, 0, .14, '#3a2a1e');
          for (let i = 0; i < 6; i++) { const p = P(x - .22 + (i % 3) * .22, y - .1 + Math.floor(i / 3) * .2, .14); blob(p[0], p[1] - 2, k * .07, k * .08, i % 2 ? '#3a5a2a' : '#4a6a30'); }
          break;
        case 'hay':
          this.box(g, x - .3, y - .2, x + .3, y + .2, 0, .32, '#8a7a3a');
          { const p = P(x + .3, y, .16); g.strokeStyle = 'rgba(60,40,10,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(p[0] - k * .2, p[1] - 2); g.lineTo(p[0] + k * .2, p[1] - 4); g.stroke(); }
          break;
        case 'trough':
          this.box(g, x - .42, y - .14, x + .42, y + .14, 0, .2, '#4a3a2a', true);
          this.poly3(g, [[x - .36, y - .09, .18], [x + .36, y - .09, .18], [x + .36, y + .09, .18], [x - .36, y + .09, .18]], '#1a2a3a');
          break;
        case 'bell': {
          const l = P(x - .25, y, 0), r = P(x + .25, y, 0), lt = P(x - .25, y, 1.0), rt = P(x + .25, y, 1.0);
          g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath();
          g.moveTo(l[0], l[1]); g.lineTo(lt[0], lt[1]); g.lineTo(rt[0], rt[1]); g.lineTo(r[0], r[1]); g.stroke();
          const m = P(x, y, .98), sw = Math.sin(t * 1.8 + x) * .15;
          g.save(); g.translate(m[0], m[1]); g.rotate(sw);
          g.fillStyle = '#a8803a'; g.beginPath(); g.moveTo(-k * .14, k * .3); g.quadraticCurveTo(-k * .12, 0, 0, 0); g.quadraticCurveTo(k * .12, 0, k * .14, k * .3); g.closePath(); g.fill();
          g.restore();
          break;
        }
        case 'sign': {
          const c = pole(.9);
          g.fillStyle = '#6a4424'; g.fillRect(c[0] - k * .02, c[1] + 2, k * .42, k * .26);
          g.fillStyle = '#d8b070'; g.fillRect(c[0] + k * .1, c[1] + k * .1, k * .18, k * .08);
          break;
        }
        case 'fire': {
          for (const a of [0, 1.2, 2.4]) { const p = P(x + Math.cos(a) * .18, y + Math.sin(a) * .18, 0); blob(p[0], p[1] - 2, k * .1, k * .05, '#3a2414'); }
          this.torch(g, b[0], b[1] - k * .12, t, k * .16);
          break;
        }
      }
      g.restore();
    }
  };
  // ---------- wall decorations: shields, lamps, flower boxes, banners [S10] ----------
  Object.assign(Cloister, {
    // the decoration jobs done for an area (b = 2: on the second cottage)
    decos(id, b) {
      const a = BYID[id], d = done(id), out = [];
      a.jobs.forEach((j, i) => {
        if (i >= d || !j.p || Array.isArray(j.p) || (j.p.b || 1) !== (b || 1)) return;
        out.push({ q: j.p, pop: this.pop && this.pop.id === id && this.pop.i === i ? this.pop.t : 1 });
      });
      return out;
    },
    drawDecos(g, id, L, hz, t, b) { for (const o of this.decos(id, b)) this.deco(g, L, hz, o.q, t, o.pop); },
    deco(g, L, hz, q, t, pop) {
      const P = this.I.P, k = this.I.k, z = q.z * hz;
      const pt = q.f === 'y' ? P(L.x0 + (L.x1 - L.x0) * q.a, L.y1, z) : P(L.x1, L.y0 + (L.y1 - L.y0) * q.a, z);
      const sk = q.f === 'y' ? .5 : -.5; // follow the wall's slope on screen
      g.save(); g.translate(pt[0], pt[1]);
      const sc = 1.25 * (pop < 1 ? G.ease.outBack(Math.max(0, pop)) : 1); g.scale(sc, sc);
      if (q.d === 'shield') {
        g.transform(1, sk, 0, 1, 0, 0);
        const w = k * .17, h = k * .2;
        g.fillStyle = '#d8b070'; g.beginPath(); g.moveTo(-w - 1.5, -h - 1.5); g.lineTo(w + 1.5, -h - 1.5); g.lineTo(w + 1.5, 0); g.quadraticCurveTo(w, h * .9, 0, h * 1.35 + 1.5); g.quadraticCurveTo(-w, h * .9, -w - 1.5, 0); g.closePath(); g.fill();
        g.fillStyle = '#8a1410'; g.beginPath(); g.moveTo(-w, -h); g.lineTo(w, -h); g.lineTo(w, 0); g.quadraticCurveTo(w * .9, h * .85, 0, h * 1.3); g.quadraticCurveTo(-w * .9, h * .85, -w, 0); g.closePath(); g.fill();
        g.strokeStyle = '#d8b070'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-w * .7, -h * .2); g.lineTo(0, h * .45); g.lineTo(w * .7, -h * .2); g.stroke();
      } else if (q.d === 'lamp') {
        g.strokeStyle = '#1e1a18'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -k * .12); g.lineTo(sk * k * .2, -k * .12 + sk * sk * k * .2); g.stroke();
        const lx = sk * k * .2, ly = -k * .12 + sk * sk * k * .2;
        g.fillStyle = '#1e1a18'; g.fillRect(lx - 3, ly, 6, 7);
        this.torch(g, lx, ly + 4, t, k * .07);
      } else if (q.d === 'box') {
        g.transform(1, sk, 0, 1, 0, 0);
        const w = k * .24;
        g.fillStyle = '#4a3020'; g.fillRect(-w, 0, w * 2, k * .09);
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? '#3a6a2a' : '#4a7a30'; g.beginPath(); g.arc(-w + w * .2 + i * w * .4, -1, k * .06, 0, Math.PI * 2); g.fill();
          if (i % 2 === 0) { g.fillStyle = ['#c84040', '#e0c060', '#c060a0'][i / 2]; g.beginPath(); g.arc(-w + w * .2 + i * w * .4, -k * .05, k * .03, 0, Math.PI * 2); g.fill(); }
        }
      } else if (q.d === 'banner') {
        this.banner(g, 0, 0, k * .8, t);
      }
      g.restore();
    }
  });
  for (const L of [Cloister.LAYOUT, Cloister.HLAYOUT]) for (const id in L) L[id].id = id;
  G.Cloister = Cloister;
})(window.G);
