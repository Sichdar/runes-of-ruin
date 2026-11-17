/* Runes of Ruin - screens, HUD and pop-up panels (DOM). */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const snd = (n, o) => { if (G.Audio && G.Audio.play) G.Audio.play(n, o); };

  function goalKey(g) {
    return g.type === 'color' ? 'tile' + g.color : g.type === 'bone' ? 'bone1' : g.type === 'ground' ? 'ground1' : g.type === 'chain' ? 'chain' : 'relic';
  }
  function goalName(g) { return g.type === 'color' ? G.COLOR_NAMES[g.color] : G.GOAL_NAMES[g.type]; }
  function icon(key, css) {
    const c = document.createElement('canvas');
    const d = Math.min(3, window.devicePixelRatio || 1);
    c.width = c.height = Math.round(css * d);
    try { c.getContext('2d').drawImage(G.Art.get(key, c.width), 0, 0); } catch (e) { /* art not ready */ }
    return c;
  }

  const UI = {
    shown: null,
    goalEls: [],
    shownLeft: [],

    show(name) {
      for (const id of ['scr-title', 'scr-map', 'hud']) $(id).classList.toggle('hidden', id !== name);
      this.shown = name;
    },

    // ---------- HUD ----------
    setupHud(level, board) {
      $('hudLevel').textContent = (level.act.roman.indexOf('Abyss') === 0 ? level.act.roman : 'Act ' + level.act.roman) + ' · ' + level.n + ' · ' + level.name;
      // Shrink the label until the whole name fits on narrow phones [S05]
      const hl = $('hudLevel'); hl.style.fontSize = '';
      for (let fs = 11; fs > 8 && hl.scrollWidth > hl.clientWidth; fs -= 0.5) hl.style.fontSize = fs - 0.5 + 'px';
      const box = $('goals');
      box.innerHTML = '';
      this.goalEls = []; this.shownLeft = [];
      board.goals.forEach(g => {
        const el = document.createElement('div');
        el.className = 'goal';
        el.appendChild(icon(goalKey(g), 40));
        const n = document.createElement('div');
        n.className = 'n';
        n.textContent = g.need;
        el.appendChild(n);
        box.appendChild(el);
        this.goalEls.push(el);
        this.shownLeft.push(g.need);
      });
      this.setMoves(board.moves, true);
    },
    setMoves(n, quiet) {
      $('moves').textContent = n;
      const low = n <= 5;
      const box = $('movesBox');
      if (low && !box.classList.contains('low') && !quiet && n > 0) snd('lowmoves');
      box.classList.toggle('low', low);
    },
    goalPos(gi) {
      const el = this.goalEls[gi];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    goalTick(gi) {
      const el = this.goalEls[gi];
      if (!el) return;
      this.shownLeft[gi] = Math.max(0, this.shownLeft[gi] - 1);
      const n = el.querySelector('.n');
      if (this.shownLeft[gi] === 0) { n.textContent = '✓'; el.classList.add('done'); }
      else n.textContent = this.shownLeft[gi];
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    },
    hudBottom() {
      const r = $('hud').getBoundingClientRect();
      return r.bottom;
    },

    // ---------- pop-up panels ----------
    modal(o) {
      const p = $('panel');
      p.innerHTML = '';
      const add = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; p.appendChild(e); return e; };
      if (o.title) add('h2', o.red ? 'red' : '', o.title);
      if (o.sub) add('div', 'sub', o.sub);
      if (o.goals) {
        const row = add('div', 'row-goals');
        o.goals.forEach(g => {
          const d = document.createElement('div');
          d.className = 'g';
          d.appendChild(icon(goalKey(g), 50));
          const b = document.createElement('b');
          b.textContent = o.goalsLeft ? Math.max(0, g.need - g.have) : g.need;
          d.appendChild(b);
          d.appendChild(document.createTextNode(goalName(g)));
          row.appendChild(d);
        });
      }
      if (o.body) add('div', 'body' + (o.story ? ' story' : ''), '').textContent = o.body;
      if (o.html) add('div', 'body', o.html);
      if (o.tip) add('div', 'tip', '').textContent = o.tip;
      if (o.toggles) {
        const t = add('div', 'toggles');
        o.toggles.forEach(tg => {
          const b = document.createElement('button');
          b.className = 'btn dark';
          const label = () => { b.textContent = tg.label + ': ' + (tg.get() ? 'On' : 'Off'); };
          label();
          b.onclick = () => { tg.set(!tg.get()); label(); snd('click'); };
          t.appendChild(b);
        });
      }
      const btns = add('div', 'btns');
      (o.buttons || []).forEach(bt => {
        const b = document.createElement('button');
        b.className = 'btn' + (bt.cls ? ' ' + bt.cls : '');
        b.innerHTML = bt.label;
        if (bt.disabled) b.disabled = true;
        b.onclick = () => { snd('click'); if (!bt.keep) this.close(); bt.fn && bt.fn(); };
        btns.appendChild(b);
      });
      $('modal').classList.remove('hidden');
    },
    close() { $('modal').classList.add('hidden'); },
    modalOpen() { return !$('modal').classList.contains('hidden'); },

    // ---------- map ----------
    buildMap(actIdx, onPick) {
      const S = G.Save.data;
      const act = G.Levels.act(actIdx);
      $('mapAct').textContent = act.roman.indexOf('Abyss') === 0 ? act.roman.toUpperCase() : 'ACT ' + act.roman;
      $('mapName').textContent = act.name;
      $('mapGold').textContent = S.gold;
      const path = $('mapPath');
      path.innerHTML = '';
      const W = Math.min(480, window.innerWidth);
      const step = 92, n = 15, H = n * step + 120;
      path.style.height = H + 'px';
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = W / 2 + Math.sin(i * 1.15 + actIdx) * W * .27;
        const y = H - 70 - i * step;
        pts.push([x, y]);
      }
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      let d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (let i = 1; i < n; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        d += ' C' + x0 + ' ' + (y0 - step / 2) + ' ' + x1 + ' ' + (y1 + step / 2) + ' ' + x1 + ' ' + y1;
      }
      for (const [w, col, dash] of [[9, 'rgba(0,0,0,.6)', ''], [4, '#7a1a10', '2 10']]) {
        const pe = document.createElementNS(svgNS, 'path');
        pe.setAttribute('d', d); pe.setAttribute('fill', 'none'); pe.setAttribute('stroke', col);
        pe.setAttribute('stroke-width', w); pe.setAttribute('stroke-linecap', 'round');
        if (dash) pe.setAttribute('stroke-dasharray', dash);
        svg.appendChild(pe);
      }
      path.appendChild(svg);
      let currentEl = null;
      for (let i = 0; i < n; i++) {
        const lv = act.first + i;
        const b = document.createElement('button');
        b.className = 'node' + (i === 14 ? ' boss' : '');
        if (lv < S.unlocked) b.classList.add('done');
        else if (lv === S.unlocked) { b.classList.add('current'); currentEl = b; }
        else b.classList.add('locked');
        b.textContent = i === 14 ? '☠' : lv;
        b.style.left = pts[i][0] + 'px';
        b.style.top = pts[i][1] + 'px';
        b.onclick = () => { snd('click'); onPick(lv); };
        path.appendChild(b);
      }
      const sc = $('mapScroll');
      requestAnimationFrame(() => {
        if (currentEl) sc.scrollTop = parseFloat(currentEl.style.top) - sc.clientHeight / 2;
        else sc.scrollTop = S.unlocked > act.first + 14 ? 0 : sc.scrollHeight;
      });
      const maxAct = G.Levels.actOf(S.unlocked);
      $('btnActPrev').disabled = actIdx <= 0;
      $('btnActNext').disabled = actIdx >= maxAct;
    }
  };
  G.UI = UI;
})(window.G);
