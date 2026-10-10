// The big moments: Last Call, Spin the Bottle, The Tab, bar fights and duels.
import { COLORS } from '../../config.js';
import { text, panel, coin, bottleCap } from '../../draw.js';
import { drawCharacter } from '../../characters.js';
import { state, scaledSips, standings, humanDevices, isPro } from '../../state.js';
import { sfx } from '../../audio.js';
import { MINIGAMES } from '../../minigames/index.js';
import { MinigameScene } from '../../minigames/runner.js';
import { ITEMS, addItem, randomItem } from '../items.js';
import { LAST_CALL_TURNS, PROMPT_X } from '../consts.js';
import { prompt, subPrompt, bigNote, choiceBox } from '../ui.js';

// What Spin the Bottle can move from the first player to the second.
const CHANCE = [
  { label: '10 coins', k: 'coins', n: 10 },
  { label: '20 coins', k: 'coins', n: 20 },
  { label: 'Swap coins', k: 'swapCoins' },
  { label: '30 coins', k: 'coins', n: 30 },
  { label: '1 bottle cap', k: 'cap' },
  { label: '20 coins', k: 'coins', n: 20 },
  { label: 'Swap caps', k: 'swapCaps' },
];

// What the bill can say. `w` is how likely each one is; Pro rules keep only the plain ones.
const TAB = [
  { label: 'Pay 10 coins', k: 'pay', n: 10, w: 4, pro: true },
  { label: 'Pay 20 coins', k: 'pay', n: 20, w: 3, pro: true },
  { label: 'Everyone chips in 5', k: 'allPay', n: 5, w: 3, pro: true },
  { label: 'Shots for the table: everyone drinks', k: 'allSip', n: 2, w: 3 },
  { label: 'Pay half your coins', k: 'half', w: 2 },
  { label: 'Split the tab: everyone\'s coins are evened out', k: 'even', w: 1 },
];

// Games two players can play head to head.
const duelGames = () => MINIGAMES.filter((m) => m.type === 'ffa' || m.name === 'Tug of Tab');

export const eventPhases = {
  // ---- Last Call: the final five turns ----

  do_lastCallIntro() {
    if (!this.lastCallShown) {
      this.lastCallShown = true;
      // The player in last place gets a little help for the home stretch. (Not in a five-turn
      // game, where Last Call starts on turn one and nobody is behind yet.)
      if (this.G.round > 1) {
        const order = standings();
        const last = order[order.length - 1];
        const item = randomItem();
        last.coins += 10;
        const gotItem = addItem(last, item);
        this.lastCallGift = { who: last, item: gotItem ? item : null };
      }
      sfx('fanfare');
      this.say('lastCall');
    }
    const skip = state.autoplay ? this.pt > 0.2 : this.pt > 1.2 && this.game.input.merged(humanDevices()).pressed;
    if (this.pt > 9 || skip) this.set('roundIntro');
  },

  draw_lastCallIntro(g) {
    const gift = this.lastCallGift;
    panel(g, PROMPT_X - 400, 90, 800, 470, { fill: 'rgba(20,15,31,.95)', line: COLORS.bad, lineW: 6 });
    text(g, 'LAST CALL', PROMPT_X, 140, { size: 64, weight: 900, color: COLORS.bad, glow: COLORS.bad });
    text(g, `${LAST_CALL_TURNS} turns left`, PROMPT_X, 190, { size: 22, color: COLORS.ink });
    text(g, '• Coin spaces are doubled: +6 and -6', PROMPT_X, 232, { size: 19, weight: 700, color: COLORS.gold });
    text(g, '• Stop on another player\'s space to duel them for coins', PROMPT_X, 260, { size: 19, weight: 700, color: COLORS.gold });
    standings().forEach((p, i) => {
      const y = 308 + i * 46;
      text(g, ['1st', '2nd', '3rd', '4th'][i], PROMPT_X - 300, y, { size: 22, align: 'left', color: i ? COLORS.dim : COLORS.gold });
      drawCharacter(g, p.char, PROMPT_X - 210, y - 2, 17, { shadow: false });
      text(g, `${p.label} ${p.name}`, PROMPT_X - 176, y, { size: 21, align: 'left', color: p.color });
      bottleCap(g, PROMPT_X + 96, y, 11);
      text(g, String(p.caps), PROMPT_X + 116, y, { size: 21, align: 'left' });
      coin(g, PROMPT_X + 190, y, 10);
      text(g, String(p.coins), PROMPT_X + 208, y, { size: 21, align: 'left' });
    });
    if (gift) {
      const extra = gift.item ? ` and a free ${ITEMS[gift.item].name}` : '';
      text(g, `On the house for last place: ${gift.who.name} gets 10 coins${extra}.`, PROMPT_X, 512, { size: 18, color: COLORS.good });
    }
    text(g, 'Press A', PROMPT_X, 540, { size: 15, weight: 700, color: COLORS.dim });
  },

  // ---- Spin the Bottle (Chance Time) ----

  openChance() {
    const n = state.players.length;
    this.chance = { reel: 0, idx: [Math.floor(Math.random() * n), Math.floor(Math.random() * CHANCE.length), 0], t: 0, note: '' };
    this.say('chance', this.player.name);
    sfx('fanfare');
    this.set('chance');
  },

  // Who the third reel can land on: anyone but the player the first reel picked.
  chanceReceivers() {
    return state.players.map((p, i) => i).filter((i) => i !== this.chance.idx[0]);
  },

  do_chance(dt) {
    const ch = this.chance;
    if (ch.reel > 2) {
      if (this.pt > (state.autoplay ? 0.1 : 1.2)) this.resolveChance();
      return;
    }
    // The current reel flicks through its options until the player stops it.
    ch.t -= dt;
    const size = [state.players.length, CHANCE.length, this.chanceReceivers().length][ch.reel];
    if (ch.t <= 0) { ch.idx[ch.reel] = (ch.idx[ch.reel] + 1) % size; ch.t = 0.09; sfx('dice'); }
    if (this.pt > 0.5 && this.ctl(this.player).pressed) {
      ch.reel++;
      this.pt = 0;
      sfx('select');
    }
  },

  resolveChance() {
    const ch = this.chance;
    const from = state.players[ch.idx[0]];
    const to = state.players[this.chanceReceivers()[ch.idx[2]]];
    const what = CHANCE[ch.idx[1]];
    if (what.k === 'coins') {
      const n = Math.min(from.coins, what.n);
      from.coins -= n;
      to.coins += n;
      this.pop(from, `-${n}`, COLORS.bad);
      this.pop(to, `+${n}`, COLORS.gold);
      ch.note = n ? `${from.name} hands ${to.name} ${n} coins.` : `${from.name} has no coins to give.`;
    } else if (what.k === 'cap') {
      if (from.caps > 0) {
        from.caps--;
        to.caps++;
        this.pop(from, '-1 BOTTLE CAP', COLORS.bad);
        this.pop(to, '+1 BOTTLE CAP', COLORS.gold);
        ch.note = `${from.name} hands ${to.name} a bottle cap!`;
      } else {
        ch.note = `${from.name} has no bottle caps to give.`;
      }
    } else if (what.k === 'swapCoins') {
      [from.coins, to.coins] = [to.coins, from.coins];
      ch.note = `${from.name} and ${to.name} swap coins.`;
    } else {
      [from.caps, to.caps] = [to.caps, from.caps];
      ch.note = `${from.name} and ${to.name} swap bottle caps!`;
    }
    sfx(what.k === 'coins' ? 'coin' : 'cap');
    this.set('chanceDone');
  },

  do_chanceDone() {
    if (this.pt > (state.autoplay ? 0.1 : 3)) { this.chance = null; this.finishTurn(); }
  },

  drawChance(g) {
    const ch = this.chance;
    const ps = state.players;
    panel(g, PROMPT_X - 420, 90, 840, 330, { fill: 'rgba(20,15,31,.96)', line: COLORS.gold, lineW: 6 });
    text(g, 'SPIN THE BOTTLE', PROMPT_X, 132, { size: 40, weight: 900, color: COLORS.gold, glow: COLORS.gold });
    const from = ps[ch.idx[0]];
    const to = ps[this.chanceReceivers()[Math.min(ch.idx[2], this.chanceReceivers().length - 1)]];
    const boxes = [
      { x: PROMPT_X - 270, who: from, head: 'THIS PLAYER' },
      { x: PROMPT_X, what: CHANCE[ch.idx[1]].label, head: 'GIVES' },
      { x: PROMPT_X + 270, who: to, head: 'TO THIS PLAYER' },
    ];
    boxes.forEach((b, i) => {
      const live = ch.reel === i;
      const set = ch.reel > i;
      panel(g, b.x - 115, 170, 230, 190, { r: 14, fill: '#1b1429', line: live ? COLORS.gold : set ? COLORS.good : COLORS.panelLine, lineW: live ? 6 : 3 });
      text(g, b.head, b.x, 192, { size: 14, color: COLORS.dim });
      if (!live && !set) { text(g, '?', b.x, 276, { size: 80, weight: 900, color: '#3b2d5c' }); return; }
      if (b.who) {
        drawCharacter(g, b.who.char, b.x, 262, 38, { t: this.t, phase: i });
        text(g, `${b.who.label} ${b.who.name}`, b.x, 332, { size: 19, color: b.who.color });
      } else {
        text(g, b.what, b.x, 274, { size: 26, weight: 900, color: COLORS.gold });
      }
    });
    if (ch.reel <= 2 && !this.player.cpu) text(g, `${this.player.name}: press A to stop the reel`, PROMPT_X, 392, { size: 17, weight: 700, color: COLORS.dim });
  },

  draw_chance(g) { this.drawChance(g); },

  draw_chanceDone(g) {
    this.drawChance(g);
    bigNote(g, this.chance.note, 470);
  },

  // ---- The Tab (the Bowser space) ----

  openTab() {
    const p = this.player;
    this.say('tab', p.name);
    sfx('bad');
    if (p.coins === 0) {
      // Nothing to take, so Sal takes pity instead.
      this.coins(p, 10);
      this.tabNote = `${p.name} is broke. Sal sighs and comps them 10 coins.`;
      this.set('tabDone');
      return;
    }
    const list = TAB.filter((o) => o.pro || !isPro());
    const bag = [];
    list.forEach((o, i) => { for (let k = 0; k < o.w; k++) bag.push(i); });
    const final = bag[Math.floor(Math.random() * bag.length)];
    // The pointer goes round the list a couple of times, slowing, and stops on the result.
    this.tab = { list, at: 0, left: list.length * 2 + final, t: 0.3, gap: 0.07, final };
    this.set('tab');
  },

  do_tab(dt) {
    const tb = this.tab;
    if (tb.left > 0) {
      tb.t -= dt;
      if (tb.t <= 0) {
        tb.at = (tb.at + 1) % tb.list.length;
        tb.left--;
        if (tb.left < 6) tb.gap *= 1.35;
        tb.t = state.autoplay ? 0 : tb.gap;
        sfx('dice');
        if (tb.left === 0) this.pt = 0;
      }
      return;
    }
    if (this.pt > (state.autoplay ? 0.1 : 0.9)) this.resolveTab();
  },

  resolveTab() {
    const p = this.player;
    const ps = state.players;
    const o = this.tab.list[this.tab.at];
    if (o.k === 'pay') { const paid = -this.coins(p, -o.n); this.tabNote = `${p.name} pays ${paid} coins.`; }
    else if (o.k === 'allPay') { for (const q of ps) this.coins(q, -o.n); this.tabNote = `Everyone chips in ${o.n} coins.`; }
    else if (o.k === 'allSip') { for (const q of ps) this.sip(q, scaledSips(o.n)); this.tabNote = 'Shots for the table. Everyone drinks.'; }
    else if (o.k === 'half') { const n = Math.ceil(p.coins / 2); this.coins(p, -n); this.tabNote = `${p.name} pays half: ${n} coins.`; }
    else {
      const total = ps.reduce((s, q) => s + q.coins, 0);
      const each = Math.floor(total / ps.length);
      for (const q of ps) q.coins = each;
      sfx('coin');
      this.tabNote = `The tab is split evenly. Everyone now has ${each} coins.`;
    }
    this.set('tabDone');
  },

  do_tabDone() {
    if (this.pt > (state.autoplay ? 0.1 : 2.6)) { this.tab = null; this.finishTurn(); }
  },

  draw_tab(g) {
    const tb = this.tab;
    const h = 84 + tb.list.length * 40;
    panel(g, PROMPT_X - 300, 90, 600, h, { fill: 'rgba(20,15,31,.96)', line: COLORS.bad, lineW: 6 });
    text(g, 'THE TAB ARRIVES', PROMPT_X, 130, { size: 36, weight: 900, color: COLORS.bad, glow: COLORS.bad });
    tb.list.forEach((o, i) => {
      const y = 180 + i * 40;
      const on = i === tb.at;
      if (on) panel(g, PROMPT_X - 280, y - 18, 560, 36, { r: 10, fill: '#5a1c1c', line: COLORS.gold, lineW: 2 });
      text(g, o.label, PROMPT_X, y, { size: 20, color: on ? COLORS.ink : COLORS.dim });
    });
  },

  draw_tabDone(g) {
    bigNote(g, this.tabNote, 120, COLORS.bad);
  },

  // ---- Bar Fight (battle minigame) ----

  openBattle() {
    const ps = state.players;
    const ante = [5, 10, 20][Math.floor(Math.random() * 3)];
    let pot = 0;
    this.antes = ps.map((q) => {
      const paid = Math.min(ante, q.coins);
      q.coins -= paid;
      pot += paid;
      if (paid) this.pop(q, `-${paid}`, COLORS.bad);
      return paid;
    });
    this.battle = { ante, pot };
    this.say('battle');
    sfx('fanfare');
    this.set('battle');
  },

  do_battle() {
    if (this.pt < (state.autoplay ? 0.1 : 3)) return;
    const { pot } = this.battle;
    if (!pot) { this.finishTurn(); return; }
    const def = this.chooseGame(MINIGAMES.filter((m) => m.type === 'ffa'));
    this.leaveFor(def, 'next', { settle: { kind: 'battle', pot } });
  },

  draw_battle(g) {
    const { ante, pot } = this.battle;
    prompt(g, 'BAR FIGHT!', 110, COLORS.gold);
    subPrompt(g, pot ? `Everyone antes up to ${ante} coins. The pot is ${pot}: winner takes 70%, second place 30%.`
      : 'Nobody has a coin to bet. The fight fizzles out.', 152);
  },

  // ---- Duels ----

  // Sets up a duel between two players. `resume` says what happens after: 'same' means the
  // challenger carries on with their turn, 'next' means the turn is over.
  openDuel(a, b, resume) {
    const max = Math.min(a.coins, b.coins);
    if (max <= 0) { if (resume === 'same') this.set('turnIntro'); else this.nextTurn(); return; }
    this.duel = { a, b, resume, options: [10, 20, 30].filter((n) => n <= max) };
    if (!this.duel.options.length) this.duel.options = [max];
    this.sel = 0;
    this.say('duel', b.name);
    sfx('fanfare');
    this.set('duelWager');
  },

  do_duelWager() {
    const d = this.duel;
    const c = this.ctl(d.a);
    const n = d.options.length;
    if (c.left) { this.sel = (this.sel + n - 1) % n; sfx('move'); }
    if (c.right) { this.sel = (this.sel + 1) % n; sfx('move'); }
    if (this.pt < 0.6 || !c.pressed) return;
    if (c.auto) this.sel = Math.floor(Math.random() * n);
    const def = this.chooseGame(duelGames());
    this.leaveFor(def, d.resume, { participants: [d.a.index, d.b.index], settle: { kind: 'duel', wager: d.options[this.sel] } });
  },

  draw_duelWager(g) {
    const d = this.duel;
    choiceBox(g, `DUEL! ${d.a.name} vs ${d.b.name}. ${d.a.name} sets the stakes:`, d.options.map((n) => `${n} coins`),
      d.a.cpu ? -1 : this.sel, 'Winner takes the coins from the loser. Left / Right, then A');
  },

  // Leaves the board for a minigame in the middle of a round, remembering where to pick up.
  leaveFor(def, resume, opts) {
    this.G.resume = resume;
    this.G.turn = this.turn;
    const onDone = this.makeReturn();
    this.game.go(new MinigameScene(def, onDone, opts));
  },
};
