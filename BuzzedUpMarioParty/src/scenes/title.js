import { W, COLORS } from '../config.js';
import { text, backdrop } from '../draw.js';
import { CHARACTERS, drawCharacter } from '../characters.js';
import { state } from '../state.js';
import { sfx, startMusic, audioLocked, isMuted } from '../audio.js';
import { stage } from '../gl/stage.js';
import { SetupScene } from './setup.js';
import { ControlsScene } from './controls.js';

const MENU = [
  { label: 'Bar Crawl', note: 'The full board game: five bars, bottle caps, minigames' },
  { label: 'Minigames', note: 'Pick any minigame and play it straight away' },
  { label: 'Controller Options', note: 'Action button, stick dead zone, vibration' },
];

export class TitleScene {
  enter() {
    this.t = 0;
    this.cursor = 0;
    startMusic();
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    const m = input.merged([...input.devices.keys()]);
    if (m.up) { this.cursor = (this.cursor + MENU.length - 1) % MENU.length; sfx('move'); }
    if (m.down) { this.cursor = (this.cursor + 1) % MENU.length; sfx('move'); }
    if (input.startPressed()) { this.game.go(new ControlsScene(this)); return; }
    if (this.t < 0.3 || !m.pressed) return;
    sfx('select');
    if (this.cursor === 2) { this.game.go(new ControlsScene(this)); return; }
    state.mode = this.cursor === 0 ? 'crawl' : 'free';
    this.game.go(new SetupScene());
  }

  draw(g) {
    backdrop(g, this.t);
    text(g, 'BAR-CRAWL', W / 2, 130, { size: 110, weight: 900, color: '#fff', glow: COLORS.pink, blur: 40 });
    text(g, 'BRAWL', W / 2, 240, { size: 140, weight: 900, color: '#fff', glow: COLORS.blue, blur: 40 });
    CHARACTERS.forEach((c, i) => {
      const x = W / 2 + (i - (CHARACTERS.length - 1) / 2) * 140;
      const y = 370 + Math.sin(this.t * 3 + i) * 8;
      drawCharacter(g, c.id, x, y, 40, { t: this.t, drunk: i / (CHARACTERS.length - 1), phase: i });
    });
    MENU.forEach((item, i) => {
      const sel = i === this.cursor;
      text(g, sel ? `►  ${item.label}  ◄` : item.label, W / 2, 478 + i * 52, {
        size: sel ? 38 : 30, weight: 900, color: sel ? COLORS.gold : COLORS.dim, glow: sel ? COLORS.gold : null,
      });
    });
    text(g, MENU[this.cursor].note, W / 2, 640, { size: 18, weight: 700, color: COLORS.ink });
    const sound = audioLocked() ? 'Press any key or click once to turn sound on' : `M: ${isMuted() ? 'unmute' : 'mute'} sound`;
    const view = stage.ok ? `   V: ${stage.enabled ? 'flat 2D view' : '3D view'}` : '';
    text(g, `Stick / arrows to choose, A / Space / Enter to select.   ${sound}${view}`, W / 2, 672, { size: 15, weight: 600, color: COLORS.dim });
    text(g, 'Drink responsibly. Sips of anything count.', W / 2, 698, { size: 14, weight: 600, color: COLORS.dim });
  }
}
