import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import {
  TOP, mover, drive, bump, keepIn, rankBy, floor, drawMover, rand, clamp, arena, mover3, label3, hsl,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 30;
const PR = 26;
const START_X = 90;
const GOAL_X = 1180;

class TrayDash {
  constructor(ctx) {
    this.ctx = ctx;
    const n = ctx.players.length;
    this.ps = ctx.players.map((p, i) => ({
      ...mover(START_X, TOP + 110 + i * ((H - TOP - 220) / Math.max(1, n - 1))),
      tray: 100, done: false, time: 0, slosh: 0, pvx: 0, pvy: 0, skill: rand(0.55, 0.8), lane: rand(-60, 60),
    }));
    // Patrons wander up and down in columns across the floor.
    this.patrons = [];
    for (let i = 0; i < 9; i++) {
      this.patrons.push({
        x: 230 + i * 105, y: rand(TOP + 60, H - 60), vy: rand(90, 190) * (Math.random() < 0.5 ? -1 : 1),
        r: 24, hue: Math.floor(rand(0, 360)),
      });
    }
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const p = this.ps[i];
    if (p.done) return { x: 0, y: 0, btn: false };
    let y = 0;
    for (const q of this.patrons) {
      const dx = q.x - p.x;
      if (dx > -20 && dx < 110 && Math.abs(q.y - p.y) < 75) y = q.y > p.y ? -1 : 1;
    }
    const homeY = clamp(H / 2 + 28 + p.lane + (i - 1.5) * 90, TOP + 60, H - 60);
    if (!y) y = clamp((homeY - p.y) / 80, -0.5, 0.5);
    return { x: p.skill, y: y * 0.8, btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    for (const q of this.patrons) {
      q.y += q.vy * dt;
      if (q.y < TOP + 40) { q.y = TOP + 40; q.vy = Math.abs(q.vy); }
      if (q.y > H - 40) { q.y = H - 40; q.vy = -Math.abs(q.vy); }
    }
    this.ps.forEach((p, i) => {
      if (p.done) return;
      p.pvx = p.vx; p.pvy = p.vy;
      drive(p, inputs[i], dt, 1300, 5);
      keepIn(p, 30, TOP + 10, W - 30, H - 10, PR);
    });
    bump(this.ps.filter((p) => !p.done), PR, 0);
    for (const p of this.ps) {
      if (p.done) continue;
      for (const q of this.patrons) {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < PR + q.r) {
          p.x = q.x + (dx / d) * (PR + q.r);
          p.y = q.y + (dy / d) * (PR + q.r);
          p.vx = (dx / d) * 260;
          p.vy = (dy / d) * 260;
          p.tray = Math.max(0, p.tray - 12);
          p.slosh = 1;
        }
      }
      // Jerky movement sloshes the drinks; smooth walking keeps them in the glass.
      const jerk = Math.hypot(p.vx - p.pvx, p.vy - p.pvy) / dt;
      p.slosh = Math.max(p.slosh * Math.exp(-4 * dt), clamp((jerk - 900) / 2500, 0, 1));
      p.tray = Math.max(0, p.tray - p.slosh * 22 * dt);
      if (p.x >= GOAL_X && !p.done) { p.done = true; p.time = this.t; emit('score', p); }
    }
    if (this.t >= LIMIT || this.ps.every((p) => p.done)) {
      // Fullest tray wins. Anyone who did not arrive ranks below everyone who did.
      this.ranking = rankBy(this.ps.map((p) => (p.done ? 1000 + p.tray - p.time * 0.01 : p.x / 10)));
      this.finished = true;
    }
  }

  draw3d(s, g) {
    arena(s, { ground: '#1a1322' });
    const my = (TOP + H) / 2;
    s.flat(W / 2, my, W - 20, H - TOP - 10, '#2c2138', { z: 0 });
    s.flat((GOAL_X + W) / 2, my, W - GOAL_X, H - TOP - 10, '#2f5a3a', { z: 1 });
    s.box(GOAL_X + 60, my, 50, 320, 44, '#5e3a18');
    for (const q of this.patrons) {
      s.cyl(q.x, q.y, q.r * 0.8, 52, hsl(q.hue, 35, 45));
      s.ball(q.x, q.y, 70, q.r * 0.62, hsl(q.hue, 30, 70));
    }
    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      mover3(s, g, info, p, PR, this.t, { label: false });
      // The tray rides above the character's head; the drinks on it drain as it spills.
      const top = PR * 2.35;
      s.cyl(p.x, p.y, 22, 3, '#c9c2d6', { z: top });
      for (let k = 0; k < 3; k++) s.cyl(p.x - 12 + k * 12, p.y + (k % 2 ? 5 : -5), 5, 3 + 15 * (p.tray / 100), '#f2a51d', { z: top + 3 });
      const at = s.project(p.x, p.y, top + 50);
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(at.x - 30, at.y, 60, 9);
      g.fillStyle = p.tray > 50 ? COLORS.gold : COLORS.bad;
      g.fillRect(at.x - 30, at.y, 60 * p.tray / 100, 9);
      text(g, info.label, at.x, at.y - 14, { size: 16, color: info.color, stroke: '#140f1f', strokeW: 4 });
      if (p.done) label3(s, g, `${Math.round(p.tray)}%`, p.x, p.y, top + 90, { size: 22, color: COLORS.good });
      else if (p.slosh > 0.3) label3(s, g, 'SPILL!', p.x, p.y, top + 90, { size: 16, color: COLORS.bad });
    });
    label3(s, g, 'TABLE', GOAL_X + 60, TOP + 40, 60, { color: COLORS.good });
  }

  draw(g) {
    floor(g, '#241a2e', 64);
    g.fillStyle = 'rgba(110,226,122,.14)';
    g.fillRect(GOAL_X, TOP, W - GOAL_X, H - TOP);
    text(g, 'TABLE', GOAL_X + 50, TOP + 26, { size: 18, color: COLORS.good });
    for (const q of this.patrons) {
      g.beginPath();
      g.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      g.fillStyle = `hsl(${q.hue} 35% 45%)`;
      g.fill();
      g.beginPath();
      g.arc(q.x, q.y - 6, q.r * 0.55, 0, Math.PI * 2);
      g.fillStyle = `hsl(${q.hue} 30% 70%)`;
      g.fill();
    }
    const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      drawMover(g, info, p, PR, this.t);
      // Tray gauge above the character.
      const bw = 60;
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(p.x - bw / 2, p.y - PR - 50, bw, 9);
      g.fillStyle = p.tray > 50 ? COLORS.gold : COLORS.bad;
      g.fillRect(p.x - bw / 2, p.y - PR - 50, bw * p.tray / 100, 9);
      if (p.slosh > 0.3) text(g, 'SPILL!', p.x, p.y + PR + 18, { size: 16, color: COLORS.bad, stroke: '#140f1f', strokeW: 4 });
      if (p.done) text(g, `${Math.round(p.tray)}%`, p.x, p.y + PR + 20, { size: 22, color: COLORS.good, stroke: '#140f1f', strokeW: 5 });
    }
  }
}

export default {
  name: 'Tray Dash',
  type: 'ffa',
  howTo: [
    'Carry your tray across the bar to the table.',
    'Sudden moves and bumping into people spill it.',
    'Fullest tray wins. Left stick to walk.',
  ],
  create: (ctx) => new TrayDash(ctx),
};
