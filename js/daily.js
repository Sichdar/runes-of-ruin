/* Runes of Ruin - the daily trial and the quest board (S4) [S08].
   Daily trial: one level a day, built from the date, about as hard as the act the player has reached,
   with one twist that rotates every day. The first win of the day pays gold and a rune stone; winning on
   days in a row builds a streak with bonus gold.
   Quest board: 3 small quests that count in every level; each pays gold when collected. Collected
   quests are replaced the next morning; unfinished ones stay.
   Save: data.daily = { shift, lastWin, streak, cal }, data.quests = { day, active: [...] }.
   data.daily.shift = days added by the "skip a day" test button on the Cloister screen. */
(function (G) {
  'use strict';
  const DAY_GOLD = 150, DAY_STONES = 1;
  const QUEST_SLOTS = 3;

  const D = () => {
    const S = G.Save.data;
    if (!S.daily || typeof S.daily !== 'object') S.daily = {};
    if (S.daily.shift === undefined) S.daily.shift = 0;
    if (S.daily.lastWin === undefined) S.daily.lastWin = -9;
    if (S.daily.streak === undefined) S.daily.streak = 0;
    return S.daily;
  };
  const Q = () => {
    const S = G.Save.data;
    if (!S.quests || typeof S.quests !== 'object') S.quests = {};
    if (!Array.isArray(S.quests.active)) S.quests.active = [];
    return S.quests;
  };

  // ---------- the twists, one a day in turn ----------
  const TWISTS = [
    { id: 'ambush', name: 'The Ambush', tip: 'Fewer moves than usual, but a fire bomb waits on the board.' },
    { id: 'sixth', name: 'The Sixth Sign', tip: 'A sixth colour falls today: matches are harder to find.' },
    { id: 'relics', name: 'The Relic Hunt', tip: 'Bring every relic down to the bottom of the board.' },
    { id: 'shadow', name: 'Shadow of', tip: '' } // a weaker copy of the act's boss; name and tip filled in below
  ];

  // ---------- quests ----------
  const QUESTS = [
    { id: 'col0', text: n => 'Collect ' + n + ' ' + G.COLOR_NAMES[0], need: 120, pay: 80, add: t => t.col[0] },
    { id: 'col1', text: n => 'Collect ' + n + ' ' + G.COLOR_NAMES[1], need: 120, pay: 80, add: t => t.col[1] },
    { id: 'col2', text: n => 'Collect ' + n + ' ' + G.COLOR_NAMES[2], need: 120, pay: 80, add: t => t.col[2] },
    { id: 'col3', text: n => 'Collect ' + n + ' ' + G.COLOR_NAMES[3], need: 120, pay: 80, add: t => t.col[3] },
    { id: 'col4', text: n => 'Collect ' + n + ' ' + G.COLOR_NAMES[4], need: 120, pay: 80, add: t => t.col[4] },
    { id: 'win', text: n => 'Win ' + n + ' levels', need: 3, pay: 100, add: (t, won) => won ? 1 : 0 },
    { id: 'daily', text: () => 'Win the daily trial', need: 1, pay: 100, add: (t, won, daily) => won && daily ? 1 : 0 },
    { id: 'bomb', text: n => 'Make ' + n + ' fire bombs', need: 4, pay: 80, add: t => t.made.bomb },
    { id: 'jav', text: n => 'Make ' + n + ' javelins', need: 8, pay: 70, add: t => t.made.jav },
    { id: 'raven', text: n => 'Make ' + n + ' ravens', need: 4, pay: 80, add: t => t.made.raven },
    { id: 'dmg', text: n => 'Deal ' + n + ' damage to bosses', need: 300, pay: 150, add: t => t.dmg },
    { id: 'bone', text: n => 'Break ' + n + ' bone piles', need: 30, pay: 80, add: t => t.bone },
    { id: 'ground', text: n => 'Clear ' + n + ' cursed ground', need: 40, pay: 80, add: t => t.ground },
    { id: 'chain', text: n => 'Break ' + n + ' chains', need: 20, pay: 80, add: t => t.chain }
  ];
  const QBYID = {};
  QUESTS.forEach(q => { QBYID[q.id] = q; });

  const Daily = {
    // today's day number (days since 1970 in the phone's own time zone), plus the test shift
    today() {
      const t = new Date();
      return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5) + D().shift;
    },
    shift() { return D().shift; },
    skipDay() { D().shift++; G.Save.save(); },
    wonToday() { return D().lastWin === this.today(); },
    // the streak as it stands today: broken if the last win was before yesterday
    streak() { const d = D(); return d.lastWin >= this.today() - 1 ? d.streak : 0; },
    twist() { return TWISTS[((this.today() % 4) + 4) % 4]; },

    // Build today's level. The move count is worked out by the bot once a day and kept.
    level() {
      const S = G.Save.data, day = this.today(), d = D();
      const actIdx = G.Levels.actOf(S.unlocked);
      const pos = 3 + (((day % 10) + 10) % 10);       // somewhere in the middle of the act
      const n = actIdx * 15 + 1 + pos;
      const tw = this.twist();
      const base = G.Levels.generate(n, (day * 9973 + 17) >>> 0);
      let name = tw.name, tip = tw.tip;
      if (tw.id === 'sixth') base.colors = 6;
      if (tw.id === 'relics') { base.goals = [{ type: 'relic' }]; base.relics = 4 + (base.tier >= 2 ? 1 : 0); }
      if (tw.id === 'shadow') {
        const B = G.Boss.forLevel(actIdx * 15 + 15);
        B.hp = Math.round(B.hp * 0.5);
        base.bossInfo = B;
        base.goals = [{ type: 'boss', n: B.hp, boss: B.id }];
        base.relics = 0;
        name = 'Shadow of ' + B.short.replace(/^The /, 'the ');
        tip = 'A weaker shadow of ' + B.short.replace(/^The /, 'the ') + ', with half the health. ' + B.tip;
      }
      let moves;
      if (d.cal && d.cal.day === day && d.cal.act === actIdx) moves = d.cal.moves;
      else {
        moves = G.Levels.calibrate(n, base, true);
        d.cal = { day, act: actIdx, moves };
        G.Save.save();
      }
      if (tw.id === 'ambush') { moves = Math.max(10, Math.round(moves * 0.8)); base.startPows = ['bomb']; }
      base.moves = moves;
      const act = G.Levels.act(actIdx);
      return Object.assign(base, { n, name, tip, act, theme: act.theme, boss: false, daily: true, twist: tw.id });
    },

    // First win of the day: gold, a rune stone, and the streak. Replays pay nothing.
    reward() {
      const S = G.Save.data, d = D(), day = this.today();
      if (d.lastWin === day) return null;
      const streak = d.lastWin === day - 1 ? d.streak + 1 : 1;
      d.lastWin = day; d.streak = streak;
      const bonus = streak === 3 ? 100 : streak % 7 === 0 ? 300 : 0;
      const ex = G.Cloister.dailyExtra(); // the hamlet's Tavern [S10]
      S.gold += DAY_GOLD + bonus + ex.gold;
      G.Cloister.addBonus(DAY_STONES + ex.stones); // saves
      return { gold: DAY_GOLD + ex.gold, bonus, stones: DAY_STONES + ex.stones, streak };
    },

    // ---------- quest board ----------
    refreshQuests() {
      const q = Q(), day = this.today();
      if (q.day === undefined || day > q.day) {
        q.active = q.active.filter(x => !x.got && QBYID[x.id]); // collected ones make room for new ones
        q.day = day;
      }
      const rng = G.rng(day * 131 + 7);
      const pool = rng.shuffle(QUESTS.slice());
      for (const t of pool) {
        if (q.active.length >= QUEST_SLOTS) break;
        if (q.active.some(x => x.id === t.id)) continue;
        if (t.id === 'dmg' && G.Save.data.unlocked < 15) continue; // no bosses yet before level 15
        q.active.push({ id: t.id, need: t.need, have: 0, pay: t.pay, done: false, got: false });
      }
      G.Save.save();
      return q.active;
    },
    text(x) { return QBYID[x.id] ? QBYID[x.id].text(x.need) : x.id; },
    // A level ended: add what it did to every open quest. Returns the quests it finished.
    record(tally, won, daily) {
      const fin = [];
      if (!tally) return fin;
      for (const x of this.refreshQuests()) {
        if (x.done || !QBYID[x.id]) continue;
        x.have = Math.min(x.need, x.have + (QBYID[x.id].add(tally, won, daily) || 0));
        if (x.have >= x.need) { x.done = true; fin.push(x); }
      }
      G.Save.save();
      return fin;
    },
    collect(i) {
      const x = Q().active[i];
      if (!x || !x.done || x.got) return 0;
      x.got = true;
      G.Save.data.gold += x.pay;
      G.Save.save();
      return x.pay;
    },
    anyToCollect() { return this.refreshQuests().some(x => x.done && !x.got); },

    // The quest board panel; onBack returns to the screen it came from
    openBoard(onBack) {
      const list = this.refreshQuests();
      let html = '<div class="q-list">';
      list.forEach((x, i) => {
        const k = x.need ? Math.min(1, x.have / x.need) : 1;
        html += '<div class="q-card' + (x.done ? ' done' : '') + (x.got ? ' got' : '') + '">' +
          '<div class="q-text">' + this.text(x) + '</div>' +
          '<div class="q-bar"><i style="width:' + Math.round(k * 100) + '%"></i></div>' +
          '<div class="q-row"><span>' + (x.got ? 'Collected · a new quest comes tomorrow' : x.have + ' / ' + x.need) + '</span>' +
          '<span class="q-pay">' + x.pay + ' <span class="coin"></span></span></div>' +
          (x.done && !x.got ? '<button class="btn q-get" data-q="' + i + '">Collect ' + x.pay + ' gold</button>' : '') +
          '</div>';
      });
      html += '</div><div class="q-note">Quests count in every level, the daily trial too. New ones arrive each morning.</div>' +
        '<div class="gold-note">You have ' + G.Save.data.gold + ' gold</div>';
      G.UI.modal({ title: 'Quest Board', sub: 'Small deeds, paid in gold', html, buttons: [{ label: 'Back', cls: 'dark', fn: () => onBack && onBack() }] });
      document.querySelectorAll('#panel [data-q]').forEach(b => {
        b.onclick = () => {
          if (this.collect(+b.dataset.q) && G.Audio && G.Audio.play) G.Audio.play('coin');
          this.openBoard(onBack);
        };
      });
    }
  };
  G.Daily = Daily;
})(window.G);
