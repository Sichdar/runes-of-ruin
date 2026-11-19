/* Runes of Ruin - bosses that fight back [S07].
   Who the five bosses are, how they attack, their health per level, and how they are drawn (in code).
   The board rules for damage and attacks live in board.js (hurt, bossTurn, attack). */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;

  // attacks: bind = chain 3 tiles, bury = 2 tiles under bone piles, curse = cursed ground under 4 tiles,
  //          burn = a power-up back into a plain tile (chains 3 if there is none)
  const BOSSES = [
    { id: 'widow', name: 'The Widow of Thorns', short: 'The Widow', weak: 0, attacks: ['bind'], she: true },
    { id: 'wyrm', name: 'The Sand Wyrm', short: 'The Wyrm', weak: 1, attacks: ['bury'] },
    { id: 'council', name: 'The Drowned Council', short: 'The Council', weak: 2, attacks: ['curse'], they: true },
    { id: 'flame', name: 'Lord of the First Flame', short: 'The Flame Lord', weak: 3, attacks: ['burn'] },
    { id: 'warden', name: 'The Heartstone Warden', short: 'The Warden', weak: 4, attacks: ['bind', 'bury', 'curse', 'burn'] },
    // Acts VI and VII [S09]
    { id: 'bishop', name: 'The Plague Bishop', short: 'The Bishop', weak: 1, attacks: ['curse', 'bury'] },
    { id: 'king', name: 'The Hollow King', short: 'The King', weak: 0, attacks: ['bind', 'bury', 'curse', 'burn'] }
  ];
  const ACTS = 7;             // story acts with their own boss; the Abyss comes after [S09]
  // Health of each act's boss (tuned with the bot, tools/tune.html), then the Abyss bosses grow
  // (a greedy bot does about 13 to 20 damage a move; generated boss levels then get their moves from the bot)
  const HP = [650, 340, 380, 420, 460, 490, 520];
  // [S09] Abyss: health grows each circle up to a cap the bot can still beat in 45 moves;
  // from the 6th circle on the bosses attack every 2 moves from the start
  const ABYSS_HP = 540, ABYSS_STEP = 10, ABYSS_MAX = 580;
  const EVERY = 3;            // moves between attacks; 2 once the boss is below half health
  const ATTACK_TEXT = { bind: 'binds 3 tiles in thorns', bury: 'buries 2 tiles under bones', curse: 'spreads cursed ground under 4 tiles', burn: 'burns a power-up back into a plain tile' };
  const SHOUT = { bind: 'Thorns!', bury: 'Buried!', curse: 'Cursed!', burn: 'Burned!' };

  function get(id) { return BOSSES.find(b => b.id === id) || BOSSES[0]; }

  function forLevel(n) {
    const act = Math.floor((n - 1) / 15);
    const circle = act - ACTS; // 0 = first Abyss circle
    const B = act < ACTS ? BOSSES[act] : BOSSES[circle % BOSSES.length];
    const hp = act < ACTS ? HP[act] : Math.min(ABYSS_MAX, ABYSS_HP + circle * ABYSS_STEP);
    const every = act >= ACTS + 5 ? 2 : EVERY;
    const who = B.she ? 'she' : B.they ? 'they' : 'it';
    const what = B.attacks.length > 1 ? 'uses a new attack' : ATTACK_TEXT[B.attacks[0]];
    const tip = 'Weak to ' + G.COLOR_NAMES[B.weak] + ': they hit twice as hard. Every ' + every + ' moves ' + who + ' ' + what +
      (every > 2 ? '; below half health, every 2' : '') + '. Power-ups hit hardest.';
    return { id: B.id, name: B.name, short: B.short, weak: B.weak, attacks: B.attacks.slice(), hp, every, tip };
  }

  // ---------------------------------------------------------------- drawing
  // Every figure is drawn with its feet at (0,0), about s tall, facing the player.
  // st: { t time, hurt 0..1, atk 0..1, angry }
  function eyes(g, x, y, gap, r, col, glow) {
    g.save();
    g.shadowColor = col; g.shadowBlur = glow;
    g.fillStyle = col;
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(x + sx * gap, y, r * 1.3, r * .75, sx * .25, 0, TAU); g.fill(); }
    g.restore();
  }

  const DRAW = {
    widow(g, s, st) {
      const t = st.t, sway = Math.sin(t * 1.3) * s * .015;
      // thorny vines either side
      g.strokeStyle = '#2a1418'; g.lineWidth = s * .025; g.lineCap = 'round';
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * s * .5, 0);
        for (let i = 1; i <= 8; i++) {
          const k = i / 8;
          g.lineTo(sx * s * (.5 - .12 * Math.sin(k * 5 + t * .8)), -s * .9 * k);
        }
        g.stroke();
        for (let i = 1; i < 8; i++) {
          const k = i / 8, x = sx * s * (.5 - .12 * Math.sin(k * 5 + t * .8)), y = -s * .9 * k;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx * s * .05, y - s * .03); g.stroke();
        }
      }
      g.save(); g.translate(sway, 0);
      // gown / veil
      const gr = g.createLinearGradient(0, -s * .85, 0, 0);
      gr.addColorStop(0, '#3a2440'); gr.addColorStop(1, '#0c0610');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-s * .1, -s * .66);
      g.quadraticCurveTo(-s * .2, -s * .3, -s * .38, 0);
      g.lineTo(s * .38, 0);
      g.quadraticCurveTo(s * .2, -s * .3, s * .1, -s * .66);
      g.closePath(); g.fill();
      // arms raised, long claws
      const lift = st.atk * s * .12;
      g.strokeStyle = '#d8cfd8'; g.lineWidth = s * .022;
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * s * .1, -s * .55);
        g.quadraticCurveTo(sx * s * .3, -s * .5, sx * s * .34, -s * .72 - lift);
        g.stroke();
        g.lineWidth = s * .01;
        for (let f = -1; f <= 1; f++) { g.beginPath(); g.moveTo(sx * s * .34, -s * .72 - lift); g.lineTo(sx * s * (.36 + f * .03), -s * .8 - lift); g.stroke(); }
        g.lineWidth = s * .022;
      }
      // pale face under the veil
      g.fillStyle = '#e4dcd8';
      g.beginPath(); g.ellipse(0, -s * .72, s * .075, s * .095, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,10,40,.55)';
      g.beginPath(); g.moveTo(-s * .12, -s * .84); g.quadraticCurveTo(0, -s * .9, s * .12, -s * .84); g.lineTo(s * .1, -s * .6); g.lineTo(-s * .1, -s * .6); g.closePath(); g.fill();
      eyes(g, 0, -s * .735, s * .03, s * .014, st.angry ? '#ff2020' : '#ff5050', s * .08);
      // crown of thorns
      g.strokeStyle = '#1a0c10'; g.lineWidth = s * .014;
      for (let i = -3; i <= 3; i++) {
        g.beginPath(); g.moveTo(i * s * .028, -s * .81); g.lineTo(i * s * .04, -s * (.9 + (i % 2 ? .02 : .05))); g.stroke();
      }
      g.restore();
    },

    wyrm(g, s, st) {
      const t = st.t;
      // sand mound
      g.fillStyle = '#6a4a28';
      g.beginPath(); g.ellipse(0, 0, s * .55, s * .1, 0, Math.PI, TAU); g.fill();
      // body: a thick curve rising from the sand
      const rise = Math.sin(t * 1.1) * s * .02 + st.atk * s * .06;
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const k = i / 14;
        pts.push([s * (-.3 + .32 * k + .08 * Math.sin(k * 6 + t)), -s * (.02 + .62 * k) - rise * k]);
      }
      for (let i = 0; i < pts.length; i++) {
        const k = i / (pts.length - 1), w = s * (.15 - .05 * k);
        g.fillStyle = i % 2 ? '#a8783c' : '#8a6030';
        g.beginPath(); g.ellipse(pts[i][0], pts[i][1], w, w * .8, 0, 0, TAU); g.fill();
      }
      // head
      const [hx, hy] = pts[pts.length - 1];
      g.save(); g.translate(hx, hy - s * .04);
      const open = .25 + st.atk * .5 + Math.sin(t * 2) * .05;
      g.fillStyle = '#9a6c34';
      g.beginPath(); g.moveTo(-s * .15, 0); g.quadraticCurveTo(0, -s * .2, s * .2, -s * .02); g.lineTo(s * .05, s * .02); g.closePath(); g.fill();
      g.fillStyle = '#7a5428';
      g.save(); g.rotate(open * .6);
      g.beginPath(); g.moveTo(-s * .12, s * .02); g.lineTo(s * .18, s * .04); g.quadraticCurveTo(0, s * .12, -s * .12, s * .02); g.fill();
      g.restore();
      g.fillStyle = '#2a0a06';
      g.beginPath(); g.moveTo(-s * .1, s * .01); g.lineTo(s * .17, 0); g.lineTo(s * .14, s * .05 + open * s * .06); g.closePath(); g.fill();
      g.fillStyle = '#f0e8d0';
      for (let i = 0; i < 4; i++) { const x = -s * .06 + i * s * .055; g.beginPath(); g.moveTo(x, s * .005); g.lineTo(x + s * .012, s * .04); g.lineTo(x + s * .024, s * .005); g.fill(); }
      eyes(g, s * .02, -s * .08, s * .045, s * .016, st.angry ? '#ff6020' : '#ffd040', s * .07);
      g.restore();
    },

    council(g, s, st) {
      const t = st.t;
      // black water
      g.fillStyle = '#0c1a14';
      g.beginPath(); g.ellipse(0, 0, s * .6, s * .08, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(80,200,140,.35)'; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const k = (t * .4 + i / 3) % 1; g.beginPath(); g.ellipse(0, 0, s * (.2 + .4 * k), s * (.03 + .05 * k), 0, 0, TAU); g.globalAlpha = 1 - k; g.stroke(); }
      g.globalAlpha = 1;
      const figs = [[-s * .3, .72, .6], [s * .3, .72, 1.9], [0, 1, 0]];
      for (const [x, sc, ph] of figs) {
        const h = s * .82 * sc, bob = Math.sin(t * 1.2 + ph) * s * .015 - st.atk * s * .05 * sc;
        g.save(); g.translate(x, bob);
        const gr = g.createLinearGradient(0, -h, 0, 0);
        gr.addColorStop(0, '#2a4034'); gr.addColorStop(1, '#08120c');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, -h);
        g.quadraticCurveTo(h * .2, -h * .95, h * .2, -h * .72);
        g.quadraticCurveTo(h * .32, -h * .3, h * .3, 0);
        g.lineTo(-h * .3, 0);
        g.quadraticCurveTo(-h * .32, -h * .3, -h * .2, -h * .72);
        g.quadraticCurveTo(-h * .2, -h * .95, 0, -h);
        g.fill();
        g.fillStyle = '#020604';
        g.beginPath(); g.ellipse(0, -h * .75, h * .11, h * .13, 0, 0, TAU); g.fill();
        eyes(g, 0, -h * .76, h * .045, h * .018, st.angry ? '#a0ff60' : '#50ffa0', s * .07);
        // dripping
        g.fillStyle = 'rgba(90,200,150,.5)';
        const dk = (t * .7 + ph) % 1;
        g.beginPath(); g.arc(h * .22, -h * .5 + dk * h * .45, s * .01, 0, TAU); g.fill();
        g.restore();
      }
    },

    flame(g, s, st) {
      const t = st.t;
      // flames behind
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * s * .11, fh = s * (.35 + .25 * Math.abs(Math.sin(t * 3 + i * 1.7))) * (st.angry ? 1.25 : 1);
        const gr = g.createLinearGradient(0, 0, 0, -fh);
        gr.addColorStop(0, 'rgba(255,120,20,.85)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - s * .07, 0); g.quadraticCurveTo(x, -fh * .6, x + Math.sin(t * 4 + i) * s * .03, -fh); g.quadraticCurveTo(x, -fh * .5, x + s * .07, 0); g.fill();
      }
      const lean = st.atk * s * .05;
      g.save(); g.translate(0, -lean);
      // shoulders and chest
      g.fillStyle = '#3a0e08';
      g.beginPath();
      g.moveTo(-s * .4, 0); g.quadraticCurveTo(-s * .42, -s * .45, -s * .14, -s * .55);
      g.lineTo(s * .14, -s * .55); g.quadraticCurveTo(s * .42, -s * .45, s * .4, 0); g.closePath(); g.fill();
      // glowing cracks
      g.strokeStyle = 'rgba(255,140,40,' + (.6 + .3 * Math.sin(t * 5)) + ')'; g.lineWidth = s * .012;
      g.beginPath(); g.moveTo(-s * .1, -s * .45); g.lineTo(-s * .03, -s * .3); g.lineTo(-s * .08, -s * .15); g.moveTo(s * .12, -s * .42); g.lineTo(s * .05, -s * .25); g.stroke();
      // head
      g.fillStyle = '#4a1208';
      g.beginPath(); g.ellipse(0, -s * .66, s * .12, s * .14, 0, 0, TAU); g.fill();
      // horns
      g.fillStyle = '#1a0a06';
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * s * .08, -s * .74);
        g.quadraticCurveTo(sx * s * .3, -s * .8, sx * s * .26, -s * 1.0);
        g.quadraticCurveTo(sx * s * .22, -s * .84, sx * s * .04, -s * .78); g.fill();
      }
      eyes(g, 0, -s * .69, s * .05, s * .02, '#ffd040', s * .1);
      g.fillStyle = 'rgba(255,150,40,' + (.6 + st.atk * .4) + ')';
      g.beginPath(); g.ellipse(0, -s * .6, s * .05, s * .015 + st.atk * s * .02, 0, 0, TAU); g.fill();
      g.restore();
    },

    warden(g, s, st) {
      const t = st.t;
      // ice shards on the ground
      g.fillStyle = '#a8c8e8';
      for (const [x, h] of [[-.45, .18], [-.36, .1], [.38, .16], [.47, .09]]) { g.beginPath(); g.moveTo(s * (x - .04), 0); g.lineTo(s * x, -s * h); g.lineTo(s * (x + .04), 0); g.fill(); }
      const lift = st.atk * s * .05 + Math.sin(t * .9) * s * .01;
      g.save(); g.translate(0, -lift);
      // body armour
      const gr = g.createLinearGradient(0, -s * .7, 0, 0);
      gr.addColorStop(0, '#5a6a80'); gr.addColorStop(1, '#141a24');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-s * .26, 0); g.lineTo(-s * .3, -s * .42); g.lineTo(-s * .42, -s * .55); g.lineTo(-s * .2, -s * .62);
      g.lineTo(s * .2, -s * .62); g.lineTo(s * .42, -s * .55); g.lineTo(s * .3, -s * .42); g.lineTo(s * .26, 0); g.closePath(); g.fill();
      g.strokeStyle = '#9ab0c8'; g.lineWidth = s * .01; g.stroke();
      // the heartstone
      const pulse = .6 + .4 * Math.sin(t * 3);
      g.save(); g.shadowColor = st.angry ? '#ff4060' : '#60c0ff'; g.shadowBlur = s * (.08 + .08 * pulse);
      g.fillStyle = st.angry ? '#ff6080' : '#90e0ff';
      g.beginPath(); g.moveTo(0, -s * .48); g.lineTo(s * .05, -s * .4); g.lineTo(0, -s * .3); g.lineTo(-s * .05, -s * .4); g.closePath(); g.fill();
      g.restore();
      // helm with ice horns
      g.fillStyle = '#3a4658';
      g.beginPath(); g.moveTo(-s * .11, -s * .62); g.lineTo(-s * .12, -s * .8); g.lineTo(0, -s * .86); g.lineTo(s * .12, -s * .8); g.lineTo(s * .11, -s * .62); g.closePath(); g.fill();
      g.fillStyle = '#c8e0f8';
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * s * .1, -s * .78); g.lineTo(sx * s * .24, -s * .98); g.lineTo(sx * s * .13, -s * .74); g.fill(); }
      g.fillStyle = '#05080c'; g.fillRect(-s * .08, -s * .74, s * .16, s * .025);
      eyes(g, 0, -s * .728, s * .04, s * .012, st.angry ? '#ff4060' : '#80d8ff', s * .08);
      g.restore();
    },

    // Act VI [S09]: a robed bishop in a beaked plague mask, swinging a censer of green smoke
    bishop(g, s, st) {
      const t = st.t, sway = Math.sin(t * 1.1) * s * .012;
      // green smoke pooling on the ground
      g.save(); g.globalAlpha = .5;
      for (let i = 0; i < 5; i++) {
        const x = Math.sin(t * .6 + i * 1.7) * s * .4, r = s * (.1 + .04 * Math.sin(t + i));
        const gr = g.createRadialGradient(x, -r * .3, 0, x, -r * .3, r);
        gr.addColorStop(0, 'rgba(150,200,60,.55)'); gr.addColorStop(1, 'rgba(150,200,60,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, -r * .3, r, 0, TAU); g.fill();
      }
      g.restore();
      g.save(); g.translate(sway, -st.atk * s * .04);
      // robe
      const gr = g.createLinearGradient(0, -s * .7, 0, 0);
      gr.addColorStop(0, '#4a4430'); gr.addColorStop(1, '#16140c');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-s * .3, 0); g.quadraticCurveTo(-s * .26, -s * .4, -s * .16, -s * .62);
      g.lineTo(s * .16, -s * .62); g.quadraticCurveTo(s * .26, -s * .4, s * .3, 0); g.closePath(); g.fill();
      // stole with crosses
      g.fillStyle = '#7a1a14'; g.fillRect(-s * .05, -s * .6, s * .1, s * .6);
      g.strokeStyle = '#d8c070'; g.lineWidth = s * .012;
      for (const y of [-.45, -.25]) { g.beginPath(); g.moveTo(0, s * (y - .04)); g.lineTo(0, s * (y + .04)); g.moveTo(-s * .025, s * (y - .015)); g.lineTo(s * .025, s * (y - .015)); g.stroke(); }
      // censer on a chain, swinging
      const ang = Math.sin(t * 1.8) * .5 + st.atk * .6, cx = s * .26, cy = -s * .52;
      const ex = cx + Math.sin(ang) * s * .26, ey = cy + Math.cos(ang) * s * .26;
      g.strokeStyle = '#8a7a50'; g.lineWidth = s * .008; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
      g.save(); g.shadowColor = '#a0e040'; g.shadowBlur = s * (.08 + st.atk * .1);
      g.fillStyle = '#b0a060'; g.beginPath(); g.arc(ex, ey, s * .04, 0, TAU); g.fill();
      g.fillStyle = 'rgba(170,230,70,.8)'; g.beginPath(); g.arc(ex, ey - s * .01, s * .018, 0, TAU); g.fill();
      g.restore();
      // hood and beaked mask
      g.fillStyle = '#2a2618';
      g.beginPath(); g.ellipse(0, -s * .69, s * .11, s * .1, 0, 0, TAU); g.fill();
      g.fillStyle = '#c8b890';
      g.beginPath(); g.moveTo(-s * .05, -s * .71); g.quadraticCurveTo(s * .02, -s * .62, s * .01, -s * .52); g.quadraticCurveTo(s * .05, -s * .64, s * .05, -s * .71); g.closePath(); g.fill();
      // tall mitre
      g.fillStyle = '#d8d0b0';
      g.beginPath(); g.moveTo(-s * .09, -s * .76); g.lineTo(-s * .07, -s * .94); g.lineTo(0, -s * 1.02); g.lineTo(s * .07, -s * .94); g.lineTo(s * .09, -s * .76); g.closePath(); g.fill();
      g.fillStyle = '#7a1a14'; g.fillRect(-s * .012, -s * .98, s * .024, s * .22);
      eyes(g, 0, -s * .72, s * .04, s * .014, st.angry ? '#ff4030' : '#c0ff50', s * .08);
      g.restore();
    },

    // Act VII [S09]: the Hollow King, an empty suit of black armour with a burning crown and a lightning blade
    king(g, s, st) {
      const t = st.t;
      g.save(); g.translate(0, -st.atk * s * .05 - Math.sin(t * .8) * s * .01);
      // cape
      g.fillStyle = '#1a1424';
      g.beginPath(); g.moveTo(-s * .2, -s * .6);
      for (let i = 0; i <= 6; i++) g.lineTo(-s * .4 + s * .8 * i / 6, -s * (.02 + .03 * Math.sin(t * 2 + i)));
      g.lineTo(s * .2, -s * .6); g.closePath(); g.fill();
      // armour
      const gr = g.createLinearGradient(0, -s * .66, 0, 0);
      gr.addColorStop(0, '#4a4a5c'); gr.addColorStop(1, '#0c0c14');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-s * .22, 0); g.lineTo(-s * .26, -s * .45); g.lineTo(-s * .38, -s * .58); g.lineTo(-s * .14, -s * .66);
      g.lineTo(s * .14, -s * .66); g.lineTo(s * .38, -s * .58); g.lineTo(s * .26, -s * .45); g.lineTo(s * .22, 0); g.closePath(); g.fill();
      g.strokeStyle = '#8890b0'; g.lineWidth = s * .01; g.stroke();
      // the empty chest: a hole with storm light inside
      const pulse = .6 + .4 * Math.sin(t * 2.4);
      const cg = g.createRadialGradient(0, -s * .42, 0, 0, -s * .42, s * .09);
      cg.addColorStop(0, 'rgba(200,220,255,' + (.5 + .4 * pulse) + ')'); cg.addColorStop(1, 'rgba(60,80,160,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(0, -s * .42, s * .09, 0, TAU); g.fill();
      // lightning blade
      g.save(); g.translate(s * .3, -s * .4); g.rotate(-.5 - st.atk * .5);
      g.fillStyle = '#c8d0e8'; g.fillRect(-s * .012, -s * .5, s * .024, s * .5);
      g.fillStyle = '#5a5a70'; g.fillRect(-s * .06, -s * .02, s * .12, s * .025);
      g.strokeStyle = 'rgba(170,200,255,' + (.4 + .6 * pulse) + ')'; g.lineWidth = s * .008; g.beginPath(); g.moveTo(0, -s * .5);
      for (let i = 1; i <= 5; i++) g.lineTo((i % 2 ? 1 : -1) * s * .03, -s * .5 + s * .1 * i);
      g.stroke(); g.restore();
      // helm and crown
      g.fillStyle = '#2a2a38';
      g.beginPath(); g.moveTo(-s * .1, -s * .66); g.lineTo(-s * .11, -s * .82); g.lineTo(s * .11, -s * .82); g.lineTo(s * .1, -s * .66); g.closePath(); g.fill();
      g.fillStyle = '#03030a'; g.fillRect(-s * .075, -s * .76, s * .15, s * .022);
      g.save(); g.shadowColor = st.angry ? '#ff4040' : '#ffc040'; g.shadowBlur = s * .08;
      g.fillStyle = '#d8a840';
      g.beginPath(); g.moveTo(-s * .12, -s * .82);
      for (let i = 0; i <= 4; i++) { g.lineTo(-s * .12 + s * .06 * i, -s * (i % 2 ? .88 : .95)); }
      g.lineTo(s * .12, -s * .82); g.closePath(); g.fill();
      g.restore();
      eyes(g, 0, -s * .749, s * .04, s * .011, st.angry ? '#ff4040' : '#a8c8ff', s * .08);
      g.restore();
    }
  };

  function drawFigure(g, id, x, y, s, st) {
    g.save();
    g.translate(x, y);
    const k = st.hurt || 0;
    if (k > 0) g.translate((Math.random() - .5) * k * s * .06, 0);
    const sc = 1 + (st.atk || 0) * .08;
    g.scale(sc, sc);
    (DRAW[id] || DRAW.widow)(g, s, st);
    g.restore();
    if (k > .05) { // white flash when hit
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = k * .35;
      g.translate(x, y);
      (DRAW[id] || DRAW.widow)(g, s, st);
      g.restore();
    }
  }

  const iconCache = new Map();
  function icon(id, px) {
    const key = id + ':' + px;
    if (iconCache.has(key)) return iconCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(px / 2, px * .45, px * .1, px / 2, px / 2, px / 2);
    gr.addColorStop(0, '#3a1810'); gr.addColorStop(1, '#0a0404');
    g.fillStyle = gr; g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 1, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 2, 0, TAU); g.clip();
    // zoom on the upper body
    drawFigure(g, id, px / 2, px * 1.05, px * 1.15, { t: 0, hurt: 0, atk: 0, angry: false });
    g.restore();
    g.strokeStyle = '#b0281a'; g.lineWidth = Math.max(1.5, px * .05);
    g.beginPath(); g.arc(px / 2, px / 2, px / 2 - g.lineWidth / 2, 0, TAU); g.stroke();
    iconCache.set(key, c);
    return c;
  }

  // The boss strip above the board: figure, health bar, weak colour, countdown.
  // st: { id, hp, max, timer, angry, hurt, atk, t }
  function drawStrip(g, x0, y0, w, h, st) {
    const cx = x0 + w / 2;
    const barW = Math.min(w * .7, 320), barH = Math.max(10, Math.round(h * .13));
    const barY = y0 + h - barH - 2;
    // dark glow behind the figure
    const gl = g.createRadialGradient(cx, barY, 4, cx, barY, h * 1.1);
    gl.addColorStop(0, st.angry ? 'rgba(140,10,0,.55)' : 'rgba(60,0,0,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.fillRect(x0, y0 - h * .1, w, h * 1.2);
    drawFigure(g, st.id, cx, barY + barH * .4, h * .92, st);
    // health bar
    const k = st.max ? G.clamp(st.hp / st.max, 0, 1) : 0;
    const bx = cx - barW / 2;
    g.fillStyle = 'rgba(0,0,0,.75)'; g.fillRect(bx - 2, barY - 2, barW + 4, barH + 4);
    g.fillStyle = '#2a0806'; g.fillRect(bx, barY, barW, barH);
    const hg = g.createLinearGradient(0, barY, 0, barY + barH);
    hg.addColorStop(0, st.angry ? '#ff7040' : '#e83020'); hg.addColorStop(1, st.angry ? '#a01800' : '#700a06');
    g.fillStyle = hg; g.fillRect(bx, barY, barW * k, barH);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, barY, barW * k, barH * .35);
    g.strokeStyle = '#c89a58'; g.lineWidth = 1.5; g.strokeRect(bx - 2, barY - 2, barW + 4, barH + 4);
    g.font = '700 ' + Math.round(barH * .82) + 'px Cinzel, Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff3d8'; g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3;
    const label = st.short + ' · ' + Math.max(0, Math.round(st.hp));
    g.strokeText(label, cx, barY + barH / 2 + 1); g.fillText(label, cx, barY + barH / 2 + 1);
    // weak colour, left of the bar
    const ic = Math.round(barH * 2.1);
    const ix = bx - ic - 6, iy = barY + barH / 2 - ic / 2;
    try { g.drawImage(G.Art.get('tile' + st.weak, Math.round(ic * 2)), ix, iy, ic, ic); } catch (e) { /* art not ready */ }
    g.font = '700 ' + Math.round(barH * .62) + 'px Cinzel, Georgia, serif';
    g.fillStyle = '#f0c890'; g.strokeText('weak', ix + ic / 2, iy - barH * .45); g.fillText('weak', ix + ic / 2, iy - barH * .45);
    // countdown, right of the bar
    const cr = barH * 1.15, ccx = bx + barW + 8 + cr, ccy = barY + barH / 2;
    const warn = st.timer <= 1;
    const pulse = warn ? .5 + .5 * Math.sin(st.t * 10) : 0;
    g.fillStyle = warn ? 'rgba(' + Math.round(150 + 100 * pulse) + ',20,10,1)' : '#2a1410';
    g.beginPath(); g.arc(ccx, ccy, cr, 0, TAU); g.fill();
    g.strokeStyle = '#c89a58'; g.lineWidth = 2; g.stroke();
    g.font = '900 ' + Math.round(cr * 1.2) + 'px Cinzel, Georgia, serif';
    g.fillStyle = '#fff3d8'; g.fillText(String(st.timer), ccx, ccy + 1);
    g.font = '700 ' + Math.round(barH * .62) + 'px Cinzel, Georgia, serif';
    g.fillStyle = '#f0c890'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)';
    g.strokeText('attack', ccx, ccy - cr - barH * .45); g.fillText('attack', ccx, ccy - cr - barH * .45);
  }

  G.Boss = { list: BOSSES, get, forLevel, icon, drawStrip, drawFigure, SHOUT };
})(window.G);
