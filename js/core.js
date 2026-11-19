/* Runes of Ruin - core helpers: namespace, random numbers, easing, save data */
window.G = window.G || {};
(function (G) {
  'use strict';
  G.VERSION = '0.7.0';

  // Timing constants shared by the game logic and the renderer (milliseconds / cells per second)
  G.T = {
    JAV_DT: 38,      // ms for a javelin to cross one cell
    BOMB_DELAY: 60,  // ms before a fire bomb bursts
    RAVEN_FLY: 430,  // ms of raven flight
    GRAV: 75,        // fall acceleration, cells/s^2
    VMAX: 17         // max fall speed, cells/s
  };

  // Seeded random number generator (mulberry32). Returns a function with helpers.
  G.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    const f = function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.getState = () => s;
    f.setState = v => { s = v; };
    f.int = n => Math.floor(f() * n);
    f.pick = a => a[Math.floor(f() * a.length)];
    f.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
    return f;
  };

  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inQuad: t => t * t
  };

  // Mix two #rrggbb colours, t = 0..1
  G.mix = function (a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  };

  // ---------- Save data (localStorage, wrapped so a private window still works) ----------
  const KEY = 'runes-of-ruin-save-v1';
  const DEFAULTS = {
    v: 1,
    unlocked: 1,        // highest level the player may play
    gold: 100,
    sound: true,
    music: true,
    seenIntro: {},      // act index -> true once its story card was shown
    seenTip: {},        // level -> true
    stats: { wins: 0, losses: 0, played: 0 },
    // Room to grow: home/meta layer and side quests read and write these
    camp: { built: {} },
    quests: { active: [], done: [] },
    daily: { shift: 0, lastWin: -9, streak: 0 }, // daily trial (daily.js) [S08]
    winStreak: 0        // wins in a row, 0..3 (S6, cloister.js) [S10]
  };
  G.Save = {
    data: JSON.parse(JSON.stringify(DEFAULTS)),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          this.data = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), d);
        }
      } catch (e) { /* storage blocked: play without saving */ }
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    },
    reset() { this.data = JSON.parse(JSON.stringify(DEFAULTS)); this.save(); }
  };
})(window.G);
