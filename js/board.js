/* Runes of Ruin - board model.
   Pure game logic: no drawing. Every player action runs to completion at once and returns a list of
   events that the renderer (view.js) replays with animation. This also lets a bot play levels fast
   to tune move counts (tools/tune.html). */
(function (G) {
  'use strict';
  let NEXT_ID = 1;

  function Tile(kind, color) {
    this.id = NEXT_ID++;
    this.kind = kind;            // 'n' normal, 'jh','jv' javelins, 'bomb', 'raven', 'chaos', 'relic'
    this.color = color === undefined ? -1 : color;
    this.chained = false;
    this.fired = false;
  }
  G.Tile = Tile;

  const POW = { jh: 1, jv: 1, bomb: 1, raven: 1, chaos: 1 };
  const isPow = k => !!POW[k];
  G.isPow = isPow;
  const powClass = k => (k === 'jh' || k === 'jv') ? 'jav' : k;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  class Board {
    constructor(level, seed) {
      this.level = level;
      this.rng = G.rng(seed === undefined ? (Math.random() * 1e9) | 0 : seed);
      const L = level.layout;
      this.R = L.length; this.C = L[0].length;
      this.nColors = level.colors;
      this.moves = level.moves;
      this.cells = [];
      let bones = 0, grounds = 0, chains = 0, relics = 0;
      for (let r = 0; r < this.R; r++) {
        const row = [];
        for (let c = 0; c < this.C; c++) {
          const ch = L[r][c] || '.';
          const x = { v: false, t: null, bone: 0, ground: 0, flag: null };
          switch (ch) {
            case '.': x.v = true; break;
            case 'b': x.bone = 1; break;
            case 'B': x.bone = 2; break;
            case 'X': x.bone = 3; break;
            case 'k': x.bone = 1; x.ground = 1; break;
            case 'K': x.bone = 2; x.ground = 1; break;
            case 'g': x.ground = 1; break;
            case 'G': x.ground = 2; break;
            case 'c': x.flag = 'chain'; break;
            case 'h': x.ground = 1; x.flag = 'chain'; break;
            case 'H': x.ground = 2; x.flag = 'chain'; break;
            case 'r': x.flag = 'relic'; break;
            default: break; // '#': plain cell
          }
          if (x.bone) bones++;
          if (x.ground) grounds++;
          if (x.flag === 'chain') chains++;
          if (x.flag === 'relic') relics++;
          row.push(x);
        }
        this.cells.push(row);
      }
      this.relicsTotal = Math.max(level.relics || 0, relics);
      this.relicsLeft = this.relicsTotal - relics;
      const auto = { bone: bones, ground: grounds, chain: chains, relic: this.relicsTotal };
      this.goals = level.goals.map(g => ({
        type: g.type, color: g.color === undefined ? -1 : g.color,
        need: g.n !== undefined ? g.n : (auto[g.type] || 0), have: 0, boss: g.boss
      }));
      // Boss fight [S07]: the boss's health is a goal; every blow on the board hurts it
      const bi = level.bossInfo;
      this.boss = bi ? Object.assign({}, bi, { gi: this.goals.findIndex(g => g.type === 'boss'), timer: bi.every, angry: false, turn: 0 }) : null;
      // top (spawn) and bottom (relic exit) playable row of each column
      this.top = []; this.bottom = [];
      for (let c = 0; c < this.C; c++) {
        let t = -1, b = -1;
        for (let r = 0; r < this.R; r++) if (!this.cells[r][c].v) { if (t < 0) t = r; b = r; }
        this.top.push(t); this.bottom.push(b);
      }
      this.swapCells = null;
      this.lastMoved = new Set();
      this.fillInitial();
    }

    // ---------- helpers ----------
    cell(r, c) { return (r >= 0 && r < this.R && c >= 0 && c < this.C && !this.cells[r][c].v) ? this.cells[r][c] : null; }
    colorAt(r, c) { const x = this.cell(r, c); return x && x.t && x.t.kind === 'n' ? x.t.color : -1; }
    movable(x) { return !!(x && x.t && !x.t.chained); }
    isWon() { return this.goals.every(g => g.have >= g.need); }
    randomTile() { return new Tile('n', this.rng.int(this.nColors)); }

    fillInitial() {
      for (let tries = 0; tries < 200; tries++) {
        for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
          const x = this.cells[r][c];
          if (x.v || x.bone) continue;
          if (x.flag === 'relic') { x.t = new Tile('relic'); continue; }
          const order = this.rng.shuffle([...Array(this.nColors).keys()]);
          for (const col of order) { x.t = new Tile('n', col); if (!this.matchAt(r, c)) break; }
          if (x.flag === 'chain') x.t.chained = true;
        }
        if (this.findGroups().length === 0 && this.listMoves().length >= 3) return;
      }
    }

    // Does the normal tile at r,c form a line of 3 or a 2x2 square?
    matchAt(r, c) {
      const col = this.colorAt(r, c);
      if (col < 0) return false;
      let n = 1;
      for (let k = c - 1; this.colorAt(r, k) === col; k--) n++;
      for (let k = c + 1; this.colorAt(r, k) === col; k++) n++;
      if (n >= 3) return true;
      n = 1;
      for (let k = r - 1; this.colorAt(k, c) === col; k--) n++;
      for (let k = r + 1; this.colorAt(k, c) === col; k++) n++;
      if (n >= 3) return true;
      for (let dr = -1; dr <= 0; dr++) for (let dc = -1; dc <= 0; dc++) {
        const a = r + dr, b = c + dc;
        if (this.colorAt(a, b) === col && this.colorAt(a, b + 1) === col && this.colorAt(a + 1, b) === col && this.colorAt(a + 1, b + 1) === col) return true;
      }
      return false;
    }

    // All moves that do something: swaps that match, swaps with a power-up, and taps on power-ups.
    listMoves(includeTaps) {
      const out = [];
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const a = this.cell(r, c);
        if (!this.movable(a)) continue;
        if (includeTaps && isPow(a.t.kind)) out.push({ tap: { r, c } });
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const b = this.cell(r + dr, c + dc);
          if (!this.movable(b)) continue;
          const mv = { a: { r, c }, b: { r: r + dr, c: c + dc } };
          if (isPow(a.t.kind) || isPow(b.t.kind)) { mv.pow = true; out.push(mv); continue; }
          const ta = a.t; a.t = b.t; b.t = ta;
          const ok = this.matchAt(r, c) || this.matchAt(r + dr, c + dc);
          b.t = a.t; a.t = ta;
          if (ok) out.push(mv);
        }
      }
      return out;
    }

    // ---------- player actions ----------
    // Returns null if the swap is impossible, or a list of events (events[0].ok === false: no match, swapped back)
    trySwap(a, b) {
      const A = this.cell(a.r, a.c), B = this.cell(b.r, b.c);
      if (!this.movable(A) || !this.movable(B)) return null;
      if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return null;
      const ta = A.t, tb = B.t;
      A.t = tb; B.t = ta;
      const pa = isPow(ta.kind), pb = isPow(tb.kind);
      const ev = [];
      if (pa || pb) {
        this.moves--;
        ev.push({ type: 'swap', a, b, ok: true });
        if (pa && pb) ev.push(this.runBlast(t => this.combo(ta, b, tb, a, t)));
        else {
          const p = pa ? ta : tb, pos = pa ? b : a, other = pa ? tb : ta;
          ev.push(this.runBlast(t => this.fireTile(p, pos.r, pos.c, t, { color: other.kind === 'n' ? other.color : undefined })));
        }
        ev.push(this.fall());
        this.cascade(ev);
        this.bossTurn(ev);
        return ev;
      }
      this.swapCells = [a, b];
      if (this.findGroups().length === 0) {
        A.t = ta; B.t = tb; this.swapCells = null;
        return [{ type: 'swap', a, b, ok: false }];
      }
      this.moves--;
      ev.push({ type: 'swap', a, b, ok: true });
      this.cascade(ev);
      this.bossTurn(ev);
      return ev;
    }

    tap(r, c) {
      const x = this.cell(r, c);
      if (!this.movable(x) || !isPow(x.t.kind)) return null;
      this.moves--;
      const tl = x.t;
      const ev = [{ type: 'tap', r, c }];
      ev.push(this.runBlast(t => this.fireTile(tl, r, c, t, {})));
      ev.push(this.fall());
      this.cascade(ev);
      this.bossTurn(ev);
      return ev;
    }

    // ---------- the boss fights back [S07] ----------
    // After each move: the countdown drops; at 0 the boss attacks. Below half health it attacks every 2 moves.
    bossTurn(ev) {
      const B = this.boss;
      if (!B) return;
      const g = this.goals[B.gi];
      if (g.have < g.need && this.moves > 0) {
        B.angry = g.have * 2 >= g.need;
        B.timer--;
        if (B.angry && B.timer > 2) B.timer = 2;
        if (B.timer <= 0) {
          let used = B.attacks[B.turn++ % B.attacks.length];
          const blast = this.runBlast(t => { used = this.attack(used, t); });
          ev.push({ type: 'bossAttack', kind: used, id: B.id });
          ev.push(blast);
          B.timer = B.angry ? 2 : B.every;
          if (this.listMoves(true).length === 0) ev.push(this.shuffle());
        }
      }
      ev.push({ type: 'bossTick', timer: B.timer, angry: B.angry });
    }

    attack(kind, t) {
      const pick = (ok, n) => {
        const list = [];
        for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) { const x = this.cell(r, c); if (x && ok(x, r, c)) list.push({ r, c }); }
        return this.rng.shuffle(list).slice(0, n);
      };
      const plain = x => x.t && x.t.kind === 'n' && !x.t.chained;
      if (kind === 'burn') {
        const p = pick(x => x.t && isPow(x.t.kind) && !x.t.chained, 1)[0];
        if (!p) kind = 'bind';
        else {
          const x = this.cells[p.r][p.c];
          const order = this.rng.shuffle([...Array(this.nColors).keys()]);
          for (const col of order) { x.t = new Tile('n', col); if (!this.matchAt(p.r, p.c)) break; }
          this.emit(t, { k: 'transform', r: p.r, c: p.c, tile: x.t, from: null });
          return 'burn';
        }
      }
      if (kind === 'bind') {
        pick(plain, 3).forEach((p, i) => { this.cells[p.r][p.c].t.chained = true; this.emit(t + i * 110, { k: 'bind', r: p.r, c: p.c }); });
      } else if (kind === 'bury') {
        // never in a column's top two rows, so new tiles can still fall in
        pick((x, r, c) => plain(x) && r > this.top[c] + 1, 2).forEach((p, i) => {
          const x = this.cells[p.r][p.c], id = x.t.id;
          x.t = null; x.bone = 1;
          this.emit(t + i * 160, { k: 'bury', r: p.r, c: p.c, id, hp: 1 });
        });
      } else if (kind === 'curse') {
        pick(x => x.t && x.t.kind !== 'relic' && x.ground < 2 && !x.bone, 4).forEach((p, i) => {
          const x = this.cells[p.r][p.c];
          x.ground++;
          this.emit(t + i * 90, { k: 'curse', r: p.r, c: p.c, lv: x.ground });
        });
      }
      return kind;
    }

    // n blows on the boss; each one flies from the board to the boss's health bar
    hurt(n, t, r, c, fk) {
      const B = this.boss;
      if (!B) return;
      const g = this.goals[B.gi];
      for (let i = 0; i < n && g.have < g.need; i++) {
        g.have++;
        this.emit(t + i * 40, { k: 'collect', gi: B.gi, r, c, type: 'boss', color: -1, fk });
      }
    }

    // The hammer (bought with gold): one blow on any cell, costs no move. [S06]
    smash(r, c) {
      const x = this.cell(r, c);
      if (!x || (!x.t && !x.bone)) return null;
      const ev = [{ type: 'tap', r, c }];
      ev.push(this.runBlast(t => this.hit(r, c, t, null)));
      ev.push(this.fall());
      this.cascade(ev);
      return ev;
    }

    // End of level: each move left becomes a javelin, then every power-up left on the board fires.
    bonus(maxN) {
      const ev = [];
      const n = Math.min(this.moves, maxN || 12);
      this.moves = 0;
      if (n > 0) {
        ev.push(this.runBlast(t => {
          const cand = [];
          for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
            const x = this.cell(r, c);
            if (x && x.t && x.t.kind === 'n' && !x.t.chained) cand.push({ r, c });
          }
          this.rng.shuffle(cand);
          for (let i = 0; i < n && i < cand.length; i++) {
            const p = cand[i];
            this.sched(t + i * 110, tt => {
              const x = this.cell(p.r, p.c);
              if (!x || !x.t || x.t.kind !== 'n') return;
              const nt = new Tile(this.rng() < .5 ? 'jh' : 'jv');
              x.t = nt;
              this.emit(tt, { k: 'transform', r: p.r, c: p.c, tile: nt, from: null });
              this.sched(tt + 380, t2 => this.hit(p.r, p.c, t2));
            });
          }
        }));
        ev.push(this.fall());
        this.cascade(ev, true);
      }
      for (let loop = 0; loop < 8; loop++) {
        const pows = [];
        for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
          const x = this.cell(r, c);
          if (x && x.t && isPow(x.t.kind)) pows.push({ r, c });
        }
        if (!pows.length) break;
        ev.push(this.runBlast(t => pows.forEach((p, i) => this.sched(t + i * 140, tt => this.hit(p.r, p.c, tt)))));
        ev.push(this.fall());
        this.cascade(ev, true);
      }
      return ev;
    }

    // ---------- blasts: a time-ordered chain of hits ----------
    emit(t, item) { item.t = t; this.items.push(item); }
    sched(t, fn) { this.q.push({ t, fn, s: this.seq++ }); }
    runBlast(init) {
      this.q = []; this.items = []; this.seq = 0; this.ravenTargets = new Set();
      init(0);
      let guard = 0;
      while (this.q.length && guard++ < 20000) {
        let bi = 0;
        for (let i = 1; i < this.q.length; i++) {
          const a = this.q[i], b = this.q[bi];
          if (a.t < b.t || (a.t === b.t && a.s < b.s)) bi = i;
        }
        const a = this.q.splice(bi, 1)[0];
        a.fn(a.t);
      }
      const items = this.items.slice().sort((a, b) => a.t - b.t);
      const dur = items.length ? items[items.length - 1].t + 260 : 0;
      return { type: 'blast', items, dur };
    }

    goalAdd(type, color, t, r, c) {
      for (let i = 0; i < this.goals.length; i++) {
        const g = this.goals[i];
        if (g.type === type && (type !== 'color' || g.color === color) && g.have < g.need) {
          g.have++;
          this.emit(t, { k: 'collect', gi: i, r, c, type, color });
          return;
        }
      }
    }

    // One blow on a cell.
    hit(r, c, t, src) {
      const x = this.cell(r, c);
      if (!x) return;
      if (x.bone > 0) {
        x.bone--;
        this.emit(t, { k: 'bone', r, c, hp: x.bone });
        if (!x.bone) this.goalAdd('bone', -1, t, r, c);
        this.hurt(1, t, r, c, 'bone1');
        return;
      }
      const tl = x.t;
      if (tl) {
        if (tl.chained) {
          tl.chained = false;
          this.emit(t, { k: 'chain', r, c });
          this.goalAdd('chain', -1, t, r, c);
          this.hurt(1, t, r, c, 'chain');
          return;
        }
        if (tl.kind === 'relic') return; // relics can't be destroyed, only brought down
        x.t = null;
        this.emit(t, { k: 'remove', r, c, id: tl.id, merge: src && src.merge ? src.merge : null });
        if (this.boss) this.hurt(tl.kind === 'n' && tl.color === this.boss.weak ? 2 : 1, t, r, c, tl.kind === 'n' ? 'tile' + tl.color : tl.kind);
        if (tl.kind === 'n') this.goalAdd('color', tl.color, t, r, c);
        else if (!tl.fired) {
          tl.fired = true;
          this.emit(t, { k: 'fx', fx: 'trigger', r, c, kind: tl.kind });
          this.sched(t + 70, tt => this.activate(tl.kind, r, c, tt, {}));
        }
      }
      if (x.ground > 0) {
        x.ground--;
        this.emit(t, { k: 'ground', r, c, lv: x.ground });
        if (!x.ground) this.goalAdd('ground', -1, t, r, c);
        this.hurt(1, t, r, c, 'ground1');
      }
    }

    fireTile(tl, r, c, t, opts) {
      tl.fired = true;
      this.hit(r, c, t);
      this.emit(t, { k: 'fx', fx: 'trigger', r, c, kind: tl.kind });
      this.activate(tl.kind, r, c, t, opts || {});
    }

    activate(kind, r, c, t, o) {
      o = o || {};
      const S = (dt, fn) => this.sched(t + dt, fn);
      switch (kind) {
        case 'jh': case 'jv': {
          const h = kind === 'jh';
          if (h ? (r < 0 || r >= this.R) : (c < 0 || c >= this.C)) return;
          this.emit(t, { k: 'fx', fx: 'javelin', r, c, dir: h ? 'h' : 'v' });
          const n = h ? this.C : this.R, pos = h ? c : r;
          for (let i = 0; i < n; i++) {
            if (i === pos && !o.includeOrigin) continue;
            const d = Math.abs(i - pos), rr = h ? r : i, cc = h ? i : c;
            S(d * G.T.JAV_DT, tt => this.hit(rr, cc, tt));
          }
          break;
        }
        case 'bomb': {
          const R = o.radius || 2;
          this.emit(t + G.T.BOMB_DELAY, { k: 'fx', fx: 'bomb', r, c, rad: R });
          for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
            if (!dr && !dc) continue;
            const d = Math.max(Math.abs(dr), Math.abs(dc));
            S(G.T.BOMB_DELAY + d * 28, tt => this.hit(r + dr, c + dc, tt));
          }
          break;
        }
        case 'raven': {
          for (const [dr, dc] of DIRS) S(30, tt => this.hit(r + dr, c + dc, tt));
          const count = o.count || 1;
          for (let i = 0; i < count; i++) {
            S(110 + i * 90, tt => {
              const tg = this.pickTarget(r, c);
              if (!tg) return;
              this.ravenTargets.add(tg.r * 100 + tg.c);
              this.emit(tt, { k: 'fx', fx: 'raven', from: { r, c }, to: tg, dur: G.T.RAVEN_FLY, carry: o.carry || null });
              this.sched(tt + G.T.RAVEN_FLY, t2 => {
                this.hit(tg.r, tg.c, t2);
                if (o.carry) this.activate(o.carry, tg.r, tg.c, t2, {});
              });
            });
          }
          break;
        }
        case 'chaos': {
          this.emit(t, { k: 'fx', fx: 'chaos', r, c, all: !!o.all });
          if (o.all) {
            for (let rr = 0; rr < this.R; rr++) for (let cc = 0; cc < this.C; cc++) {
              const d = Math.max(Math.abs(rr - r), Math.abs(cc - c));
              if (d) S(150 + d * 50, tt => this.hit(rr, cc, tt));
            }
            break;
          }
          const col = (o.color !== undefined && o.color >= 0) ? o.color : this.commonColor();
          const targets = [];
          for (let rr = 0; rr < this.R; rr++) for (let cc = 0; cc < this.C; cc++) {
            const x = this.cell(rr, cc);
            if (x && x.t && x.t.kind === 'n' && x.t.color === col) targets.push({ r: rr, c: cc });
          }
          targets.sort((a, b) => (Math.abs(a.r - r) + Math.abs(a.c - c)) - (Math.abs(b.r - r) + Math.abs(b.c - c)));
          targets.forEach((p, i) => {
            if (o.convert) {
              S(150 + i * 35, tt => {
                const x = this.cell(p.r, p.c);
                if (!x || !x.t || x.t.kind !== 'n') return;
                const k = o.convert === 'jav' ? (this.rng() < .5 ? 'jh' : 'jv') : o.convert;
                const nt = new Tile(k);
                nt.chained = x.t.chained;
                x.t = nt;
                this.emit(tt, { k: 'fx', fx: 'beam', from: { r, c }, to: p });
                this.emit(tt, { k: 'transform', r: p.r, c: p.c, tile: nt });
              });
              S(150 + targets.length * 35 + 280 + i * 70, tt => this.hit(p.r, p.c, tt));
            } else {
              S(150 + i * 35, tt => {
                this.emit(tt, { k: 'fx', fx: 'beam', from: { r, c }, to: p });
                this.hit(p.r, p.c, tt);
              });
            }
          });
          break;
        }
      }
    }

    // Two power-ups swapped into each other. t1 now sits at p, t2 at q; the combo goes off at p.
    combo(t1, p, t2, q, t) {
      t1.fired = t2.fired = true;
      this.hit(p.r, p.c, t); this.hit(q.r, q.c, t);
      const k1 = powClass(t1.kind), k2 = powClass(t2.kind);
      const has = k => k1 === k || k2 === k, both = k => k1 === k && k2 === k;
      const { r, c } = p;
      this.emit(t, { k: 'fx', fx: 'combo', r, c, a: t1.kind, b: t2.kind });
      if (both('chaos')) return this.activate('chaos', r, c, t, { all: true });
      if (has('chaos')) { const other = k1 === 'chaos' ? k2 : k1; return this.activate('chaos', r, c, t, { convert: other }); }
      if (both('bomb')) return this.activate('bomb', r, c, t, { radius: 3 });
      if (both('jav')) { this.activate('jh', r, c, t); this.activate('jv', r, c, t); return; }
      if (has('jav') && has('bomb')) {
        for (let d = -1; d <= 1; d++) {
          this.activate('jh', r + d, c, t, { includeOrigin: d !== 0 });
          this.activate('jv', r, c + d, t, { includeOrigin: d !== 0 });
        }
        return;
      }
      if (both('raven')) return this.activate('raven', r, c, t, { count: 3 });
      const carry = k1 === 'raven' ? t2.kind : t1.kind;
      this.activate('raven', r, c, t, { carry });
    }

    commonColor() {
      const n = new Array(this.nColors).fill(0);
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const x = this.cell(r, c);
        if (x && x.t && x.t.kind === 'n') n[x.t.color] += x.t.chained ? 0.5 : 1;
      }
      let best = 0;
      for (let i = 1; i < n.length; i++) if (n[i] > n[best]) best = i;
      return best;
    }

    // Raven target: whatever the goals need most.
    pickTarget(r0, c0) {
      const need = type => this.goals.some(g => g.type === type && g.have < g.need);
      const needColor = col => this.goals.some(g => g.type === 'color' && g.color === col && g.have < g.need);
      let best = -1, list = [];
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const x = this.cell(r, c);
        if (!x || (r === r0 && c === c0) || this.ravenTargets.has(r * 100 + c)) continue;
        let s = 0;
        if (x.bone > 0) s = need('bone') ? 10 + (3 - x.bone) * .1 : 2;
        else if (x.t) {
          if (x.t.kind === 'relic') continue;
          if (x.t.chained) s = need('chain') ? 9 : 2;
          else if (x.ground > 0) s = need('ground') ? 8 + x.ground * .1 : 1;
          else if (x.t.kind === 'n' && needColor(x.t.color)) s = 5;
          else s = isPow(x.t.kind) ? .5 : 1;
          const up = this.cell(r - 1, c);
          if (need('relic') && up && up.t && up.t.kind === 'relic') s = Math.max(s, 7);
        } else if (x.ground > 0) s = need('ground') ? 7 : 0;
        else continue;
        if (s > best) { best = s; list = [{ r, c }]; } else if (s === best) list.push({ r, c });
      }
      return list.length ? list[this.rng.int(list.length)] : null;
    }

    // ---------- matching ----------
    findGroups() {
      const R = this.R, C = this.C, runs = [];
      for (let r = 0; r < R; r++) {
        let c = 0;
        while (c < C) {
          const col = this.colorAt(r, c);
          if (col < 0) { c++; continue; }
          let e = c;
          while (e + 1 < C && this.colorAt(r, e + 1) === col) e++;
          if (e - c >= 2) { const cells = []; for (let k = c; k <= e; k++) cells.push({ r, c: k }); runs.push({ d: 'h', cells }); }
          c = e + 1;
        }
      }
      for (let c = 0; c < C; c++) {
        let r = 0;
        while (r < R) {
          const col = this.colorAt(r, c);
          if (col < 0) { r++; continue; }
          let e = r;
          while (e + 1 < R && this.colorAt(e + 1, c) === col) e++;
          if (e - r >= 2) { const cells = []; for (let k = r; k <= e; k++) cells.push({ r: k, c }); runs.push({ d: 'v', cells }); }
          r = e + 1;
        }
      }
      for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
        const col = this.colorAt(r, c);
        if (col >= 0 && this.colorAt(r, c + 1) === col && this.colorAt(r + 1, c) === col && this.colorAt(r + 1, c + 1) === col)
          runs.push({ d: 's', cells: [{ r, c }, { r, c: c + 1 }, { r: r + 1, c }, { r: r + 1, c: c + 1 }] });
      }
      if (!runs.length) return [];
      const parent = new Map();
      const key = p => p.r * 100 + p.c;
      const find = k => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
      for (const run of runs) for (const p of run.cells) if (!parent.has(key(p))) parent.set(key(p), key(p));
      for (const run of runs) { const a = find(key(run.cells[0])); for (const p of run.cells) { const b = find(key(p)); if (a !== b) parent.set(b, a); } }
      const groups = new Map();
      for (const run of runs) {
        const root = find(key(run.cells[0]));
        if (!groups.has(root)) groups.set(root, { cells: new Map(), runs: [] });
        const g = groups.get(root);
        g.runs.push(run);
        for (const p of run.cells) g.cells.set(key(p), p);
      }
      const out = [];
      for (const g of groups.values()) {
        let maxLen = 0, hasH = false, hasV = false, hasS = false, longest = null, four = null;
        for (const run of g.runs) {
          if (run.d === 's') { hasS = true; continue; }
          if (run.d === 'h') hasH = true; else hasV = true;
          if (run.cells.length > maxLen) { maxLen = run.cells.length; longest = run; }
          if (run.cells.length === 4) four = run;
        }
        let power = null;
        if (maxLen >= 5) power = 'chaos';
        else if (hasH && hasV) power = 'bomb';
        else if (four) power = four.d === 'h' ? 'jh' : 'jv';
        else if (hasS) power = 'raven';
        const cells = [...g.cells.values()];
        const group = { cells, power, spawn: null };
        if (power) group.spawn = this.pickSpawn(g, cells, power, longest);
        if (power && !group.spawn) group.power = null;
        out.push(group);
      }
      return out;
    }

    pickSpawn(g, cells, power, longest) {
      const ok = p => { const x = this.cell(p.r, p.c); return x && x.t && !x.t.chained; };
      const inG = p => g.cells.has(p.r * 100 + p.c);
      if (this.swapCells) for (const p of this.swapCells) if (inG(p) && ok(p)) return p;
      if (power === 'bomb') {
        const hs = g.runs.filter(x => x.d === 'h'), vs = g.runs.filter(x => x.d === 'v');
        for (const h of hs) for (const v of vs) for (const p of h.cells) if (v.cells.some(q => q.r === p.r && q.c === p.c) && ok(p)) return p;
      }
      for (const p of cells) { const x = this.cell(p.r, p.c); if (x.t && this.lastMoved.has(x.t.id) && ok(p)) return p; }
      const src = longest ? longest.cells : cells;
      const mid = src[Math.floor(src.length / 2)];
      if (ok(mid)) return mid;
      return cells.find(ok) || null;
    }

    blastMatches(groups, t) {
      for (const g of groups) {
        const merge = g.power ? { r: g.spawn.r, c: g.spawn.c } : null;
        const adj = new Set();
        g.cells.forEach((p, i) => {
          this.hit(p.r, p.c, t + (merge ? 0 : i * 12), merge ? { merge } : null);
          for (const [dr, dc] of DIRS) { const q = this.cell(p.r + dr, p.c + dc); if (q && q.bone > 0) adj.add((p.r + dr) * 100 + p.c + dc); }
        });
        for (const k of adj) this.hit(Math.floor(k / 100), k % 100, t + 40);
        if (g.power) {
          const sp = g.spawn, kind = g.power;
          this.sched(t + 170, tt => {
            const x = this.cell(sp.r, sp.c);
            if (x && !x.t && !x.bone) {
              const nt = new Tile(kind);
              x.t = nt;
              this.emit(tt, { k: 'spawnPower', r: sp.r, c: sp.c, tile: nt });
            }
          });
        }
      }
    }

    // Keep matching, dropping and collecting relics until the board is still.
    cascade(ev, quiet) {
      let n = 0;
      for (let guard = 0; guard < 80; guard++) {
        const exits = [];
        for (let c = 0; c < this.C; c++) {
          const r = this.bottom[c];
          if (r >= 0) { const x = this.cells[r][c]; if (x.t && x.t.kind === 'relic') exits.push({ r, c }); }
        }
        if (exits.length) {
          ev.push(this.runBlast(t => exits.forEach((p, i) => {
            const x = this.cells[p.r][p.c], tl = x.t;
            x.t = null;
            this.emit(t + i * 60, { k: 'remove', r: p.r, c: p.c, id: tl.id, relic: true });
            this.goalAdd('relic', -1, t + i * 60, p.r, p.c);
          })));
          ev.push(this.fall());
          continue;
        }
        const groups = this.findGroups();
        if (!groups.length) break;
        n++;
        const b = this.runBlast(t => this.blastMatches(groups, t));
        b.cascade = n;
        ev.push(b);
        this.swapCells = null;
        ev.push(this.fall());
      }
      this.swapCells = null;
      if (!quiet && !this.isWon() && this.moves > 0 && this.listMoves(true).length === 0) ev.push(this.shuffle());
    }

    // ---------- gravity ----------
    spawnTile() {
      if (this.relicsLeft > 0) {
        let onBoard = 0;
        for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) { const x = this.cells[r][c]; if (x.t && x.t.kind === 'relic') onBoard++; }
        if (onBoard < 2 && this.rng() < 0.22) { this.relicsLeft--; return new Tile('relic'); }
      }
      return this.randomTile();
    }

    fall() {
      const R = this.R, C = this.C, cells = this.cells;
      const moves = new Map(), spawns = [], spawnCount = new Array(C).fill(0);
      const empty = x => !x.v && !x.t && x.bone === 0;
      const blocker = x => x.bone > 0 || (x.t && x.t.chained);
      const moveTile = (fr, fc, tr, tc) => {
        const t = cells[fr][fc].t;
        cells[fr][fc].t = null; cells[tr][tc].t = t;
        let m = moves.get(t.id);
        if (!m) { m = { id: t.id, path: [[fr, fc]] }; moves.set(t.id, m); }
        m.path.push([tr, tc]);
      };
      let changed = true, guard = 0;
      while (changed && guard++ < 2000) {
        changed = false;
        for (let c = 0; c < C; c++) {
          for (let r = R - 1; r >= 0; r--) {
            const x = cells[r][c];
            if (!empty(x)) continue;
            let rr = r - 1, blocked = false, found = false;
            while (rr >= 0) {
              const up = cells[rr][c];
              if (up.v) { rr--; continue; }
              if (blocker(up)) { blocked = true; break; }
              if (up.t) { moveTile(rr, c, r, c); found = true; break; }
              rr--;
            }
            if (found) { changed = true; continue; }
            if (!blocked) {
              const t = this.spawnTile();
              x.t = t;
              spawnCount[c]++;
              const m = { id: t.id, path: [[this.top[c] - spawnCount[c], c], [r, c]], tile: t };
              moves.set(t.id, m);
              spawns.push(m);
              changed = true;
            }
          }
        }
        if (changed) continue;
        // diagonal slide into cells that are blocked from above
        outer:
        for (let r = R - 1; r >= 0; r--) {
          for (let c = 0; c < C; c++) {
            const x = cells[r][c];
            if (!empty(x)) continue;
            const sides = this.rng() < .5 ? [-1, 1] : [1, -1];
            for (const dc of sides) {
              const cc = c + dc, rr = r - 1;
              if (rr < 0 || cc < 0 || cc >= C) continue;
              const s = cells[rr][cc];
              if (s.v || !s.t || s.t.chained) continue;
              moveTile(rr, cc, r, c);
              changed = true;
              break outer;
            }
          }
        }
      }
      this.lastMoved = new Set(moves.keys());
      const mv = [], sp = [];
      for (const m of moves.values()) (m.tile ? sp : mv).push(m);
      return { type: 'fall', moves: mv, spawns: sp };
    }

    shuffle() {
      const pos = [], tiles = [];
      for (let r = 0; r < this.R; r++) for (let c = 0; c < this.C; c++) {
        const x = this.cell(r, c);
        if (x && x.t && x.t.kind === 'n' && !x.t.chained) { pos.push({ r, c }); tiles.push(x.t); }
      }
      for (let k = 0; k < 300; k++) {
        this.rng.shuffle(tiles);
        if (k > 150) tiles.forEach(t => { t.color = this.rng.int(this.nColors); });
        pos.forEach((p, i) => { this.cells[p.r][p.c].t = tiles[i]; });
        if (this.findGroups().length === 0 && this.listMoves().length > 0) break;
      }
      return { type: 'shuffle', tiles: pos.map(p => ({ id: this.cells[p.r][p.c].t.id, r: p.r, c: p.c, color: this.cells[p.r][p.c].t.color })) };
    }

    // ---------- for the tuning bot ----------
    clone() {
      const b = Object.create(Board.prototype);
      Object.assign(b, this);
      b.cells = this.cells.map(row => row.map(x => ({ v: x.v, bone: x.bone, ground: x.ground, flag: x.flag, t: x.t ? Object.assign(Object.create(Tile.prototype), x.t) : null })));
      b.goals = this.goals.map(g => Object.assign({}, g));
      b.boss = this.boss ? Object.assign({}, this.boss) : null;
      b.rng = G.rng(1); b.rng.setState(this.rng.getState());
      b.lastMoved = new Set(this.lastMoved);
      return b;
    }
    progress() {
      let p = 0;
      for (const g of this.goals) p += g.need ? Math.min(g.have, g.need) / g.need : 1;
      return p / this.goals.length;
    }
  }
  G.Board = Board;
})(window.G);
