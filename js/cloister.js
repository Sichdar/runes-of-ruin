/* Runes of Ruin - the Cloister: rune stones, five areas to rebuild, their perks, and its screen. [S06]
   Stones are not stored: every level won for the first time gives 1 (an act's last level gives 3),
   so the total follows from Save.data.unlocked, and what is left = earned - spent on stages.
   Save: data.camp.built = { gate: 0..3, ... }, data.camp.perksOff = true turns every perk off. */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const snd = (n, o) => { if (G.Audio && G.Audio.play) G.Audio.play(n, o); };

  const AREAS = [
    { id: 'gate', name: 'The Gate', costs: [2, 3, 5], what: 'Guards the way in.',
      perks: ['+1 move in every level', '+2 moves in every level', '+3 moves in every level'] },
    { id: 'treasury', name: 'The Treasury', costs: [2, 3, 5], what: 'Keeps what the dead leave behind.',
      perks: ['+10% gold for every win', '+20% gold for every win', '+30% gold for every win'] },
    { id: 'forge', name: 'The Forge', costs: [2, 3, 5], what: 'Arms you before each fight.',
      perks: ['Every level starts with a javelin', 'Every level starts with a javelin and a fire bomb', 'Every level starts with a javelin, a fire bomb and a raven'] },
    { id: 'chapel', name: 'The Chapel', costs: [2, 3, 5], what: 'Its prayers buy you time.',
      perks: ['Extra moves cost 25% less', 'Extra moves cost half', 'Extra moves cost half, and the first in each level is free'] },
    { id: 'shrine', name: 'Shrine of the Huntress', costs: [10], what: 'Her statue, raised again.',
      perks: ['The title screen shows your restored cloister'], needs: 'Opens when the other four are fully restored.' }
  ];
  const BYID = {};
  AREAS.forEach(a => { BYID[a.id] = a; });

  const camp = () => {
    const S = G.Save.data;
    if (!S.camp || typeof S.camp !== 'object') S.camp = {};
    if (!S.camp.built) S.camp.built = {};
    return S.camp;
  };
  const stage = id => camp().built[id] || 0;

  const Cloister = {
    AREAS,
    stage,
    // stones a first win of level n gives
    stonesFor(level) { return level && level.boss ? 3 : 1; },
    earned() { const n = Math.max(0, G.Save.data.unlocked - 1); return n + 2 * Math.floor(n / 15); },
    spent() { let s = 0; for (const a of AREAS) for (let i = 0; i < stage(a.id); i++) s += a.costs[i]; return s; },
    stones() { return this.earned() - this.spent(); },
    perksOn() { return !camp().perksOff; },
    setPerks(on) { camp().perksOff = !on; G.Save.save(); },
    perk(id) { return this.perksOn() ? stage(id) : 0; },
    isOpen(a) { return !a.needs || AREAS.every(b => b === a || stage(b.id) >= b.costs.length); },
    nextCost(a) { const s = stage(a.id); return s < a.costs.length ? a.costs[s] : null; },
    canBuild(a) { const c = this.nextCost(a); return c !== null && this.isOpen(a) && this.stones() >= c; },
    anyAffordable() { return AREAS.some(a => this.canBuild(a)); },
    shrineDone() { return stage('shrine') >= 1; },
    build(id) {
      const a = BYID[id];
      if (!a || !this.canBuild(a)) return false;
      camp().built[id] = stage(id) + 1;
      G.Save.save();
      return true;
    },

    // ---------- perks used by main.js ----------
    extraMoves() { return this.perk('gate'); },
    goldMult() { return 1 + 0.1 * this.perk('treasury'); },
    forgeKinds() { return ['jav', 'bomb', 'raven'].slice(0, this.perk('forge')); },
    movePrice(base, buys) {
      const s = this.perk('chapel');
      if (s >= 3 && buys === 0) return 0;
      return Math.round(base * (s >= 2 ? 0.5 : s === 1 ? 0.75 : 1));
    },
    // Put the Forge's power-ups on plain tiles of a new board (before the view copies it).
    arm(board) {
      const kinds = this.forgeKinds();
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

    // ---------- screen ----------
    open(onBack) {
      this.onBack = onBack;
      $('btnClBack').onclick = () => { snd('click'); this.close(); onBack && onBack(); };
      $('btnPerks').onclick = () => { snd('click'); this.setPerks(!this.perksOn()); this.refresh(); };
      this.fx = [];
      this.refresh();
      this.sizeArt();
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
      const h = Math.round(Math.min(w * 0.62, window.innerHeight * 0.34));
      const d = Math.min(2.5, window.devicePixelRatio || 1);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
      this.aw = w; this.ah = h; this.ad = d;
    },
    refresh() {
      $('clStones').textContent = this.stones();
      $('btnPerks').textContent = 'Perks: ' + (this.perksOn() ? 'On' : 'Off');
      const list = $('cloisterList');
      list.innerHTML = '';
      for (const a of AREAS) {
        const s = stage(a.id), max = a.costs.length, open = this.isOpen(a);
        const card = document.createElement('div');
        card.className = 'cl-card' + (s >= max ? ' done' : '') + (!open ? ' locked' : '');
        let pips = '';
        for (let i = 0; i < max; i++) pips += '<i class="' + (i < s ? 'on' : '') + '"></i>';
        const now = s > 0 ? a.perks[s - 1] : 'In ruins. ' + a.what;
        let html = '<div class="cl-row"><div class="cl-name">' + a.name + '</div><div class="cl-pips">' + pips + '</div></div>' +
          '<div class="cl-perk">' + (s > 0 ? 'Now: ' : '') + now + '</div>';
        if (s < max) html += '<div class="cl-next">' + (open ? 'Next: ' + a.perks[s] : a.needs) + '</div>';
        card.innerHTML = html;
        if (s < max && open) {
          const cost = a.costs[s];
          const b = document.createElement('button');
          b.className = 'btn cl-build';
          b.innerHTML = (s === 0 ? 'Rebuild' : s === max - 1 ? 'Restore' : 'Repair') + ' · ' + cost + ' <span class="stone-ico"></span>';
          if (this.stones() < cost) b.disabled = true;
          b.onclick = () => {
            if (!this.build(a.id)) return;
            snd('forge'); setTimeout(() => snd('coin'), 160);
            this.burst(a.id);
            this.refresh();
          };
          card.appendChild(b);
        }
        list.appendChild(card);
      }
      const off = !this.perksOn();
      $('clNote').textContent = off ? 'Perks are off: levels play as if the Cloister were still in ruins.' : 'Win new levels to earn rune stones. An act\'s last level gives 3.';
      $('clNote').classList.toggle('warn', off);
    },

    // ---------- drawing ----------
    // Positions as fractions of the picture (x = centre, y = base line)
    POS: { chapel: [.2, .64], shrine: [.5, .5], forge: [.8, .64], treasury: [.17, .93], gate: [.53, .93] },
    burst(id) {
      const [fx, fy] = this.POS[id] || [.5, .5];
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
        this.fx.push({ x: fx * this.aw, y: fy * this.ah - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1 + Math.random() * .6, gold: Math.random() < .7 });
      }
      this.flashId = id; this.flashT = 1;
    },
    drawArt(dt) {
      const cv = $('cloisterArt');
      if (!cv || !this.aw) return;
      const g = cv.getContext('2d');
      g.setTransform(this.ad, 0, 0, this.ad, 0, 0);
      this.drawScene(g, 0, 0, this.aw, this.ah, this.t || 0, dt);
      // build sparks
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
    },
    // Draws the whole cloister into a box. Also used by the title screen once the Shrine stands.
    drawScene(g, X, Y, w, h, t, dt, bare) {
      g.save();
      g.translate(X, Y);
      g.beginPath(); g.rect(0, 0, w, h); g.clip();
      const total = AREAS.reduce((n, a) => n + stage(a.id), 0) / 13;
      if (!bare) { // sky, moon, hills and ground (left out on the title screen, which has its own)
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, G.mix('#07060c', '#141026', total));
      sky.addColorStop(.7, G.mix('#1c1214', '#3a2418', total));
      sky.addColorStop(1, '#0c0807');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      // moon and stars
      g.fillStyle = 'rgba(255,240,220,.7)';
      for (let i = 1; i <= 26; i++) {
        g.globalAlpha = .3 + .3 * Math.sin(t * 1.3 + i);
        g.fillRect((i * 0.6180339 % 1) * w, (i * 0.3819 * 7 % 1) * h * .45, 1.2, 1.2);
      }
      g.globalAlpha = 1;
      const mx = w * .86, my = h * .17, mr = h * .075;
      const mg = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4);
      mg.addColorStop(0, 'rgba(230,210,180,.25)'); mg.addColorStop(1, 'rgba(230,210,180,0)');
      g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(40,30,30,.35)'; g.beginPath(); g.arc(mx - mr * .3, my - mr * .2, mr * .25, 0, Math.PI * 2); g.fill();
      // far hills
      g.fillStyle = '#120d10';
      g.beginPath(); g.moveTo(0, h * .62);
      for (let i = 0; i <= 12; i++) g.lineTo(w * i / 12, h * (.52 + .06 * Math.sin(i * 1.7) + .03 * Math.sin(i * 4.1)));
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      // courtyard ground
      const gr = g.createLinearGradient(0, h * .6, 0, h);
      gr.addColorStop(0, '#1e1714'); gr.addColorStop(1, '#0a0706');
      g.fillStyle = gr; g.fillRect(0, h * .62, w, h * .38); }
      const u = Math.min(w, h * 1.6); // unit for sizes
      const P = id => [this.POS[id][0] * w, this.POS[id][1] * h];
      // back row
      this.drawBuilding(g, 'chapel', ...P('chapel'), u * .2, u * .2, t);
      this.drawShrine(g, ...P('shrine'), u, t);
      this.drawBuilding(g, 'forge', ...P('forge'), u * .19, u * .13, t);
      // front walls, then front row
      this.drawWalls(g, w, h, u, t);
      this.drawBuilding(g, 'treasury', ...P('treasury'), u * .17, u * .11, t);
      this.drawGate(g, ...P('gate'), u, t);
      // forge smoke
      if (stage('forge') >= 2) {
        const [fx, fy] = P('forge');
        for (let i = 0; i < 6; i++) {
          const k = ((t * .25 + i / 6) % 1);
          g.fillStyle = 'rgba(90,80,80,' + (.25 * (1 - k)) + ')';
          g.beginPath(); g.arc(fx + u * .055 + Math.sin(k * 6 + i) * 4, fy - u * .2 - k * h * .3, 3 + k * 9, 0, Math.PI * 2); g.fill();
        }
      }
      // ground mist
      const mist = g.createLinearGradient(0, h * .8, 0, h);
      mist.addColorStop(0, 'rgba(60,50,60,0)'); mist.addColorStop(1, 'rgba(60,50,60,.35)');
      g.fillStyle = mist; g.fillRect(0, h * .8, w, h * .2);
      // highlight the area just built
      if (this.flashT > 0 && this.flashId) {
        const [fx, fy] = P(this.flashId);
        const rg = g.createRadialGradient(fx, fy - u * .08, 2, fx, fy - u * .08, u * .25);
        rg.addColorStop(0, 'rgba(255,210,120,' + (.45 * this.flashT) + ')'); rg.addColorStop(1, 'rgba(255,210,120,0)');
        g.fillStyle = rg; g.fillRect(fx - u * .3, fy - u * .4, u * .6, u * .5);
      }
      g.restore();
    },
    stoneCol(s) { return ['#2e2824', '#433a33', '#51463d', '#605244'][s]; },
    rubble(g, x, y, w, seed) {
      for (let i = 0; i < 7; i++) {
        const k = (seed * 31 + i * 17) % 13 / 13;
        g.fillStyle = i % 2 ? '#2a2420' : '#3a322c';
        g.beginPath(); g.ellipse(x - w / 2 + k * w, y - 1, 2 + k * 4, 1.5 + k * 2.5, 0, 0, Math.PI * 2); g.fill();
      }
    },
    scaffold(g, x, y, w, h) {
      g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.5;
      g.beginPath();
      for (const fx of [-.55, .55]) { g.moveTo(x + fx * w, y); g.lineTo(x + fx * w, y - h * 1.05); }
      for (const fy of [.35, .7]) { g.moveTo(x - .6 * w, y - fy * h); g.lineTo(x + .6 * w, y - fy * h); }
      g.moveTo(x - .55 * w, y); g.lineTo(x + .55 * w, y - .7 * h);
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
    // A plain building (chapel, forge, treasury); s = 0 ruined .. 3 restored
    drawBuilding(g, id, x, y, w, h, t) {
      const s = stage(id);
      const col = this.stoneCol(s);
      if (s === 0) {
        // broken walls with jagged tops
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x - w / 2, y);
        const pts = [.55, .3, .62, .2, .45, .1, .38, .5, .25];
        pts.forEach((p, i) => g.lineTo(x - w / 2 + w * i / (pts.length - 1), y - h * p));
        g.lineTo(x + w / 2, y); g.fill();
        g.fillStyle = '#0c0908'; g.fillRect(x - w * .28, y - h * .32, w * .1, h * .16);
        this.rubble(g, x, y, w * 1.2, id.length);
        return;
      }
      // walls
      g.fillStyle = col; g.fillRect(x - w / 2, y - h, w, h);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w * .2, y - h, w * .3, h);
      // roof
      if (s >= 2) {
        g.fillStyle = s >= 3 ? '#5a2418' : '#2e2830'; g.strokeStyle = s >= 3 ? '#8a4a30' : '#5a4e48'; g.lineWidth = 1;
        g.beginPath();
        if (id === 'chapel') { g.moveTo(x - w * .58, y - h); g.lineTo(x, y - h * 1.55); g.lineTo(x + w * .58, y - h); }
        else if (id === 'treasury') { g.moveTo(x - w * .56, y - h); g.lineTo(x - w * .4, y - h * 1.25); g.lineTo(x + w * .4, y - h * 1.25); g.lineTo(x + w * .56, y - h); }
        else { g.moveTo(x - w * .56, y - h); g.lineTo(x - w * .1, y - h * 1.45); g.lineTo(x + w * .56, y - h); }
        g.closePath(); g.fill(); g.stroke();
      } else {
        g.strokeStyle = '#4a3420'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x - w * .55, y - h); g.lineTo(x, y - h * 1.4); g.lineTo(x + w * .55, y - h); g.stroke();
      }
      // chapel spire with a rune at its tip
      if (id === 'chapel') {
        const sx = x - w * .3, top = y - h * (s >= 2 ? 2.1 : 1.6);
        g.fillStyle = col; g.fillRect(sx - w * .09, y - h * 1.35, w * .18, h * .4);
        if (s >= 2) { g.fillStyle = s >= 3 ? '#5a2418' : '#2e2830'; g.beginPath(); g.moveTo(sx - w * .12, y - h * 1.35); g.lineTo(sx, top); g.lineTo(sx + w * .12, y - h * 1.35); g.fill(); }
        if (s >= 3) {
          g.strokeStyle = '#ffd890'; g.lineWidth = 1.6; g.shadowColor = '#ffb040'; g.shadowBlur = 8;
          g.beginPath(); g.moveTo(sx, top - 2); g.lineTo(sx, top - 12); g.moveTo(sx - 4, top - 9); g.lineTo(sx, top - 6); g.lineTo(sx + 4, top - 9); g.stroke();
          g.shadowBlur = 0;
        }
      }
      // forge chimney
      if (id === 'forge') { g.fillStyle = col; g.fillRect(x + w * .22, y - h * 1.6, w * .16, h * .7); }
      // windows and door
      const lit = s >= 3;
      const win = (wx, wy, ww, wh, round) => {
        g.fillStyle = lit ? (id === 'forge' ? '#ff8a30' : '#ffc860') : '#0c0908';
        if (lit) { g.shadowColor = id === 'forge' ? '#ff6020' : '#ffa040'; g.shadowBlur = 10 + 3 * Math.sin(t * 7 + wx); }
        g.beginPath();
        if (round) g.arc(wx, wy, ww, 0, Math.PI * 2); else { g.rect(wx - ww / 2, wy - wh, ww, wh); }
        g.fill(); g.shadowBlur = 0;
      };
      if (id === 'chapel') { win(x + w * .1, y - h * .7, w * .1, 0, true); win(x - w * .02, y - h * .05, w * .16, h * .4); }
      else if (id === 'forge') { win(x - w * .15, y, w * .3, h * .55); }
      else { win(x - w * .25, y - h * .45, w * .1, h * .22); win(x + w * .25, y - h * .45, w * .1, h * .22); win(x, y, w * .2, h * .45); }
      if (id === 'treasury' && s >= 3) {
        for (let i = 0; i < 3; i++) {
          const a = (Math.sin(t * 2.2 + i * 2.1) + 1) / 2;
          g.fillStyle = 'rgba(255,225,120,' + a + ')';
          g.fillRect(x - w * .3 + i * w * .3, y - h * 1.1 - a * 3, 2, 2);
        }
      }
      if (s === 1) this.scaffold(g, x, y, w, h);
      if (s >= 3) { this.banner(g, x - w * .42, y - h * .95, h * .5, t); this.banner(g, x + w * .42, y - h * .95, h * .5, t); }
    },
    drawWalls(g, w, h, u, t) {
      const s = stage('gate');
      const y = h * .93, wh = u * .09;
      g.fillStyle = this.stoneCol(s);
      for (const [a, b] of [[0, .3], [.76, 1]]) {
        if (s === 0) {
          g.beginPath(); g.moveTo(a * w, y);
          for (let i = 0; i <= 6; i++) g.lineTo((a + (b - a) * i / 6) * w, y - wh * (.25 + .5 * ((i * 37 % 7) / 7)));
          g.lineTo(b * w, y); g.fill();
        } else {
          g.fillRect(a * w, y - wh, (b - a) * w, wh);
          if (s >= 2) for (let xx = a * w; xx < b * w - 4; xx += 9) g.fillRect(xx, y - wh - 4, 5, 4);
        }
      }
      void t;
    },
    drawGate(g, x, y, u, t) {
      const s = stage('gate');
      const col = this.stoneCol(s);
      const tw = u * .08, th = u * .2, aw = u * .14, ah = u * .13;
      for (const side of [-1, 1]) {
        const tx = x + side * (aw / 2 + tw / 2);
        g.fillStyle = col;
        if (s === 0) {
          g.beginPath(); g.moveTo(tx - tw / 2, y); g.lineTo(tx - tw / 2, y - th * (side < 0 ? .55 : .4));
          g.lineTo(tx, y - th * (side < 0 ? .45 : .5)); g.lineTo(tx + tw / 2, y - th * .3); g.lineTo(tx + tw / 2, y); g.fill();
        } else {
          g.fillRect(tx - tw / 2, y - th, tw, th);
          g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(tx + tw * .1, y - th, tw * .4, th);
          g.fillStyle = col;
          if (s >= 2) for (let i = 0; i < 3; i++) g.fillRect(tx - tw / 2 + i * tw * .4, y - th - 5, tw * .22, 5);
          g.fillStyle = s >= 3 ? '#ffc860' : '#0c0908';
          if (s >= 3) { g.shadowColor = '#ffa040'; g.shadowBlur = 8; }
          g.fillRect(tx - 1.5, y - th * .75, 3, 7);
          g.shadowBlur = 0;
        }
      }
      if (s === 0) { this.rubble(g, x, y, aw * 1.4, 5); return; }
      // arch
      g.fillStyle = col;
      g.fillRect(x - aw / 2, y - ah, aw, ah);
      g.fillStyle = '#080605';
      g.beginPath(); g.moveTo(x - aw * .32, y); g.lineTo(x - aw * .32, y - ah * .55); g.arc(x, y - ah * .55, aw * .32, Math.PI, 0); g.lineTo(x + aw * .32, y); g.fill();
      if (s >= 2) {
        // portcullis raised halfway, wooden doors
        g.strokeStyle = '#5a5048'; g.lineWidth = 1.2;
        g.beginPath();
        for (let i = -2; i <= 2; i++) { g.moveTo(x + i * aw * .12, y - ah * .85); g.lineTo(x + i * aw * .12, y - ah * .45); }
        g.moveTo(x - aw * .3, y - ah * .6); g.lineTo(x + aw * .3, y - ah * .6);
        g.stroke();
        g.fillStyle = '#3a2414'; g.fillRect(x - aw * .3, y - ah * .4, aw * .14, ah * .4); g.fillRect(x + aw * .16, y - ah * .4, aw * .14, ah * .4);
      }
      if (s === 1) this.scaffold(g, x, y, aw, ah);
      if (s >= 3) {
        this.torch(g, x - aw * .42, y - ah * .55, t, 3);
        this.torch(g, x + aw * .42, y - ah * .55, t, 3);
        this.banner(g, x - aw / 2 - tw / 2, y - th + 4, th * .4, t);
        this.banner(g, x + aw / 2 + tw / 2, y - th + 4, th * .4, t);
      }
    },
    drawShrine(g, x, y, u, t) {
      const s = stage('shrine');
      const pw = u * .1, ph = u * .05;
      // the hill the shrine stands on, rising behind the gate
      g.fillStyle = '#17110f';
      g.beginPath(); g.moveTo(x - u * .3, y + u * .25); g.quadraticCurveTo(x - u * .12, y - 2, x, y); g.quadraticCurveTo(x + u * .12, y - 2, x + u * .3, y + u * .25); g.fill();
      g.fillStyle = this.stoneCol(s ? 3 : 1);
      if (!s) {
        // cracked plinth, the fallen statue lying beside it
        g.beginPath(); g.moveTo(x - pw / 2, y); g.lineTo(x - pw / 2, y - ph); g.lineTo(x - pw * .1, y - ph * .7); g.lineTo(x + pw * .2, y - ph); g.lineTo(x + pw / 2, y - ph * .8); g.lineTo(x + pw / 2, y); g.fill();
        g.fillStyle = '#4a4440';
        g.save(); g.translate(x + pw * .9, y - 3); g.rotate(-.08);
        g.fillRect(-u * .07, -3, u * .1, 6); g.beginPath(); g.arc(u * .045, 0, 4, 0, Math.PI * 2); g.fill();
        g.restore();
        return;
      }
      // light rays
      const k = .75 + .25 * Math.sin(t * 1.5);
      const rg = g.createRadialGradient(x, y - u * .17, 2, x, y - u * .17, u * .28);
      rg.addColorStop(0, 'rgba(200,220,255,' + (.35 * k) + ')'); rg.addColorStop(1, 'rgba(200,220,255,0)');
      g.fillStyle = rg; g.fillRect(x - u * .3, y - u * .45, u * .6, u * .45);
      g.fillStyle = this.stoneCol(3);
      g.fillRect(x - pw / 2, y - ph, pw, ph);
      // the huntress: body, head, raised spear
      const sy = y - ph, sh = u * .2;
      g.fillStyle = '#8a8890';
      g.beginPath(); g.moveTo(x - sh * .14, sy); g.lineTo(x - sh * .08, sy - sh * .55); g.lineTo(x - sh * .12, sy - sh * .72);
      g.lineTo(x + sh * .1, sy - sh * .72); g.lineTo(x + sh * .07, sy - sh * .55); g.lineTo(x + sh * .14, sy); g.fill();
      g.beginPath(); g.arc(x, sy - sh * .82, sh * .09, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#a8a6ae'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + sh * .08, sy - sh * .68); g.lineTo(x + sh * .3, sy - sh * 1.05); g.stroke();
      g.beginPath(); g.moveTo(x + sh * .3, sy - sh * 1.05); g.lineTo(x + sh * .26, sy - sh * .94); g.lineTo(x + sh * .36, sy - sh * .98); g.closePath();
      g.fillStyle = '#d8e0ff'; g.shadowColor = '#a0c0ff'; g.shadowBlur = 10 * k; g.fill(); g.shadowBlur = 0;
    }
  };
  G.Cloister = Cloister;
})(window.G);
