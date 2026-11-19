/* Runes of Ruin - audio.js
 * Everything is synthesized with Web Audio: no files, no libraries.
 * API: G.Audio.unlock() / play(name, opts) / setSound(on) / setMusic(on) / music(theme) /
 *      stopMusic() / suspend() / resume() / sfxVol / musicVol (live properties, 0..1).
 * Classic script, ES2017, safe on iOS Safari 15+. play() never throws.
 */
window.G = window.G || {};
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- state
  let ctx = null;
  let master, comp, sfxBus, sfxWet, wetSend, musicBus, musicRev, reverbIn, noiseBuf;
  let sfxOn = true, musicOn = true;
  let sfxVolume = 0.8, musicVolume = 0.35;
  let userSusp = false;      // page hidden / suspend() called
  let lastUnlock = 0;        // performance.now() of the last unlock() call
  let live = 0;              // oscillators + noise sources currently alive (debug / leak check)
  let wantTheme = null;      // theme the game asked for (kept while music is off or locked)
  let sess = null;           // running music session
  const lastPlayed = {};     // name -> performance.now() of last accepted play
  let recent = [];           // timestamps of recently accepted sounds (voice cap)
  const warned = {};         // sounds that already logged a failure

  const BELL = [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.22, 0.35], [8.93, 0.1, 0.2]];
  const GLASS = [[1, 1, 1], [2.01, 0.3, 0.6], [3.0, 0.4, 0.45], [4.17, 0.15, 0.3]];
  const PLUCK = [[1, 1, 1], [2, 0.4, 0.5], [3, 0.2, 0.3]];
  const WOOD = [[1, 1, 1], [1.58, 0.3, 0.5]];
  const GONG = [[1, 1, 1], [1.5, 0.5, 0.8], [2.04, 0.6, 0.7], [2.76, 0.4, 0.5], [4.1, 0.25, 0.35], [5.6, 0.15, 0.25]];
  const METAL = [[1, 1, 1], [2.32, 0.6, 0.6], [4.25, 0.35, 0.4], [6.63, 0.2, 0.25]];

  const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

  function rr(a, b) { return a + Math.random() * (b - a); }
  function ri(a, b) { return Math.floor(rr(a, b + 1)); }
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------------------------------------------------------------- graph
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 1;
    comp.connect(master); master.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    sfxWet = ctx.createGain(); sfxWet.connect(sfxBus);        // bells etc: dry + reverb send
    wetSend = ctx.createGain(); sfxWet.connect(wetSend);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    musicRev = ctx.createGain(); musicRev.gain.value = 0.5; musicBus.connect(musicRev);

    // one shared reverb: dark synthetic impulse, built once
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.4);
    const ir = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let y = 0;
      for (let i = 0; i < len; i++) {
        y = y * 0.62 + (Math.random() * 2 - 1) * 0.38;
        d[i] = y * Math.pow(1 - i / len, 2.6);
      }
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    reverbIn = ctx.createGain();
    reverbIn.connect(conv); conv.connect(revOut); revOut.connect(comp);
    wetSend.connect(reverbIn); musicRev.connect(reverbIn);

    // one shared noise buffer (3 s)
    noiseBuf = ctx.createBuffer(1, Math.floor(sr * 3), sr);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    applyVolumes(true);
    try { ctx.onstatechange = onState; } catch (e) { /* ignore */ }
    return true;
  }

  function applyVolumes(instant) {
    if (!ctx) return;
    const t = ctx.currentTime, tc = instant ? 0.001 : 0.05;
    const sv = sfxOn ? sfxVolume : 0;
    sfxBus.gain.setTargetAtTime(sv, t, tc);
    wetSend.gain.setTargetAtTime(0.4, t, tc);
    musicBus.gain.setTargetAtTime(musicOn ? musicVolume : 0, t, instant ? 0.001 : 0.4);
  }

  function onState() {
    if (ctx && ctx.state === 'running') { startMusicIfWanted(); }
  }

  // ---------------------------------------------------------------- building blocks
  // Oscillator with envelope. o: {a, dest, det, f:[type,freq,q]}
  function tone(type, f0, f1, t, dur, vol, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (o.det) osc.detune.value = o.det;
    const a = Math.min(o.a || 0.004, dur * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let flt = null;
    if (o.f) {
      flt = ctx.createBiquadFilter(); flt.type = o.f[0]; flt.frequency.value = o.f[1]; flt.Q.value = o.f[2] || 1;
      osc.connect(flt); flt.connect(g);
    } else osc.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
    live++;
    osc.onended = function () {
      live--;
      try { osc.disconnect(); g.disconnect(); if (flt) flt.disconnect(); } catch (e) { /* ignore */ }
    };
  }

  // Filtered noise burst. o: {type, f0, f1, q, a, dest}
  function noise(t, dur, vol, o) {
    o = o || {};
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q || 1;
    const a = Math.min(o.a || 0.004, dur * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * Math.max(0.1, noiseBuf.duration - dur - 0.2)); src.stop(t + dur + 0.05);
    live++;
    src.onended = function () { live--; try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
  }

  // Inharmonic bell from partials [ratio, volume, durationScale]
  function bell(f, t, vol, dur, dest, parts) {
    parts = parts || BELL;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (f * p[0] < 11000) tone('sine', f * p[0], 0, t, dur * p[2], vol * p[1], { dest: dest, a: 0.003 });
    }
  }

  // Slightly rough brass/reed: two detuned saws through a swept lowpass
  function brass(f, t, dur, vol, dest) {
    for (let k = -1; k <= 1; k += 2) {
      const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = f; osc.detune.value = k * 7;
      lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.linearRampToValueAtTime(1700, t + dur * 0.35);
      lp.frequency.linearRampToValueAtTime(700, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.06);
      g.gain.setValueAtTime(vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(lp); lp.connect(g); g.connect(dest || sfxBus);
      osc.start(t); osc.stop(t + dur + 0.05);
      live++;
      osc.onended = function () { live--; try { osc.disconnect(); lp.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
    }
  }

  // ---------------------------------------------------------------- sound effects
  const SFX = {
    swap: function (t) {
      noise(t, 0.17, 0.2, { f0: 500, f1: 1800, q: 1.2, a: 0.06 });
    },
    bad: function (t) {
      tone('sine', 125, 55, t, 0.18, 0.4);
      noise(t, 0.07, 0.18, { type: 'lowpass', f0: 500 });
    },
    match: function (t, o) {
      const n = Math.max(1, Math.min(8, Math.floor((o && o.n) || 1)));
      const i = n - 1;
      const m = 62 + PHRYGIAN[i % 7] + 12 * Math.floor(i / 7);       // D phrygian climbing from D4
      const f = mf(m) * Math.pow(2, rr(-4, 4) / 1200);
      const dur = 0.9 + n * 0.06;
      bell(f, t, 0.2, dur, sfxWet);
      if (n >= 3) bell(f * 1.4983, t + 0.012, 0.07, dur * 0.8, sfxWet, GLASS);   // fifth
      if (n >= 6) bell(f * 0.5, t, 0.1, dur, sfxWet);                            // octave below
      noise(t, 0.015, 0.08, { type: 'lowpass', f0: 3200 });
    },
    crack: function (t) {
      const k = rr(0.85, 1.2);
      noise(t, 0.05, 0.3, { f0: 2200 * k, q: 1.5 });
      tone('triangle', 320 * k, 130 * k, t, 0.09, 0.2);
    },
    bonebreak: function (t) {
      for (let i = 0; i < 3; i++) {
        const k = rr(0.8, 1.25), ti = t + i * 0.04;
        noise(ti, 0.05, 0.3, { type: 'highpass', f0: 1500 * k });
        tone('triangle', 260 * k, 100, ti, 0.1, 0.15);
      }
      tone('sine', 95, 45, t, 0.22, 0.32);
      for (let j = 0; j < 5; j++) noise(t + 0.13 + j * rr(0.03, 0.06), 0.03, 0.07, { f0: rr(2500, 4000), q: 3 });
    },
    chain: function (t) {
      for (let i = 0; i < 4; i++) {
        const ti = t + i * 0.045, f = rr(2400, 3800);
        bell(f, ti, 0.1, 0.16, sfxBus, [[1, 1, 1], [2.4, 0.6, 0.6], [3.9, 0.3, 0.4]]);
        noise(ti, 0.02, 0.1, { f0: 5000, q: 6 });
      }
      noise(t + 0.2, 0.07, 0.35, { type: 'highpass', f0: 1800 });
      tone('sine', 200, 80, t + 0.2, 0.1, 0.25);
    },
    ground: function (t) {
      noise(t, 0.95, 0.22, { f0: 1200, f1: 300, q: 0.8, a: 0.22 });
      tone('sine', 150, 60, t, 0.95, 0.2, { a: 0.2 });
    },
    javelin: function (t) {
      noise(t, 0.28, 0.28, { f0: 2800, f1: 700, q: 4, a: 0.08 });
      tone('sine', 1800, 500, t, 0.22, 0.05);
      tone('sine', 160, 70, t + 0.12, 0.1, 0.15);
    },
    // a boss attacks [S07]: low growl over rumbling noise
    roar: function (t) {
      tone('sawtooth', 95, 52, t, 0.75, 0.2, { a: 0.06, f: ['lowpass', 520, 2] });
      tone('sawtooth', 98, 50, t + 0.02, 0.75, 0.16, { a: 0.06, det: 25, f: ['lowpass', 420, 2] });
      tone('square', 47, 38, t, 0.8, 0.08, { a: 0.08, f: ['lowpass', 200, 1] });
      noise(t, 0.85, 0.22, { type: 'bandpass', f0: 420, f1: 160, q: 1.2, a: 0.08 });
    },
    bomb: function (t) {
      noise(t, 0.9, 0.5, { type: 'lowpass', f0: 3000, f1: 120, q: 0.7 });
      tone('sine', 110, 28, t, 0.7, 0.55);
      noise(t + 0.03, 0.5, 0.15, { f0: 800, q: 0.8 });
      noise(t, 1.4, 0.22, { type: 'lowpass', f0: 200, a: 0.1 });
    },
    raven: function (t) {
      function caw(ti, f0, f1, d) {
        tone('sawtooth', f0, f1, ti, d, 0.13, { a: 0.012, f: ['bandpass', 1100, 2.5] });
        tone('sawtooth', f0, f1, ti, d, 0.13, { a: 0.012, det: 30, f: ['bandpass', 1100, 2.5] });
        noise(ti, d * 0.8, 0.1, { f0: 1800, q: 1.5, a: 0.015 });
      }
      caw(t, 620, 380, 0.2);
      caw(t + 0.25, 560, 330, 0.25);
    },
    chaos: function (t) {
      const am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      am.gain.value = 0.5; lfo.frequency.value = rr(11, 15); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(am.gain); am.connect(sfxWet);
      lfo.start(t); lfo.stop(t + 1.2); live++;
      lfo.onended = function () { live--; try { lfo.disconnect(); lg.disconnect(); am.disconnect(); } catch (e) { /* ignore */ } };
      const fs = [660, 891, 1180, 1760];
      for (let i = 0; i < fs.length; i++) tone('sine', fs[i], fs[i] * 1.5, t, 1.0, 0.07, { a: 0.25, dest: am });
      tone('sine', 466, 330, t, 1.0, 0.08, { a: 0.3 });
    },
    beam: function (t) {
      for (let i = 0; i < 7; i++) noise(t + rr(0, 0.25), rr(0.02, 0.04), 0.14, { type: 'highpass', f0: 2500 });
      tone('sawtooth', 140, 60, t, 0.26, 0.09, { f: ['lowpass', 600, 1] });
    },
    forge: function (t) {
      bell(523, t, 0.22, 0.9, sfxWet, METAL);
      noise(t, 0.04, 0.2, { type: 'highpass', f0: 3000 });
      tone('sine', 120, 60, t, 0.15, 0.25);
    },
    trigger: function (t) {
      tone('sine', 260, 70, t, 0.14, 0.35);
      noise(t, 0.1, 0.2, { type: 'lowpass', f0: 1500, f1: 300 });
    },
    land: function (t) {
      tone('sine', 150, 70, t, 0.07, 0.07, { a: 0.002 });
    },
    collect: function (t) {
      bell(880, t, 0.13, 0.6, sfxWet, [[1, 1, 1], [2.76, 0.3, 0.4]]);
      bell(1320, t + 0.07, 0.08, 0.5, sfxWet, [[1, 1, 1], [2.76, 0.3, 0.4]]);
    },
    combo: function (t) {
      bell(58, t, 0.32, 2.8, sfxWet, GONG);
      noise(t, 1.2, 0.12, { type: 'lowpass', f0: 400, a: 0.4 });
      tone('sine', 40, 30, t, 1.6, 0.3);
    },
    shuffle: function (t) {
      for (let i = 0; i < 6; i++) noise(t + i * 0.06, 0.12, 0.12, { f0: 600 + i * 200, f1: (600 + i * 200) * 1.8, q: 1.1, a: 0.04 });
      noise(t, 0.4, 0.1, { type: 'lowpass', f0: 250 });
    },
    win: function (t) {
      const ph = [[62, 0], [65, 0.25], [69, 0.5]];
      for (let i = 0; i < ph.length; i++) brass(mf(ph[i][0]), t + ph[i][1], 0.32, 0.1, sfxWet);
      brass(mf(74), t + 0.78, 1.5, 0.11, sfxWet);
      bell(mf(74), t + 0.78, 0.18, 2.4, sfxWet);
      bell(mf(81), t + 1.0, 0.12, 2.2, sfxWet, GLASS);
      const chord = [50, 57, 65];
      for (let i = 0; i < chord.length; i++) brass(mf(chord[i]), t + 0.78, 1.8, 0.07, sfxWet);
      bell(58, t + 0.78, 0.22, 2.8, sfxWet, GONG);
    },
    lose: function (t) {
      const ns = [[57, 0], [55, 0.45], [53, 0.9], [50, 1.35]];
      for (let i = 0; i < ns.length; i++) {
        const d = i === 3 ? 2.2 : 0.55;
        tone('sawtooth', mf(ns[i][0]), mf(ns[i][0]) * 0.985, t + ns[i][1], d, 0.12, { a: 0.05, f: ['lowpass', 520, 1] });
        tone('sawtooth', mf(ns[i][0]), mf(ns[i][0]) * 0.985, t + ns[i][1], d, 0.1, { a: 0.05, det: 9, f: ['lowpass', 520, 1] });
      }
      bell(55, t + 1.35, 0.25, 3, sfxWet, GONG);
      noise(t + 1.0, 1.6, 0.1, { f0: 700, f1: 200, q: 0.7, a: 0.5 });
    },
    click: function (t) {
      tone('sine', 700, 450, t, 0.05, 0.12);
      noise(t, 0.012, 0.05, { type: 'highpass', f0: 2500 });
    },
    coin: function (t) {
      tone('sine', 1568, 0, t, 0.4, 0.13);
      tone('sine', 2349, 0, t + 0.06, 0.45, 0.1);
      noise(t, 0.02, 0.06, { type: 'highpass', f0: 6000 });
    },
    lowmoves: function (t) {
      for (let i = 0; i < 2; i++) {
        bell(147, t + i * 0.7, 0.3, 2.2, sfxWet);
        noise(t + i * 0.7, 0.05, 0.1, { type: 'lowpass', f0: 600 });
      }
    }
  };

  // name -> min gap ms, priority (0 essential, 1 normal, 2 droppable when busy)
  const META = {
    swap: [70, 2], bad: [150, 0], match: [55, 1], crack: [50, 2], bonebreak: [70, 1], chain: [80, 2],
    ground: [100, 2], javelin: [70, 1], bomb: [90, 0], raven: [200, 1], chaos: [120, 1], beam: [60, 2],
    forge: [100, 0], trigger: [60, 0], land: [35, 2], collect: [45, 2], combo: [250, 0], shuffle: [400, 0],
    win: [800, 0], lose: [800, 0], click: [40, 0], coin: [45, 2], lowmoves: [500, 0]
  };

  function canSound() {
    if (!ctx || userSusp) return false;
    if (ctx.state === 'running') return true;
    // right after unlock() the context is still resuming: let the first sound queue
    return ctx.state === 'suspended' && performance.now() - lastUnlock < 1500;
  }

  // ---------------------------------------------------------------- music
  const SCALES = {
    phr: PHRYGIAN,
    aeo: [0, 2, 3, 5, 7, 8, 10],
    dbl: [0, 1, 4, 5, 7, 8, 11],
    hell: [0, 1, 3, 6, 7, 8, 11]
  };

  const THEMES = {
    title: {
      root: 38, scale: 'phr', dvol: 0.1, cut: 380, lfo: 0.05,
      drone: [{ s: 0, type: 'sawtooth', v: 0.5 }, { s: 7, type: 'sawtooth', v: 0.25 }, { s: -12, type: 'sine', v: 0.6 }],
      noise: { type: 'bandpass', f: 450, q: 0.7, vol: 0.05, lfo: 0.06, depth: 200 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 2, 4, 0, 5], n: 3, lp: 900, formant: true, vol: 0.035, every: [8, 14], dur: [8, 12] },
      bell: { kind: 'bell', oct: 36, vol: 0.06, every: [6, 12], deg: [0, 2, 3, 4, 6] }
    },
    moors: {
      root: 33, scale: 'aeo', dvol: 0.1, cut: 320, lfo: 0.04,
      drone: [{ s: 0, type: 'sawtooth', v: 0.45 }, { s: 7, type: 'triangle', v: 0.4 }, { s: -12, type: 'sine', v: 0.6 }],
      noise: { type: 'bandpass', f: 380, q: 0.9, vol: 0.09, lfo: 0.05, depth: 220 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 2, 4, 6], n: 2, lp: 700, formant: true, vol: 0.03, every: [12, 20], dur: [9, 13] },
      bell: { kind: 'bell', oct: 36, vol: 0.05, every: [9, 18], deg: [0, 2, 4, 6] }
    },
    desert: {
      root: 40, scale: 'dbl', dvol: 0.09, cut: 520, lfo: 0.06,
      drone: [{ s: 0, type: 'sawtooth', v: 0.4 }, { s: 12, type: 'triangle', v: 0.3 }, { s: 7, type: 'sawtooth', v: 0.25 }],
      noise: { type: 'bandpass', f: 900, q: 1.5, vol: 0.06, lfo: 0.09, depth: 450 },
      pad: { type: 'sawtooth', oct: 12, deg: [0, 2, 4], n: 2, lp: 1100, formant: false, vol: 0.025, every: [14, 22], dur: [8, 12] },
      bell: { kind: 'pluck', oct: 24, vol: 0.05, every: [3, 7], deg: [0, 1, 2, 3, 4, 5, 6] }
    },
    jungle: {
      root: 31, scale: 'phr', dvol: 0.09, cut: 300, lfo: 0.07,
      drone: [{ s: 0, type: 'sine', v: 0.7 }, { s: 7, type: 'triangle', v: 0.35 }, { s: 12, type: 'sine', v: 0.3 }],
      noise: { type: 'highpass', f: 3500, q: 0.7, vol: 0.03, lfo: 0.13, depth: 800 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 1, 4], n: 2, lp: 800, formant: true, vol: 0.025, every: [12, 18], dur: [8, 12] },
      bell: { kind: 'wood', oct: 36, vol: 0.06, every: [5, 10], deg: [0, 3, 4] },
      extra: ['insects', 'drip']
    },
    hell: {
      root: 36, scale: 'hell', dvol: 0.12, cut: 300, lfo: 0.2,
      drone: [{ s: 0, type: 'sawtooth', v: 0.5 }, { s: 6, type: 'sawtooth', v: 0.3 }, { s: 1, type: 'sawtooth', v: 0.2 }],
      noise: { type: 'lowpass', f: 600, q: 0.7, vol: 0.09, lfo: 0.17, depth: 250 },
      pad: { type: 'sawtooth', oct: 12, deg: [0, 1, 3, 4], n: 3, lp: 800, formant: true, vol: 0.035, every: [7, 12], dur: [7, 11] },
      bell: { kind: 'toll', oct: 24, vol: 0.07, every: [8, 16], deg: [0, 3, 4] },
      extra: ['crackle']
    },
    frost: {
      root: 42, scale: 'aeo', dvol: 0.08, cut: 700, lfo: 0.05,
      drone: [{ s: 0, type: 'sine', v: 0.6 }, { s: 7, type: 'sine', v: 0.4 }, { s: 12, type: 'triangle', v: 0.3 }],
      noise: { type: 'bandpass', f: 1800, q: 1.2, vol: 0.07, lfo: 0.11, depth: 700 },
      pad: { type: 'triangle', oct: 24, deg: [0, 2, 4, 6], n: 3, lp: 2200, formant: false, vol: 0.04, every: [8, 14], dur: [8, 12] },
      bell: { kind: 'glass', oct: 36, vol: 0.055, every: [4, 9], deg: [0, 2, 3, 4, 6] }
    },
    // Act VI plague city and Act VII storm citadel [S09]
    city: {
      root: 35, scale: 'phr', dvol: 0.1, cut: 360, lfo: 0.04,
      drone: [{ s: 0, type: 'sawtooth', v: 0.45 }, { s: 5, type: 'triangle', v: 0.35 }, { s: -12, type: 'sine', v: 0.6 }],
      noise: { type: 'bandpass', f: 500, q: 0.8, vol: 0.07, lfo: 0.04, depth: 200 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 1, 3, 5], n: 3, lp: 750, formant: true, vol: 0.035, every: [10, 16], dur: [9, 13] },
      bell: { kind: 'toll', oct: 24, vol: 0.075, every: [6, 12], deg: [0, 4] }
    },
    storm: {
      root: 30, scale: 'aeo', dvol: 0.11, cut: 420, lfo: 0.09,
      drone: [{ s: 0, type: 'sawtooth', v: 0.5 }, { s: 7, type: 'sawtooth', v: 0.3 }, { s: -12, type: 'sine', v: 0.7 }],
      noise: { type: 'lowpass', f: 900, q: 0.6, vol: 0.12, lfo: 0.12, depth: 500 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 2, 3, 6], n: 3, lp: 1000, formant: true, vol: 0.035, every: [8, 14], dur: [8, 12] },
      bell: { kind: 'bell', oct: 36, vol: 0.05, every: [7, 14], deg: [0, 3, 4] },
      extra: ['drum']
    },
    abyss: {
      root: 28, scale: 'hell', dvol: 0.13, cut: 220, lfo: 0.03,
      drone: [{ s: 0, type: 'sawtooth', v: 0.45 }, { s: 1, type: 'sawtooth', v: 0.3 }, { s: 6, type: 'sine', v: 0.5 }],
      noise: { type: 'lowpass', f: 200, q: 0.7, vol: 0.07, lfo: 0.03, depth: 80 },
      pad: { type: 'sawtooth', oct: 24, deg: [0, 1, 3, 6], n: 3, lp: 600, formant: true, vol: 0.03, every: [10, 16], dur: [10, 14] },
      bell: { kind: 'toll', oct: 24, vol: 0.07, every: [10, 20], deg: [0, 1, 4] },
      extra: ['drum']
    }
  };

  function loop(s, name, lo, hi, fn, first) {
    function run() {
      if (!s.alive) return;
      if (ctx && ctx.state === 'running') { try { fn(s); } catch (e) { /* ignore */ } }
      s.tid[name] = setTimeout(run, rr(lo, hi) * 1000);
    }
    s.tid[name] = setTimeout(run, (first != null ? first : rr(lo, hi)) * 1000);
  }

  function padEvent(s) {
    const P = s.T.pad, sc = SCALES[s.T.scale];
    const t = ctx.currentTime + 0.05, dur = rr(P.dur[0], P.dur[1]);
    const degs = P.deg.slice(), vol = P.vol;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = rr(4.2, 5.4); lg.gain.value = 7; lfo.connect(lg);
    const nodes = [lfo, lg]; const oscs = [lfo];
    for (let k = 0; k < P.n && degs.length; k++) {
      const d = degs.splice(Math.floor(Math.random() * degs.length), 1)[0];
      const f = mf(s.T.root + P.oct + sc[d % 7] + 12 * Math.floor(d / 7));
      const g = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = P.lp; lp.Q.value = 1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      lp.connect(g); g.connect(s.out); nodes.push(g, lp);
      if (P.formant) {
        const fm = ctx.createBiquadFilter(), fg = ctx.createGain();
        fm.type = 'bandpass'; fm.frequency.value = rr(650, 1050); fm.Q.value = 5; fg.gain.value = 1.6;
        lp.connect(fm); fm.connect(fg); fg.connect(g); nodes.push(fm, fg);
      }
      for (let j = -1; j <= 1; j += 2) {
        const o = ctx.createOscillator();
        o.type = P.type; o.frequency.value = f; o.detune.value = j * 8;
        lg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
        nodes.push(o); oscs.push(o); live++;
      }
    }
    lfo.start(t); lfo.stop(t + dur + 0.1); live++;
    let ended = 0;
    oscs.forEach(function (o) {
      s.pads.add(o);
      o.onended = function () {
        live--; ended++; s.pads.delete(o);
        if (ended === oscs.length) nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* ignore */ } });
      };
    });
  }

  function bellEvent(s) {
    const B = s.T.bell, sc = SCALES[s.T.scale], t = ctx.currentTime + 0.05;
    const d = pick(B.deg), m = s.T.root + B.oct + sc[d % 7] + 12 * Math.floor(d / 7);
    switch (B.kind) {
      case 'pluck': {                       // short descending run, desert-style
        const n = ri(2, 4); let idx = ri(3, 6);
        for (let i = 0; i < n; i++) {
          const mm = s.T.root + B.oct + sc[idx % 7] + 12 * Math.floor(idx / 7);
          bell(mf(mm), t + i * 0.24, B.vol, 1.2, s.out, PLUCK);
          idx = Math.max(0, idx - ri(1, 2));
        }
        break;
      }
      case 'glass': bell(mf(m), t, B.vol, 4, s.out, GLASS); break;
      case 'wood': bell(mf(m), t, B.vol, 0.5, s.out, WOOD); break;
      case 'toll': bell(mf(m), t, B.vol, 6, s.out, BELL); break;
      default: bell(mf(m), t, B.vol, 3.5, s.out, BELL);
    }
  }

  const EXTRAS = {
    crackle: function (s) {
      loop(s, 'crk', 0.06, 0.45, function () {
        noise(ctx.currentTime + 0.02, rr(0.02, 0.06), rr(0.02, 0.06), { type: 'highpass', f0: rr(1800, 6000), dest: s.out });
      });
    },
    insects: function (s) {
      loop(s, 'ins', 2.5, 6, function () {
        const n = ri(6, 14), f = rr(3300, 4600), t = ctx.currentTime + 0.05;
        for (let i = 0; i < n; i++) tone('sine', f, f * 1.05, t + i * 0.075, 0.05, 0.012, { a: 0.01, dest: s.out });
      });
    },
    drip: function (s) {
      loop(s, 'drip', 1.5, 5, function () {
        const f = rr(900, 1600);
        tone('sine', f, f * 0.55, ctx.currentTime + 0.02, 0.12, 0.04, { a: 0.003, dest: s.out });
      });
    },
    drum: function (s) {
      loop(s, 'drum', 3, 4.5, function () {
        const t = ctx.currentTime + 0.02;
        tone('sine', 62, 34, t, 0.5, 0.2, { dest: s.out });
        tone('sine', 58, 32, t + 0.28, 0.45, 0.12, { dest: s.out });
      });
    }
  };

  function startSession(theme, fadeIn) {
    const T = THEMES[theme];
    if (!T || !ctx) return;
    const t0 = ctx.currentTime;
    const s = { theme: theme, T: T, alive: true, tid: {}, nodes: [], srcs: [], pads: new Set() };
    s.out = ctx.createGain();
    s.out.gain.setValueAtTime(0.0001, t0);
    s.out.gain.setTargetAtTime(1, t0, (fadeIn || 3) / 3);
    s.out.connect(musicBus);
    function reg(n) { s.nodes.push(n); return n; }
    function startSrc(n) { n.start(); s.srcs.push(n); live++; }

    // drones: detuned pairs through a slowly moving lowpass, with a slow volume swell
    const dg = reg(ctx.createGain()), lp = reg(ctx.createBiquadFilter());
    dg.gain.value = T.dvol; lp.type = 'lowpass'; lp.frequency.value = T.cut; lp.Q.value = 0.7;
    dg.connect(lp); lp.connect(s.out);
    const l1 = reg(ctx.createOscillator()), l1g = reg(ctx.createGain());
    l1.frequency.value = T.lfo; l1g.gain.value = T.cut * 0.4; l1.connect(l1g); l1g.connect(lp.frequency); startSrc(l1);
    const l2 = reg(ctx.createOscillator()), l2g = reg(ctx.createGain());
    l2.frequency.value = T.lfo * 0.7; l2g.gain.value = T.dvol * 0.3; l2.connect(l2g); l2g.connect(dg.gain); startSrc(l2);
    T.drone.forEach(function (d) {
      for (let k = -1; k <= 1; k += 2) {
        const o = reg(ctx.createOscillator()), g = reg(ctx.createGain());
        o.type = d.type; o.frequency.value = mf(T.root + d.s); o.detune.value = k * 7;
        g.gain.value = d.v / 2; o.connect(g); g.connect(dg); startSrc(o);
      }
    });

    // noise bed: wind / rain / fire roar
    if (T.noise) {
      const N = T.noise;
      const src = reg(ctx.createBufferSource()), f = reg(ctx.createBiquadFilter()), g = reg(ctx.createGain());
      src.buffer = noiseBuf; src.loop = true;
      f.type = N.type; f.frequency.value = N.f; f.Q.value = N.q; g.gain.value = N.vol;
      src.connect(f); f.connect(g); g.connect(s.out);
      const a = reg(ctx.createOscillator()), ag = reg(ctx.createGain());
      a.frequency.value = N.lfo; ag.gain.value = N.depth; a.connect(ag); ag.connect(f.frequency); startSrc(a);
      const b = reg(ctx.createOscillator()), bg = reg(ctx.createGain());
      b.frequency.value = N.lfo * 0.6; bg.gain.value = N.vol * 0.5; b.connect(bg); bg.connect(g.gain); startSrc(b);
      src.start(0, Math.random() * 2); s.srcs.push(src); live++;
    }

    if (T.pad) loop(s, 'pad', T.pad.every[0], T.pad.every[1], padEvent, rr(1, 4));
    if (T.bell) loop(s, 'bell', T.bell.every[0], T.bell.every[1], bellEvent, rr(3, 7));
    (T.extra || []).forEach(function (e) { EXTRAS[e](s); });
    sess = s;
  }

  function endSession(s, fade) {
    if (!s) return;
    s.alive = false;
    Object.keys(s.tid).forEach(function (k) { clearTimeout(s.tid[k]); });
    try { s.out.gain.cancelScheduledValues(ctx.currentTime); s.out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3); } catch (e) { /* ignore */ }
    setTimeout(function () {
      s.srcs.forEach(function (n) { try { n.stop(); } catch (e) { /* ignore */ } live--; });
      s.pads.forEach(function (o) { try { o.stop(); } catch (e) { /* ignore */ } });   // their onended cleans up
      s.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { /* ignore */ } });
      try { s.out.disconnect(); } catch (e) { /* ignore */ }
    }, fade * 1000 + 400);
  }

  function startMusicIfWanted() {
    if (!ctx || userSusp || !musicOn || !wantTheme) return;
    if (sess && sess.theme === wantTheme && sess.alive) return;
    const old = sess; sess = null;
    if (old) endSession(old, 3);
    startSession(wantTheme, old ? 3 : 2);
  }

  // ---------------------------------------------------------------- public API
  const A = G.Audio = {
    unlock: function () {
      try {
        if (!ctx && !build()) return;
        lastUnlock = performance.now();
        if (!userSusp && ctx.state !== 'running') {
          // silent buffer inside the gesture: the iOS unlock trick
          const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
          const p = ctx.resume();
          if (p && p.then) p.then(startMusicIfWanted, function () { /* stays locked until the next tap */ });
        }
        startMusicIfWanted();
      } catch (e) { /* never throw */ }
    },

    play: function (name, opts) {
      try {
        if (!sfxOn || !canSound()) return;
        const fn = SFX[name], m = META[name];
        if (!fn) return;
        const now = performance.now();
        if (now - (lastPlayed[name] || 0) < m[0]) return;
        // voice cap: count sounds accepted in the last 300 ms
        while (recent.length && now - recent[0] > 300) recent.shift();
        const busy = recent.length;
        if (m[1] === 2 && busy >= 6) return;
        if (m[1] === 1 && busy >= 10) return;
        if (busy >= 16) return;
        lastPlayed[name] = now; recent.push(now);
        fn(ctx.currentTime + 0.005, opts);
      } catch (e) {
        // never throw; warn once per sound so a bug is visible in the console
        if (!warned[name]) { warned[name] = true; if (window.console) console.warn('[audio] ' + name + ' failed:', e); }
      }
    },

    setSound: function (on) {
      sfxOn = !!on;
      try { applyVolumes(false); } catch (e) { /* ignore */ }
    },

    setMusic: function (on) {
      musicOn = !!on;
      try {
        applyVolumes(false);
        if (!musicOn) { const old = sess; sess = null; if (old) endSession(old, 1.2); }
        else startMusicIfWanted();
      } catch (e) { /* ignore */ }
    },

    music: function (theme) {
      try {
        if (!THEMES[theme]) return;
        wantTheme = theme;
        startMusicIfWanted();
      } catch (e) { /* ignore */ }
    },

    stopMusic: function () {
      try {
        wantTheme = null;
        const old = sess; sess = null;
        if (old) endSession(old, 1.5);
      } catch (e) { /* ignore */ }
    },

    suspend: function () {
      try {
        userSusp = true;
        if (!ctx) return;
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        setTimeout(function () {
          if (userSusp && ctx && ctx.state === 'running') { const p = ctx.suspend(); if (p && p.catch) p.catch(function () { /* ignore */ }); }
        }, 150);
      } catch (e) { /* ignore */ }
    },

    resume: function () {
      try {
        userSusp = false;
        if (!ctx) return;
        const p = ctx.resume();
        if (p && p.then) p.then(function () { startMusicIfWanted(); }, function () { /* ignore */ });
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
        startMusicIfWanted();
      } catch (e) { /* ignore */ }
    },

    // for the preview page / debugging
    debug: function () {
      return { state: ctx ? ctx.state : 'none', live: live, theme: sess ? sess.theme : null, want: wantTheme, sound: sfxOn, music: musicOn };
    },
    names: Object.keys(SFX),
    themes: Object.keys(THEMES)
  };

  Object.defineProperty(A, 'sfxVol', {
    get: function () { return sfxVolume; },
    set: function (v) { sfxVolume = G.clamp ? G.clamp(+v || 0, 0, 1) : Math.max(0, Math.min(1, +v || 0)); try { applyVolumes(false); } catch (e) { /* ignore */ } }
  });
  Object.defineProperty(A, 'musicVol', {
    get: function () { return musicVolume; },
    set: function (v) { musicVolume = G.clamp ? G.clamp(+v || 0, 0, 1) : Math.max(0, Math.min(1, +v || 0)); try { applyVolumes(false); } catch (e) { /* ignore */ } }
  });
})(window.G);
