// Start of a new crawl: show where the first bottle cap is, then roll for turn order.
import { COLORS } from '../../config.js';
import { text, panel } from '../../draw.js';
import { drawCharacter } from '../../characters.js';
import { state, humanDevices } from '../../state.js';
import { sfx } from '../../audio.js';
import { MAP, zoneInfo } from '../map.js';
import { DIE_MAX, PROMPT_X } from '../consts.js';
import { prompt, subPrompt } from '../ui.js';

export const orderPhases = {
  // Fly the camera to the first cap so everyone knows where they are headed.
  do_orderIntro() {
    const cap = MAP.nodes[this.G.capNode];
    this.focus = this.pt > 1.2 ? { x: cap.x, y: cap.y - 40 } : null;
    const skip = state.autoplay ? this.pt > 0.2 : this.pt > 0.8 && this.game.input.merged(humanDevices()).pressed;
    if (this.pt > 4.5 || skip) {
      this.focus = null;
      this.rolls = state.players.map(() => 0);
      this.rollAt = 0;
      this.die = 1;
      this.dieT = 0;
      this.set('orderRoll');
    }
  },

  draw_orderIntro(g) {
    prompt(g, `The first bottle cap is in ${zoneInfo(MAP.nodes[this.G.capNode].zone).name}`, 110, COLORS.gold);
    subPrompt(g, 'Walk past it with 20 coins to buy it. Most caps wins.', 152);
  },

  // Everyone rolls once; the highest roll goes first.
  do_orderRoll(dt) {
    const ps = state.players;
    if (this.rollAt >= ps.length) {
      const tie = ps.map(() => Math.random());
      this.newOrder = ps.map((p, i) => i).sort((a, b) => this.rolls[b] - this.rolls[a] || tie[a] - tie[b]);
      this.set('orderShow');
      sfx('select');
      return;
    }
    this.dieT -= dt;
    if (this.dieT <= 0) { this.die = 1 + Math.floor(Math.random() * DIE_MAX); this.dieT = 0.06; sfx('dice'); }
    const c = this.ctl(ps[this.rollAt]);
    if (this.pt > 0.3 && c.pressed) {
      this.rolls[this.rollAt] = this.die;
      this.rollAt++;
      this.pt = 0;
      sfx('step');
    }
  },

  drawOrderRow(g, order) {
    const ps = state.players;
    const n = ps.length;
    const cw = 190;
    const x0 = PROMPT_X - (n * cw) / 2;
    panel(g, x0 - 20, 196, n * cw + 40, 250, { fill: 'rgba(20,15,31,.94)', line: COLORS.gold });
    order.forEach((i, slot) => {
      const p = ps[i];
      const x = x0 + slot * cw + cw / 2;
      const rolling = this.phase === 'orderRoll' && i === this.rollAt;
      if (this.phase === 'orderShow') text(g, ['1st', '2nd', '3rd', '4th'][slot], x, 224, { size: 22, color: COLORS.gold });
      drawCharacter(g, p.char, x, 286, 34, { t: this.t, phase: i });
      text(g, `${p.label} ${p.name}`, x, 346, { size: 18, color: p.color });
      const shown = rolling ? this.die : this.rolls[i];
      g.beginPath();
      g.roundRect(x - 28, 366, 56, 56, 12);
      g.fillStyle = shown ? '#fff7e6' : '#3b2d5c';
      g.fill();
      g.lineWidth = rolling ? 5 : 3;
      g.strokeStyle = rolling ? COLORS.gold : '#140f1f';
      g.stroke();
      if (shown) text(g, String(shown), x, 396, { size: 32, weight: 900, color: '#140f1f' });
    });
  },

  draw_orderRoll(g) {
    const p = state.players[Math.min(this.rollAt, state.players.length - 1)];
    prompt(g, 'Roll for turn order: highest goes first', 110);
    subPrompt(g, p.cpu ? `${p.name} is rolling…` : `${p.label} ${p.name}: press A to roll`, 152);
    this.drawOrderRow(g, state.players.map((q, i) => i));
  },

  do_orderShow() {
    if (this.pt < (state.autoplay ? 0.2 : 2.6)) return;
    // From here on the players are stored in turn order.
    state.players = this.newOrder.map((i) => state.players[i]);
    state.players.forEach((p, i) => { p.index = i; });
    this.resetTokens();
    this.startRound();
  },

  draw_orderShow(g) {
    prompt(g, 'Turn order', 110, COLORS.gold);
    this.drawOrderRow(g, this.newOrder);
  },
};
