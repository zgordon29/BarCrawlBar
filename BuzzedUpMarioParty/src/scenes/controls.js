import { W, COLORS } from '../config.js';
import { text, panel, backdrop } from '../draw.js';
import { ACTION_NAMES, DEADZONES } from '../input.js';

const ROWS = ['action', 'deadzone', 'rumble', 'back'];
const DEADZONE_ORDER = Object.keys(DEADZONES);
const DEADZONE_LABELS = { small: 'Small (sensitive sticks)', medium: 'Medium', large: 'Large (worn or drifting sticks)' };

// Controller options. Opened on top of another scene and returns to it when closed.
export class ControlsScene {
  constructor(returnTo) { this.returnTo = returnTo; }

  enter() {
    this.t = 0;
    this.cursor = 0;
  }

  close() {
    this.game.input.saveSettings();
    this.game.resume(this.returnTo);
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    const st = input.settings;
    const m = input.merged([...input.devices.keys()]);
    if (m.up) this.cursor = (this.cursor + ROWS.length - 1) % ROWS.length;
    if (m.down) this.cursor = (this.cursor + 1) % ROWS.length;
    const dir = (m.right ? 1 : 0) - (m.left ? 1 : 0);
    const row = ROWS[this.cursor];
    if (dir) {
      if (row === 'action') st.action = (st.action + dir + 4) % 4;
      if (row === 'deadzone') {
        const i = DEADZONE_ORDER.indexOf(st.deadzone);
        st.deadzone = DEADZONE_ORDER[(i + dir + DEADZONE_ORDER.length) % DEADZONE_ORDER.length];
      }
      if (row === 'rumble') {
        st.rumble = !st.rumble;
        if (st.rumble) for (const id of input.devices.keys()) input.rumble(id, 200, 0.8);
      }
    }
    if (this.t > 0.2 && (input.backPressed() || input.startPressed() || (m.pressed && row === 'back'))) this.close();
  }

  draw(g) {
    backdrop(g, this.t);
    const input = this.game.input;
    const st = input.settings;
    text(g, 'CONTROLLER OPTIONS', W / 2, 54, { size: 48, weight: 900, glow: COLORS.blue });

    panel(g, 140, 100, 1000, 250);
    const rows = [
      ['Action button', ACTION_NAMES[st.action]],
      ['Stick dead zone', DEADZONE_LABELS[st.deadzone]],
      ['Vibration', st.rumble ? 'On' : 'Off'],
    ];
    rows.forEach(([name, value], i) => {
      const y = 140 + i * 50;
      const sel = this.cursor === i;
      text(g, name, 190, y, { size: 26, align: 'left', color: sel ? COLORS.gold : COLORS.dim });
      text(g, sel ? `◄  ${value}  ►` : value, 1090, y, { size: 26, align: 'right', color: sel ? COLORS.ink : COLORS.dim });
    });
    const selBack = this.cursor === 3;
    text(g, 'DONE', W / 2, 308, { size: 30, weight: 900, color: selBack ? COLORS.good : COLORS.ink, glow: selBack ? COLORS.good : null });

    text(g, 'Test your controls', W / 2, 388, { size: 24, color: COLORS.pink });
    const shown = [...input.devices.entries()].filter(([id]) => !id.startsWith('kb') || id === 'kb1' || id === 'kb2');
    const cw = 190;
    const x0 = (W - shown.length * cw) / 2;
    shown.forEach(([id, s], i) => {
      const cx = x0 + i * cw + cw / 2;
      panel(g, cx - 85, 415, 170, 215, { line: s.btn ? COLORS.gold : COLORS.panelLine });
      g.beginPath();
      g.arc(cx, 490, 50, 0, Math.PI * 2);
      g.fillStyle = '#120d1c';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = COLORS.panelLine;
      g.stroke();
      g.beginPath();
      g.arc(cx + s.x * 38, 490 + s.y * 38, 14, 0, Math.PI * 2);
      g.fillStyle = COLORS.blue;
      g.fill();
      g.beginPath();
      g.arc(cx, 572, 16, 0, Math.PI * 2);
      g.fillStyle = s.btn ? COLORS.gold : '#3b2d5c';
      g.fill();
      text(g, input.label(id), cx, 608, { size: 14, weight: 700, color: COLORS.dim });
    });
    text(g, 'These options apply to every controller. Phones and keyboards always use their one button.', W / 2, 660, {
      size: 16, weight: 600, color: COLORS.dim,
    });
    // Back is B, unless B has been made the action button.
    text(g, `${st.action === 1 ? 'A' : 'B'} / Esc: back`, W / 2, 692, { size: 16, weight: 600, color: COLORS.dim });
  }
}
