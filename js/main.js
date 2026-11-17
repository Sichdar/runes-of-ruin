/* Runes of Ruin - game flow, input, main loop. */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = () => G.Audio || { play() {}, unlock() {}, music() {}, setSound() {}, setMusic() {}, suspend() {}, resume() {} };
  const snd = (n, o) => A().play(n, o);
  const WIN_LINES = ['The dead rest again.', 'Another hall purged.', 'The darkness recoils.', 'Your javelins found their mark.', 'Silence returns to the stones.'];
  const LOSE_LINES = ['The darkness endures.', 'The dead outnumber you.', 'Your strength fails.'];
  const EXTRA_MOVES = 5;

  const App = {
    scene: 'title', state: 'idle', mapAct: 0,
    level: null, board: null, view: new G.View(),
    W: 0, H: 0, dpr: 1, bg: null, bgKey: '', ambient: null, ambientKey: '',
    idle: 0, drag: null, selected: null, buys: 0,

    init() {
      G.Save.load();
      const S = G.Save.data;
      this.cv = $('cv');
      this.ctx = this.cv.getContext('2d');
      this.view.hooks = { goalPos: gi => G.UI.goalPos(gi), collected: gi => G.UI.goalTick(gi) };
      A().setSound && A().setSound(S.sound);
      A().setMusic && A().setMusic(S.music);
      this.bindInput();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
      document.addEventListener('visibilitychange', () => { if (document.hidden) A().suspend(); else A().resume(); });
      $('btnPlay').onclick = () => { snd('click'); this.openMap(G.Levels.actOf(G.Save.data.unlocked)); };
      $('btnTitleMap').onclick = () => { snd('click'); this.openMap(G.Levels.actOf(G.Save.data.unlocked)); };
      $('btnMapBack').onclick = () => { snd('click'); this.openTitle(); };
      $('btnMapPlay').onclick = () => { snd('click'); this.startLevel(G.Save.data.unlocked); };
      $('btnActPrev').onclick = () => { snd('click'); this.openMap(this.mapAct - 1); };
      $('btnActNext').onclick = () => { snd('click'); this.openMap(this.mapAct + 1); };
      $('btnPause').onclick = () => { snd('click'); this.pause(); };
      $('titleFoot').textContent = 'v' + G.VERSION + (S.unlocked > 1 ? ' · level ' + S.unlocked : '');
      this.resize();
      this.openTitle();
      let last = performance.now();
      const loop = now => {
        const dt = Math.min(.05, (now - last) / 1000);
        last = now;
        this.frame(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      // Offline support only on a real https site (on localhost it would cache old files while developing)
      if ('serviceWorker' in navigator && location.protocol === 'https:') {
        navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker not registered:', e));
      }
    },

    resize() {
      this.W = window.innerWidth; this.H = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
      this.bg = null;
      if (this.scene === 'level') this.layoutBoard();
      if (this.scene === 'map') G.UI.buildMap(this.mapAct, n => this.startLevel(n));
    },
    layoutBoard() {
      const top = G.UI.hudBottom() + 10;
      const probe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
      this.view.layout(this.W, this.H, top, 18 + probe, this.dpr);
    },
    theme() {
      if (this.scene === 'title') return 'title';
      if (this.scene === 'level' && this.level) return this.level.theme;
      return G.Levels.act(this.mapAct).theme;
    },

    // ---------- scenes ----------
    openTitle() {
      this.scene = 'title'; this.state = 'idle';
      G.UI.close();
      G.UI.show('scr-title');
      A().music('title');
    },
    openMap(actIdx) {
      const maxAct = G.Levels.actOf(G.Save.data.unlocked);
      this.mapAct = G.clamp(actIdx, 0, maxAct);
      this.scene = 'map'; this.state = 'idle';
      G.UI.close();
      G.UI.show('scr-map');
      G.UI.buildMap(this.mapAct, n => this.startLevel(n));
      A().music(G.Levels.act(this.mapAct).theme);
    },
    startLevel(n) {
      const S = G.Save.data;
      if (n > S.unlocked) return;
      const level = G.Levels.get(n);
      const actIdx = G.Levels.actOf(n);
      if ((n - 1) % 15 === 0 && !S.seenIntro[actIdx]) {
        const act = level.act;
        G.UI.modal({
          title: act.roman.indexOf('Abyss') === 0 ? act.name : 'Act ' + act.roman, sub: act.idx < 5 ? act.name : '', body: act.story, story: true,
          buttons: [{ label: 'Onward', fn: () => { S.seenIntro[actIdx] = true; G.Save.save(); this.startLevel(n); } }]
        });
        return;
      }
      this.level = level;
      this.board = new G.Board(level);
      this.buys = 0;
      this.scene = 'level'; this.state = 'intro';
      G.UI.show('hud');
      G.UI.setupHud(level, this.board);
      this.view.setBoard(this.board, level.theme);
      this.layoutBoard();
      A().music(level.theme);
      S.stats.played++;
      G.Save.save();
      G.UI.modal({
        title: level.boss ? level.name : 'Level ' + n, sub: level.boss ? 'Level ' + n : level.name,
        goals: this.board.goals, html: '<b>' + level.moves + '</b> moves', tip: level.tip || '',
        buttons: [{ label: 'Fight', cls: 'big', fn: () => { this.state = 'play'; this.idle = 0; } }, { label: 'Back', cls: 'dark', fn: () => this.openMap(actIdx) }]
      });
    },

    // ---------- turns ----------
    act(ev) {
      if (!ev) return;
      this.idle = 0;
      this.view.showHint(null);
      this.view.sel = null; this.selected = null;
      G.UI.setMoves(this.board.moves);
      this.state = 'anim';
      this.view.play(ev, () => this.afterTurn());
    },
    afterTurn() {
      if (this.board.isWon()) return this.win();
      if (this.board.moves <= 0) return this.outOfMoves();
      this.state = 'play';
    },
    win() {
      this.state = 'end';
      const left = this.board.moves;
      const gold = 20 + left * 5 + (this.level.boss ? 50 : 0);
      this.view.text('Victory', this.W / 2, this.view.by + this.view.R * this.view.cs * .4, 1.3);
      snd('win');
      setTimeout(() => {
        if (left > 0) this.view.text('Huntress\'s Fury!', this.W / 2, this.view.by + this.view.R * this.view.cs * .55, .9);
        G.UI.setMoves(0, true);
        this.view.play(this.board.bonus(12), () => {
          const S = G.Save.data;
          const n = this.level.n;
          if (n >= S.unlocked) S.unlocked = n + 1;
          S.gold += gold;
          S.stats.wins++;
          G.Save.save();
          snd('coin');
          G.UI.modal({
            title: 'Victory', sub: WIN_LINES[n % WIN_LINES.length],
            html: '+' + gold + ' gold' + (left ? '<br><span style="color:#9c8c74;font-size:15px">' + left + ' moves unused</span>' : ''),
            buttons: [
              { label: 'Next Level', cls: 'big', fn: () => this.startLevel(n + 1) },
              { label: 'Map', cls: 'dark', fn: () => this.openMap(G.Levels.actOf(n + 1)) }
            ]
          });
        });
      }, 900);
    },
    outOfMoves() {
      this.state = 'end';
      const S = G.Save.data;
      const price = 200 * (this.buys + 1);
      G.UI.modal({
        title: 'Out of Moves', red: true, sub: 'Still standing in your way:', goals: this.board.goals.filter(g => g.have < g.need), goalsLeft: true,
        buttons: [
          { label: '+' + EXTRA_MOVES + ' Moves · ' + price + ' gold', disabled: S.gold < price, fn: () => {
            S.gold -= price; this.buys++; G.Save.save();
            this.board.moves += EXTRA_MOVES; G.UI.setMoves(this.board.moves, true);
            snd('coin');
            this.state = 'play';
          } },
          { label: 'Give Up', cls: 'dark', fn: () => this.lose() }
        ]
      });
      if (S.gold < price) {
        const p = document.querySelector('#panel .btns');
        const note = document.createElement('div');
        note.style.cssText = 'font-size:14px;color:#9c8c74';
        note.textContent = 'You have ' + S.gold + ' gold.';
        p.insertBefore(note, p.firstChild.nextSibling);
      }
    },
    lose() {
      const S = G.Save.data;
      S.stats.losses++; G.Save.save();
      snd('lose');
      const n = this.level.n;
      G.UI.modal({
        title: 'You Have Fallen', red: true, sub: LOSE_LINES[S.stats.losses % LOSE_LINES.length],
        buttons: [{ label: 'Try Again', cls: 'big', fn: () => this.startLevel(n) }, { label: 'Map', cls: 'dark', fn: () => this.openMap(G.Levels.actOf(n)) }]
      });
    },
    pause() {
      if (this.scene !== 'level' || this.state === 'end') return;
      const prev = this.state;
      this.state = 'paused';
      const S = G.Save.data;
      G.UI.modal({
        title: 'Paused', sub: 'Level ' + this.level.n + ' · ' + this.level.name,
        toggles: [
          { label: 'Sound', get: () => S.sound, set: v => { S.sound = v; G.Save.save(); A().setSound(v); } },
          { label: 'Music', get: () => S.music, set: v => { S.music = v; G.Save.save(); A().setMusic(v); } }
        ],
        buttons: [
          { label: 'Resume', cls: 'big', fn: () => { this.state = prev === 'intro' ? 'play' : prev; } },
          { label: 'Restart', cls: 'dark', fn: () => this.startLevel(this.level.n) },
          { label: 'Retreat to Map', cls: 'dark', fn: () => this.openMap(G.Levels.actOf(this.level.n)) }
        ]
      });
    },

    // ---------- input ----------
    bindInput() {
      const cv = this.cv;
      document.addEventListener('pointerdown', () => A().unlock(), true);
      document.addEventListener('touchstart', () => A().unlock(), { capture: true, passive: true });
      cv.addEventListener('pointerdown', e => {
        if (this.scene !== 'level' || this.state !== 'play' || this.view.busy()) return;
        const cell = this.view.cellAt(e.clientX, e.clientY);
        if (!cell) { this.selected = null; this.view.sel = null; return; }
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
        this.drag = { cell, x: e.clientX, y: e.clientY, moved: false };
        this.view.sel = cell;
        this.idle = 0; this.view.showHint(null);
      });
      cv.addEventListener('pointermove', e => {
        const d = this.drag;
        if (!d || d.moved) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < this.view.cs * .3) return;
        d.moved = true;
        const to = Math.abs(dx) > Math.abs(dy) ? { r: d.cell.r, c: d.cell.c + Math.sign(dx) } : { r: d.cell.r + Math.sign(dy), c: d.cell.c };
        this.view.sel = null; this.selected = null;
        this.act(this.board.trySwap(d.cell, to));
      });
      const up = () => {
        const d = this.drag;
        this.drag = null;
        if (!d || d.moved) return;
        if (this.state !== 'play' || this.view.busy()) return;
        const x = this.board.cell(d.cell.r, d.cell.c);
        const s = this.selected;
        if (s && Math.abs(s.r - d.cell.r) + Math.abs(s.c - d.cell.c) === 1) { this.view.sel = null; this.selected = null; return this.act(this.board.trySwap(s, d.cell)); }
        if (x && x.t && G.isPow(x.t.kind) && !x.t.chained && s && s.r === d.cell.r && s.c === d.cell.c) { return this.act(this.board.tap(d.cell.r, d.cell.c)); }
        if (x && x.t && G.isPow(x.t.kind) && !x.t.chained && !s) { return this.act(this.board.tap(d.cell.r, d.cell.c)); }
        this.selected = d.cell; this.view.sel = d.cell;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { this.drag = null; });
    },

    // ---------- frame ----------
    frame(dt) {
      const g = this.ctx, W = this.W, H = this.H;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const theme = this.theme();
      const key = theme + W + 'x' + H + '@' + (G.Art ? G.Art.version : 0);
      if (!this.bg || this.bgKey !== key) {
        this.bgKey = key;
        try { this.bg = theme === 'title' ? G.Art.title(W, H, this.dpr) : G.Art.background(theme, W, H, this.dpr); } catch (e) { this.bg = null; }
      }
      if (this.bg) g.drawImage(this.bg, 0, 0, W, H); else { g.fillStyle = '#0b0706'; g.fillRect(0, 0, W, H); }
      // In a level the board covers the middle of the screen, where each act's landmark sits.
      // Draw a shorter copy of the scene on top so its horizon lands in the gap above the board;
      // the seam between the two copies stays hidden behind the board. [S05]
      if (this.scene === 'level' && theme !== 'title' && this.view.cs) {
        const hs = Math.round(Math.min(H, this.view.by + this.view.R * this.view.cs * 0.2));
        const tkey = key + '/' + hs;
        if (this.bgTopKey !== tkey) {
          this.bgTopKey = tkey;
          try { this.bgTop = G.Art.background(theme, W, hs, this.dpr); } catch (e) { this.bgTop = null; }
        }
        if (this.bgTop) g.drawImage(this.bgTop, 0, 0, W, hs);
      }
      if (this.ambientKey !== theme && G.Art && G.Art.Ambient) { this.ambientKey = theme; this.ambient = new G.Art.Ambient(theme); }
      if (this.ambient) { this.ambient.update(dt, W, H); this.ambient.draw(g); }
      if (this.scene === 'level') {
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
        this.view.update(dt);
        this.view.draw(g);
        if (this.state === 'play' && !this.view.busy()) {
          this.idle += dt;
          if (this.idle > 6 && !this.view.hint) this.view.showHint(this.pickHint());
        }
      }
    },
    pickHint() {
      const mv = this.board.listMoves(true);
      if (!mv.length) return null;
      return mv.find(m => m.pow || m.tap) || mv[Math.floor(Math.random() * mv.length)];
    }
  };

  G.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init());
})(window.G);
