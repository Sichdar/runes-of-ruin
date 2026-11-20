/* Runes of Ruin - the rescue picture above the board (S7) [S12].
   Kaela stands chained on a pillar while blood rises in the pit around her. The blood follows the moves
   used; her chains follow the level's chain goal. On a win the chains fall and the blood drains;
   on a loss the blood closes over her. Drawn in code, in the same strip the bosses use. */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;

  // st: { t, danger 0..1, chains left, max, free 0..1, lost 0..1, moves }
  function drawStrip(g, x0, y0, w, h, st) {
    const cx = x0 + w / 2, bot = y0 + h;
    g.save();
    g.beginPath(); g.rect(x0, y0 - h * .1, w, h * 1.1); g.clip();
    // dark pit with a red glow from below
    const pit = g.createLinearGradient(0, y0, 0, bot);
    pit.addColorStop(0, 'rgba(0,0,0,0)'); pit.addColorStop(.5, 'rgba(20,4,4,.6)'); pit.addColorStop(1, 'rgba(40,6,4,.85)');
    g.fillStyle = pit; g.fillRect(x0, y0, w, h);
    // pit walls either side
    g.fillStyle = '#140c0a';
    g.beginPath(); g.moveTo(x0, y0 + h * .15); g.lineTo(x0 + w * .16, y0 + h * .3); g.lineTo(x0 + w * .2, bot); g.lineTo(x0, bot); g.fill();
    g.beginPath(); g.moveTo(x0 + w, y0 + h * .15); g.lineTo(x0 + w * .84, y0 + h * .3); g.lineTo(x0 + w * .8, bot); g.lineTo(x0 + w, bot); g.fill();
    // the pillar
    const pw = Math.min(w * .12, h * .5), ptop = y0 + h * .58;
    // a pale moon behind her, so her shape reads against it
    const mR = h * .42, my = y0 + h * .3;
    const mg = g.createRadialGradient(cx, my, mR * .2, cx, my, mR * 1.5);
    mg.addColorStop(0, 'rgba(255,190,150,.55)'); mg.addColorStop(.55, 'rgba(200,60,40,.25)'); mg.addColorStop(1, 'rgba(120,10,10,0)');
    g.fillStyle = mg; g.fillRect(cx - mR * 1.6, y0 - h * .1, mR * 3.2, h * 1.1);
    g.fillStyle = 'rgba(240,170,130,.35)'; g.beginPath(); g.arc(cx, my, mR * .62, 0, TAU); g.fill();
    const pg = g.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    pg.addColorStop(0, '#2a2420'); pg.addColorStop(.6, '#5a4c40'); pg.addColorStop(1, '#3a302a');
    g.fillStyle = pg; g.fillRect(cx - pw / 2, ptop, pw, bot - ptop);
    g.fillStyle = '#6a5a4a'; g.fillRect(cx - pw * .62, ptop - 3, pw * 1.24, 5);
    // Kaela, small, feet on the pillar; she lifts her spear once free
    const s = (ptop - y0) / 112, fy = ptop - 2;
    const sway = st.free ? 0 : Math.sin(st.t * 2.2) * .04 * (1 + st.danger);
    g.save(); g.translate(cx, fy); g.rotate(sway); g.scale(s, s);
    const fear = st.free ? 0 : st.danger;
    if (G.Art && G.Art.huntress) {
      const rim = st.free ? '#ffe8a0' : 'rgb(255,' + Math.round(200 - 110 * fear) + ',' + Math.round(150 - 90 * fear) + ')';
      g.save(); g.translate(2.2, -1); G.Art.huntress(g, rim); g.restore();
      g.save(); g.translate(-2.2, -1); G.Art.huntress(g, rim); g.restore();
      G.Art.huntress(g, '#1a0c0a');
    }
    g.restore();
    // her chains: up to 4 lines from her waist to rings in the pit walls; they break as the chain goal is met
    const shown = st.max ? Math.ceil(4 * st.chains / st.max) : 0;
    const wy = fy - 54 * s;
    const anchors = [[x0 + w * .17, y0 + h * .32], [x0 + w * .83, y0 + h * .32], [x0 + w * .19, y0 + h * .7], [x0 + w * .81, y0 + h * .7]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = anchors[i];
      const alive = i < shown && !st.free;
      g.strokeStyle = alive ? '#8a8a96' : 'rgba(120,120,130,.25)';
      g.lineWidth = alive ? 2.2 : 1.2;
      g.setLineDash(alive ? [4, 3] : [2, 6]);
      g.beginPath(); g.moveTo(ax, ay);
      if (alive) g.quadraticCurveTo((ax + cx) / 2, Math.max(ay, wy) + h * .08, cx + (ax < cx ? -6 : 6) * s * 3, wy);
      else g.lineTo(ax + (cx - ax) * .25, ay + h * .2); // a broken end hanging down
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#4a4a54'; g.beginPath(); g.arc(ax, ay, 3, 0, TAU); g.fill();
    }
    // the blood: fills the pit up to her feet over the first 60% of the moves, then climbs to her chin
    const lv = st.lost ? Math.max(st.danger, st.lost) : st.danger * (1 - st.free);
    const floorY = bot - h * .04, chinY = fy - 84 * s;
    const topY = lv < .6 ? G.lerp(floorY, fy, lv / .6) : G.lerp(fy, chinY, Math.min(1, (lv - .6) / .4));
    const bg = g.createLinearGradient(0, topY, 0, bot);
    bg.addColorStop(0, 'rgba(190,20,12,.92)'); bg.addColorStop(1, 'rgba(70,0,0,.97)');
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(x0, bot);
    for (let x = 0; x <= w; x += 6) g.lineTo(x0 + x, topY + Math.sin(x * .05 + st.t * 2.6) * 2 + Math.sin(x * .13 - st.t * 1.7) * 1.2);
    g.lineTo(x0 + w, bot); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,120,90,.55)'; g.lineWidth = 1.2;
    g.beginPath();
    for (let x = 0; x <= w; x += 6) { const y = topY + Math.sin(x * .05 + st.t * 2.6) * 2 + Math.sin(x * .13 - st.t * 1.7) * 1.2; x ? g.lineTo(x0 + x, y) : g.moveTo(x0 + x, y); }
    g.stroke();
    // a glow round her once she is free
    if (st.free) {
      const gl = g.createRadialGradient(cx, fy - 60 * s, 2, cx, fy - 60 * s, h * .7);
      gl.addColorStop(0, 'rgba(255,230,150,' + (.5 * st.free) + ')'); gl.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = gl; g.fillRect(x0, y0, w, h);
    }
    g.restore();
    // labels: chains left (left), moves left as a warning (right)
    const fs = Math.max(11, Math.round(h * .13));
    g.font = '700 ' + fs + 'px Cinzel, Georgia, serif';
    g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.85)';
    const ly = y0 + h * .14;
    g.textAlign = 'left'; g.fillStyle = '#c8c8d4';
    const cl = st.free ? 'Free!' : 'Chains ' + st.chains;
    g.strokeText(cl, x0 + 10, ly); g.fillText(cl, x0 + 10, ly);
    g.textAlign = 'right';
    const warn = !st.free && !st.lost && st.moves <= 3;
    const p = warn ? .5 + .5 * Math.sin(st.t * 9) : 0;
    g.fillStyle = warn ? 'rgb(255,' + Math.round(120 - 80 * p) + ',' + Math.round(90 - 60 * p) + ')' : '#f0c890';
    const ml = st.free ? 'Saved' : st.lost ? 'Lost' : warn ? 'Hurry!' : 'Save her';
    g.strokeText(ml, x0 + w - 10, ly); g.fillText(ml, x0 + w - 10, ly);
  }

  G.Rescue = { drawStrip };
})(window.G);
