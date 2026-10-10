import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, mover, drive, dash, bump, keepIn, floor, drawMover, rand, seek, arena, mover3, rails } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 35;
const PR = 28;
const X0 = 140, X1 = W - 140, Y0 = TOP + 30, Y1 = H - 30;
const WARN = 0.95;   // seconds a shadow shows before the glass lands

class GlassRain {
  constructor(ctx) {
    this.ctx = ctx;
    const n = ctx.players.length;
    this.ps = ctx.players.map((p, i) => ({
      ...mover(W / 2 + (i - (n - 1) / 2) * 150, H / 2 + 20), outT: 0, skill: rand(0.25, 0.9),
    }));
    this.drops = [];
    this.next = 1;
    this.t = 0;
    this.endT = -1;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const me = this.ps[i];
    if (me.out) return { x: 0, y: 0, btn: false };
    // Run from the most urgent shadow overhead, otherwise drift back to the middle.
    let ax = 0;
    let ay = 0;
    for (const d of this.drops) {
      if (d.landed) continue;
      const dx = me.x - d.x;
      const dy = me.y - d.y;
      const dd = Math.hypot(dx, dy) || 1;
      // Weaker bots notice a shadow late and cut it fine.
      if (d.t > (1 - me.skill) * 0.75 && dd < d.r + PR + 30 * me.skill - 10) { ax += dx / dd; ay += dy / dd; }
    }
    if (ax || ay) {
      const m = Math.hypot(ax, ay) || 1;
      return { x: ax / m, y: ay / m, btn: false };
    }
    const home = seek(me, W / 2 + (i - 1.5) * 120, H / 2 + 20, 0.5);
    return { ...home, btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    this.next -= dt;
    if (this.next <= 0) {
      // Glasses fall faster as the shelf gives way; some are aimed at players.
      this.next = Math.max(0.09, 0.6 - this.t * 0.03);
      const alive = this.ps.filter((p) => !p.out);
      const aimed = alive.length && Math.random() < 0.55;
      const target = aimed ? alive[Math.floor(Math.random() * alive.length)] : null;
      this.drops.push({
        x: target ? target.x + rand(-40, 40) : rand(X0 + 40, X1 - 40),
        y: target ? target.y + rand(-40, 40) : rand(Y0 + 40, Y1 - 40),
        r: rand(48, 76) + Math.min(50, this.t * 1.6), t: 0, landed: false, kind: Math.random() < 0.5 ? 'bottle' : 'glass',
      });
    }
    this.ps.forEach((p, i) => {
      if (p.out) return;
      drive(p, inputs[i], dt);
      dash(p, inputs[i]);
      keepIn(p, X0, Y0, X1, Y1, PR);
    });
    bump(this.ps, PR);
    for (const d of this.drops) {
      d.t += dt;
      if (!d.landed && d.t >= WARN) {
        d.landed = true;
        for (const p of this.ps) {
          if (!p.out && Math.hypot(p.x - d.x, p.y - d.y) < d.r) { p.out = true; p.outT = this.t; emit('out', p); }
        }
      }
    }
    this.drops = this.drops.filter((d) => d.t < WARN + 0.5);

    const alive = this.ps.filter((p) => !p.out).length;
    if (alive <= 1 && this.endT < 0) this.endT = this.t + 0.6;
    if ((this.endT >= 0 && this.t >= this.endT) || this.t >= LIMIT) {
      // Survivors share first place; the rest rank by how long they lasted.
      const idx = this.ps.map((p, i) => i);
      const ranking = [];
      const alives = idx.filter((i) => !this.ps[i].out);
      if (alives.length) ranking.push(alives);
      const dead = idx.filter((i) => this.ps[i].out).sort((a, b) => this.ps[b].outT - this.ps[a].outT);
      for (const i of dead) {
        const last = ranking[ranking.length - 1];
        if (last && this.ps[last[0]].out && this.ps[last[0]].outT === this.ps[i].outT) last.push(i);
        else ranking.push([i]);
      }
      this.ranking = ranking;
      this.finished = true;
    }
  }

  draw3d(s, g) {
    arena(s, { ground: '#1a1424' });
    s.flat((X0 + X1) / 2, (Y0 + Y1) / 2, X1 - X0, Y1 - Y0, '#2b2238', { z: 0 });
    rails(s, X0, Y0, X1, Y1, '#3b2d5c');
    for (const d of this.drops) {
      if (!d.landed) {
        // A red patch marks where the glass will land, and the glass itself falls towards it.
        const k = d.t / WARN;
        s.cyl(d.x, d.y, d.r, 1.5, '#ff6b5e', { z: 0.5, opacity: 0.2 + k * 0.3 });
        s.torus(d.x, d.y, 3, Math.max(4, d.r * k), '#ff6b5e', { tube: 3 });
        const z = (1 - k) * 760 + 4;
        const color = d.kind === 'bottle' ? '#3f9a22' : '#d6f1ff';
        s.cyl(d.x, d.y, 10, 38, color, { z });
        if (d.kind === 'bottle') s.cyl(d.x, d.y, 4, 16, color, { z: z + 38 });
      } else {
        const k = (d.t - WARN) / 0.5;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const rr = d.r * (0.25 + k * 0.8);
          s.box(d.x + Math.cos(ang) * rr, d.y + Math.sin(ang) * rr, 9, 9, 9, '#d6f1ff', { z: 50 * k * (1 - k), opacity: 1 - k, rot: ang });
        }
      }
    }
    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      if (p.out) {
        const k = Math.min(1, (this.t - p.outT) / 0.5);
        s.char('p' + i, info.char, p.x, p.y, { r: PR, t: this.t, drunk: info.drunk, sad: true, tilt: 1.5 * k, alpha: 1 - k * 0.5 });
        return;
      }
      mover3(s, g, info, p, PR, this.t, { ring: true });
    });
    const alive = this.ps.filter((p) => !p.out).length;
    text(g, `${alive} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }

  draw(g) {
    floor(g, '#1a1424', 64);
    g.fillStyle = '#261d33';
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.strokeStyle = '#3b2d5c';
    g.lineWidth = 4;
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);

    for (const d of this.drops) {
      if (!d.landed) {
        const k = d.t / WARN;
        g.beginPath();
        g.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        g.fillStyle = `rgba(255,107,94,${0.12 + k * 0.25})`;
        g.fill();
        g.beginPath();
        g.arc(d.x, d.y, d.r * k, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,107,94,.8)';
        g.lineWidth = 3;
        g.stroke();
      } else {
        // Shattered glass.
        const k = (d.t - WARN) / 0.5;
        g.strokeStyle = `rgba(200,235,255,${1 - k})`;
        g.lineWidth = 4;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          g.beginPath();
          g.moveTo(d.x + Math.cos(ang) * d.r * 0.2, d.y + Math.sin(ang) * d.r * 0.2);
          g.lineTo(d.x + Math.cos(ang) * d.r * (0.4 + k * 0.6), d.y + Math.sin(ang) * d.r * (0.4 + k * 0.6));
          g.stroke();
        }
      }
    }
    const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        const k = Math.min(1, (this.t - p.outT) / 0.5);
        drawCharacter(g, info.char, p.x, p.y, PR, { t: this.t, drunk: info.drunk, sad: true, tilt: 1.57 * k, alpha: 1 - k * 0.6 });
        continue;
      }
      drawMover(g, info, p, PR, this.t, { ring: true });
    }
    // Falling glasses drawn above everything as they come down.
    for (const d of this.drops) {
      if (d.landed) continue;
      const k = d.t / WARN;
      const y = d.y - (1 - k) * 500;
      g.fillStyle = d.kind === 'bottle' ? '#3f9a22' : '#d6f1ff';
      g.beginPath();
      g.roundRect(d.x - 9, y - 22, 18, 36, 5);
      g.fill();
      if (d.kind === 'bottle') g.fillRect(d.x - 4, y - 34, 8, 14);
    }
    const alive = this.ps.filter((p) => !p.out).length;
    text(g, `${alive} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }
}

export default {
  name: 'Glass Rain',
  type: 'ffa',
  howTo: [
    'The shelf is collapsing. Get out of the red shadows.',
    'Last one standing wins.',
    'Left stick to move. A to shove someone into trouble.',
  ],
  create: (ctx) => new GlassRain(ctx),
};
