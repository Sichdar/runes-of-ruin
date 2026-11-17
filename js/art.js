/* Runes of Ruin - code-drawn art.
   Tiles, power-ups, obstacles, act backgrounds, the title scene and ambient particles.
   Everything static is drawn once into cached canvases. Any key listed in window.ART_OVERRIDES
   (assets/art-overrides.js) is replaced by that image once it has loaded.
   Plain ES2017, no ctx.roundRect, no ctx.filter (iOS Safari 15+). */
window.G = window.G || {};
(function (G) {
  'use strict';
  const Art = G.Art = G.Art || {};
  const TAU = Math.PI * 2;
  Art.version = 0;

  // =====================================================================
  // Small helpers
  // =====================================================================
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { const c = hex2rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mixHex(a, b, t) {
    const p = hex2rgb(a), q = hex2rgb(b);
    let s = '#';
    for (let i = 0; i < 3; i++) { const v = Math.round(p[i] + (q[i] - p[i]) * t); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  const lighten = (h, t) => mixHex(h, '#ffffff', t);
  const darken = (h, t) => mixHex(h, '#000000', t);
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return G.rng ? G.rng(seed) : (function () { let s = seed || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(); }
  function rr(r, a, b) { return a + r() * (b - a); }

  // Rounded rectangle path (no ctx.roundRect on older iOS)
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Polygon path from [[x,y],...]
  function poly(ctx, pts, keep) {
    if (!keep) ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry, keep) {
    if (!keep) ctx.beginPath();
    ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.moveTo(1, 0); ctx.arc(0, 0, 1, 0, TAU); ctx.restore();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  // Soft radial glow
  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.45, rgba(col, a * 0.45));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Shadow in "unit" space: blur and offsets are scaled by k (= canvas px per unit)
  function shadow(ctx, k, col, blur, ox, oy) {
    ctx.shadowColor = col; ctx.shadowBlur = blur * k; ctx.shadowOffsetX = (ox || 0) * k; ctx.shadowOffsetY = (oy || 0) * k;
  }
  function noShadow(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function linGrad(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function radGrad(ctx, x, y, r0, r1, stops, x1, y1) {
    const g = ctx.createRadialGradient(x, y, r0, x1 === undefined ? x : x1, y1 === undefined ? y : y1, r1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  // Four-point twinkle
  function sparkle(ctx, x, y, r, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y + r * 0.7); ctx.quadraticCurveTo(x, y, x - r * 0.7, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
    ctx.restore();
  }

  // =====================================================================
  // Override images (assets/art-overrides.js)
  // =====================================================================
  const cache = new Map();
  const ov = {};
  function overrideImg(key) {
    const map = window.ART_OVERRIDES;
    if (!map || !map[key]) return null;
    let st = ov[key];
    if (!st) {
      st = ov[key] = { img: new Image(), ok: false, failed: false };
      st.img.onload = function () { st.ok = true; cache.clear(); Art.version++; };
      st.img.onerror = function () { st.failed = true; if (window.console) console.warn('[Art] override image failed to load: ' + key + ' -> ' + map[key]); };
      st.img.src = map[key];
    }
    return st.ok ? st.img : null;
  }
  Art.preload = function () { const map = window.ART_OVERRIDES || {}; Object.keys(map).forEach(k => { if (map[k]) overrideImg(k); }); };
  function drawContain(ctx, img, S) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(S / w, S / h);
    ctx.drawImage(img, (S - w * s) / 2, (S - h * s) / 2, w * s, h * s);
  }
  function drawCover(ctx, img, W, H) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.max(W / w, H / h);
    ctx.drawImage(img, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
  }
  Art.clear = function () { cache.clear(); };
  function cachePut(key, c) { if (cache.size > 500) cache.clear(); cache.set(key, c); return c; }

  // =====================================================================
  // Pieces: all drawn in a 100 x 100 unit square, k = canvas px per unit
  // =====================================================================
  const D = {}; // key -> function (ctx, k)

  // ---------- faceted gem (shared by sapphire, emerald, soul shard) ----------
  function facetGem(ctx, k, outer, c, opt) {
    opt = opt || {};
    const cx = opt.cx || 50, cy = opt.cy || 50, inS = opt.inner || 0.45;
    const ox = opt.tableDx || -2, oy = opt.tableDy || -3;
    const inner = outer.map(p => [cx + ox + (p[0] - cx) * inS, cy + oy + (p[1] - cy) * inS]);
    // outline + drop shadow
    ctx.save();
    ctx.lineJoin = 'round';
    shadow(ctx, k, 'rgba(0,0,0,0.85)', 5, 0, 3);
    poly(ctx, outer); ctx.lineWidth = 7; ctx.strokeStyle = '#07040a'; ctx.stroke();
    ctx.restore();
    // body
    poly(ctx, outer);
    ctx.fillStyle = linGrad(ctx, 22, 8, 78, 94, [[0, c.light], [0.45, c.mid], [1, c.dark]]);
    ctx.fill();
    // facets, lit from the top-left
    ctx.save();
    poly(ctx, outer); ctx.clip();
    const L = [-0.62, -0.78];
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      const mx = (outer[i][0] + outer[j][0]) / 2 - cx, my = (outer[i][1] + outer[j][1]) / 2 - cy;
      const len = Math.hypot(mx, my) || 1;
      const d = (mx * L[0] + my * L[1]) / len;
      poly(ctx, [outer[i], outer[j], inner[j], inner[i]]);
      ctx.fillStyle = d > 0 ? 'rgba(255,255,255,' + (d * 0.34).toFixed(3) + ')' : 'rgba(0,0,0,' + (-d * 0.42).toFixed(3) + ')';
      ctx.fill();
    }
    // table (top face)
    poly(ctx, inner);
    ctx.fillStyle = radGrad(ctx, cx - 6, cy - 8, 1, 30, [[0, rgba(c.light, 0.95)], [0.6, rgba(c.mid, 0.55)], [1, rgba(c.mid, 0.2)]]);
    ctx.fill();
    // facet edges
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rgba(lighten(c.light, 0.4), 0.45);
    for (let i = 0; i < outer.length; i++) {
      ctx.beginPath(); ctx.moveTo(outer[i][0], outer[i][1]); ctx.lineTo(inner[i][0], inner[i][1]); ctx.stroke();
    }
    poly(ctx, inner); ctx.stroke();
    ctx.restore();
    // bright rim
    ctx.lineJoin = 'round';
    poly(ctx, outer); ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(lighten(c.light, 0.5), 0.6); ctx.stroke();
    sparkle(ctx, opt.spx || 36, opt.spy || 30, 9, 0.95);
  }

  // tile0: blood vial (round flask with cork)
  D.tile0 = function (ctx, k) {
    glow(ctx, 50, 56, 52, '#ff2030', 0.5);
    const cx = 50, cy = 62, r = 29, nx = 9;
    const a1 = Math.atan2(-Math.sqrt(r * r - nx * nx), -nx), a2 = Math.atan2(-Math.sqrt(r * r - nx * nx), nx);
    const flask = () => {
      ctx.beginPath();
      ctx.moveTo(cx - nx, 21);
      ctx.lineTo(cx - nx, cy + r * Math.sin(a1));
      ctx.arc(cx, cy, r, a1, a2, true);
      ctx.lineTo(cx + nx, 21);
      ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    shadow(ctx, k, 'rgba(0,0,0,0.85)', 5, 0, 3);
    ctx.lineWidth = 7; ctx.strokeStyle = '#07040a';
    flask(); ctx.stroke();
    rrect(ctx, 41, 5, 18, 16, 4); ctx.stroke();
    rrect(ctx, 36, 16, 28, 8, 3.5); ctx.stroke();
    ctx.restore();
    // cork
    rrect(ctx, 41, 5, 18, 16, 4);
    ctx.fillStyle = linGrad(ctx, 41, 0, 59, 0, [[0, '#6a3e1c'], [0.4, '#c89060'], [1, '#4a2810']]);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,20,8,0.5)';
    circle(ctx, 46, 10, 1.3); ctx.fill(); circle(ctx, 53, 14, 1.1); ctx.fill();
    // dark glass
    flask(); ctx.fillStyle = '#2a0408'; ctx.fill();
    // liquid
    ctx.save();
    flask(); ctx.clip();
    ctx.fillStyle = radGrad(ctx, 41, 54, 2, 36, [[0, '#ff7a6a'], [0.35, '#e8182a'], [0.8, '#8a0414'], [1, '#4a0008']], 50, 62);
    ctx.fillRect(0, 37, 100, 70);
    ellipse(ctx, 50, 37.5, 10, 2.2); ctx.fillStyle = '#ff6a6a'; ctx.fill();
    // bubbles
    ctx.fillStyle = 'rgba(255,200,200,0.55)';
    circle(ctx, 60, 58, 2.4); ctx.fill(); circle(ctx, 55, 70, 1.6); ctx.fill(); circle(ctx, 63, 48, 1.3); ctx.fill();
    ctx.restore();
    // glass rim + highlights
    flask(); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(255,190,190,0.55)'; ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, 22, 2.55, 3.75); ctx.lineWidth = 4.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, 26); ctx.lineTo(44, 33); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
    // lip
    rrect(ctx, 36, 16, 28, 8, 3.5);
    ctx.fillStyle = linGrad(ctx, 0, 16, 0, 24, [[0, '#ffc0c0'], [0.5, '#c06070'], [1, '#5a1a24']]);
    ctx.fill();
    sparkle(ctx, 38, 48, 7, 0.9);
  };

  // tile1: frost sapphire (rhombus)
  D.tile1 = function (ctx, k) {
    glow(ctx, 50, 50, 52, '#2a8cff', 0.55);
    facetGem(ctx, k, [[50, 4], [92, 50], [50, 96], [8, 50]],
      { light: '#d8f2ff', mid: '#2a7cf0', dark: '#0a1e6a' }, { inner: 0.46, spx: 36, spy: 34 });
  };

  // tile2: venom emerald (pointy-top hexagon)
  D.tile2 = function (ctx, k) {
    glow(ctx, 50, 50, 52, '#28e04a', 0.5);
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; pts.push([50 + Math.cos(a) * 46, 51 + Math.sin(a) * 46]); }
    facetGem(ctx, k, pts, { light: '#dcffd0', mid: '#1cb83a', dark: '#044a16' }, { inner: 0.5, cy: 51, spx: 34, spy: 32 });
  };

  // tile3: cursed gold coin with an embossed rune
  function runePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(50, 29); ctx.lineTo(50, 71);
    ctx.moveTo(39, 41); ctx.lineTo(50, 30); ctx.lineTo(61, 41);
    ctx.moveTo(43, 52); ctx.lineTo(50, 45); ctx.lineTo(57, 52); ctx.lineTo(50, 59); ctx.closePath();
    ctx.moveTo(40, 70); ctx.lineTo(50, 62); ctx.lineTo(60, 70);
  }
  D.tile3 = function (ctx, k) {
    glow(ctx, 50, 50, 52, '#ffb020', 0.5);
    ctx.save();
    shadow(ctx, k, 'rgba(0,0,0,0.85)', 5, 0, 3);
    circle(ctx, 50, 50, 42); ctx.fillStyle = '#0a0602'; ctx.fill();
    ctx.restore();
    circle(ctx, 50, 50, 39);
    ctx.fillStyle = radGrad(ctx, 36, 32, 2, 52, [[0, '#fff6b0'], [0.35, '#f6c838'], [0.75, '#b8740e'], [1, '#5a3404']], 50, 50);
    ctx.fill();
    // notched rim
    ctx.strokeStyle = 'rgba(90,50,4,0.75)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU;
      ctx.beginPath(); ctx.moveTo(50 + Math.cos(a) * 35.5, 50 + Math.sin(a) * 35.5); ctx.lineTo(50 + Math.cos(a) * 38.5, 50 + Math.sin(a) * 38.5); ctx.stroke();
    }
    circle(ctx, 50, 50, 34.5); ctx.lineWidth = 2; ctx.strokeStyle = '#8a5208'; ctx.stroke();
    // inner field, slightly sunk
    circle(ctx, 50, 50, 33);
    ctx.fillStyle = radGrad(ctx, 58, 60, 2, 40, [[0, '#f0b828'], [0.7, '#c88a14'], [1, '#8a5a08']], 50, 50);
    ctx.fill();
    // rune: shadow, highlight, face, cursed red core
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(1.2, 1.6); runePath(ctx); ctx.lineWidth = 6.5; ctx.strokeStyle = '#5a3204'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(-0.8, -1); runePath(ctx); ctx.lineWidth = 5.5; ctx.strokeStyle = '#fff2a0'; ctx.stroke(); ctx.restore();
    runePath(ctx); ctx.lineWidth = 4.6; ctx.strokeStyle = '#e8aa22'; ctx.stroke();
    ctx.save(); shadow(ctx, k, '#ff2010', 4, 0, 0);
    runePath(ctx); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(200,24,16,0.85)'; ctx.stroke(); ctx.restore();
    // shine
    ctx.beginPath(); ctx.arc(50, 50, 37, 3.6, 4.6); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,230,0.7)'; ctx.stroke();
    sparkle(ctx, 30, 30, 8, 0.95);
  };

  // tile4: soul shard (tall purple crystal with two small side crystals)
  D.tile4 = function (ctx, k) {
    glow(ctx, 50, 50, 54, '#b040ff', 0.55);
    const side = (pts) => {
      ctx.save(); ctx.lineJoin = 'round';
      shadow(ctx, k, 'rgba(0,0,0,0.8)', 4, 0, 2);
      poly(ctx, pts); ctx.lineWidth = 6; ctx.strokeStyle = '#07040a'; ctx.stroke(); ctx.restore();
      poly(ctx, pts); ctx.fillStyle = linGrad(ctx, 20, 50, 40, 95, [[0, '#d090ff'], [1, '#3a0a6a']]); ctx.fill();
      poly(ctx, pts); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(240,210,255,0.5)'; ctx.stroke();
    };
    side([[34, 93], [17, 66], [21, 56], [37, 74]]);
    side([[66, 93], [83, 70], [80, 61], [63, 76]]);
    facetGem(ctx, k, [[50, 3], [69, 24], [66, 82], [50, 97], [34, 82], [31, 24]],
      { light: '#f4d4ff', mid: '#a43cf0', dark: '#2e0660' }, { inner: 0.38, tableDx: -1, tableDy: -4, spx: 42, spy: 22 });
  };

  // Skull, unit coords centred on (50,50); eyes: true = glowing red sockets
  function skull(ctx, k, cx, cy, s, eyes) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-50, -50);
    const shape = () => {
      ctx.beginPath();
      ellipse(ctx, 50, 42, 33, 31, true);
      ctx.moveTo(22, 46); ctx.lineTo(78, 46); ctx.lineTo(72, 71); ctx.lineTo(28, 71); ctx.closePath();
      ctx.moveTo(39, 62); ctx.arcTo(66, 62, 66, 88, 6); ctx.arcTo(66, 88, 34, 88, 6); ctx.arcTo(34, 88, 34, 62, 6); ctx.arcTo(34, 62, 66, 62, 6); ctx.closePath();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    shadow(ctx, k * s, 'rgba(0,0,0,0.85)', 5, 0, 3);
    shape(); ctx.lineWidth = 7; ctx.strokeStyle = '#0a0606'; ctx.stroke();
    ctx.restore();
    shape();
    ctx.fillStyle = linGrad(ctx, 30, 12, 70, 90, [[0, '#fffbf0'], [0.5, '#e8dcc0'], [1, '#a8987a']]);
    ctx.fill();
    // temple shading
    ctx.save(); shape(); ctx.clip();
    ctx.fillStyle = radGrad(ctx, 50, 38, 14, 40, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(60,40,20,0.35)']]);
    ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    // crack
    ctx.beginPath(); ctx.moveTo(60, 12); ctx.lineTo(63, 21); ctx.lineTo(58, 27); ctx.lineTo(61, 32);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(70,50,30,0.8)'; ctx.lineCap = 'round'; ctx.stroke();
    // sockets
    ctx.fillStyle = '#1a0606';
    ellipse(ctx, 37, 49, 10, 11); ctx.fill();
    ellipse(ctx, 63, 49, 10, 11); ctx.fill();
    if (eyes) {
      [37, 63].forEach(x => {
        ctx.fillStyle = radGrad(ctx, x, 50, 0, 9.5, [[0, '#ffe0c0'], [0.18, '#ff4a30'], [0.6, 'rgba(200,16,10,0.55)'], [1, 'rgba(120,0,0,0)']]);
        ellipse(ctx, x, 49, 9.5, 10.5); ctx.fill();
      });
    }
    // nose
    poly(ctx, [[50, 57], [45.5, 67], [54.5, 67]]); ctx.fillStyle = '#1a0606'; ctx.fill();
    // teeth
    ctx.strokeStyle = 'rgba(40,24,16,0.75)'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(37, 77); ctx.lineTo(63, 77);
    [41.5, 47, 53, 58.5].forEach(x => { ctx.moveTo(x, 71); ctx.lineTo(x, 84); });
    ctx.stroke();
    // shine
    ellipse(ctx, 38, 24, 9, 5); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
  }
  // tile5: skull with glowing red eye sockets
  D.tile5 = function (ctx, k) {
    glow(ctx, 50, 50, 52, '#ffd8c8', 0.32);
    glow(ctx, 50, 50, 40, '#ff3020', 0.25);
    skull(ctx, k, 50, 49, 1.04, true);
  };

  // ---------- power-ups ----------
  function disc(ctx, k, rim, core) {
    glow(ctx, 50, 50, 52, rim, 0.55);
    ctx.save();
    shadow(ctx, k, 'rgba(0,0,0,0.85)', 5, 0, 2);
    circle(ctx, 50, 50, 45); ctx.fillStyle = '#060308'; ctx.fill();
    ctx.restore();
    circle(ctx, 50, 50, 42);
    ctx.fillStyle = radGrad(ctx, 50, 46, 2, 42, [[0, core], [0.6, darken(core, 0.55)], [1, '#050306']]);
    ctx.fill();
    ctx.save();
    shadow(ctx, k, rim, 7, 0, 0);
    circle(ctx, 50, 50, 42.5); ctx.lineWidth = 3.4; ctx.strokeStyle = lighten(rim, 0.3); ctx.stroke();
    ctx.restore();
    circle(ctx, 50, 50, 37.5); ctx.lineWidth = 0.9; ctx.strokeStyle = rgba(rim, 0.45); ctx.stroke();
    ctx.fillStyle = rgba(lighten(rim, 0.4), 0.8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; circle(ctx, 50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40, 1.1); ctx.fill(); }
  }
  // Horizontal double-headed javelin
  function javelin(ctx, k) {
    ctx.lineCap = 'round';
    // speed streaks
    ctx.strokeStyle = 'rgba(255,200,110,0.45)'; ctx.lineWidth = 2.2;
    [[28, 35, 44], [56, 35, 72], [28, 65, 44], [56, 65, 72]].forEach(s => { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[1]); ctx.stroke(); });
    const head = (dir) => {
      ctx.save();
      if (dir < 0) { ctx.translate(100, 0); ctx.scale(-1, 1); }
      ctx.beginPath();
      ctx.moveTo(68, 50); ctx.quadraticCurveTo(76, 38, 85, 39.5); ctx.lineTo(99, 50); ctx.lineTo(85, 60.5); ctx.quadraticCurveTo(76, 62, 68, 50); ctx.closePath();
      ctx.save(); shadow(ctx, k, '#ffd080', 7, 0, 0);
      ctx.lineWidth = 4; ctx.strokeStyle = '#0a0606'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
      ctx.fillStyle = linGrad(ctx, 0, 39, 0, 61, [[0, '#ffffff'], [0.45, '#d0dce8'], [0.55, '#7a8898'], [1, '#3a4652']]);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(72, 50); ctx.lineTo(96, 50); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      // socket binding
      rrect(ctx, 63, 44.5, 7, 11, 2); ctx.fillStyle = '#e8b030'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#3a2004'; ctx.stroke();
      ctx.restore();
    };
    // shaft
    rrect(ctx, 24, 45.5, 52, 9, 4.5); ctx.lineWidth = 3.5; ctx.strokeStyle = '#0a0606'; ctx.stroke();
    ctx.fillStyle = linGrad(ctx, 0, 45.5, 0, 54.5, [[0, '#f6d090'], [0.5, '#b07840'], [1, '#5a3412']]); ctx.fill();
    // leather grip
    rrect(ctx, 42, 44, 16, 12, 2.5); ctx.fillStyle = '#5a2412'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#1a0804'; ctx.stroke();
    ctx.strokeStyle = 'rgba(230,160,110,0.65)'; ctx.lineWidth = 1.2;
    for (let x = 44; x < 57; x += 3.2) { ctx.beginPath(); ctx.moveTo(x, 55); ctx.lineTo(x + 3, 45); ctx.stroke(); }
    head(1); head(-1);
  }
  D.jh = function (ctx, k) { disc(ctx, k, '#ffaa20', '#4a2a08'); javelin(ctx, k); };
  D.jv = function (ctx, k) {
    disc(ctx, k, '#ffaa20', '#4a2a08');
    ctx.save(); ctx.translate(50, 50); ctx.rotate(Math.PI / 2); ctx.translate(-50, -50); javelin(ctx, k); ctx.restore();
  };

  D.bomb = function (ctx, k) {
    disc(ctx, k, '#ff6a10', '#5a1804');
    // body
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.8)', 4, 0, 2);
    circle(ctx, 50, 57, 27.5); ctx.fillStyle = '#060606'; ctx.fill(); ctx.restore();
    circle(ctx, 50, 57, 25.5);
    ctx.fillStyle = radGrad(ctx, 40, 46, 1, 30, [[0, '#70707a'], [0.4, '#2c2c34'], [1, '#08080a']], 50, 57);
    ctx.fill();
    // iron band and rivets
    ctx.save(); circle(ctx, 50, 57, 25.5); ctx.clip();
    ellipse(ctx, 50, 57, 27, 8); ctx.lineWidth = 3; ctx.strokeStyle = '#4a4a52'; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#9a9aa4';
    [[30, 60], [41, 64.5], [59, 64.5], [70, 60]].forEach(p => { circle(ctx, p[0], p[1], 1.3); ctx.fill(); });
    // glowing cracks
    const cracks = [[[34, 50], [40, 55], [37, 62], [43, 70]], [[60, 43], [63, 51], [58, 57], [65, 66]], [[47, 79], [51, 71], [55, 77]]];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); shadow(ctx, k, '#ff5000', 6, 0, 0);
    cracks.forEach(c => { ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineWidth = 2.8; ctx.strokeStyle = '#ff9a30'; ctx.stroke(); });
    ctx.restore();
    cracks.forEach(c => { ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineWidth = 1; ctx.strokeStyle = '#fff2a0'; ctx.stroke(); });
    // shine
    ellipse(ctx, 41, 46, 6, 3.5); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    // cap and fuse
    rrect(ctx, 43, 27, 14, 8, 2); ctx.fillStyle = '#3a3a42'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#08080a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, 27); ctx.quadraticCurveTo(51, 15, 64, 13);
    ctx.lineWidth = 5; ctx.strokeStyle = '#0a0604'; ctx.stroke();
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#c8a070'; ctx.stroke();
    // spark
    glow(ctx, 65, 12, 14, '#ffd040', 0.9);
    ctx.save(); ctx.translate(65, 12); ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 1.3;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, l = i % 2 ? 4.5 : 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
    ctx.restore();
    circle(ctx, 65, 12, 2.4); ctx.fillStyle = '#ffffff'; ctx.fill();
  };

  D.raven = function (ctx, k) {
    disc(ctx, k, '#ff2a3a', '#7a1020');
    const L = [[46, 46], [38, 36], [26, 29], [13, 29], [5, 34], [14, 38], [9, 44], [18, 45], [14, 52], [24, 51], [22, 58], [32, 55], [34, 63], [45, 59]];
    const R = L.map(p => [100 - p[0], p[1]]);
    const tail = [[44, 67], [39, 85], [45.5, 81], [50, 88], [54.5, 81], [61, 85], [56, 67]];
    const beak = [[54, 33.5], [67, 37.5], [55, 41.5]];
    const parts = [
      () => poly(ctx, L), () => poly(ctx, R), () => poly(ctx, tail),
      () => ellipse(ctx, 50, 56, 9.5, 17), () => circle(ctx, 50, 37, 8.5), () => poly(ctx, beak)
    ];
    ctx.lineJoin = 'round';
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.9)', 4, 0, 2);
    parts.forEach(p => { p(); ctx.lineWidth = 3.4; ctx.strokeStyle = '#b8c0e0'; ctx.stroke(); });
    ctx.restore();
    parts.forEach(p => { p(); ctx.fillStyle = '#08080c'; ctx.fill(); });
    // feather lines
    ctx.strokeStyle = 'rgba(120,130,170,0.55)'; ctx.lineWidth = 1;
    [[44, 52, 22, 40], [44, 55, 26, 50], [56, 52, 78, 40], [56, 55, 74, 50]].forEach(s => { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); });
    // beak tint
    poly(ctx, beak); ctx.fillStyle = '#3a3a44'; ctx.fill();
    // eye
    glow(ctx, 53, 35, 7, '#ff2020', 0.9);
    circle(ctx, 53, 35, 2.3); ctx.fillStyle = '#ff3a2a'; ctx.fill();
    circle(ctx, 52.4, 34.4, 0.8); ctx.fillStyle = '#ffe0d0'; ctx.fill();
  };

  D.chaos = function (ctx, k) {
    glow(ctx, 50, 50, 54, '#a040ff', 0.6);
    glow(ctx, 50, 50, 40, '#40ff90', 0.18);
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.85)', 5, 0, 2);
    circle(ctx, 50, 50, 42); ctx.fillStyle = '#05020a'; ctx.fill(); ctx.restore();
    circle(ctx, 50, 50, 40);
    ctx.fillStyle = radGrad(ctx, 50, 50, 1, 40, [[0, '#4a1a6a'], [0.6, '#1a0828'], [1, '#07020c']]);
    ctx.fill();
    ctx.save();
    circle(ctx, 50, 50, 39.5); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const col = i % 2 ? '#3aff84' : '#c050ff';
      const a0 = i / 6 * TAU;
      let px = 50, py = 50;
      for (let s = 1; s <= 20; s++) {
        const r = s * 1.95, a = a0 + r * 0.075;
        const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y);
        ctx.lineWidth = 5.5 - s * 0.22;
        ctx.strokeStyle = rgba(col, 0.75 - s * 0.025);
        ctx.stroke();
        px = x; py = y;
      }
    }
    const R = rng(77);
    for (let i = 0; i < 16; i++) {
      const a = R() * TAU, r = 8 + R() * 28;
      circle(ctx, 50 + Math.cos(a) * r, 50 + Math.sin(a) * r, 0.6 + R() * 1.1);
      ctx.fillStyle = R() < 0.5 ? 'rgba(220,170,255,0.9)' : 'rgba(170,255,200,0.9)'; ctx.fill();
    }
    ctx.fillStyle = radGrad(ctx, 50, 50, 0, 14, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(230,160,255,0.85)'], [1, 'rgba(120,40,200,0)']]);
    ctx.fillRect(30, 30, 40, 40);
    ctx.restore();
    // rim: alternating purple/green arcs
    ctx.save(); shadow(ctx, k, '#b040ff', 6, 0, 0);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(50, 50, 40.5, i / 6 * TAU + 0.08, (i + 1) / 6 * TAU - 0.08);
      ctx.lineWidth = 2.6; ctx.strokeStyle = i % 2 ? '#7affb0' : '#e0a0ff'; ctx.stroke();
    }
    ctx.restore();
    ellipse(ctx, 36, 30, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  };

  D.relic = function (ctx, k) {
    disc(ctx, k, '#ffd040', '#5a3e0a');
    // halo rays
    ctx.save(); circle(ctx, 50, 50, 41); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU;
      ctx.beginPath(); ctx.moveTo(50, 42);
      ctx.lineTo(50 + Math.cos(a - 0.09) * 50, 42 + Math.sin(a - 0.09) * 50);
      ctx.lineTo(50 + Math.cos(a + 0.09) * 50, 42 + Math.sin(a + 0.09) * 50);
      ctx.closePath(); ctx.fillStyle = 'rgba(255,210,90,0.14)'; ctx.fill();
    }
    ctx.restore();
    const gold = () => linGrad(ctx, 26, 0, 74, 0, [[0, '#6a4006'], [0.3, '#ffe890'], [0.55, '#e8a822'], [1, '#5a3604']]);
    const bowl = () => { ctx.beginPath(); ctx.moveTo(27, 21); ctx.lineTo(73, 21); ctx.bezierCurveTo(73, 44, 62, 56, 50, 57); ctx.bezierCurveTo(38, 56, 27, 44, 27, 21); ctx.closePath(); };
    const stem = () => { poly(ctx, [[46, 56], [54, 56], [53, 71], [47, 71]]); };
    const base = () => { ctx.beginPath(); ctx.moveTo(47, 70); ctx.lineTo(53, 70); ctx.lineTo(64, 79); ctx.quadraticCurveTo(50, 87, 36, 79); ctx.closePath(); };
    const knob = () => ellipse(ctx, 50, 63.5, 6, 3.2);
    ctx.lineJoin = 'round';
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.85)', 4, 0, 2);
    [bowl, stem, base, knob].forEach(f => { f(); ctx.lineWidth = 4.5; ctx.strokeStyle = '#140a02'; ctx.stroke(); });
    ctx.restore();
    [base, stem, bowl, knob].forEach(f => { f(); ctx.fillStyle = gold(); ctx.fill(); });
    // rim and wine
    ellipse(ctx, 50, 21, 23, 4.6); ctx.fillStyle = '#ffe48a'; ctx.fill();
    ellipse(ctx, 50, 21.3, 19.5, 3.1); ctx.fillStyle = '#5a0810'; ctx.fill();
    // band and gem
    ctx.beginPath(); ctx.moveTo(29, 31); ctx.quadraticCurveTo(50, 36, 71, 31); ctx.lineWidth = 1.6; ctx.strokeStyle = '#7a4a08'; ctx.stroke();
    poly(ctx, [[50, 33], [56, 40], [50, 47], [44, 40]]); ctx.fillStyle = '#e01828'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#4a0008'; ctx.stroke();
    poly(ctx, [[50, 34.5], [53.5, 39], [50, 40], [46.5, 39]]); ctx.fillStyle = '#ff8a8a'; ctx.fill();
    ctx.fillStyle = '#fff4c0';
    [[36, 40], [64, 40]].forEach(p => { circle(ctx, p[0], p[1], 1.8); ctx.fill(); });
    sparkle(ctx, 33, 27, 8, 0.95);
  };

  // ---------- obstacles ----------
  function bone(ctx, x1, y1, x2, y2, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.6, -w * 0.32); ctx.lineTo(len - w * 0.6, -w * 0.32); ctx.lineTo(len - w * 0.6, w * 0.32); ctx.lineTo(w * 0.6, w * 0.32); ctx.closePath();
      [[0, -w * 0.38], [0, w * 0.38], [len, -w * 0.38], [len, w * 0.38]].forEach(p => { ctx.moveTo(p[0] + w * 0.46, p[1]); ctx.arc(p[0], p[1], w * 0.46, 0, TAU); });
    };
    shape(); ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0c0806'; ctx.stroke();
    shape(); ctx.fillStyle = linGrad(ctx, 0, -w, 0, w, [[0, '#fffbee'], [0.5, '#e0d2b2'], [1, '#9a8a6a']]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w * 0.7, -w * 0.12); ctx.lineTo(len - w * 0.7, -w * 0.12); ctx.lineWidth = w * 0.13; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    ctx.restore();
  }
  function slab(ctx, k, c1, c2, seed, cracks) {
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.85)', 4, 0, 2);
    rrect(ctx, 3, 3, 94, 94, 12); ctx.fillStyle = '#060406'; ctx.fill(); ctx.restore();
    rrect(ctx, 4.5, 4.5, 91, 91, 11);
    ctx.fillStyle = linGrad(ctx, 10, 5, 90, 95, [[0, c1], [1, c2]]); ctx.fill();
    ctx.save(); rrect(ctx, 4.5, 4.5, 91, 91, 11); ctx.clip();
    const R = rng(seed);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(R() * 100, R() * 100, 0.8 + R() * 2.2, 0.8 + R() * 2.2);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let c = 0; c < cracks; c++) {
      let x = R() < 0.5 ? 5 + R() * 20 : 75 + R() * 20, y = R() < 0.5 ? 5 + R() * 15 : 80 + R() * 15;
      const pts = [[x, y]];
      const tx = 50 + rr(R, -20, 20), ty = 50 + rr(R, -20, 20);
      for (let s = 0; s < 4; s++) { x += (tx - x) * 0.35 + rr(R, -6, 6); y += (ty - y) * 0.35 + rr(R, -6, 6); pts.push([x, y]); }
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
      ctx.save(); ctx.translate(0.8, 0.8); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // bevel
    rrect(ctx, 6, 6, 88, 88, 10); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
    rrect(ctx, 4.5, 4.5, 91, 91, 11); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  }
  D.bone1 = function (ctx, k) {
    slab(ctx, k, '#5a4c40', '#2a221c', 11, 1);
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.7)', 4, 0, 2);
    bone(ctx, 22, 22, 78, 78, 13); bone(ctx, 78, 22, 22, 78, 13);
    ctx.restore();
  };
  D.bone2 = function (ctx, k) {
    slab(ctx, k, '#4a404c', '#1c161e', 22, 3);
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.7)', 4, 0, 2);
    bone(ctx, 18, 36, 82, 88, 12); bone(ctx, 82, 36, 18, 88, 12);
    ctx.restore();
    skull(ctx, k, 50, 45, 0.62, false);
  };
  D.bone3 = function (ctx, k) {
    // dark earth behind the stone so the whole cell is blocked
    rrect(ctx, 3, 3, 94, 94, 12); ctx.fillStyle = '#120c10'; ctx.fill();
    const stone = () => { ctx.beginPath(); ctx.moveTo(8, 97); ctx.lineTo(8, 42); ctx.arc(50, 42, 42, Math.PI, 0); ctx.lineTo(92, 97); ctx.closePath(); };
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.85)', 4, 0, 2);
    stone(); ctx.lineWidth = 4; ctx.strokeStyle = '#060406'; ctx.stroke(); ctx.restore();
    stone(); ctx.fillStyle = linGrad(ctx, 15, 0, 85, 100, [[0, '#8a8490'], [0.5, '#56505c'], [1, '#26222a']]); ctx.fill();
    ctx.save(); stone(); ctx.clip();
    const R = rng(33);
    for (let i = 0; i < 80; i++) { ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(R() * 100, R() * 100, 1 + R() * 2, 1 + R() * 2); }
    // moss at the foot
    ctx.fillStyle = 'rgba(40,70,40,0.5)'; ellipse(ctx, 30, 99, 30, 8); ctx.fill(); ellipse(ctx, 78, 100, 22, 7); ctx.fill();
    // big crack
    ctx.beginPath(); ctx.moveTo(62, 2); ctx.lineTo(57, 14); ctx.lineTo(66, 22); ctx.lineTo(60, 34); ctx.lineTo(70, 44);
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(10,6,10,0.85)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 30); ctx.lineTo(26, 38); ctx.lineTo(22, 46); ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
    // carved rune at the top
    ctx.lineCap = 'round'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(50, 9); ctx.lineTo(50, 27); ctx.moveTo(43, 15); ctx.lineTo(57, 15);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.save(); ctx.translate(0.6, 0.8); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#1a141c'; ctx.stroke();
    stone(); ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.7)', 4, 0, 2);
    bone(ctx, 16, 50, 84, 94, 11); bone(ctx, 84, 50, 16, 94, 11);
    ctx.restore();
    skull(ctx, k, 50, 58, 0.56, false);
  };
  // two crossed iron chains with a padlock (transparent elsewhere)
  function chainLine(ctx, k, x1, y1, x2, y2, n) {
    const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1), step = len / n;
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = step * (i + 0.5);
      if (i % 2 === 0) {
        ellipse(ctx, x, 0, step * 0.66, 5.2); ctx.lineWidth = 6.4; ctx.strokeStyle = '#0a0a0c'; ctx.stroke();
        ellipse(ctx, x, 0, step * 0.66, 5.2); ctx.lineWidth = 3.4; ctx.strokeStyle = '#8a9098'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse ? ctx.ellipse(x, 0, step * 0.66, 5.2, 0, Math.PI * 1.1, Math.PI * 1.75) : ctx.arc(x, 0, 5, 3.4, 5.5);
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#e4e8ee'; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x - step * 0.62, 0); ctx.lineTo(x + step * 0.62, 0);
        ctx.lineWidth = 6.8; ctx.strokeStyle = '#0a0a0c'; ctx.stroke();
        ctx.lineWidth = 3.8; ctx.strokeStyle = '#6a7078'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - step * 0.5, -0.9); ctx.lineTo(x + step * 0.5, -0.9); ctx.lineWidth = 1.1; ctx.strokeStyle = '#c8ccd4'; ctx.stroke();
      }
    }
    ctx.restore();
  }
  D.chain = function (ctx, k) {
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.75)', 4, 0, 2);
    chainLine(ctx, k, 4, 4, 96, 96, 9);
    chainLine(ctx, k, 96, 4, 4, 96, 9);
    ctx.restore();
    // padlock
    ctx.beginPath(); ctx.arc(50, 45, 9, Math.PI, 0); ctx.lineWidth = 7; ctx.strokeStyle = '#0a0a0c'; ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = '#9aa0a8'; ctx.stroke();
    ctx.save(); shadow(ctx, k, 'rgba(0,0,0,0.8)', 4, 0, 2);
    rrect(ctx, 36, 44, 28, 24, 4.5); ctx.fillStyle = '#0a0806'; ctx.fill(); ctx.restore();
    rrect(ctx, 37.5, 45.5, 25, 21, 3.5);
    ctx.fillStyle = linGrad(ctx, 37, 45, 63, 67, [[0, '#d0b070'], [0.5, '#8a6a34'], [1, '#3a2a12']]); ctx.fill();
    ctx.fillStyle = '#0a0604';
    circle(ctx, 50, 53, 3.2); ctx.fill();
    poly(ctx, [[48.2, 54], [51.8, 54], [52.6, 61.5], [47.4, 61.5]]); ctx.fill();
    ctx.fillStyle = '#f0dca0';
    [[40.5, 48.5], [59.5, 48.5], [40.5, 63.5], [59.5, 63.5]].forEach(p => { circle(ctx, p[0], p[1], 1.1); ctx.fill(); });
    rrect(ctx, 37.5, 45.5, 25, 21, 3.5); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.stroke();
  };
  // cursed ground under a tile (fills the whole cell)
  function veins(ctx, R, n, col, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let v = 0; v < n; v++) {
      const side = v % 4;
      let x = side === 0 ? 0 : side === 1 ? 100 : R() * 100, y = side === 2 ? 0 : side === 3 ? 100 : R() * 100;
      let a = Math.atan2(50 - y, 50 - x) + rr(R, -0.5, 0.5);
      const pts = [[x, y]];
      const steps = 5 + Math.floor(R() * 4);
      for (let s = 0; s < steps; s++) { a += rr(R, -0.6, 0.6); x += Math.cos(a) * 8; y += Math.sin(a) * 8; pts.push([x, y]); }
      const path = () => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
      path(); ctx.lineWidth = w + 2.4; ctx.strokeStyle = 'rgba(8,0,4,0.7)'; ctx.stroke();
      path(); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
      // a branch
      const b = pts[Math.floor(pts.length / 2)];
      let bx = b[0], by = b[1], ba = a + (R() < 0.5 ? 1 : -1) * 1.1;
      ctx.beginPath(); ctx.moveTo(bx, by);
      for (let s = 0; s < 3; s++) { ba += rr(R, -0.5, 0.5); bx += Math.cos(ba) * 6; by += Math.sin(ba) * 6; ctx.lineTo(bx, by); }
      ctx.lineWidth = w * 0.6; ctx.stroke();
    }
  }
  function ground(ctx, k, c0, c1, c2, seed) {
    ctx.fillStyle = radGrad(ctx, 50, 50, 4, 72, [[0, c0], [0.6, c1], [1, c2]]);
    ctx.fillRect(0, 0, 100, 100);
    const R = rng(seed);
    for (let i = 0; i < 90; i++) { ctx.fillStyle = R() < 0.6 ? 'rgba(0,0,0,0.25)' : 'rgba(255,90,90,0.07)'; ctx.fillRect(R() * 100, R() * 100, 1 + R() * 2.4, 1 + R() * 2.4); }
    return R;
  }
  D.ground1 = function (ctx, k) {
    const R = ground(ctx, k, '#5a0c16', '#36060c', '#1a0206', 101);
    veins(ctx, R, 6, 'rgba(210,30,44,0.8)', 1.5);
    ctx.strokeStyle = 'rgba(255,80,80,0.16)'; ctx.lineWidth = 1.5; ctx.strokeRect(1.5, 1.5, 97, 97);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(0.6, 0.6, 98.8, 98.8);
  };
  D.ground2 = function (ctx, k) {
    const R = ground(ctx, k, '#800a1e', '#4a0412', '#22000a', 202);
    veins(ctx, R, 8, 'rgba(255,50,64,0.9)', 1.9);
    // glowing rune circle
    ctx.save(); shadow(ctx, k, '#ff2a20', 6, 0, 0);
    circle(ctx, 50, 50, 36); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(255,110,80,0.55)'; ctx.stroke();
    circle(ctx, 50, 50, 28); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,90,70,0.6)'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,150,110,0.6)'; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      ctx.save(); ctx.translate(50 + Math.cos(a) * 32, 50 + Math.sin(a) * 32); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      if (i % 3 === 0) { ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.moveTo(-2, -1); ctx.lineTo(2, 1); }
      else if (i % 3 === 1) { ctx.moveTo(-2, 3); ctx.lineTo(0, -3); ctx.lineTo(2, 3); }
      else { ctx.moveTo(-2, -3); ctx.lineTo(2, 0); ctx.lineTo(-2, 3); }
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,90,90,0.2)'; ctx.lineWidth = 1.5; ctx.strokeRect(1.5, 1.5, 97, 97);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.strokeRect(0.6, 0.6, 98.8, 98.8);
  };

  function placeholder(ctx, k, key) {
    ctx.fillStyle = '#ff00ff'; ctx.fillRect(4, 4, 92, 92);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 5;
    for (let i = -100; i < 200; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 100, 100); ctx.stroke(); }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
    ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText('?', 50, 52); ctx.fillText('?', 50, 52);
  }

  // =====================================================================
  // Public: pieces
  // =====================================================================
  Art.keys = Object.keys(D);
  Art.get = function (key, sizePx) {
    const S = Math.max(8, Math.round(sizePx || 64));
    const ck = key + '|' + S;
    const hit = cache.get(ck);
    if (hit) return hit;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    try {
      const img = overrideImg(key);
      if (img) drawContain(ctx, img, S);
      else {
        ctx.save(); ctx.scale(S / 100, S / 100);
        if (D[key]) D[key](ctx, S / 100); else placeholder(ctx, S / 100, key);
        ctx.restore();
      }
    } catch (e) {
      if (window.console) console.error('[Art] failed drawing ' + key, e);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, S, S);
      ctx.save(); ctx.scale(S / 100, S / 100); placeholder(ctx, S / 100, key); ctx.restore();
    }
    return cachePut(ck, c);
  };
  Art.tileKey = function (tile) { return tile.kind === 'n' ? 'tile' + tile.color : tile.kind; };

  // =====================================================================
  // Backgrounds (drawn in CSS px on a canvas scaled by dpr)
  // =====================================================================
  function sky(ctx, W, H, stops) { ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, stops); ctx.fillRect(0, 0, W, H); }
  function stars(ctx, R, W, H, n, maxY, a, col) {
    ctx.fillStyle = col || '#ffffff';
    for (let i = 0; i < n; i++) {
      const s = R() < 0.1 ? 1.6 : 0.6 + R() * 0.7;
      ctx.globalAlpha = a * (0.25 + R() * 0.75);
      ctx.fillRect(R() * W, R() * H * maxY, s, s);
    }
    ctx.globalAlpha = 1;
  }
  function moon(ctx, R, x, y, r, col, halo, haloA) {
    glow(ctx, x, y, r * 4.5, halo, haloA === undefined ? 0.3 : haloA);
    glow(ctx, x, y, r * 1.8, halo, 0.35);
    circle(ctx, x, y, r);
    ctx.fillStyle = radGrad(ctx, x - r * 0.3, y - r * 0.3, r * 0.1, r * 1.25, [[0, lighten(col, 0.35)], [0.55, col], [1, darken(col, 0.45)]], x, y);
    ctx.fill();
    ctx.save(); circle(ctx, x, y, r); ctx.clip();
    for (let i = 0; i < 9; i++) {
      const a = R() * TAU, d = R() * r * 0.75, cr = r * (0.08 + R() * 0.22);
      const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d, ba = 0.14 + R() * 0.16;
      ctx.fillStyle = radGrad(ctx, bx, by, 0, cr, [[0, rgba(darken(col, 0.5), ba)], [0.6, rgba(darken(col, 0.5), ba * 0.6)], [1, rgba(darken(col, 0.5), 0)]]);
      ctx.fillRect(bx - cr, by - cr, cr * 2, cr * 2);
    }
    ctx.restore();
  }
  function cloudStreaks(ctx, R, W, y0, y1, col, a, n) {
    for (let i = 0; i < n; i++) {
      const y = rr(R, y0, y1), x = R() * W, w = W * rr(R, 0.25, 0.6), h = rr(R, 3, 9);
      ctx.save(); ctx.translate(x, y); ctx.scale(w / 2, h / 2);
      ctx.fillStyle = radGrad(ctx, 0, 0, 0, 1, [[0, rgba(col, a)], [1, rgba(col, 0)]]);
      ctx.fillRect(-1, -1, 2, 2); ctx.restore();
    }
  }
  // Jagged ridge from y downwards; returns yAt(x) for placing things on it
  function ridge(ctx, R, W, H, y, amp, col, jag, freq) {
    const step = 6, pts = [];
    const f1 = (freq || 1) * rr(R, 0.006, 0.011), f2 = (freq || 1) * rr(R, 0.017, 0.03), p1 = R() * 9, p2 = R() * 9;
    for (let x = -step; x <= W + step; x += step) {
      const v = y - amp * (0.6 * (0.5 + 0.5 * Math.sin(x * f1 + p1)) + 0.4 * (0.5 + 0.5 * Math.sin(x * f2 + p2))) - (jag || 0) * R();
      pts.push([x, v]);
    }
    ctx.beginPath(); ctx.moveTo(-step, H + 2);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(W + step, H + 2); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    return function (x) { const i = G.clamp(Math.floor((x + step) / step), 0, pts.length - 2), t = (x - pts[i][0]) / step; return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; };
  }
  function fogBand(ctx, W, y, h, col, a) {
    ctx.fillStyle = linGrad(ctx, 0, y - h, 0, y + h, [[0, rgba(col, 0)], [0.5, rgba(col, a)], [1, rgba(col, 0)]]);
    ctx.fillRect(0, y - h, W, h * 2);
  }
  function vignette(ctx, W, H, a) {
    const r = Math.hypot(W, H) / 2;
    ctx.fillStyle = radGrad(ctx, W / 2, H * 0.48, r * 0.35, r, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,' + a + ')']]);
    ctx.fillRect(0, 0, W, H);
  }
  function deadTree(ctx, R, x, y, h, col) {
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    const br = (x0, y0, len, ang, w, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      const mx = (x0 + x1) / 2 + rr(R, -len, len) * 0.15, my = (y0 + y1) / 2 + rr(R, -len, len) * 0.15;
      ctx.lineWidth = Math.max(0.7, w);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      if (depth <= 0 || len < 3) return;
      const n = 2 + (R() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) br(x1, y1, len * rr(R, 0.55, 0.78), ang + rr(R, -0.75, 0.75) + (i - (n - 1) / 2) * 0.35, w * 0.62, depth - 1);
    };
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - h * 0.12, y + 2); ctx.quadraticCurveTo(x, y - h * 0.1, x + h * 0.12, y + 2); ctx.fill();
    br(x, y + 1, h * 0.42, -Math.PI / 2 + rr(R, -0.15, 0.15), h * 0.07, 5);
  }
  function ruinTower(ctx, R, x, y, w, h, col, win) {
    const top = y - h;
    const pts = [[x - w / 2, y + 4], [x - w / 2, top + h * 0.12]];
    pts.push([x - w / 2, top + h * 0.05], [x - w * 0.3, top + h * 0.05], [x - w * 0.3, top], [x - w * 0.1, top], [x - w * 0.1, top + h * 0.06]);
    pts.push([x + w * 0.05, top + h * 0.1], [x + w * 0.18, top + h * 0.2], [x + w * 0.3, top + h * 0.18], [x + w / 2, top + h * 0.34], [x + w / 2, y + 4]);
    poly(ctx, pts); ctx.fillStyle = col; ctx.fill();
    if (win) {
      ctx.fillStyle = rgba(win, 0.55);
      ctx.fillRect(x - w * 0.08, top + h * 0.3, w * 0.12, h * 0.1);
      ctx.fillStyle = rgba(win, 0.35);
      ctx.fillRect(x - w * 0.2, top + h * 0.55, w * 0.1, h * 0.08);
    }
  }
  function cloister(ctx, R, x0, y, w, h, col, n) {
    ctx.beginPath();
    ctx.moveTo(x0, y + 4); ctx.lineTo(x0, y - h);
    const seg = 10;
    for (let i = 1; i <= seg; i++) { const x = x0 + w * i / seg; ctx.lineTo(x, y - h * (i > seg * 0.6 ? rr(R, 0.45, 0.9) : rr(R, 0.92, 1.05))); }
    ctx.lineTo(x0 + w, y + 4); ctx.closePath();
    const aw = w / n;
    for (let i = 0; i < n; i++) {
      const ax = x0 + aw * (i + 0.2), ww = aw * 0.6, top = y - h * 0.62;
      ctx.moveTo(ax, y + 4); ctx.lineTo(ax, top); ctx.arc(ax + ww / 2, top, ww / 2, Math.PI, 0); ctx.lineTo(ax + ww, y + 4); ctx.closePath();
    }
    ctx.fillStyle = col; ctx.fill('evenodd');
  }
  function graves(ctx, R, yAt, x0, x1, n, size, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = rr(R, x0, x1), y = yAt(x) + 2, s = size * rr(R, 0.7, 1.2), tilt = rr(R, -0.25, 0.25);
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      if (R() < 0.5) { ctx.beginPath(); ctx.moveTo(-s * 0.35, 0); ctx.lineTo(-s * 0.35, -s * 0.7); ctx.arc(0, -s * 0.7, s * 0.35, Math.PI, 0); ctx.lineTo(s * 0.35, 0); ctx.fill(); }
      else { ctx.fillRect(-s * 0.08, -s * 1.1, s * 0.16, s * 1.1); ctx.fillRect(-s * 0.35, -s * 0.85, s * 0.7, s * 0.15); }
      ctx.restore();
    }
  }
  function spikes(ctx, R, yAt, W, n, hMin, hMax, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = R() * W, y = yAt(x) + 3, h = rr(R, hMin, hMax), w = h * rr(R, 0.08, 0.16), lean = rr(R, -0.25, 0.25) * h;
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w * 0.2 + lean * 0.4, y - h * 0.6, x + lean, y - h); ctx.quadraticCurveTo(x + w * 0.2 + lean * 0.4, y - h * 0.6, x + w / 2, y); ctx.fill();
    }
  }
  function hangingChain(ctx, x0, y0, x1, y1, sag, link, col) {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / (link * 1.5)));
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, link * 0.28);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = G.lerp(x0, x1, t), y = G.lerp(y0, y1, t) + sag * 4 * t * (1 - t);
      const t2 = (i + 1) / n, xa = G.lerp(x0, x1, t2), ya = G.lerp(y0, y1, t2) + sag * 4 * t2 * (1 - t2);
      const a = Math.atan2(ya - y, xa - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      if (i % 2) { ctx.beginPath(); ctx.moveTo(-link * 0.8, 0); ctx.lineTo(link * 0.8, 0); ctx.stroke(); }
      else { ellipse(ctx, 0, 0, link * 0.9, link * 0.45); ctx.stroke(); }
      ctx.restore();
    }
  }
  function peaks(ctx, R, W, H, baseY, n, hMin, hMax, col, snow) {
    const tops = [], xs = [];
    for (let i = 0; i < n; i++) xs.push((i + rr(R, -0.3, 0.3)) / (n - 1) * W);
    ctx.beginPath(); ctx.moveTo(-20, H + 2); ctx.lineTo(-20, baseY);
    for (let i = 0; i < n; i++) {
      const x = xs[i], h = rr(R, hMin, hMax), half = (W / (n - 1)) * rr(R, 0.5, 0.8);
      [[x - half, baseY], [x - half * 0.45, baseY - h * rr(R, 0.45, 0.6)], [x - half * 0.15, baseY - h * 0.85], [x, baseY - h], [x + half * 0.2, baseY - h * 0.8], [x + half * 0.5, baseY - h * rr(R, 0.4, 0.55)], [x + half, baseY]].forEach(p => ctx.lineTo(p[0], p[1]));
      tops.push([x, baseY - h, half]);
    }
    ctx.lineTo(W + 20, baseY); ctx.lineTo(W + 20, H + 2); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    if (snow) {
      tops.forEach(t => {
        const x = t[0], y = t[1], hw = t[2];
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + hw * 0.22, y + hw * 0.5); ctx.lineTo(x + hw * 0.08, y + hw * 0.42); ctx.lineTo(x - hw * 0.05, y + hw * 0.55); ctx.lineTo(x - hw * 0.18, y + hw * 0.4); ctx.lineTo(x - hw * 0.26, y + hw * 0.48); ctx.closePath();
        ctx.fillStyle = snow; ctx.fill();
      });
    }
    return tops;
  }
  function canopy(ctx, R, W, H, y, rMin, rMax, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let x = -rMax; x < W + rMax;) { const r = rr(R, rMin, rMax); ctx.moveTo(x + r, y); ctx.arc(x, y - rr(R, 0, r * 0.6), r, 0, TAU); x += r * rr(R, 0.9, 1.4); }
    ctx.fill();
    ctx.fillRect(-2, y, W + 4, H - y + 2);
  }
  function vine(ctx, R, x, len, col, sway) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, -2); ctx.bezierCurveTo(x + sway, len * 0.35, x - sway, len * 0.7, x + sway * 0.4, len); ctx.stroke();
    for (let t = 0.15; t < 1; t += 0.12) {
      const vx = x + sway * (3 * t * (1 - t) * (1 - t) - 3 * t * t * (1 - t) + 0.4 * t * t * t), vy = len * t;
      ellipse(ctx, vx + (R() < 0.5 ? -3 : 3), vy, 3.2, 1.6); ctx.fill();
    }
  }
  function obelisk(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    poly(ctx, [[x - w / 2, y + 2], [x - w * 0.36, y - h], [x, y - h - w * 0.55], [x + w * 0.36, y - h], [x + w / 2, y + 2]]); ctx.fill();
  }

  const BG = {};
  BG.moors = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#040309'], [0.4, '#130912'], [0.68, '#36101a'], [1, '#14060a']]);
    stars(ctx, R, W, H, 70, 0.5, 0.6);
    const m = Math.min(W, H);
    moon(ctx, R, W * 0.74, H * 0.13, m * 0.1, '#c8342a', '#ff2a1a', 0.28);
    cloudStreaks(ctx, R, W, H * 0.1, H * 0.2, '#07030a', 0.75, 6);
    const y1 = ridge(ctx, R, W, H, H * 0.6, H * 0.05, '#2c121a', 1.5);
    cloister(ctx, R, W * 0.06, y1(W * 0.2) + 6, W * 0.32, H * 0.07, '#2c121a', 4);
    ruinTower(ctx, R, W * 0.44, y1(W * 0.44) + 4, W * 0.07, H * 0.13, '#2c121a', '#ff4020');
    ruinTower(ctx, R, W * 0.86, y1(W * 0.86) + 4, W * 0.05, H * 0.09, '#2c121a', null);
    fogBand(ctx, W, H * 0.6, H * 0.05, '#6a2a34', 0.25);
    const y2 = ridge(ctx, R, W, H, H * 0.72, H * 0.04, '#170910', 1.2);
    [0.15, 0.58, 0.9].forEach(f => deadTree(ctx, R, W * f, y2(W * f), H * rr(R, 0.09, 0.13), '#170910'));
    graves(ctx, R, y2, W * 0.25, W * 0.5, 6, H * 0.022, '#170910');
    fogBand(ctx, W, H * 0.74, H * 0.05, '#5a2430', 0.22);
    const y3 = ridge(ctx, R, W, H, H * 0.87, H * 0.035, '#070308', 1);
    deadTree(ctx, R, W * 0.08, y3(W * 0.08), H * 0.24, '#070308');
    deadTree(ctx, R, W * 0.95, y3(W * 0.95), H * 0.17, '#070308');
    graves(ctx, R, y3, W * 0.3, W * 0.8, 5, H * 0.035, '#070308');
    fogBand(ctx, W, H * 0.92, H * 0.06, '#4a1a24', 0.25);
  };
  BG.desert = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#06040a'], [0.4, '#1a0e12'], [0.66, '#4e2412'], [1, '#1e0e08']]);
    stars(ctx, R, W, H, 50, 0.45, 0.5);
    const m = Math.min(W, H);
    glow(ctx, W * 0.3, H * 0.6, W * 0.75, '#ff7a28', 0.3);
    moon(ctx, R, W * 0.3, H * 0.57, m * 0.12, '#e09050', '#ff8a30', 0.2);
    cloudStreaks(ctx, R, W, H * 0.45, H * 0.56, '#1a0a08', 0.6, 5);
    const y1 = ridge(ctx, R, W, H, H * 0.62, H * 0.04, '#3a1c10', 0, 0.6);
    [[0.62, 0.11], [0.78, 0.07]].forEach(p => {
      const x = W * p[0], h = H * p[1], y = y1(x) + 3;
      poly(ctx, [[x - h * 1.1, y], [x, y - h], [x + h * 1.1, y]]); ctx.fillStyle = '#2e160c'; ctx.fill();
      poly(ctx, [[x, y - h], [x + h * 1.1, y], [x + h * 0.25, y]]); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    });
    fogBand(ctx, W, H * 0.63, H * 0.05, '#8a5a2a', 0.18);
    const y2 = ridge(ctx, R, W, H, H * 0.74, H * 0.045, '#1e0f08', 0, 0.7);
    obelisk(ctx, W * 0.14, y2(W * 0.14), W * 0.045, H * 0.16, '#1e0f08');
    obelisk(ctx, W * 0.24, y2(W * 0.24), W * 0.03, H * 0.09, '#1e0f08');
    obelisk(ctx, W * 0.84, y2(W * 0.84), W * 0.04, H * 0.13, '#1e0f08');
    ctx.fillStyle = '#1e0f08';
    [[0.46, 0.06], [0.52, 0.035], [0.58, 0.05]].forEach(p => { const x = W * p[0]; ctx.fillRect(x - W * 0.012, y2(x) - H * p[1], W * 0.024, H * p[1] + 4); });
    fogBand(ctx, W, H * 0.76, H * 0.05, '#7a4a20', 0.16);
    const y3 = ridge(ctx, R, W, H, H * 0.89, H * 0.04, '#080403', 0, 0.8);
    obelisk(ctx, W * 0.93, y3(W * 0.93), W * 0.06, H * 0.2, '#080403');
    fogBand(ctx, W, H * 0.93, H * 0.05, '#5a3418', 0.2);
  };
  BG.jungle = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#020605'], [0.45, '#071410'], [0.7, '#10281c'], [1, '#05100a']]);
    stars(ctx, R, W, H, 50, 0.4, 0.45, '#d8ffe0');
    const m = Math.min(W, H);
    moon(ctx, R, W * 0.22, H * 0.12, m * 0.075, '#b8dca8', '#7aff9a', 0.2);
    canopy(ctx, R, W, H, H * 0.62, W * 0.04, W * 0.09, '#11291b');
    const zx = W * 0.6, zb = H * 0.7, zw = W * 0.5, zh = H * 0.17, steps = 5;
    ctx.fillStyle = '#0c2015';
    for (let i = 0; i < steps; i++) { const w = zw * (1 - i / steps * 0.75), y = zb - zh * i / steps; ctx.fillRect(zx - w / 2, y - zh / steps - 1, w, zh / steps + 2); }
    ctx.fillRect(zx - zw * 0.09, zb - zh - zh * 0.12, zw * 0.18, zh * 0.14);
    ctx.fillRect(zx - zw * 0.03, zb - zh * 0.85, zw * 0.06, zh * 0.85);
    glow(ctx, zx, zb - zh - zh * 0.05, zw * 0.12, '#5aff8a', 0.35);
    ctx.fillStyle = 'rgba(120,255,150,0.5)'; ctx.fillRect(zx - zw * 0.025, zb - zh - zh * 0.07, zw * 0.05, zh * 0.08);
    for (let i = 0; i < 7; i++) vine(ctx, R, zx + rr(R, -zw * 0.35, zw * 0.35), zh * rr(R, 0.2, 0.6), '#081a10', 4);
    fogBand(ctx, W, H * 0.68, H * 0.05, '#3a7a5a', 0.2);
    canopy(ctx, R, W, H, H * 0.77, W * 0.05, W * 0.11, '#071810');
    const wy = H * 0.84;
    ctx.fillStyle = linGrad(ctx, 0, wy, 0, H, [[0, '#0c2a26'], [1, '#020806']]); ctx.fillRect(0, wy, W, H - wy);
    ctx.strokeStyle = 'rgba(140,255,200,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const y = wy + 3 + R() * (H - wy) * 0.8, x = R() * W, w = rr(R, 10, 60); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(180,230,170,0.12)'; ctx.fillRect(W * 0.2, wy + 4, m * 0.08, (H - wy) * 0.5);
    const leaf = (x, y, l, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l * 0.5, -l * 0.28, l, 0); ctx.quadraticCurveTo(l * 0.5, l * 0.28, 0, 0); ctx.fill(); ctx.restore(); };
    ctx.fillStyle = '#020805';
    for (let i = 0; i < 9; i++) leaf(-5, H * rr(R, 0.72, 1), W * rr(R, 0.15, 0.3), rr(R, -0.9, 0.2));
    for (let i = 0; i < 9; i++) leaf(W + 5, H * rr(R, 0.72, 1), W * rr(R, 0.15, 0.3), Math.PI + rr(R, -0.2, 0.9));
    for (let i = 0; i < 12; i++) vine(ctx, R, R() * W, H * rr(R, 0.05, 0.2), '#020805', rr(R, -8, 8));
    fogBand(ctx, W, H * 0.86, H * 0.05, '#2a6a4a', 0.15);
  };
  BG.hell = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#070101'], [0.4, '#1e0404'], [0.7, '#5a1004'], [1, '#7a2206']]);
    glow(ctx, W * 0.5, H * 1.02, Math.max(W, H) * 0.7, '#ff5010', 0.35);
    stars(ctx, R, W, H, 30, 0.4, 0.3, '#ffb080');
    cloudStreaks(ctx, R, W, H * 0.12, H * 0.45, '#2a0404', 0.6, 10);
    const y1 = ridge(ctx, R, W, H, H * 0.62, H * 0.07, '#3a0806', 10, 1.4);
    spikes(ctx, R, y1, W, 9, H * 0.05, H * 0.13, '#3a0806');
    fogBand(ctx, W, H * 0.63, H * 0.05, '#ff4a10', 0.12);
    const y2 = ridge(ctx, R, W, H, H * 0.75, H * 0.05, '#160202', 8, 1.6);
    spikes(ctx, R, y2, W, 12, H * 0.06, H * 0.17, '#160202');
    const ly = H * 0.86;
    ctx.fillStyle = linGrad(ctx, 0, ly - 6, 0, ly + 6, [[0, 'rgba(255,120,20,0)'], [0.5, 'rgba(255,140,30,0.85)'], [1, 'rgba(255,60,10,0)']]);
    ctx.fillRect(0, ly - 6, W, 12);
    glow(ctx, W * 0.3, ly, W * 0.3, '#ff6a10', 0.25); glow(ctx, W * 0.8, ly, W * 0.25, '#ff6a10', 0.2);
    const y3 = ridge(ctx, R, W, H, H * 0.9, H * 0.03, '#050101', 4, 1.2);
    ctx.strokeStyle = 'rgba(255,110,20,0.7)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
    for (let i = 0; i < 8; i++) { let x = R() * W, y = y3(x) + rr(R, 8, H * 0.08); ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 5; s++) { x += rr(R, -12, 12); y += rr(R, 2, 9); ctx.lineTo(x, y); } ctx.stroke(); }
    hangingChain(ctx, -10, H * 0.04, W * 0.42, -10, H * 0.12, W * 0.018, '#0a0101');
    hangingChain(ctx, W * 0.6, -10, W + 10, H * 0.1, H * 0.1, W * 0.018, '#0a0101');
    hangingChain(ctx, -10, H * 0.2, W * 0.25, -10, H * 0.06, W * 0.014, '#120202');
  };
  BG.frost = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#02040a'], [0.42, '#081428'], [0.7, '#17304e'], [1, '#08121e']]);
    stars(ctx, R, W, H, 110, 0.55, 0.7, '#e0ecff');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-10, H * (0.16 + i * 0.025));
      ctx.bezierCurveTo(W * 0.3, H * (0.06 + i * 0.02), W * 0.6, H * (0.28 + i * 0.01), W + 10, H * (0.12 + i * 0.03));
      ctx.lineWidth = H * 0.025; ctx.strokeStyle = i % 2 ? 'rgba(60,200,180,0.06)' : 'rgba(80,140,255,0.06)'; ctx.stroke();
    }
    ctx.restore();
    const m = Math.min(W, H);
    moon(ctx, R, W * 0.72, H * 0.12, m * 0.075, '#dce8ff', '#9ac0ff', 0.25);
    peaks(ctx, R, W, H, H * 0.62, 5, H * 0.12, H * 0.24, '#1c3250', '#5a7aa0');
    fogBand(ctx, W, H * 0.62, H * 0.05, '#8ab0d8', 0.14);
    const t2 = peaks(ctx, R, W, H, H * 0.74, 4, H * 0.08, H * 0.18, '#0d192c', '#3a5478');
    let best = t2[0]; t2.forEach(t => { if (t[0] > W * 0.1 && t[0] < W * 0.9 && t[1] < best[1]) best = t; });
    const sx = best[0], sy = best[1] + 4, sw = W * 0.035, sh = H * 0.14;
    ctx.fillStyle = '#0a1424';
    poly(ctx, [[sx - sw, sy], [sx - sw * 0.7, sy - sh * 0.75], [sx - sw * 0.9, sy - sh * 0.75], [sx, sy - sh * 1.25], [sx + sw * 0.9, sy - sh * 0.75], [sx + sw * 0.7, sy - sh * 0.75], [sx + sw, sy]]); ctx.fill();
    ctx.fillRect(sx - sw * 1.6, sy - sh * 0.42, sw * 0.5, sh * 0.42); ctx.fillRect(sx + sw * 1.1, sy - sh * 0.36, sw * 0.5, sh * 0.36);
    glow(ctx, sx, sy - sh * 0.55, sw * 3, '#7ae0ff', 0.4);
    ctx.fillStyle = 'rgba(170,240,255,0.85)'; ctx.fillRect(sx - sw * 0.15, sy - sh * 0.62, sw * 0.3, sh * 0.12);
    fogBand(ctx, W, H * 0.75, H * 0.05, '#7a9ac8', 0.14);
    const y3 = ridge(ctx, R, W, H, H * 0.87, H * 0.04, '#04080e', 3);
    ctx.strokeStyle = 'rgba(180,210,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 0; x <= W; x += 6) { const y = y3(x) + 1; if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    fogBand(ctx, W, H * 0.93, H * 0.06, '#6a8ab8', 0.16);
  };
  BG.abyss = function (ctx, W, H, R) {
    sky(ctx, W, H, [[0, '#010003'], [0.5, '#06020c'], [1, '#0e0618']]);
    const M = Math.max(W, H);
    glow(ctx, W * 0.3, H * 0.3, M * 0.45, '#5a1a9a', 0.22);
    glow(ctx, W * 0.75, H * 0.55, M * 0.4, '#8a1a7a', 0.13);
    glow(ctx, W * 0.5, H * 1.05, M * 0.55, '#6a20c0', 0.3);
    glow(ctx, W * 0.6, H * 0.2, M * 0.2, '#20a070', 0.06);
    stars(ctx, R, W, H, 150, 1, 0.5, '#e0c8ff');
    for (let i = 0; i < 7; i++) {
      const x = R() * W, y = H * rr(R, 0.15, 0.85), w = W * rr(R, 0.06, 0.2), h = w * rr(R, 0.6, 1.1);
      const pts = [[x - w / 2, y], [x + w / 2, y]];
      const n = 5;
      for (let s = 1; s < n; s++) pts.push([x + w / 2 - w * s / n + rr(R, -w * 0.06, w * 0.06), y + h * Math.sin(s / n * Math.PI) * rr(R, 0.5, 1)]);
      ctx.save(); ctx.shadowColor = 'rgba(160,80,255,0.6)'; ctx.shadowBlur = 10 * (ctx.getTransform ? ctx.getTransform().a : 1);
      poly(ctx, pts); ctx.fillStyle = '#07040e'; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(190,130,255,0.45)'; ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let x = W * 0.5, y = H * 0.35; ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) { x += rr(R, -10, 10); y += H * 0.035; ctx.lineTo(x, y); }
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(200,140,255,0.35)'; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(140,60,255,0.08)'; ctx.stroke();
    ctx.restore();
  };

  Art.themes = Object.keys(BG);
  Art.background = function (theme, W, H, dpr) {
    dpr = dpr || 1;
    if (!BG[theme]) theme = 'moors';
    const ck = 'bg|' + theme + '|' + W + '|' + H + '|' + dpr;
    const hit = cache.get(ck); if (hit) return hit;
    const c = canvas(W * dpr, H * dpr), ctx = c.getContext('2d');
    const img = overrideImg('bg-' + theme);
    if (img) drawCover(ctx, img, c.width, c.height);
    else {
      ctx.scale(dpr, dpr);
      try { BG[theme](ctx, W, H, rng(hashStr(theme) + 1)); }
      catch (e) { if (window.console) console.error('[Art] background ' + theme, e); }
      vignette(ctx, W, H, 0.75);
    }
    return cachePut(ck, c);
  };

  // =====================================================================
  // Title scene: blood moon, ruined spires, cliff, the huntress
  // =====================================================================
  function gothicSpire(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    poly(ctx, [[x - w / 2, y + 4], [x - w / 2, y - h * 0.55], [x - w * 0.3, y - h * 0.6], [x, y - h], [x + w * 0.3, y - h * 0.6], [x + w / 2, y - h * 0.55], [x + w / 2, y + 4]]); ctx.fill();
    [[-0.62, 0.42], [0.62, 0.42]].forEach(p => { const px = x + w * p[0]; poly(ctx, [[px - w * 0.12, y + 4], [px - w * 0.12, y - h * p[1] * 0.75], [px, y - h * p[1]], [px + w * 0.12, y - h * p[1] * 0.75], [px + w * 0.12, y + 4]]); ctx.fill(); });
  }
  // The huntress, in units: feet at (0,0), head top near y = -100, wind blowing to +x
  function huntress(ctx, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // cape (behind)
    poly(ctx, [[-9, -79], [8, -80], [16, -80], [30, -74], [47, -66], [42, -61], [50, -55], [41, -52], [46, -43], [36, -45], [33, -36], [26, -44], [15, -50], [9, -64]]); ctx.fill();
    // quiver on her back, javelins over the left shoulder (between head and spear)
    poly(ctx, [[-1, -60], [5, -62], [-9, -92], [-15, -89]]); ctx.fill();
    ctx.lineWidth = 1.5;
    [[-12, -90, -17, -113], [-13, -90, -21, -110], [-10, -90, -12, -115]].forEach(j => {
      ctx.beginPath(); ctx.moveTo(j[0], j[1]); ctx.lineTo(j[2], j[3]); ctx.stroke();
      const a = Math.atan2(j[3] - j[1], j[2] - j[0]);
      ctx.save(); ctx.translate(j[2], j[3]); ctx.rotate(a); poly(ctx, [[5, 0], [-1, -2], [-1, 2]]); ctx.fill(); ctx.restore();
    });
    // spear upright in her right hand, with a ribbon
    ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(-25, 3); ctx.lineTo(-25, -127); ctx.stroke();
    poly(ctx, [[-25, -150], [-29, -137], [-25, -126], [-21, -137]]); ctx.fill();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-29.5, -126); ctx.lineTo(-20.5, -126); ctx.stroke();
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-24, -124); ctx.quadraticCurveTo(-14, -125, -6, -118); ctx.moveTo(-24, -122); ctx.quadraticCurveTo(-15, -118, -9, -112); ctx.stroke();
    // legs
    poly(ctx, [[-9, -50], [-1, -50], [-6, -26], [-9, -4], [-6, 0], [-19, 0], [-17, -4], [-14, -27]]); ctx.fill();
    poly(ctx, [[1, -50], [9, -50], [10, -26], [13, -4], [19, 0], [7, 0], [7, -4], [4, -27]]); ctx.fill();
    // skirt of leather strips
    poly(ctx, [[-11, -57], [11, -57], [14, -44], [9, -40], [5, -44], [1, -39], [-3, -44], [-8, -40], [-13, -44]]); ctx.fill();
    // torso and pauldrons
    poly(ctx, [[-8, -57], [8, -57], [10, -66], [12.5, -79], [-12.5, -79], [-10, -66]]); ctx.fill();
    ellipse(ctx, -12, -77, 5, 4); ctx.fill(); ellipse(ctx, 12, -77, 5, 4); ctx.fill();
    // arms
    ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(-12, -76); ctx.lineTo(-21, -62); ctx.lineTo(-25, -71); ctx.stroke();
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(12, -76); ctx.lineTo(16, -63); ctx.lineTo(11, -55); ctx.stroke();
    // neck, head, ponytail, headband tail
    ctx.fillRect(-2.5, -85, 5, 7);
    circle(ctx, 0, -89, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -95); ctx.bezierCurveTo(14, -99, 24, -93, 40, -97); ctx.bezierCurveTo(31, -89, 16, -86, 5, -86); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(5, -91); ctx.quadraticCurveTo(14, -88, 20, -83); ctx.stroke();
  }
  function drawTitle(ctx, W, H, dpr, R) {
    sky(ctx, W, H, [[0, '#090204'], [0.28, '#240408'], [0.5, '#5e0c10'], [0.66, '#3a060a'], [1, '#080203']]);
    stars(ctx, R, W, H, 40, 0.3, 0.35, '#ffc8c0');
    const mx = W * 0.5, my = H * 0.47, mr = Math.min(W * 0.42, H * 0.2);
    glow(ctx, mx, my, mr * 3.4, '#ff2010', 0.35);
    moon(ctx, R, mx, my, mr, '#d42c1e', '#ff3a1a', 0);
    cloudStreaks(ctx, R, W, my - mr * 0.1, my + mr * 0.7, '#1a0306', 0.85, 6);
    // crows
    ctx.strokeStyle = '#0a0204'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = W * rr(R, 0.15, 0.85), y = H * rr(R, 0.3, 0.42), s = rr(R, 4, 8);
      ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.3); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.3); ctx.stroke();
    }
    // far spires and ruins
    const hz = H * 0.66;
    const y1 = ridge(ctx, R, W, H, hz, H * 0.025, '#2a0608', 2);
    [[0.08, 0.05, 0.14], [0.17, 0.035, 0.09], [0.82, 0.06, 0.17], [0.93, 0.04, 0.1], [0.3, 0.03, 0.07], [0.7, 0.03, 0.08]].forEach(p => gothicSpire(ctx, W * p[0], y1(W * p[0]), W * p[1], H * p[2], '#2a0608'));
    ruinTower(ctx, R, W * 0.62, y1(W * 0.62), W * 0.045, H * 0.06, '#2a0608', '#ff4020');
    fogBand(ctx, W, hz, H * 0.03, '#8a1a1a', 0.3);
    // the cliff
    const ct = H * 0.665, hx = W * 0.5;
    const top = [[W * 0.37, H * 0.675], [hx - W * 0.09, ct + 1], [hx - W * 0.03, ct - 1], [hx + W * 0.06, ct], [hx + W * 0.1, ct + 3]];
    ctx.fillStyle = '#050102';
    ctx.beginPath(); ctx.moveTo(-5, H + 2); ctx.lineTo(-5, H * 0.72);
    ctx.lineTo(W * 0.12, H * 0.715); ctx.lineTo(W * 0.22, H * 0.7); ctx.lineTo(W * 0.3, H * 0.69);
    top.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(hx + W * 0.13, ct + H * 0.02); ctx.lineTo(hx + W * 0.16, ct + H * 0.035); ctx.lineTo(hx + W * 0.2, ct + H * 0.07);
    ctx.lineTo(hx + W * 0.27, ct + H * 0.09); ctx.lineTo(W * 0.85, H * 0.78); ctx.lineTo(W + 5, H * 0.8); ctx.lineTo(W + 5, H + 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,60,40,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); top.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    deadTree(ctx, R, W * 0.16, H * 0.712, H * 0.11, '#050102');
    // the huntress, with a red rim light from the moon behind her
    const hh = Math.min(H * 0.15, W * 0.32), s = hh / 100;
    ctx.save(); ctx.translate(hx, ct + 0.5); ctx.scale(s, s);
    ctx.save(); ctx.shadowColor = 'rgba(255,40,16,0.7)'; ctx.shadowBlur = 4 * dpr;
    ctx.translate(1 / s, -0.8 / s); huntress(ctx, '#ff5a3a');
    ctx.translate(-2 / s, 0); huntress(ctx, '#c82010');
    ctx.restore();
    huntress(ctx, '#040102');
    ctx.restore();
    // low fog where the buttons sit
    fogBand(ctx, W, H * 0.8, H * 0.05, '#6a1018', 0.3);
    fogBand(ctx, W, H * 0.92, H * 0.06, '#4a0a10', 0.3);
    vignette(ctx, W, H, 0.7);
  }
  Art.title = function (W, H, dpr) {
    dpr = dpr || 1;
    const ck = 'title|' + W + '|' + H + '|' + dpr;
    const hit = cache.get(ck); if (hit) return hit;
    const c = canvas(W * dpr, H * dpr), ctx = c.getContext('2d');
    const img = overrideImg('title');
    if (img) drawCover(ctx, img, c.width, c.height);
    else {
      ctx.scale(dpr, dpr);
      try { drawTitle(ctx, W, H, dpr, rng(9071)); }
      catch (e) { if (window.console) console.error('[Art] title', e); }
    }
    return cachePut(ck, c);
  };

  // =====================================================================
  // Ambient particles (no shadowBlur per frame; glows are pre-drawn sprites)
  // =====================================================================
  const sprites = {};
  function glowSprite(col) {
    if (sprites[col]) return sprites[col];
    const c = canvas(32, 32), x = c.getContext('2d');
    x.fillStyle = radGrad(x, 16, 16, 0, 16, [[0, 'rgba(255,255,255,1)'], [0.18, rgba(col, 1)], [0.45, rgba(col, 0.35)], [1, rgba(col, 0)]]);
    x.fillRect(0, 0, 32, 32);
    return (sprites[col] = c);
  }
  function fogSprite(col) {
    const key = 'fog' + col;
    if (sprites[key]) return sprites[key];
    const c = canvas(64, 64), x = c.getContext('2d');
    x.fillStyle = radGrad(x, 32, 32, 0, 32, [[0, rgba(col, 1)], [0.5, rgba(col, 0.45)], [1, rgba(col, 0)]]);
    x.fillRect(0, 0, 64, 64);
    return (sprites[key] = c);
  }
  // kind: flake (tumbling ash), dot (snow / dust), glow (sprite, additive)
  const AMB = {
    moors: { n: 60, kind: 'flake', cols: ['#8a8088', '#6a6068', '#a89aa0'], size: [1.2, 3], vx: [-10, 4], vy: [10, 26], sway: 10, a: [0.25, 0.6] },
    desert: { n: 80, kind: 'dot', cols: ['#c8a070', '#a87e50'], size: [0.6, 1.8], vx: [40, 110], vy: [-4, 6], sway: 6, a: [0.15, 0.45] },
    jungle: { n: 40, kind: 'glow', cols: ['#a0ff6a', '#6affb0'], size: [2.5, 5.5], vx: [-5, 5], vy: [-14, -4], sway: 12, a: [0.35, 0.8], pulse: 1 },
    hell: { n: 70, kind: 'glow', cols: ['#ff7a20', '#ffaa30', '#ff4a10'], size: [1.6, 3.8], vx: [-10, 10], vy: [-80, -30], sway: 18, a: [0.5, 1], fadeTop: 1, flicker: 1 },
    frost: { n: 90, kind: 'dot', cols: ['#e8f0ff', '#c8dcff'], size: [0.8, 2.6], vx: [-6, 6], vy: [18, 55], sway: 14, a: [0.4, 0.9], sizeSpeed: 1 },
    abyss: { n: 55, kind: 'glow', cols: ['#b060ff', '#b060ff', '#d080ff', '#60ffa0'], size: [1.8, 4], vx: [-6, 6], vy: [-25, -8], sway: 10, a: [0.35, 0.85], fadeTop: 1, pulse: 1 },
    title: { n: 60, kind: 'glow', cols: ['#ff5020', '#ff8a30', '#ff3010'], size: [1.6, 3.6], vx: [-6, 14], vy: [-55, -20], sway: 16, a: [0.45, 1], fadeTop: 1, flicker: 1, fog: '#8a1a22' }
  };
  function Ambient(theme) {
    this.theme = AMB[theme] ? theme : 'moors';
    this.cfg = AMB[this.theme];
    this.p = []; this.fog = [];
    this.W = 0; this.H = 0; this.t = 0;
    this.R = rng(hashStr(this.theme) + 3);
  }
  Ambient.prototype.spawn = function (p, initial) {
    const c = this.cfg, R = this.R, W = this.W, H = this.H;
    p.vx = rr(R, c.vx[0], c.vx[1]);
    p.vy = rr(R, c.vy[0], c.vy[1]);
    p.s = rr(R, c.size[0], c.size[1]);
    if (c.sizeSpeed) p.vy *= 0.5 + (p.s - c.size[0]) / (c.size[1] - c.size[0]);
    p.a = rr(R, c.a[0], c.a[1]);
    p.ph = R() * TAU; p.fr = rr(R, 0.6, 1.6);
    p.rot = R() * TAU; p.vr = rr(R, -3, 3);
    p.col = c.cols[Math.floor(R() * c.cols.length)];
    if (initial) { p.x = R() * W; p.y = R() * H; }
    else if (c.vx[0] > 20) { p.x = -10; p.y = R() * H; }
    else if (p.vy > 0) { p.x = R() * W; p.y = -10; }
    else { p.x = R() * W; p.y = H + 10; }
  };
  Ambient.prototype.update = function (dt, W, H) {
    dt = Math.min(dt || 0, 0.1);
    if (W !== this.W || H !== this.H) {
      this.W = W; this.H = H; this.p = [];
      for (let i = 0; i < this.cfg.n; i++) { const p = {}; this.spawn(p, true); this.p.push(p); }
      this.fog = [];
      if (this.cfg.fog) for (let i = 0; i < 7; i++) this.fog.push({ x: this.R() * W, y: H * rr(this.R, 0.68, 1), w: W * rr(this.R, 0.5, 0.9), h: H * rr(this.R, 0.06, 0.12), v: rr(this.R, 4, 12) * (this.R() < 0.5 ? -1 : 1), a: rr(this.R, 0.12, 0.22) });
    }
    this.t += dt;
    const t = this.t, sw = this.cfg.sway;
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      p.x += (p.vx + Math.sin(t * p.fr + p.ph) * sw) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 12 || p.y < -12 || p.x > W + 12 || p.x < -12) this.spawn(p, false);
    }
    for (let i = 0; i < this.fog.length; i++) {
      const f = this.fog[i]; f.x += f.v * dt;
      if (f.x > W + f.w / 2) f.x = -f.w / 2; else if (f.x < -f.w / 2) f.x = W + f.w / 2;
    }
  };
  Ambient.prototype.draw = function (ctx) {
    const c = this.cfg, t = this.t, H = this.H;
    ctx.save();
    if (this.fog.length) {
      const fs = fogSprite(c.fog);
      for (let i = 0; i < this.fog.length; i++) { const f = this.fog[i]; ctx.globalAlpha = f.a * (0.8 + 0.2 * Math.sin(t * 0.3 + i)); ctx.drawImage(fs, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h); }
    }
    if (c.kind === 'glow') ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      let a = p.a;
      if (c.pulse) a *= 0.55 + 0.45 * Math.sin(t * 2 * p.fr + p.ph);
      if (c.flicker) a *= 0.75 + 0.25 * Math.sin(t * 13 * p.fr + p.ph);
      if (c.fadeTop) a *= G.clamp(p.y / (H * 0.45), 0, 1);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      if (c.kind === 'glow') {
        const r = p.s * 3;
        ctx.drawImage(glowSprite(p.col), p.x - r, p.y - r, r * 2, r * 2);
      } else if (c.kind === 'flake') {
        ctx.fillStyle = p.col;
        const w = p.s * Math.abs(Math.cos(p.rot)) + 0.4, h = p.s * 0.8;
        ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
      } else {
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.5 + 0.3, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  };
  Art.Ambient = Ambient;

  Art.preload();
})(window.G);
