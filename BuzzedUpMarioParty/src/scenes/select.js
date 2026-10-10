import { W, COLORS } from '../config.js';
import { text, panel, backdrop, drunkMeter, coin } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { drunkLevel, setDrunkScale } from '../drunk.js';
import { state, humanDevices, newRound } from '../state.js';
import { sfx } from '../audio.js';
import { MINIGAMES, TYPE_LABELS, playable } from '../minigames/index.js';
import { MinigameScene } from '../minigames/runner.js';
import { TitleScene } from './title.js';

const TYPES = ['ffa', '2v2', '1v3'];

// Free play: pick any minigame from a menu.
export class SelectScene {
  enter() {
    this.t = 0;
    setDrunkScale(24);
    this.columns = TYPES.map((type) => MINIGAMES.filter((m) => m.type === type));
    this.col = SelectScene.last ? SelectScene.last.col : 0;
    this.row = SelectScene.last ? SelectScene.last.row : 0;
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    const m = input.merged(humanDevices());
    if (m.left) this.col = (this.col + TYPES.length - 1) % TYPES.length;
    if (m.right) this.col = (this.col + 1) % TYPES.length;
    const len = this.columns[this.col].length;
    this.row = Math.min(this.row, len - 1);
    if (m.up) this.row = (this.row + len - 1) % len;
    if (m.down) this.row = (this.row + 1) % len;
    if (m.left || m.right || m.up || m.down) sfx('move');

    // Testing aids: number keys change how drunk each character is.
    for (let i = 0; i < state.players.length; i++) {
      if (input.keyPressed('Digit' + (i + 1))) state.players[i].sips += 4;
    }
    if (input.keyPressed('Digit0')) state.players.forEach((p) => { p.sips = 0; });

    if (input.backPressed()) { sfx('back'); this.game.go(new TitleScene()); return; }
    const pick = this.columns[this.col][this.row];
    if (m.pressed && playable(pick, state.players.length)) {
      SelectScene.last = { col: this.col, row: this.row };
      newRound();
      this.game.go(new MinigameScene(pick, () => this.game.go(new SelectScene())));
    }
  }

  draw(g) {
    backdrop(g, this.t);
    text(g, 'MINIGAMES', W / 2, 50, { size: 48, weight: 900, glow: COLORS.blue });
    const n = state.players.length;
    this.columns.forEach((list, c) => {
      const x = 50 + c * 400;
      panel(g, x, 90, 380, 400);
      text(g, TYPE_LABELS[TYPES[c]], x + 190, 118, { size: 22, color: COLORS.pink });
      list.forEach((m, r) => {
        const y = 162 + r * 40;
        const sel = c === this.col && r === this.row;
        const ok = playable(m, n);
        if (sel) panel(g, x + 14, y - 18, 352, 36, { r: 10, fill: '#3b2d5c', line: COLORS.gold, lineW: 2 });
        text(g, m.name, x + 30, y, { size: 21, align: 'left', color: ok ? COLORS.ink : '#6f6488' });
        if (!ok) text(g, 'needs 4 players', x + 352, y, { size: 14, weight: 600, align: 'right', color: '#6f6488' });
      });
    });

    state.players.forEach((p, i) => {
      const x = (W - n * 300 + 20) / 2 + i * 300;
      panel(g, x, 510, 280, 150, { line: p.color });
      drawCharacter(g, p.char, x + 60, 572, 36, { t: this.t, drunk: drunkLevel(p.sips), phase: i });
      text(g, `${p.label} ${p.name}`, x + 115, 540, { size: 22, align: 'left', color: p.color });
      coin(g, x + 126, 572, 10);
      text(g, String(p.coins), x + 144, 573, { size: 20, align: 'left' });
      if (p.nonDrinker) text(g, 'not drinking', x + 262, 573, { size: 14, weight: 600, align: 'right', color: COLORS.blue });
      drunkMeter(g, x + 115, 598, 145, p);
    });
    text(g, 'A: play    B / Esc: quit to title    Testing: keys 1-4 add sips to a player, 0 resets', W / 2, 692, {
      size: 16, weight: 600, color: COLORS.dim,
    });
  }
}
