/* Runes of Ruin - board renderer. Replays the events from board.js with animation and effects.
   The view keeps its own copy of what is on screen (sprites, bones, chains, ground), because the
   model has already jumped to the end of the turn. */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;
  const TILE_RGB = ['#ff4a3a', '#5aa0ff', '#3ee07a', '#ffd050', '#c070ff', '#efe6d0'];
  const COMBO_WORDS = [null, null, null, 'Carnage!', 'Bloodbath!', 'Massacre!', 'Annihilation!', 'Apocalypse!'];

  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  G.rrect = rrect;
  const snd = (n, o) => { if (G.Audio && G.Audio.play) G.Audio.play(n, o); };

  class View {
    constructor() {
      this.sprites = new Map();
      this.queue = []; this.cur = null; this.onDone = null;
      this.fx = []; this.parts = []; this.flyers = []; this.texts = [];
      this.time = 0; this.shake = 0; this.flash = 0;
      this.cs = 40; this.bx = 0; this.by = 0; this.dpr = 1;
      this.hint = null; this.sel = null;
      this.hooks = { goalPos: () => null, collected: () => {} };
      this.artVersion = -1;
    }

    setBoard(board, theme) {
      this.board = board; this.R = board.R; this.C = board.C;
      this.theme = G.THEMES[theme] || G.THEMES.moors;
      this.sprites.clear();
      this.queue = []; this.cur = null; this.onDone = null;
      this.fx = []; this.parts = []; this.flyers = []; this.texts = [];
      this.hint = null; this.sel = null; this.shake = 0; this.flash = 0;
      this.vc = []; this.grid = [];
      for (let r = 0; r < this.R; r++) {
        const vr = [], gr = [];
        for (let c = 0; c < this.C; c++) {
          const x = board.cells[r][c];
          vr.push({ v: x.v, bone: x.bone, ground: x.ground, chained: !!(x.t && x.t.chained), wob: 0 });
          gr.push(x.t ? this.mkSprite(x.t, c, r) : null);
        }
        this.vc.push(vr); this.grid.push(gr);
      }
      this.boardImg = null;
      // tiles drop in at the start
      for (const s of this.sprites.values()) { s.intro = -(this.R - s.y) * 0.035 - Math.random() * 0.05; }
    }

    mkSprite(tile, x, y) {
      const s = { tile, x, y, scale: 1, path: null, pi: 0, v: 0, land: 0, pop: 1, dying: 0, dmax: 0, merge: null, tw: null, intro: 0, relic: false };
      this.sprites.set(tile.id, s);
      return s;
    }

    layout(W, H, top, bottom, dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      const availW = W - 14, availH = Math.max(100, H - top - bottom);
      const cs = Math.floor(Math.min(availW / this.C, availH / this.R, 78));
      this.cs = cs;
      this.bx = Math.round((W - cs * this.C) / 2);
      this.by = Math.round(top + (availH - cs * this.R) / 2);
      this.boardImg = null;
    }

    cellAt(px, py) {
      const c = Math.floor((px - this.bx) / this.cs), r = Math.floor((py - this.by) / this.cs);
      if (r < 0 || c < 0 || r >= this.R || c >= this.C || this.vc[r][c].v) return null;
      return { r, c };
    }
    px(x) { return this.bx + (x + .5) * this.cs; }
    py(y) { return this.by + (y + .5) * this.cs; }
    busy() { return !!this.cur || this.queue.length > 0; }

    play(events, onDone) {
      for (const e of events) this.queue.push(e);
      this.onDone = onDone || null;
    }

    // ---------- board picture (frame + cells), rebuilt on resize ----------
    buildBoard() {
      const cs = this.cs, d = this.dpr, th = this.theme;
      const pad = Math.ceil(cs * .45);
      const W = this.C * cs, H = this.R * cs;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil((W + pad * 2) * d); cv.height = Math.ceil((H + pad * 2) * d);
      const g = cv.getContext('2d');
      g.scale(d, d); g.translate(pad, pad);
      const cells = [];
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) if (!this.vc[r][c].v) cells.push([r, c]);
      const each = (grow, rad) => { for (const [r, c] of cells) { rrect(g, c * cs - grow, r * cs - grow, cs + grow * 2, cs + grow * 2, rad); g.fill(); } };
      // drop shadow
      g.save(); g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = cs * .5; g.shadowOffsetY = cs * .12;
      g.fillStyle = '#000'; each(cs * .2, cs * .2); g.restore();
      // iron frame
      const fg = g.createLinearGradient(0, -cs * .2, 0, H + cs * .2);
      fg.addColorStop(0, th.frameHi); fg.addColorStop(.12, th.frame); fg.addColorStop(.88, th.frame); fg.addColorStop(1, '#000');
      g.fillStyle = fg; each(cs * .16, cs * .18);
      g.fillStyle = 'rgba(0,0,0,.7)'; each(cs * .07, cs * .08);
      // cells
      const rng = G.rng(this.R * 31 + this.C);
      for (const [r, c] of cells) {
        const x = c * cs, y = r * cs;
        g.fillStyle = (r + c) % 2 ? th.cellA : th.cellB;
        g.fillRect(x, y, cs, cs);
        // worn stone: speckles
        for (let i = 0; i < 6; i++) {
          g.fillStyle = rng() < .5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.12)';
          const s = cs * (.05 + rng() * .12);
          g.fillRect(x + rng() * (cs - s), y + rng() * (cs - s), s, s * (.4 + rng() * .6));
        }
        g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, y, cs, 1.5);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + cs - 1.5, cs, 1.5); g.fillRect(x + cs - 1, y, 1, cs);
        // a faint light edge so every square stands out from the dark, in every land [S09]
        g.strokeStyle = 'rgba(255,240,220,.09)'; g.lineWidth = 1;
        g.strokeRect(x + 2.5, y + 2.5, cs - 5, cs - 5);
      }
      // rivets on the frame corners
      g.fillStyle = th.frameHi;
      for (const [r, c] of cells) {
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        for (const [dx, dy] of corners) {
          const nx = this.vc[r + dy] && this.vc[r + dy][c], ny = this.vc[r] && this.vc[r][c + dx];
          const outX = !ny || ny.v, outY = !nx || nx.v;
          if (outX && outY) {
            g.beginPath(); g.arc(c * cs + cs / 2 + dx * (cs / 2 + cs * .08), r * cs + cs / 2 + dy * (cs / 2 + cs * .08), cs * .045, 0, TAU); g.fill();
          }
        }
      }
      this.boardImg = cv; this.boardPad = pad;
      const p = new Path2D();
      for (const [r, c] of cells) p.rect(this.bx + c * cs, this.by + r * cs, cs, cs);
      this.clip = p;
    }

    // ---------- event playback ----------
    stepEvents(dt) {
      let guard = 0;
      while (guard++ < 4) {
        if (!this.cur) {
          if (!this.queue.length) {
            if (this.onDone) { const f = this.onDone; this.onDone = null; f(); }
            return;
          }
          this.cur = this.queue.shift();
          this.cur.clock = 0;
          this.begin(this.cur);
        }
        if (this.tick(this.cur, dt)) { this.cur = null; dt = 0; continue; }
        return;
      }
    }

    begin(e) {
      if (e.type === 'swap') {
        e.sa = this.grid[e.a.r][e.a.c]; e.sb = this.grid[e.b.r][e.b.c];
        snd('swap');
        if (e.ok) { this.grid[e.a.r][e.a.c] = e.sb; this.grid[e.b.r][e.b.c] = e.sa; }
        this.hint = null;
      } else if (e.type === 'tap') {
        this.hint = null;
      } else if (e.type === 'blast') {
        e.i = 0;
        if (e.cascade >= 2) snd('match', { n: e.cascade }); else if (e.cascade === 1) snd('match', { n: 1 });
        if (e.cascade >= 3) {
          const w = COMBO_WORDS[Math.min(e.cascade, COMBO_WORDS.length - 1)];
          this.text(w, this.W / 2, this.by + this.R * this.cs * .45, 1 + Math.min(e.cascade, 7) * .06);
          if (e.cascade >= 4) snd('combo');
        }
      } else if (e.type === 'fall') {
        e.sp = [];
        const all = e.moves.concat(e.spawns);
        for (const m of all) {
          let s = this.sprites.get(m.id);
          const [r0, c0] = m.path[0];
          if (!s) {
            if (!m.tile) continue;
            s = this.mkSprite(m.tile, c0, r0);
          } else if (this.grid[r0] && this.grid[r0][c0] === s) this.grid[r0][c0] = null;
          s.path = m.path.slice(1).map(p => ({ x: p[1], y: p[0] }));
          s.pi = 0; s.v = 0; s.x = c0; s.y = r0;
          e.sp.push(s);
        }
        for (const m of all) {
          const s = this.sprites.get(m.id);
          if (!s) continue;
          const [r1, c1] = m.path[m.path.length - 1];
          this.grid[r1][c1] = s;
        }
      } else if (e.type === 'bossTick') {
        if (this.hooks.boss) this.hooks.boss(e); // [S07]
      } else if (e.type === 'shuffle') {
        snd('shuffle');
        this.text('The runes shift...', this.W / 2, this.by + this.R * this.cs * .5, .8);
        for (const t of e.tiles) {
          const s = this.sprites.get(t.id);
          if (!s) continue;
          s.tw = { x0: s.x, y0: s.y, x1: t.c, y1: t.r, t: 0, dur: .5 };
        }
        for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
          const s = this.grid[r][c];
          if (s && s.tile.kind === 'n' && !this.vc[r][c].chained) this.grid[r][c] = null;
        }
        for (const t of e.tiles) { const s = this.sprites.get(t.id); if (s) this.grid[t.r][t.c] = s; }
      }
    }

    tick(e, dt) {
      e.clock += dt;
      if (e.type === 'swap') {
        const D = .13;
        const k = e.ok ? Math.min(1, e.clock / D) : (e.clock < D ? e.clock / D : Math.max(0, 2 - e.clock / D));
        const q = G.ease.inOutQuad(k);
        if (e.sa) { e.sa.x = G.lerp(e.a.c, e.b.c, q); e.sa.y = G.lerp(e.a.r, e.b.r, q); }
        if (e.sb) { e.sb.x = G.lerp(e.b.c, e.a.c, q); e.sb.y = G.lerp(e.b.r, e.a.r, q); }
        if (!e.ok && e.clock >= D && !e.thud) { e.thud = true; snd('bad'); }
        return e.ok ? e.clock >= D : e.clock >= D * 2;
      }
      if (e.type === 'tap') return true;
      if (e.type === 'blast') {
        const ms = e.clock * 1000;
        while (e.i < e.items.length && e.items[e.i].t <= ms) this.apply(e.items[e.i++]);
        return e.i >= e.items.length && ms >= e.dur - 120;
      }
      if (e.type === 'fall') {
        let moving = false, landed = 0;
        for (const s of e.sp) {
          if (!s.path) continue;
          moving = true;
          s.v = Math.min(s.v + G.T.GRAV * dt, G.T.VMAX);
          let dist = s.v * dt;
          while (dist > 0 && s.path) {
            const tg = s.path[s.pi];
            const dx = tg.x - s.x, dy = tg.y - s.y, L = Math.hypot(dx, dy);
            if (L <= dist) {
              s.x = tg.x; s.y = tg.y; dist -= L; s.pi++;
              if (s.pi >= s.path.length) { s.path = null; s.land = 1; s.v = 0; landed++; }
            } else { s.x += dx / L * dist; s.y += dy / L * dist; dist = 0; }
          }
        }
        if (landed) snd('land');
        return !moving;
      }
      if (e.type === 'shuffle') return e.clock >= .55;
      if (e.type === 'bossAttack') { // let the blows land first, then the boss strikes [S07]
        if (!e.fired) {
          if (this.flyers.length) return false;
          e.fired = true; e.f0 = e.clock;
          if (this.hooks.boss) this.hooks.boss(e);
          this.shake = Math.max(this.shake, 6);
        }
        return e.clock - e.f0 >= .5;
      }
      return true;
    }

    apply(it) {
      const cs = this.cs;
      const X = this.px(it.c), Y = this.py(it.r);
      switch (it.k) {
        case 'remove': {
          let s = this.sprites.get(it.id);
          if (!s) break;
          if (this.grid[it.r][it.c] === s) this.grid[it.r][it.c] = null;
          if (it.relic) { s.dying = s.dmax = .45; s.relic = true; this.burst(X, Y, '#ffd060', 14, 1); snd('collect'); break; }
          if (it.merge) { s.dying = s.dmax = .16; s.merge = { x: it.merge.c, y: it.merge.r }; }
          else {
            s.dying = s.dmax = .2;
            const col = s.tile.kind === 'n' ? TILE_RGB[s.tile.color] : '#ffb060';
            this.burst(X, Y, col, 7, .8);
          }
          break;
        }
        case 'collect': {
          const target = this.hooks.goalPos(it.gi);
          const key = it.fk || (it.type === 'color' ? 'tile' + it.color : it.type === 'bone' ? 'bone1' : it.type === 'ground' ? 'ground1' : it.type === 'chain' ? 'chain' : 'relic');
          if (target) this.flyers.push({ key, x0: X, y0: Y, x1: target.x, y1: target.y, t: 0, dur: .55 + Math.random() * .15, gi: it.gi });
          else this.hooks.collected(it.gi);
          break;
        }
        case 'bone': {
          const v = this.vc[it.r][it.c];
          v.bone = it.hp; v.wob = 1;
          this.burst(X, Y, '#e8dcc0', it.hp ? 6 : 14, 1, 'bone');
          snd(it.hp ? 'crack' : 'bonebreak');
          this.shake = Math.max(this.shake, it.hp ? 2 : 4);
          break;
        }
        case 'chain': {
          this.vc[it.r][it.c].chained = false;
          this.burst(X, Y, '#a8a8b0', 10, 1, 'bone');
          snd('chain');
          break;
        }
        case 'ground': {
          this.vc[it.r][it.c].ground = it.lv;
          this.burst(X, Y, '#c02040', 8, .6, 'smoke');
          snd('ground');
          break;
        }
        case 'spawnPower': {
          const s = this.mkSprite(it.tile, it.c, it.r);
          s.pop = 0;
          this.grid[it.r][it.c] = s;
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .35, color: '#ffd080', r0: cs * .3, r1: cs * .9 });
          snd('forge');
          break;
        }
        case 'transform': {
          const old = this.grid[it.r][it.c];
          if (old) { this.sprites.delete(old.tile.id); }
          const s = this.mkSprite(it.tile, it.c, it.r);
          s.pop = 0;
          this.grid[it.r][it.c] = s;
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .3, color: '#ff8040', r0: cs * .2, r1: cs * .7 });
          snd('forge');
          break;
        }
        case 'fx': this.effect(it, X, Y); break;
        // boss attacks [S07]
        case 'bind': {
          this.vc[it.r][it.c].chained = true; this.vc[it.r][it.c].wob = 1;
          this.burst(X, Y, '#6a2a40', 10, .9, 'shard');
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .3, color: '#c04060', r0: cs * .7, r1: cs * .3 });
          snd('chain');
          break;
        }
        case 'bury': {
          const s = this.sprites.get(it.id);
          if (s) { if (this.grid[it.r][it.c] === s) this.grid[it.r][it.c] = null; s.dying = s.dmax = .2; }
          const v = this.vc[it.r][it.c];
          v.bone = it.hp; v.wob = 1;
          this.burst(X, Y, '#d8c090', 14, 1, 'smoke');
          snd('crack');
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'curse': {
          this.vc[it.r][it.c].ground = it.lv;
          this.burst(X, Y, '#802040', 10, .7, 'smoke');
          snd('ground');
          break;
        }
      }
    }

    effect(it, X, Y) {
      const cs = this.cs;
      switch (it.fx) {
        case 'trigger':
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .25, color: '#ffffff', r0: cs * .2, r1: cs * .8 });
          snd('trigger');
          break;
        case 'javelin': {
          const h = it.dir === 'h';
          for (const sgn of [-1, 1]) this.fx.push({ type: 'jav', x: it.c, y: it.r, dx: h ? sgn : 0, dy: h ? 0 : sgn, kind: h ? 'jh' : 'jv', t: 0 });
          snd('javelin');
          break;
        }
        case 'bomb': {
          this.fx.push({ type: 'boom', x: X, y: Y, t: 0, life: .55, rad: (it.rad + .5) * cs });
          this.burst(X, Y, '#ffa030', 26, 2.2, 'spark');
          this.burst(X, Y, '#402018', 10, 1.2, 'smoke');
          this.shake = Math.max(this.shake, 6 + it.rad * 2);
          snd('bomb');
          break;
        }
        case 'raven':
          this.fx.push({ type: 'raven', a: { x: this.px(it.from.c), y: this.py(it.from.r) }, b: { x: this.px(it.to.c), y: this.py(it.to.r) }, t: 0, dur: it.dur / 1000, carry: it.carry });
          snd('raven');
          break;
        case 'chaos':
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .5, color: '#c060ff', r0: cs * .3, r1: cs * (it.all ? 6 : 2) });
          this.flash = it.all ? .8 : .35;
          snd('chaos');
          break;
        case 'beam':
          this.fx.push({ type: 'beam', a: { x: this.px(it.from.c), y: this.py(it.from.r) }, b: { x: this.px(it.to.c), y: this.py(it.to.r) }, t: 0, life: .22 });
          snd('beam');
          break;
        case 'combo':
          this.fx.push({ type: 'ring', x: X, y: Y, t: 0, life: .6, color: '#ff4020', r0: cs * .5, r1: cs * 4 });
          this.flash = .6; this.shake = Math.max(this.shake, 9);
          snd('combo');
          break;
      }
    }

    burst(x, y, color, n, power, kind) {
      const cs = this.cs;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, sp = (40 + Math.random() * 160) * power * cs / 50;
        this.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'smoke' ? 20 : 60),
          life: 0, max: kind === 'smoke' ? .7 + Math.random() * .4 : .35 + Math.random() * .35,
          size: cs * (kind === 'smoke' ? .22 : kind === 'spark' ? .06 : .09) * (.6 + Math.random() * .8),
          color, kind: kind || 'shard', rot: Math.random() * TAU, vr: (Math.random() - .5) * 12,
          g: kind === 'smoke' ? -30 : kind === 'spark' ? 120 : 520
        });
      }
      if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    }

    text(str, x, y, scale) { this.texts.push({ str, x, y, t: 0, life: 1.3, scale: scale || 1 }); }

    showHint(mv) { this.hint = mv ? { a: mv.a, b: mv.b, tap: mv.tap, t: 0 } : null; }

    // ---------- per frame ----------
    update(dt) {
      this.time += dt;
      if (G.Art && G.Art.version !== this.artVersion) { this.artVersion = G.Art.version; this.boardImg = null; }
      this.stepEvents(dt);
      for (const [id, s] of this.sprites) {
        if (s.intro < 0) s.intro = Math.min(0, s.intro + dt * .9);
        if (s.land > 0) s.land = Math.max(0, s.land - dt * 5);
        if (s.pop < 1) s.pop = Math.min(1, s.pop + dt * 4.5);
        if (s.tw) {
          s.tw.t += dt;
          const k = G.ease.inOutQuad(Math.min(1, s.tw.t / s.tw.dur));
          s.x = G.lerp(s.tw.x0, s.tw.x1, k); s.y = G.lerp(s.tw.y0, s.tw.y1, k);
          if (s.tw.t >= s.tw.dur) s.tw = null;
        }
        if (s.dying > 0) {
          if (s.merge) { s.x = G.lerp(s.x, s.merge.x, Math.min(1, dt * 18)); s.y = G.lerp(s.y, s.merge.y, Math.min(1, dt * 18)); }
          if (s.relic) s.y += dt * 2.5;
          s.dying -= dt;
          if (s.dying <= 0) this.sprites.delete(id);
        }
      }
      for (const row of this.vc) for (const v of row) if (v.wob > 0) v.wob = Math.max(0, v.wob - dt * 4);
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.vx *= (1 - dt * 1.5);
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.t += dt;
        if (f.type === 'jav') {
          f.x += f.dx * dt * 1000 / G.T.JAV_DT; f.y += f.dy * dt * 1000 / G.T.JAV_DT;
          if (Math.random() < .6) this.parts.push({ x: this.px(f.x), y: this.py(f.y), vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: 0, max: .3, size: this.cs * .05, color: '#ffc080', kind: 'spark', rot: 0, vr: 0, g: 0 });
          if (f.x < -2 || f.y < -2 || f.x > this.C + 1 || f.y > this.R + 1) this.fx.splice(i, 1);
        } else if (f.type === 'raven') {
          if (f.t >= f.dur) { this.burst(f.b.x, f.b.y, '#201828', 10, .9, 'shard'); this.fx.splice(i, 1); }
        } else if (f.t >= f.life) this.fx.splice(i, 1);
      }
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        f.t += dt;
        if (f.t >= f.dur) { this.flyers.splice(i, 1); this.hooks.collected(f.gi); snd('collect'); }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.t += dt; if (t.t >= t.life) this.texts.splice(i, 1); }
      this.shake = Math.max(0, this.shake - dt * 30);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      if (this.hint) this.hint.t += dt;
    }

    draw(g) {
      if (!this.board) return;
      if (!this.boardImg) this.buildBoard();
      const cs = this.cs, d = this.dpr;
      const shx = this.shake ? (Math.random() - .5) * this.shake : 0, shy = this.shake ? (Math.random() - .5) * this.shake : 0;
      g.save();
      g.translate(shx, shy);
      const pad = this.boardPad;
      g.drawImage(this.boardImg, this.bx - pad, this.by - pad, this.C * cs + pad * 2, this.R * cs + pad * 2);
      const px = Math.round(cs * d);
      // cursed ground and bone piles
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const v = this.vc[r][c];
        if (v.v) continue;
        const x = this.bx + c * cs, y = this.by + r * cs;
        if (v.ground) {
          g.drawImage(G.Art.get('ground' + v.ground, px), x, y, cs, cs);
          if (v.ground === 2) { g.globalAlpha = .12 + .1 * Math.sin(this.time * 2 + r + c); g.fillStyle = '#ff2040'; g.fillRect(x, y, cs, cs); g.globalAlpha = 1; }
        }
        if (v.bone) {
          const w = v.wob ? Math.sin(v.wob * 30) * v.wob * cs * .06 : 0;
          g.drawImage(G.Art.get('bone' + v.bone, px), x + w, y, cs, cs);
        }
      }
      // selection glow
      if (this.sel) {
        const x = this.px(this.sel.c), y = this.py(this.sel.r);
        g.fillStyle = 'rgba(255,200,120,' + (.16 + .08 * Math.sin(this.time * 8)) + ')';
        rrect(g, x - cs / 2 + 2, y - cs / 2 + 2, cs - 4, cs - 4, cs * .15); g.fill();
      }
      // tiles
      g.save();
      g.clip(this.clip);
      const dying = [];
      for (const s of this.sprites.values()) { if (s.dying > 0) dying.push(s); else this.drawSprite(g, s, px); }
      for (const s of dying) this.drawSprite(g, s, px);
      g.restore();
      // chains on top of tiles
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const v = this.vc[r][c];
        if (!v.v && v.chained) g.drawImage(G.Art.get('chain', px), this.bx + c * cs, this.by + r * cs, cs, cs);
      }
      this.drawFx(g, px);
      // particles
      for (const p of this.parts) {
        const a = 1 - p.life / p.max;
        g.globalAlpha = p.kind === 'smoke' ? a * .45 : a;
        g.fillStyle = p.color;
        if (p.kind === 'smoke' || p.kind === 'spark') {
          g.beginPath(); g.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? (1 + p.life * 2) : 1), 0, TAU); g.fill();
        } else {
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
          g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66);
          g.restore();
        }
      }
      g.globalAlpha = 1;
      g.restore();
      if (this.flash > 0) {
        g.fillStyle = 'rgba(255,230,210,' + (this.flash * .35) + ')';
        g.fillRect(0, 0, this.W, this.H);
      }
      // collected items flying to the goals
      for (const f of this.flyers) {
        const k = G.ease.inOutQuad(Math.min(1, f.t / f.dur));
        const mx = (f.x0 + f.x1) / 2 + (f.x0 < f.x1 ? -60 : 60), my = Math.min(f.y0, f.y1) - 40;
        const x = (1 - k) * (1 - k) * f.x0 + 2 * (1 - k) * k * mx + k * k * f.x1;
        const y = (1 - k) * (1 - k) * f.y0 + 2 * (1 - k) * k * my + k * k * f.y1;
        const sz = cs * (.8 - .35 * k);
        g.drawImage(G.Art.get(f.key, px), x - sz / 2, y - sz / 2, sz, sz);
      }
      // big words
      for (const t of this.texts) {
        const k = t.t / t.life;
        const sc = t.scale * (k < .15 ? G.ease.outBack(k / .15) : 1);
        g.save();
        g.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
        g.translate(t.x, t.y - k * 30);
        g.scale(sc, sc);
        g.font = '900 ' + Math.round(Math.min(44, this.W / 9)) + 'px Cinzel, Copperplate, "Copperplate Gothic Bold", Georgia, serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(t.str, 0, 0);
        const gr = g.createLinearGradient(0, -20, 0, 20);
        gr.addColorStop(0, '#ffe6a0'); gr.addColorStop(.5, '#e0a040'); gr.addColorStop(1, '#a01810');
        g.fillStyle = gr; g.fillText(t.str, 0, 0);
        g.restore();
      }
    }

    drawSprite(g, s, px) {
      const cs = this.cs;
      let x = this.px(s.x), y = this.py(s.y + (s.intro < 0 ? s.intro * this.R * 1.2 : 0));
      let sc = 1, a = 1, sx = 1, sy = 1, rot = 0;
      if (s.pop < 1) sc *= Math.max(0, G.ease.outBack(s.pop));
      if (s.dying > 0) {
        const k = 1 - s.dying / s.dmax;
        if (s.merge) sc *= 1 - k * .35;
        else if (s.relic) a = 1 - k;
        else { sc *= 1 + k * .35; a = 1 - k; }
      }
      if (s.land > 0) { sy = 1 - s.land * .16; sx = 1 + s.land * .1; y += cs * .5 * (1 - sy); }
      if (this.hint && this.hint.t > 0) {
        const h = this.hint, gs = this.grid;
        const w = Math.sin(h.t * 14) * cs * .07 * (Math.sin(h.t * 2) > 0 ? 1 : 0);
        if (h.tap && gs[h.tap.r][h.tap.c] === s) sc *= 1 + Math.abs(w) / cs * 2;
        else if (h.a && gs[h.a.r][h.a.c] === s) { x += (h.b.c - h.a.c) * w; y += (h.b.r - h.a.r) * w; }
        else if (h.b && gs[h.b.r][h.b.c] === s) { x += (h.a.c - h.b.c) * w; y += (h.a.r - h.b.r) * w; }
      }
      if (s.tile.kind === 'chaos') rot = this.time * 1.6;
      const img = G.Art.get(G.Art.tileKey(s.tile), px);
      g.globalAlpha = a;
      if (rot || sc !== 1 || sx !== 1) {
        g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(sc * sx, sc * sy);
        g.drawImage(img, -cs / 2, -cs / 2, cs, cs);
        g.restore();
      } else g.drawImage(img, x - cs / 2, y - cs / 2, cs, cs);
      g.globalAlpha = 1;
    }

    drawFx(g, px) {
      const cs = this.cs;
      for (const f of this.fx) {
        if (f.type === 'jav') {
          const x = this.px(f.x), y = this.py(f.y);
          // trail
          const tl = cs * 2.2;
          const gr = g.createLinearGradient(x, y, x - f.dx * tl, y - f.dy * tl);
          gr.addColorStop(0, 'rgba(255,200,140,.7)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
          g.strokeStyle = gr; g.lineWidth = cs * .16; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - f.dx * tl, y - f.dy * tl); g.stroke();
          g.save(); g.translate(x, y);
          g.rotate(f.dx ? (f.dx > 0 ? 0 : Math.PI) : (f.dy > 0 ? Math.PI / 2 : -Math.PI / 2));
          g.drawImage(G.Art.get('jh', px), -cs * .65, -cs * .65, cs * 1.3, cs * 1.3);
          g.restore();
        } else if (f.type === 'ring') {
          const k = f.t / f.life;
          g.globalAlpha = 1 - k;
          g.strokeStyle = f.color; g.lineWidth = cs * .12 * (1 - k) + 1;
          g.beginPath(); g.arc(f.x, f.y, G.lerp(f.r0, f.r1, G.ease.outCubic(k)), 0, TAU); g.stroke();
          g.globalAlpha = 1;
        } else if (f.type === 'boom') {
          const k = f.t / f.life;
          const r = f.rad * G.ease.outCubic(Math.min(1, k * 1.6));
          const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, Math.max(1, r));
          gr.addColorStop(0, 'rgba(255,250,220,' + (1 - k) + ')');
          gr.addColorStop(.35, 'rgba(255,170,60,' + (.85 * (1 - k)) + ')');
          gr.addColorStop(.75, 'rgba(180,40,10,' + (.5 * (1 - k)) + ')');
          gr.addColorStop(1, 'rgba(60,0,0,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(255,200,120,' + (1 - k) + ')'; g.lineWidth = 3;
          g.beginPath(); g.arc(f.x, f.y, r * 1.1, 0, TAU); g.stroke();
        } else if (f.type === 'raven') {
          const k = Math.min(1, f.t / f.dur), e = G.ease.inOutQuad(k);
          const mx = (f.a.x + f.b.x) / 2, my = Math.min(f.a.y, f.b.y) - cs * 2.2;
          const x = (1 - e) * (1 - e) * f.a.x + 2 * (1 - e) * e * mx + e * e * f.b.x;
          const y = (1 - e) * (1 - e) * f.a.y + 2 * (1 - e) * e * my + e * e * f.b.y;
          const flap = .65 + .35 * Math.abs(Math.sin(f.t * 22));
          g.save(); g.translate(x, y); g.rotate((f.b.x - f.a.x) * .002); g.scale(1.25, 1.25 * flap);
          g.drawImage(G.Art.get('raven', px), -cs / 2, -cs / 2, cs, cs);
          if (f.carry) g.drawImage(G.Art.get(f.carry, px), -cs * .3, cs * .05, cs * .6, cs * .6);
          g.restore();
          if (Math.random() < .5) this.parts.push({ x, y, vx: (Math.random() - .5) * 30, vy: 20, life: 0, max: .5, size: cs * .08, color: '#15101a', kind: 'shard', rot: Math.random() * 6, vr: 4, g: 60 });
        } else if (f.type === 'beam') {
          const k = f.t / f.life;
          g.globalAlpha = 1 - k;
          const pts = [];
          const n = 7;
          for (let i = 0; i <= n; i++) {
            const t = i / n, j = (i === 0 || i === n) ? 0 : (Math.random() - .5) * cs * .5;
            const dx = f.b.x - f.a.x, dy = f.b.y - f.a.y, L = Math.hypot(dx, dy) || 1;
            pts.push([f.a.x + dx * t - dy / L * j, f.a.y + dy * t + dx / L * j]);
          }
          for (const [w, col] of [[cs * .22, 'rgba(160,60,255,.35)'], [cs * .07, '#f0d0ff']]) {
            g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
            g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.stroke();
          }
          g.globalAlpha = 1;
        }
      }
    }
  }
  G.View = View;
})(window.G);
