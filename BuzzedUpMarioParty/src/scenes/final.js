import { W, COLORS } from '../config.js';
import { text, panel, backdrop, drunkMeter, coin, bottleCap } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { drunkLevel } from '../drunk.js';
import { state, humanDevices, isPro, beersText } from '../state.js';
import { sfx } from '../audio.js';
import { hostLine } from '../content/host.js';
import { TitleScene } from './title.js';

const PLACES = ['1st', '2nd', '3rd', '4th'];

// The bonus caps handed out at the end. The first three are Mario Party 2's Mini-Game, Coin and
// Happening Stars; the fourth is this game's own. Pro rules award only the first.
const BONUSES = [
  { title: 'Minigame Champ', note: 'most coins won in minigames', score: (p) => p.stats.mgCoins },
  { title: 'High Roller', note: 'highest coin total at any point', score: (p) => p.stats.peak },
  { title: 'Wild Card', note: 'most card spaces landed on', score: (p) => p.stats.cards },
  { title: 'Designated Drinker', note: 'most sips taken', score: (p) => p.sips },
];

// End of the crawl: bonus caps are revealed one at a time, then the final standings.
export class FinalScene {
  enter() {
    this.t = 0;
    const ps = state.players;
    this.bonuses = (isPro() ? BONUSES.slice(0, 1) : BONUSES).map((b) => {
      const top = Math.max(...ps.map(b.score));
      return { ...b, top, who: top > 0 ? ps.filter((p) => b.score(p) === top) : [] };
    });
    this.revealed = 0;
    this.revealT = 1.4;
    // If caps and coins are both level, a die roll settles it, as in the classic rules.
    for (const p of ps) p.tieRoll = Math.random();
    this.rank();
    this.line = hostLine('final', state.settings.rating);
    this.finished = false;
    sfx('fanfare');
  }

  rank() {
    this.order = [...state.players].sort((a, b) => b.caps - a.caps || b.coins - a.coins || b.tieRoll - a.tieRoll);
  }

  update(dt) {
    this.t += dt;
    const done = this.revealed >= this.bonuses.length;
    if (!done) {
      this.revealT -= state.autoplay ? 1 : dt;
      if (this.revealT <= 0) {
        for (const p of this.bonuses[this.revealed].who) p.caps++;
        this.revealed++;
        this.revealT = 1.6;
        this.rank();
        sfx('cap');
      }
      return;
    }
    if (state.autoplay) { this.finished = true; return; }
    if (this.revealT > 0) { this.revealT -= dt; return; }
    if (this.game.input.merged(humanDevices()).pressed) {
      state.game = null;
      this.game.go(new TitleScene());
    }
  }

  draw(g) {
    backdrop(g, this.t);
    text(g, 'CLOSING TIME', W / 2, 46, { size: 54, weight: 900, glow: COLORS.gold });
    text(g, this.line, W / 2, 86, { size: 18, weight: 700, color: COLORS.dim });

    // Bonus caps.
    const nb = this.bonuses.length;
    const bw = nb > 1 ? 300 : 620;
    const bx0 = (W - (nb * bw + (nb - 1) * 12)) / 2;
    this.bonuses.forEach((b, i) => {
      const x = bx0 + i * (bw + 12);
      const shown = i < this.revealed;
      panel(g, x, 106, bw, 70, { line: shown ? COLORS.gold : COLORS.panelLine });
      bottleCap(g, x + 28, 141, 14);
      text(g, b.title, x + 50, 126, { size: 17, align: 'left', color: shown ? COLORS.gold : COLORS.dim });
      text(g, b.note, x + 50, 146, { size: 11, weight: 700, align: 'left', color: COLORS.dim });
      const names = b.who.length ? `${b.who.map((p) => p.name).join(' & ')} (${b.top})` : 'nobody';
      text(g, shown ? names : '. . .', x + 50, 164, { size: 14, align: 'left', color: shown ? COLORS.ink : COLORS.dim });
    });

    const done = this.revealed >= nb;
    const n = this.order.length;
    const cw = 290;
    const x0 = (W - (n * cw + (n - 1) * 16)) / 2;
    this.order.forEach((p, i) => {
      const x = x0 + i * (cw + 16);
      const win = done && i === 0;
      const y = win ? 190 : 204;
      panel(g, x, y, cw, 432, { line: win ? COLORS.gold : p.color, lineW: win ? 7 : 3 });
      text(g, PLACES[i], x + cw / 2, y + 34, { size: 36, weight: 900, color: win ? COLORS.gold : COLORS.ink });
      drawCharacter(g, p.char, x + cw / 2, y + 112 + (win ? Math.sin(this.t * 6) * 8 : 0), win ? 52 : 44, {
        t: this.t, drunk: drunkLevel(p.sips), phase: i, sad: done && i === n - 1 && n > 1,
      });
      text(g, `${p.label} ${p.name}`, x + cw / 2, y + 194, { size: 22, color: p.color });
      bottleCap(g, x + cw / 2 - 66, y + 230, 15);
      text(g, String(p.caps), x + cw / 2 - 44, y + 231, { size: 30, align: 'left' });
      coin(g, x + cw / 2 + 22, y + 230, 12);
      text(g, String(p.coins), x + cw / 2 + 42, y + 231, { size: 24, align: 'left' });
      // What each player did, so the bonus caps make sense and there is something to beat next time.
      const rows = [
        ['Minigames won', p.wins],
        ['Coins from minigames', p.stats.mgCoins],
        ['Most coins held', p.stats.peak],
        ['Card spaces', p.stats.cards],
        ['Sips taken', p.nonDrinker ? 'not drinking' : `${p.sips} (${beersText(p.sips)})`],
      ];
      rows.forEach(([label, value], k) => {
        const ry = y + 270 + k * 23;
        text(g, label, x + 28, ry, { size: 14, weight: 700, align: 'left', color: COLORS.dim });
        text(g, String(value), x + cw - 28, ry, { size: 15, align: 'right', color: COLORS.ink });
      });
      drunkMeter(g, x + 28, y + 392, cw - 56, p);
    });

    if (!done) {
      text(g, 'And the bonus caps go to…', W / 2, 668, { size: 24, color: COLORS.gold });
      return;
    }
    const champ = this.order[0];
    text(g, `A toast to ${champ.name}! Don't forget to drink some water.`, W / 2, 660, { size: 22, color: COLORS.ink });
    if (this.revealT <= 0 && Math.sin(this.t * 4) > -0.3) {
      text(g, 'Press A to return to the title', W / 2, 694, { size: 18, color: COLORS.gold });
    }
  }
}
