import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, rankBy, floor, rand, clamp, arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 25;
const DARTS = 3;
const BOARD_R = 120;
const RINGS = [[0.1, 50], [0.28, 25], [0.5, 15], [0.75, 10], [1, 5]];

function scoreAt(d) {
  for (const [edge, pts] of RINGS) if (d <= BOARD_R * edge) return pts;
  return 0;
}

class DartHustle {
  constructor(ctx) {
    this.ctx = ctx;
    this.ls = ctx.players.map((p, i) => ({
      x: rand(-80, 80), y: rand(-80, 80), darts: [], score: 0, cd: 0.8, prev: false,
      skill: rand(0.5, 0.95), ph: i * 1.9,
    }));
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const l = this.ls[i];
    if (l.darts.length >= DARTS) return { x: 0, y: 0, btn: false };
    const d = Math.hypot(l.x, l.y);
    const close = BOARD_R * (0.12 + (1 - l.skill) * 0.7);
    // A shaky hand: weaker bots overcorrect and throw before they are lined up.
    const shake = (1 - l.skill) * 1.6;
    return {
      x: clamp(-l.x / 30, -1, 1) + Math.sin(this.t * 9 + l.ph) * shake,
      y: clamp(-l.y / 30, -1, 1) + Math.cos(this.t * 7 + l.ph) * shake,
      btn: l.cd <= 0 && d < close && Math.random() < 0.05,
    };
  }

  update(dt, inputs) {
    this.t += dt;
    this.ls.forEach((l, i) => {
      if (l.darts.length >= DARTS) return;
      const inp = inputs[i];
      l.cd -= dt;
      // Everyone's hand wanders a little; the stick fights it.
      const sx = Math.sin(this.t * 1.9 + l.ph) * 0.6 + Math.sin(this.t * 3.7 + l.ph * 2) * 0.4;
      const sy = Math.cos(this.t * 1.6 + l.ph) * 0.6 + Math.sin(this.t * 4.1 + l.ph) * 0.4;
      l.x = clamp(l.x + (inp.x * 230 + sx * 85) * dt, -150, 150);
      l.y = clamp(l.y + (inp.y * 230 + sy * 85) * dt, -150, 150);
      if (inp.pressed && l.cd <= 0) {
        const pts = scoreAt(Math.hypot(l.x, l.y));
        l.darts.push({ x: l.x, y: l.y, pts });
        l.score += pts;
        emit(pts ? 'score' : 'fail', { seat: i });
        l.cd = 1;
      }
    });
    if (this.t >= LIMIT || this.ls.every((l) => l.darts.length >= DARTS)) {
      // Equal totals are split by whose darts landed nearer the bull.
      this.ranking = rankBy(this.ls.map((l) => l.score - l.darts.reduce((s, d) => s + Math.hypot(d.x, d.y), 0) * 0.001));
      this.finished = true;
    }
  }

  // Seen from behind the throwers: a dartboard on the wall for each player.
  draw3d(s, g) {
    const n = this.ls.length;
    const cw = W / n;
    const WALL = 200;    // where the wall is, going away from the camera
    const UP = 300;      // height of the middle of each board
    const colors = ['#e2412f', '#2f8f4e', '#f3e7c9', '#22201f', '#f3e7c9'];
    arena(s, { cy: 420, pitch: 12, dist: 1750, fov: 26, lookZ: 235, ground: '#1d1513' });
    s.box(W / 2, WALL - 10, 1700, 20, 700, '#2f221d');
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const cx = cw * i + cw / 2;
      const r0 = BOARD_R + 8;
      s.cyl(cx, WALL + 2, r0, 4, '#111111', { lay: 'y', z: UP - r0 });
      for (let k = RINGS.length - 1; k >= 0; k--) {
        const r = BOARD_R * RINGS[k][0];
        s.cyl(cx, WALL + 5 + (RINGS.length - k), r, 4, colors[k], { lay: 'y', z: UP - r, shadow: false });
      }
      for (const d of l.darts) {
        s.ball(cx + d.x, WALL + 14, UP - d.y, 7, info.color);
        s.cyl(cx + d.x, WALL + 30, 2.5, 30, '#dddddd', { lay: 'y', z: UP - d.y - 2.5 });
        label3(s, g, String(d.pts), cx + d.x, WALL + 30, UP - d.y + 26, { size: 16 });
      }
      if (l.darts.length < DARTS) {
        s.torus(cx + l.x, WALL + 22, UP - l.y, 18, l.cd <= 0 ? '#ffffff' : '#8a8494', { upright: true, tube: 3, glow: 0.7 });
        s.ball(cx + l.x, WALL + 22, UP - l.y, 3, '#ffffff', { glow: 1, shadow: false });
      }
      s.char('p' + i, info.char, cx, 440, { r: 40, t: this.t, drunk: info.drunk, phase: i, face: -Math.PI / 2 + 0.5 });
      label3(s, g, `${info.label} ${info.name}`, cx + 110, 470, 70, { size: 20, color: info.color });
      label3(s, g, `${l.score}`, cx + 110, 470, 30, { size: 40, weight: 900, color: COLORS.gold });
      label3(s, g, `Darts left: ${DARTS - l.darts.length}`, cx + 110, 470, 0, { size: 15, weight: 700, color: COLORS.dim });
    });
  }

  draw(g) {
    floor(g, '#1d1513', 0);
    const n = this.ls.length;
    const cw = W / n;
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const cx = cw * i + cw / 2;
      const cy = TOP + 250;
      g.fillStyle = i % 2 ? '#2a1e1a' : '#2f221d';
      g.fillRect(cw * i, TOP, cw, H - TOP);
      const colors = ['#e2412f', '#2f8f4e', '#f3e7c9', '#22201f', '#f3e7c9'];
      for (let r = RINGS.length - 1; r >= 0; r--) {
        g.beginPath();
        g.arc(cx, cy, BOARD_R * RINGS[r][0], 0, Math.PI * 2);
        g.fillStyle = colors[r];
        g.fill();
      }
      g.beginPath();
      g.arc(cx, cy, BOARD_R, 0, Math.PI * 2);
      g.lineWidth = 8;
      g.strokeStyle = '#111';
      g.stroke();
      for (const d of l.darts) {
        g.fillStyle = info.color;
        g.beginPath();
        g.arc(cx + d.x, cy + d.y, 8, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#111';
        g.lineWidth = 2;
        g.stroke();
        text(g, String(d.pts), cx + d.x, cy + d.y - 20, { size: 16, color: COLORS.ink, stroke: '#111', strokeW: 4 });
      }
      if (l.darts.length < DARTS) {
        const rx = cx + l.x;
        const ry = cy + l.y;
        g.strokeStyle = l.cd <= 0 ? '#fff' : 'rgba(255,255,255,.35)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(rx, ry, 16, 0, Math.PI * 2);
        g.moveTo(rx - 26, ry); g.lineTo(rx + 26, ry);
        g.moveTo(rx, ry - 26); g.lineTo(rx, ry + 26);
        g.stroke();
      }
      drawCharacter(g, info.char, cx, H - 170, 40, { t: this.t, drunk: info.drunk, phase: i });
      text(g, `${info.label} ${info.name}`, cx, H - 100, { size: 20, color: info.color });
      text(g, `${l.score}`, cx, H - 62, { size: 40, weight: 900, color: COLORS.gold });
      text(g, `Darts left: ${DARTS - l.darts.length}`, cx, H - 26, { size: 15, weight: 700, color: COLORS.dim });
    });
  }
}

export default {
  name: 'Dart Hustle',
  type: 'ffa',
  howTo: [
    'Three darts each. Highest total wins.',
    'Your aim drifts, so steady it with the stick.',
    'Press A to throw.',
  ],
  create: (ctx) => new DartHustle(ctx),
};
