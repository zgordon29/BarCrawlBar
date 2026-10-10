import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { arena, tag3 } from './kit.js';
import { emit } from './fx.js';

const CX = W / 2;
const CY = H / 2 + 28;
const R_START = 285;
const R_END = 150;
const SHRINK_TIME = 32;
const LIMIT = 40;
const PR = 30;        // player radius
const ACCEL = 1500;
const FRICTION = 5.5;
const DASH = 620;
const DASH_COOLDOWN = 1.2;

class LastCallBrawl {
  constructor(ctx) {
    this.ctx = ctx;
    const n = ctx.players.length;
    this.ps = ctx.players.map((p, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        x: CX + Math.cos(a) * 170, y: CY + Math.sin(a) * 170, vx: 0, vy: 0,
        face: a + Math.PI, out: false, outT: 0, dashCd: 0.5, dashT: 0, walk: 0, moving: false,
      };
    });
    this.t = 0;
    this.endT = -1;
    this.finished = false;
    this.ranking = [];
  }

  radius() {
    return R_START + (R_END - R_START) * Math.min(1, this.t / SHRINK_TIME);
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const me = this.ps[i];
    if (me.out) return { x: 0, y: 0, btn: false };
    const R = this.radius();
    const dcx = CX - me.x;
    const dcy = CY - me.y;
    const dc = Math.hypot(dcx, dcy);
    let target = null;
    let best = Infinity;
    this.ps.forEach((o, j) => {
      if (j === i || o.out) return;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < best) { best = d; target = o; }
    });
    // Too close to the edge: get back to the middle.
    if (!target || dc > R * 0.62) {
      return { x: (dcx / (dc || 1)) * 0.95, y: (dcy / (dc || 1)) * 0.95, btn: false };
    }
    const tx = target.x - me.x;
    const ty = target.y - me.y;
    const targetOut = Math.hypot(target.x - CX, target.y - CY);
    const btn = best < 100 && me.dashCd <= 0 && targetOut > dc && Math.random() < 0.12;
    return { x: (tx / best) * 0.9, y: (ty / best) * 0.9, btn };
  }

  update(dt, inputs) {
    this.t += dt;
    const R = this.radius();
    this.ps.forEach((p, i) => {
      if (p.out) return;
      const inp = inputs[i];
      const mag = Math.hypot(inp.x, inp.y);
      p.moving = mag > 0.2;
      if (p.moving) { p.face = Math.atan2(inp.y, inp.x); p.walk += dt; }
      p.vx += inp.x * ACCEL * dt;
      p.vy += inp.y * ACCEL * dt;
      p.dashCd -= dt;
      p.dashT -= dt;
      if (inp.pressed && p.dashCd <= 0) {
        p.vx += Math.cos(p.face) * DASH;
        p.vy += Math.sin(p.face) * DASH;
        p.dashT = 0.25;
        p.dashCd = DASH_COOLDOWN;
        emit('dash', { x: p.x, y: p.y, seat: i });
      }
      const f = Math.exp(-FRICTION * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });

    for (let i = 0; i < this.ps.length; i++) {
      for (let j = i + 1; j < this.ps.length; j++) {
        const a = this.ps[i];
        const b = this.ps[j];
        if (a.out || b.out) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d >= PR * 2) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = PR * 2 - d;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -rel * 0.95;
          a.vx -= nx * imp; a.vy -= ny * imp;
          b.vx += nx * imp; b.vy += ny * imp;
        }
        // A shove sends the other player flying.
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (a.dashT > 0) { b.vx += nx * 380; b.vy += ny * 380; a.dashT = 0; emit('shove', { ...mid, seat: i, hit: j }); }
        if (b.dashT > 0) { a.vx -= nx * 380; a.vy -= ny * 380; b.dashT = 0; emit('shove', { ...mid, seat: j, hit: i }); }
      }
    }

    for (const p of this.ps) {
      if (!p.out && Math.hypot(p.x - CX, p.y - CY) > R + 4) { p.out = true; p.outT = this.t; emit('out', { x: p.x, y: p.y, seat: this.ps.indexOf(p) }); }
    }

    const alive = this.ps.filter((p) => !p.out).length;
    if (alive <= 1 && this.endT < 0) this.endT = this.t + 0.5;
    if ((this.endT >= 0 && this.t >= this.endT) || this.t >= LIMIT) this.finish();
  }

  finish() {
    const idx = this.ps.map((p, i) => i);
    // Survivors rank by how close to the middle they held; the rest by how long they lasted.
    const alive = idx.filter((i) => !this.ps[i].out)
      .sort((a, b) => Math.hypot(this.ps[a].x - CX, this.ps[a].y - CY) - Math.hypot(this.ps[b].x - CX, this.ps[b].y - CY));
    const dead = idx.filter((i) => this.ps[i].out).sort((a, b) => this.ps[b].outT - this.ps[a].outT);
    const ranking = alive.map((i) => [i]);
    for (const i of dead) {
      const lastGroup = ranking[ranking.length - 1];
      if (lastGroup && this.ps[lastGroup[0]].out && this.ps[lastGroup[0]].outT === this.ps[i].outT) lastGroup.push(i);
      else ranking.push([i]);
    }
    this.ranking = ranking;
    this.finished = true;
  }

  // A round table on a pedestal over a long drop; anyone shoved off the edge falls.
  draw3d(s, g) {
    arena(s, { ground: '#120d1a', groundZ: -300 });
    const R = this.radius();
    s.cyl(CX, CY, 46, 230, '#3b2313', { z: -300 });
    s.cyl(CX, CY, R + 6, 16, '#5e3a18', { z: -66 });
    s.cyl(CX, CY, R, 50, '#8a5a2b', { z: -50 });
    for (let r = R - 60; r > 30; r -= 70) s.torus(CX, CY, 0.5, r, '#74491f', { tube: 2 });
    if (R > R_END + 4) s.torus(CX, CY, 1, R_END, '#ff6b5e', { tube: 3, glow: 0.6 });
    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      if (p.out) {
        const k = (this.t - p.outT) / 0.9;
        if (k >= 1) return;
        s.char('p' + i, info.char, p.x, p.y, {
          r: PR, z: -k * k * 300, t: this.t, drunk: info.drunk, sad: true, tilt: k * 3, alpha: 1 - k * 0.4, face: p.face,
        });
        return;
      }
      s.torus(p.x, p.y, 3, PR * 1.15, p.dashCd <= 0 ? info.color : '#55506a', { tube: 3 });
      s.char('p' + i, info.char, p.x, p.y, {
        r: PR, t: this.t, drunk: info.drunk, moving: p.moving, walk: p.walk, phase: i, face: p.face,
      });
      tag3(s, g, info, p.x, p.y, PR * 2.7);
    });
    const alive = this.ps.filter((p) => !p.out).length;
    text(g, `${alive} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }

  draw(g) {
    g.fillStyle = '#120d1a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.04)';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    const R = this.radius();
    // Where the table will end up.
    g.setLineDash([8, 10]);
    g.strokeStyle = 'rgba(255,107,94,.35)';
    g.beginPath();
    g.arc(CX, CY, R_END, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    // Table top.
    g.beginPath();
    g.arc(CX, CY + 10, R, 0, Math.PI * 2);
    g.fillStyle = '#3b2313';
    g.fill();
    g.beginPath();
    g.arc(CX, CY, R, 0, Math.PI * 2);
    g.fillStyle = '#8a5a2b';
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#5e3a18';
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.12)';
    g.lineWidth = 3;
    for (let r = R - 50; r > 20; r -= 50) { g.beginPath(); g.arc(CX, CY, r, 0, Math.PI * 2); g.stroke(); }

    const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        const k = (this.t - p.outT) / 0.6;
        if (k >= 1) continue;
        drawCharacter(g, info.char, p.x, p.y + k * 40, PR * (1 - k * 0.6), {
          t: this.t, drunk: info.drunk, alpha: 1 - k, sad: true, tilt: k * 3, shadow: false,
        });
        continue;
      }
      // Shove cooldown ring.
      g.beginPath();
      g.arc(p.x, p.y + PR * 0.9, PR * 0.95, 0, Math.PI * 2);
      g.strokeStyle = p.dashCd <= 0 ? info.color : 'rgba(255,255,255,.2)';
      g.lineWidth = 4;
      g.stroke();
      drawCharacter(g, info.char, p.x, p.y, PR, {
        t: this.t, drunk: info.drunk, moving: p.moving, walk: p.walk, phase: i,
        lookX: Math.cos(p.face), lookY: Math.sin(p.face),
      });
      text(g, info.label, p.x, p.y - PR - 22, { size: 18, color: info.color, stroke: '#140f1f', strokeW: 5 });
    }

    const alive = this.ps.filter((p) => !p.out).length;
    text(g, `${alive} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }
}

export default {
  name: 'Last Call Brawl',
  type: 'ffa',
  howTo: [
    'Knock everyone else off the table.',
    'The table shrinks, so stay near the middle.',
    'Left stick to move. A to shove.',
  ],
  create: (ctx) => new LastCallBrawl(ctx),
};
