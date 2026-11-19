/* Runes of Ruin - game flow, input, main loop. */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const A = () => G.Audio || { play() {}, unlock() {}, music() {}, setSound() {}, setMusic() {}, suspend() {}, resume() {} };
  const snd = (n, o) => A().play(n, o);
  const WIN_LINES = ['The dead rest again.', 'Another hall purged.', 'The darkness recoils.', 'Your javelins found their mark.', 'Silence returns to the stones.'];
  const LOSE_LINES = ['The darkness endures.', 'The dead outnumber you.', 'Your strength fails.'];
  const EXTRA_MOVES = 5;
  const BOMB_PRICE = 150, HAMMER_PRICE = 100; // S3 helpers, kept small on purpose [S06]

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
      this.view.hooks = {
        // blows on a boss fly into the boss, not to the top bar [S07]
        goalPos: gi => this.bossFx && gi === this.board.boss.gi ? this.bossCenter() : G.UI.goalPos(gi),
        collected: gi => { G.UI.goalTick(gi); if (this.bossFx && gi === this.board.boss.gi) this.bossFx.hurt = 1; },
        boss: e => this.bossEvent(e)
      };
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
      $('btnPause').onclick = () => { snd('click'); this.hammerOff(); this.pause(); };
      $('btnHammer').onclick = () => this.hammerClick();
      $('btnTitleCloister').onclick = () => { snd('click'); this.openCloister(() => this.openTitle()); };
      $('mapStones').onclick = () => { snd('click'); const a = this.mapAct; this.openCloister(() => this.openMap(a)); };
      // Daily trial and quest board (S4) [S08]
      $('btnDaily').onclick = () => { snd('click'); this.startDaily(); };
      $('btnQuests').onclick = () => { snd('click'); G.Daily.openBoard(() => this.openTitle()); };
      $('btnSkipDay').onclick = () => { snd('click'); G.Daily.skipDay(); this.skipLabel(); };
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
      if (this.scene === 'cloister') G.Cloister.sizeArt();
    },
    layoutBoard() {
      let top = G.UI.hudBottom() + 10;
      // boss levels: a strip above the board for the boss, its health bar and countdown [S07]
      this.bossBox = null;
      if (this.bossFx) {
        const h = Math.round(G.clamp(this.H * .14, 78, 130));
        this.bossBox = { x: 0, y: top, w: this.W, h };
        top += h + 6;
      }
      const probe = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
      this.view.layout(this.W, this.H, top, 18 + probe + 56, this.dpr); // +56: room for the hammer button [S06]
    },
    bossCenter() {
      const b = this.bossBox;
      return b ? { x: b.x + b.w / 2, y: b.y + b.h * .45 } : null;
    },
    // the board told us the boss attacked, or its countdown changed [S07]
    bossEvent(e) {
      const F = this.bossFx;
      if (!F) return;
      if (e.type === 'bossTick') { F.timer = e.timer; F.angry = e.angry; return; }
      F.atk = 1;
      snd('roar');
      this.view.text(G.Boss.SHOUT[e.kind] || 'Beware!', this.W / 2, this.view.by + this.view.R * this.view.cs * .35, .9);
    },
    theme() {
      if (this.scene === 'title' || this.scene === 'cloister') return 'title';
      if (this.scene === 'level' && this.level) return this.level.theme;
      return G.Levels.act(this.mapAct).theme;
    },

    // ---------- scenes ----------
    openTitle() {
      this.scene = 'title'; this.state = 'idle';
      G.Cloister.close();
      G.UI.close();
      G.UI.show('scr-title');
      $('btnTitleCloister').classList.toggle('badge', G.Cloister.anyAffordable());
      $('btnDaily').classList.toggle('badge', !G.Daily.wonToday());
      $('btnQuests').classList.toggle('badge', G.Daily.anyToCollect());
      A().music('title');
    },
    skipLabel() {
      const s = G.Daily.shift();
      $('btnSkipDay').textContent = 'Test: skip a day' + (s ? ' (+' + s + ')' : '');
    },
    openMap(actIdx) {
      const maxAct = G.Levels.actOf(G.Save.data.unlocked);
      this.mapAct = G.clamp(actIdx, 0, maxAct);
      this.scene = 'map'; this.state = 'idle';
      G.Cloister.close();
      G.UI.close();
      G.UI.show('scr-map');
      G.UI.buildMap(this.mapAct, n => this.startLevel(n));
      $('mapStones').textContent = G.Cloister.stones();
      $('mapStones').classList.toggle('badge', G.Cloister.anyAffordable());
      A().music(G.Levels.act(this.mapAct).theme);
    },
    // The Cloister screen [S06]; back = where its back button returns to
    openCloister(back) {
      this.scene = 'cloister'; this.state = 'idle';
      G.UI.close();
      G.UI.show('scr-cloister');
      G.Cloister.open(back);
      this.skipLabel();
      A().music('title');
    },
    startLevel(n) {
      const S = G.Save.data;
      if (n > S.unlocked) return;
      const level = G.Levels.get(n);
      const actIdx = G.Levels.actOf(n);
      if ((n - 1) % 15 === 0 && !S.seenIntro[actIdx]) {
        const act = level.act;
        // coming straight from a won level: show the new act's map behind the story card, not the old board [S09]
        if (this.scene === 'level') this.openMap(actIdx);
        G.UI.modal({
          title: act.roman.indexOf('Abyss') === 0 ? act.name : 'Act ' + act.roman, sub: act.idx < 5 ? act.name : '', body: act.story, story: true,
          buttons: [{ label: 'Onward', fn: () => { S.seenIntro[actIdx] = true; G.Save.save(); this.startLevel(n); } }]
        });
        return;
      }
      this.enter(level, n, actIdx);
    },
    // Today's daily trial (S4) [S08]: the bot works out its moves once a day, so show a short note first
    startDaily() {
      G.UI.modal({ title: 'Daily Trial', sub: 'The stones are being cast…', buttons: [] });
      setTimeout(() => {
        const level = G.Daily.level();
        this.enter(level, level.n, level.act.idx);
      }, 60);
    },
    enter(level, n, actIdx) {
      const S = G.Save.data;
      this.level = level;
      this.board = new G.Board(level);
      this.buys = 0;
      // Cloister perks: the Gate adds moves, the Forge puts power-ups on the board [S06]
      const CL = G.Cloister;
      const extra = CL.extraMoves();
      this.board.moves += extra;
      const armed = CL.arm(this.board);
      const perkNotes = [];
      if (level.startPows) CL.arm(this.board, level.startPows); // the daily Ambush's free fire bomb [S08]
      if (extra) perkNotes.push('+' + extra + ' from the Gate');
      if (armed) perkNotes.push(armed + ' from the Forge');
      const anyBuilt = CL.AREAS.some(a => CL.stage(a.id) > 0);
      G.Cloister.close();
      const B = this.board.boss;
      this.bossFx = B ? { id: B.id, short: B.short, weak: B.weak, max: this.board.goals[B.gi].need, timer: B.timer, angry: false, hurt: 0, atk: 0, t: 0 } : null; // [S07]
      this.scene = 'level'; this.state = 'intro';
      G.UI.show('hud');
      G.UI.setupHud(level, this.board);
      this.view.setBoard(this.board, level.theme);
      this.layoutBoard();
      A().music(level.theme);
      S.stats.played++;
      G.Save.save();
      this.hammerOff();
      this.intro = { n, actIdx, perkNotes, anyBuilt, bomb: false };
      this.showIntro();
    },
    // Level start panel; offers one fire bomb for gold (S3 helpers) [S06]
    showIntro() {
      const o = this.intro, level = this.level, S = G.Save.data, CL = G.Cloister;
      const buttons = [{ label: 'Fight', cls: 'big', fn: () => { this.state = 'play'; this.idle = 0; } }];
      if (!o.bomb) buttons.push({
        label: 'Start with a fire bomb · ' + BOMB_PRICE + ' gold', cls: 'dark helper', disabled: S.gold < BOMB_PRICE,
        fn: () => {
          if (S.gold < BOMB_PRICE || !CL.arm(this.board, ['bomb'])) return this.showIntro();
          S.gold -= BOMB_PRICE; G.Save.save();
          o.bomb = true; o.perkNotes.push('fire bomb bought');
          this.view.setBoard(this.board, level.theme);
          this.layoutBoard();
          snd('coin');
          this.showIntro();
        }
      });
      buttons.push({ label: 'Back', cls: 'dark', fn: () => level.daily ? this.openTitle() : this.openMap(o.actIdx) });
      const D = G.Daily, streak = D.streak();
      const dailyNote = !level.daily ? '' : D.wonToday()
        ? '<br><span class="perk-note">Today\'s reward is claimed; replays pay nothing</span>'
        : '<br><span class="perk-note">First win today: ' + 150 + ' gold and 1 rune stone' + (streak ? ' · streak ' + streak + ' day' + (streak > 1 ? 's' : '') : '') + '</span>';
      G.UI.modal({
        title: level.daily ? 'Daily Trial' : level.bossInfo ? level.bossInfo.name : level.boss ? level.name : 'Level ' + o.n,
        sub: level.daily ? level.name : level.bossInfo ? 'Level ' + o.n + ' · ' + level.name : level.boss ? 'Level ' + o.n : level.name,
        goals: this.board.goals, tip: level.tip || '',
        html: '<b>' + this.board.moves + '</b> moves' + dailyNote +
          (o.perkNotes.length ? '<br><span class="perk-note">' + o.perkNotes.join(' · ') + '</span>' : '') +
          (o.anyBuilt && !CL.perksOn() ? '<br><span class="perk-note off">Cloister perks are off</span>' : '') +
          (o.bomb ? '' : '<br><span class="gold-note">You have ' + S.gold + ' gold</span>'),
        buttons
      });
    },

    // ---------- the hammer: smash one tile for gold, costs no move (S3 helpers) [S06] ----------
    hammerOff() {
      this.hammerOn = false;
      const b = $('btnHammer');
      b.classList.remove('armed');
      b.innerHTML = 'Hammer · ' + HAMMER_PRICE + ' <span class="coin"></span>';
      b.classList.toggle('poor', G.Save.data.gold < HAMMER_PRICE);
    },
    hammerClick() {
      if (this.scene !== 'level' || this.state !== 'play' || this.view.busy()) return;
      if (this.hammerOn) { snd('click'); return this.hammerOff(); }
      if (G.Save.data.gold < HAMMER_PRICE) {
        snd('bad');
        this.view.text('Not enough gold', this.W / 2, this.view.by + this.view.R * this.view.cs * .5, .7);
        return;
      }
      snd('click');
      this.hammerOn = true;
      this.view.sel = null; this.selected = null;
      const b = $('btnHammer');
      b.classList.add('armed');
      b.textContent = 'Tap a tile to smash';
    },
    useHammer(cell) {
      const S = G.Save.data;
      const ev = S.gold >= HAMMER_PRICE ? this.board.smash(cell.r, cell.c) : null;
      this.hammerOff();
      if (!ev) return;
      S.gold -= HAMMER_PRICE; G.Save.save();
      this.hammerOff();
      snd('crack');
      this.act(ev);
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
      const gold = Math.round((20 + left * 5 + (this.level.boss ? 50 : 0)) * G.Cloister.goldMult());
      const firstWin = this.level.n >= G.Save.data.unlocked;
      const stones = firstWin ? G.Cloister.stonesFor(this.level) : 0;
      this.view.text('Victory', this.W / 2, this.view.by + this.view.R * this.view.cs * .4, 1.3);
      snd('win');
      setTimeout(() => {
        if (left > 0) this.view.text('Huntress\'s Fury!', this.W / 2, this.view.by + this.view.R * this.view.cs * .55, .9);
        G.UI.setMoves(0, true);
        this.view.play(this.board.bonus(12), () => {
          const S = G.Save.data;
          const n = this.level.n;
          const quests = this.questNote(true);
          if (this.level.daily) return this.winDaily(quests);
          if (n >= S.unlocked) S.unlocked = n + 1;
          S.gold += gold;
          S.stats.wins++;
          G.Save.save();
          snd('coin');
          G.UI.modal({
            title: 'Victory', sub: WIN_LINES[n % WIN_LINES.length],
            html: '+' + gold + ' gold' +
              (stones ? '<br><span class="stones">+' + stones + ' rune stone' + (stones > 1 ? 's' : '') + '</span>' : '') +
              (left ? '<br><span style="color:#9c8c74;font-size:15px">' + left + ' moves unused</span>' : '') + quests,
            buttons: [
              { label: 'Next Level', cls: 'big', fn: () => this.startLevel(n + 1) },
              G.Cloister.anyAffordable()
                ? { label: 'The Cloister', cls: 'badge', fn: () => this.openCloister(() => this.openMap(G.Levels.actOf(n + 1))) }
                : null,
              { label: 'Map', cls: 'dark', fn: () => this.openMap(G.Levels.actOf(n + 1)) }
            ].filter(Boolean)
          });
        });
      }, 900);
    },
    // Add what this level did to the quest board; returns a line for the end panel [S08]
    questNote(won) {
      if (!this.board || !this.board.tally) return '';
      const fin = G.Daily.record(this.board.tally, won, !!(this.level && this.level.daily));
      this.board.tally = null; // counted once
      return fin.length ? '<br><span class="quest-done">Quest done: ' + fin.map(x => G.Daily.text(x)).join(', ') + '</span>' : '';
    },
    winDaily(quests) {
      const S = G.Save.data;
      S.stats.wins++; G.Save.save();
      const r = G.Daily.reward();
      snd('coin');
      const html = r
        ? '+' + r.gold + ' gold<br><span class="stones">+' + r.stones + ' rune stone</span>' +
          '<br><span class="perk-note">Streak: ' + r.streak + ' day' + (r.streak > 1 ? 's' : '') + (r.bonus ? ' · bonus +' + r.bonus + ' gold' : '') + '</span>'
        : '<span class="gold-note">Today\'s reward was already claimed. A new trial comes tomorrow.</span>';
      G.UI.modal({
        title: 'Trial Won', sub: WIN_LINES[S.stats.wins % WIN_LINES.length], html: html + quests,
        buttons: [
          { label: 'Onward', cls: 'big', fn: () => this.openTitle() },
          G.Daily.anyToCollect() ? { label: 'Quest Board', cls: 'badge', fn: () => G.Daily.openBoard(() => this.openTitle()) } : null,
          G.Cloister.anyAffordable() ? { label: 'The Cloister', cls: 'badge', fn: () => this.openCloister(() => this.openTitle()) } : null
        ].filter(Boolean)
      });
    },
    outOfMoves() {
      this.state = 'end';
      const S = G.Save.data;
      const price = G.Cloister.movePrice(200 * (this.buys + 1), this.buys); // the Chapel lowers it [S06]
      G.UI.modal({
        title: 'Out of Moves', red: true, sub: 'Still standing in your way:', goals: this.board.goals.filter(g => g.have < g.need), goalsLeft: true,
        buttons: [
          { label: '+' + EXTRA_MOVES + ' Moves · ' + (price ? price + ' gold' : 'Free'), disabled: S.gold < price, fn: () => {
            S.gold -= price; this.buys++; G.Save.save();
            this.board.moves += EXTRA_MOVES; G.UI.setMoves(this.board.moves, true);
            this.hammerOff();
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
      const n = this.level.n, daily = this.level.daily;
      const quests = this.questNote(false);
      G.UI.modal({
        title: 'You Have Fallen', red: true, sub: LOSE_LINES[S.stats.losses % LOSE_LINES.length], html: quests ? quests.slice(4) : '',
        buttons: [{ label: 'Try Again', cls: 'big', fn: () => daily ? this.startDaily() : this.startLevel(n) },
          daily ? { label: 'Title', cls: 'dark', fn: () => this.openTitle() } : { label: 'Map', cls: 'dark', fn: () => this.openMap(G.Levels.actOf(n)) }]
      });
    },
    pause() {
      if (this.scene !== 'level' || this.state === 'end') return;
      const prev = this.state;
      this.state = 'paused';
      const S = G.Save.data;
      G.UI.modal({
        title: 'Paused', sub: (this.level.daily ? 'Daily Trial' : 'Level ' + this.level.n) + ' · ' + this.level.name,
        toggles: [
          { label: 'Sound', get: () => S.sound, set: v => { S.sound = v; G.Save.save(); A().setSound(v); } },
          { label: 'Music', get: () => S.music, set: v => { S.music = v; G.Save.save(); A().setMusic(v); } }
        ],
        buttons: [
          { label: 'Resume', cls: 'big', fn: () => { this.state = prev === 'intro' ? 'play' : prev; } },
          // progress so far still counts for quests when leaving early [S08]
          { label: 'Restart', cls: 'dark', fn: () => { this.questNote(false); this.level.daily ? this.startDaily() : this.startLevel(this.level.n); } },
          { label: this.level.daily ? 'Retreat' : 'Retreat to Map', cls: 'dark', fn: () => { this.questNote(false); this.level.daily ? this.openTitle() : this.openMap(G.Levels.actOf(this.level.n)); } }
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
        if (this.hammerOn) { if (cell) this.useHammer(cell); else { snd('click'); this.hammerOff(); } return; }
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
      // Once the Shrine stands, the title screen shows the restored cloister, faded at its edges [S06]
      if (this.scene === 'title' && G.Cloister.shrineDone()) {
        const cw = Math.min(W, 520), ch = Math.round(Math.min(cw * .62, H * .3));
        const d = this.dpr;
        if (!this.titleCl || this.titleCl.width !== Math.round(cw * d) || this.titleCl.height !== Math.round(ch * d)) {
          this.titleCl = document.createElement('canvas');
          this.titleCl.width = Math.round(cw * d); this.titleCl.height = Math.round(ch * d);
        }
        const o = this.titleCl.getContext('2d');
        o.setTransform(d, 0, 0, d, 0, 0);
        o.globalCompositeOperation = 'source-over';
        o.clearRect(0, 0, cw, ch);
        this.titleT = (this.titleT || 0) + dt;
        G.Cloister.drawScene(o, 0, 0, cw, ch, this.titleT, dt, true);
        o.globalCompositeOperation = 'destination-in';
        const m = o.createRadialGradient(cw / 2, ch * .6, ch * .25, cw / 2, ch * .6, cw * .55);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = m; o.fillRect(0, 0, cw, ch);
        o.globalCompositeOperation = 'source-over';
        g.drawImage(this.titleCl, (W - cw) / 2, H * .36, cw, ch);
      }
      if (this.scene === 'level') {
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
        this.view.update(dt);
        this.view.draw(g);
        const F = this.bossFx; // the boss above the board [S07]
        if (F && this.bossBox) {
          F.t += dt; F.hurt = Math.max(0, F.hurt - dt * 4); F.atk = Math.max(0, F.atk - dt * 1.6);
          const gi = this.board.boss.gi, left = G.UI.shownLeft[gi];
          const b = this.bossBox;
          G.Boss.drawStrip(g, b.x, b.y, b.w, b.h, Object.assign({}, F, { hp: left === undefined ? F.max : left }));
        }
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
