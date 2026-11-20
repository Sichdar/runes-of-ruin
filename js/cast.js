/* Runes of Ruin - a small cast who talk (S8) [S12].
   Brother Aldric (an old monk), Hadrik (the ghost of the cloister's smith) and Corvin (a raven) say one short
   line in a bubble that fades by itself. It never needs a tap, never stops the game, and lets touches pass
   through. They only speak on the home screen and over start / end panels, never while you are matching. */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);

  const WHO = {
    monk: { name: 'Brother Aldric',
      face: '<svg viewBox="0 0 40 40"><path d="M4 40 Q4 8 20 4 Q36 8 36 40 Z" fill="#4a3424"/><path d="M10 40 Q10 14 20 11 Q30 14 30 40 Z" fill="#1a100a"/>' +
        '<ellipse cx="20" cy="24" rx="7" ry="9" fill="#c8a080"/><path d="M14 30 Q20 38 26 30 Q24 36 20 37 Q16 36 14 30 Z" fill="#e8e0d4"/>' +
        '<circle cx="17" cy="22" r="1.2" fill="#2a1a10"/><circle cx="23" cy="22" r="1.2" fill="#2a1a10"/></svg>' },
    smith: { name: 'Hadrik, the ghost smith',
      face: '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="22" rx="13" ry="15" fill="#9ad0ff" opacity=".35"/><ellipse cx="20" cy="20" rx="9" ry="10" fill="#bfe4ff" opacity=".8"/>' +
        '<path d="M11 24 Q20 42 29 24 Q27 33 20 35 Q13 33 11 24 Z" fill="#e8f6ff" opacity=".9"/><rect x="11" y="12" width="18" height="3" rx="1.5" fill="#6a8aa8"/>' +
        '<circle cx="16.5" cy="19" r="1.6" fill="#40f0ff"/><circle cx="23.5" cy="19" r="1.6" fill="#40f0ff"/></svg>' },
    raven: { name: 'Corvin the raven',
      face: '<svg viewBox="0 0 40 40"><ellipse cx="18" cy="26" rx="13" ry="12" fill="#14121a"/><circle cx="20" cy="16" r="9" fill="#1c1a24"/>' +
        '<path d="M27 14 L38 18 L27 20 Z" fill="#3a3640"/><circle cx="22" cy="14" r="2.2" fill="#ffd040"/><circle cx="22.6" cy="13.6" r=".9" fill="#000"/>' +
        '<path d="M8 22 Q2 30 6 36 Q10 30 14 28 Z" fill="#0c0a10"/></svg>' }
  };

  // lines by event; { w: who, t: text }
  const L = (w, t) => ({ w, t });
  const LINES = {
    intro: [L('raven', 'Swap fast, think faster. Caw.'), L('monk', 'Walk in the light, child. Or at least near it.'),
      L('smith', 'Make a javelin early. It does the heavy lifting.'), L('raven', 'Four in a square makes one of me. Flattering.'),
      L('monk', 'Patience. The board gives to those who look twice.'), L('smith', 'An L or a T, and you have fire. Use it well.')],
    cursed: [L('monk', 'This ground is cursed. Fewer moves, but double the stones.'), L('monk', 'I smell the curse on this place. Spend no move idly.'),
      L('raven', 'Cursed again? The pay is good, at least.')],
    rescue: [L('raven', 'Kaela! They\'ve chained her in the pit! Hurry!'), L('monk', 'The blood rises with every move. Break her chains!'),
      L('smith', 'Those chains are poor iron. Smash them, quick!')],
    boss: [L('smith', 'A big one. Hit it with its weak colour.'), L('monk', 'Steel yourself. It strikes back every few moves.'),
      L('raven', 'I\'ll be up here. Watching. Bravely.')],
    win: [L('raven', 'Shiny gold! Mine? No? Fine.'), L('monk', 'Well fought. Bring the stones home.'), L('smith', 'Good work. The forge waits for those stones.'),
      L('raven', 'They didn\'t stand a chance. Caw!')],
    rescueWin: [L('monk', 'Thank the old saints. She walks free.'), L('raven', 'Out of the pit! I wasn\'t worried. Much.'), L('smith', 'Told you that iron was rubbish.')],
    lose: [L('monk', 'Every hunter falls. The good ones stand again.'), L('raven', 'That went badly. Again?'), L('smith', 'Blades get sharper on the second pass.')],
    job: [L('smith', 'Steady hands. It\'s coming together.'), L('raven', 'Ooh, that\'s new. Can I sit on it?'), L('monk', 'Stone by stone, the old place breathes.'),
      L('smith', 'In my day that took a week. Not bad.')],
    stageUp: [L('smith', 'Now that is proper building.'), L('monk', 'It stands taller now. So should we.'), L('raven', 'Bigger! I approve of bigger.')],
    areaDone: [L('monk', 'Restored at last. The sisters would weep to see it.'), L('smith', 'Finished. That\'s worth a drink, if I could drink.'),
      L('raven', 'Done! Now build me a nest.')],
    chest: [L('raven', 'A chest! Open it, open it!'), L('raven', 'I found it first. Remember that.'), L('smith', 'Good iron on that lock. Shame to break it.')],
    forge: [L('smith', 'My old forge, alive again. Thank you, girl.')],
    chapel: [L('monk', 'My chapel. I can almost hear the hymns.')],
    shrine: [L('monk', 'Her shrine. Kneel a moment, if you would.')]
  };

  const GAP = 14; // seconds between optional lines
  const Cast = {
    last: -1e9,
    el: null,
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    // what happened -> maybe a line; must = always speak (a rescue, a finished area, a chest)
    event(kind, x) {
      let pool = null, must = false, chance = .3, where = 'top';
      if (kind === 'intro') {
        const lv = x || {};
        if (lv.daily) return;
        if (lv.rescue) { pool = LINES.rescue; must = true; }
        else if (lv.cursed) { pool = LINES.cursed; chance = .8; }
        else if (lv.boss) { pool = LINES.boss; chance = .7; }
        else { pool = LINES.intro; chance = lv.n <= 3 ? 0 : .25; }
      } else if (kind === 'win') { pool = x && x.rescue ? LINES.rescueWin : LINES.win; must = !!(x && x.rescue); chance = .3; }
      else if (kind === 'lose') { pool = LINES.lose; chance = .45; }
      else if (kind === 'chest') { pool = LINES.chest; must = true; }
      else if (kind === 'areaDone') { pool = LINES[x] && Math.random() < .6 ? LINES[x] : LINES.areaDone; must = true; where = 'home'; }
      else if (kind === 'stageUp') { pool = LINES.stageUp; chance = .6; where = 'home'; }
      else if (kind === 'job') { pool = LINES.job; chance = .25; where = 'home'; }
      if (!pool) return;
      const now = performance.now() / 1000;
      if (!must && (now - this.last < GAP || Math.random() > chance)) return;
      const line = this.pick(pool), wait = 3 - (now - this.last); // let the line on show finish first
      if (wait > 0) { clearTimeout(this.next); this.next = setTimeout(() => this.say(line, where), wait * 1000); }
      else this.say(line, where);
    },
    // fade out now (play starts: the bubble must not sit over the goals and moves)
    hide() { if (this.el) this.el.classList.remove('on'); clearTimeout(this.timer); clearTimeout(this.next); },
    say(line, where) {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.id = 'cast';
        this.el.className = 'cast';
        this.el.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.el);
      }
      const who = WHO[line.w];
      this.el.innerHTML = '<div class="cast-face">' + who.face + '</div><div class="cast-text"><b>' + who.name + '</b>' + line.t + '</div>';
      // home: over the bottom of the picture; elsewhere: the top of the screen, above any panel
      const art = $('cloisterArt');
      const r = where === 'home' && art ? art.getBoundingClientRect() : null;
      this.el.style.top = r && r.height ? Math.round(r.bottom - 8) + 'px' : '';
      this.el.classList.toggle('home', !!(r && r.height));
      this.el.classList.remove('on'); void this.el.offsetWidth; this.el.classList.add('on');
      this.last = performance.now() / 1000;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.el.classList.remove('on'), 3800);
    }
  };
  G.Cast = Cast;
})(window.G);
