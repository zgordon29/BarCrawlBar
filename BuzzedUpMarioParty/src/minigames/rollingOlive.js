import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import {
  TOP, mover, drive, dash, bump, keepIn, teamRanking, floor, drawMover, seek, rand, arena, mover3, label3, rails,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 30;
const X0 = 120, X1 = W - 120, Y0 = TOP + 30, Y1 = H - 30;
const OLIVE_R = 62;
const PR = 24;

class RollingOlive {
  constructor(ctx) {
    this.ctx = ctx;
    this.solo = ctx.players.find((p) => p.team === 0).index;
    this.trio = ctx.players.filter((p) => p.team !== 0).map((p) => p.index);
    this.ps = ctx.players.map(() => mover(0, 0));
    const o = this.ps[this.solo];
    o.x = W / 2;
    o.y = (Y0 + Y1) / 2;
    o.spin = 0;
    this.trio.forEach((i, k) => {
      const p = this.ps[i];
      const a = (k / this.trio.length) * Math.PI * 2 + 0.5;
      p.x = W / 2 + Math.cos(a) * 380;
      p.y = (Y0 + Y1) / 2 + Math.sin(a) * 220;
      p.skill = rand(0.6, 1);
      p.turn = k % 2 ? 1 : -1;
    });
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const o = this.ps[this.solo];
    if (i === this.solo) {
      let target = null;
      let bd = Infinity;
      for (const j of this.trio) {
        const p = this.ps[j];
        if (p.out) continue;
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d < bd) { bd = d; target = p; }
      }
      if (!target) return { x: 0, y: 0, btn: false };
      return { ...seek(o, target.x + target.vx * 0.4, target.y + target.vy * 0.4, 1), btn: bd < 240 && Math.random() < 0.06 };
    }
    const me = this.ps[i];
    if (me.out) return { x: 0, y: 0, btn: false };
    const dx = me.x - o.x;
    const dy = me.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    // Run away, curve sideways so as not to get pinned, and steer off the walls.
    let x = dx / d - (dy / d) * 0.7 * me.turn;
    let y = dy / d + (dx / d) * 0.7 * me.turn;
    const margin = 110;
    if (me.x < X0 + margin) x += (X0 + margin - me.x) / 50;
    if (me.x > X1 - margin) x -= (me.x - (X1 - margin)) / 50;
    if (me.y < Y0 + margin) y += (Y0 + margin - me.y) / 50;
    if (me.y > Y1 - margin) y -= (me.y - (Y1 - margin)) / 50;
    const m = Math.hypot(x, y) || 1;
    return { x: (x / m) * me.skill, y: (y / m) * me.skill, btn: d < 150 && Math.random() < 0.15 };
  }

  update(dt, inputs) {
    this.t += dt;
    const o = this.ps[this.solo];
    // The olive is fast but heavy: slow to get going and slow to turn.
    drive(o, inputs[this.solo], dt, 470, 1.9);
    dash(o, inputs[this.solo], 360, 2.5);
    keepIn(o, X0, Y0, X1, Y1, OLIVE_R);
    o.spin += (Math.hypot(o.vx, o.vy) / OLIVE_R) * dt * Math.sign(o.vx || 1);
    const runners = [];
    for (const i of this.trio) {
      const p = this.ps[i];
      if (p.out) continue;
      drive(p, inputs[i], dt);
      dash(p, inputs[i], 520, 2);
      keepIn(p, X0, Y0, X1, Y1, PR);
      if (Math.hypot(p.x - o.x, p.y - o.y) < OLIVE_R + PR - 14) { p.out = true; p.outT = this.t; emit('out', p); continue; }
      runners.push(p);
    }
    bump(runners, PR, 300);
    const left = this.trio.filter((i) => !this.ps[i].out).length;
    if (left === 0 || this.t >= LIMIT) {
      this.ranking = teamRanking(this.ctx.teams, left === 0 ? 0 : 1);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    const mx = (X0 + X1) / 2;
    const my = (Y0 + Y1) / 2;
    arena(s, { ground: '#17121f' });
    // A gingham tablecloth.
    s.flat(mx, my, X1 - X0, Y1 - Y0, '#f3e7c9', { z: 0 });
    for (let x = X0 + 80; x < X1; x += 80) s.flat(x, my, 3, Y1 - Y0, '#c9b98f', { z: 0.6 });
    for (let y = Y0 + 80; y < Y1; y += 80) s.flat(mx, y, X1 - X0, 3, '#c9b98f', { z: 0.6 });
    rails(s, X0, Y0, X1, Y1, '#8a5a2b', 22);

    for (const i of this.trio) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        // Squashed flat.
        s.char('p' + i, info.char, p.x, p.y, { r: PR, sy: 0.12, sx: 1.6, sad: true });
        continue;
      }
      mover3(s, g, info, p, PR, this.t, { ring: true });
    }
    const o = this.ps[this.solo];
    const info = this.ctx.players[this.solo];
    s.ball(o.x, o.y, OLIVE_R, OLIVE_R, '#8a9a2b');
    // The pimento goes round as the olive rolls.
    s.ball(o.x + Math.cos(o.spin) * OLIVE_R * 0.8, o.y + 8, OLIVE_R + Math.sin(o.spin) * OLIVE_R * 0.8, OLIVE_R * 0.24, '#e2412f');
    s.char('p' + this.solo, info.char, o.x, o.y, { r: 26, z: OLIVE_R * 2 - 8, t: this.t, drunk: info.drunk, phase: this.solo, face: o.face });
    label3(s, g, `${info.label} OLIVE`, o.x, o.y, OLIVE_R * 2 + 90, { color: info.color });
    if (o.cd <= 0) label3(s, g, 'A: boost', o.x, o.y + OLIVE_R + 20, 0, { size: 14, weight: 700, color: COLORS.dim });

    const left = this.trio.filter((i) => !this.ps[i].out).length;
    text(g, `Still running: ${left}`, W / 2, 29, { size: 24 });
  }

  draw(g) {
    floor(g, '#17121f', 80);
    g.fillStyle = '#f3e7c9';
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.strokeStyle = '#c9b98f';
    g.lineWidth = 2;
    for (let x = X0; x <= X1; x += 80) { g.beginPath(); g.moveTo(x, Y0); g.lineTo(x, Y1); g.stroke(); }
    for (let y = Y0; y <= Y1; y += 80) { g.beginPath(); g.moveTo(X0, y); g.lineTo(X1, y); g.stroke(); }
    g.lineWidth = 8;
    g.strokeStyle = '#8a5a2b';
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);

    for (const i of this.trio) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        // Squashed flat.
        g.save();
        g.translate(p.x, p.y + 14);
        g.scale(1.5, 0.3);
        drawCharacter(g, info.char, 0, 0, PR, { shadow: false, sad: true });
        g.restore();
        continue;
      }
      drawMover(g, info, p, PR, this.t, { ring: true });
    }
    const o = this.ps[this.solo];
    const info = this.ctx.players[this.solo];
    g.beginPath();
    g.ellipse(o.x, o.y + OLIVE_R * 0.9, OLIVE_R * 0.9, OLIVE_R * 0.22, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fill();
    g.save();
    g.translate(o.x, o.y);
    g.rotate(o.spin);
    g.beginPath();
    g.arc(0, 0, OLIVE_R, 0, Math.PI * 2);
    g.fillStyle = '#8a9a2b';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = '#4d5714';
    g.stroke();
    g.beginPath();
    g.arc(OLIVE_R * 0.55, 0, OLIVE_R * 0.24, 0, Math.PI * 2);
    g.fillStyle = '#e2412f';
    g.fill();
    g.restore();
    drawCharacter(g, info.char, o.x, o.y - 4, 26, { t: this.t, drunk: info.drunk, shadow: false, phase: this.solo });
    text(g, `${info.label} OLIVE`, o.x, o.y - OLIVE_R - 20, { size: 18, color: info.color, stroke: '#140f1f', strokeW: 5 });
    if (o.cd <= 0) text(g, 'A: boost', o.x, o.y + OLIVE_R + 22, { size: 14, weight: 700, color: COLORS.dim });

    const left = this.trio.filter((i) => !this.ps[i].out).length;
    text(g, `Still running: ${left}`, W / 2, 29, { size: 24 });
  }
}

export default {
  name: 'Rolling Olive',
  type: '1v3',
  howTo: [
    'One of you rides a giant olive. Flatten the other three.',
    'Trio: stay alive until time runs out.',
    'Left stick to move. A to boost (olive) or dash (trio).',
  ],
  create: (ctx) => new RollingOlive(ctx),
};
