import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import {
  TOP, mover, drive, dash, bump, keepIn, floor, drawMover, rand, seek, banner, arena, mover3, rails,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 45;
const PR = 28;
const X0 = 160, X1 = W - 160, Y0 = TOP + 40, Y1 = H - 40;
const GRAB_TIME = 6;

// Musical chairs: one lime fewer than players; whoever misses out is eliminated.
class LimeGrab {
  constructor(ctx) {
    this.ctx = ctx;
    const n = ctx.players.length;
    this.ps = ctx.players.map((p, i) => {
      const a = (i / n) * Math.PI * 2;
      return { ...mover(W / 2 + Math.cos(a) * 200, H / 2 + 20 + Math.sin(a) * 160), has: false, outT: 0, skill: rand(0.7, 1) };
    });
    this.limes = [];
    this.phase = 'wait';
    this.pt = 0;
    this.waitFor = rand(1.5, 3.5);
    this.t = 0;
    this.finished = false;
    this.ranking = [];
    this.outOrder = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const me = this.ps[i];
    if (me.out || me.has) return { x: 0, y: 0, btn: false };
    if (this.phase !== 'grab') {
      // Mill about near the middle while waiting.
      const a = this.t * 0.9 + i * 1.6;
      return { ...seek(me, W / 2 + Math.cos(a) * 150, H / 2 + 20 + Math.sin(a) * 110, 0.6), btn: false };
    }
    let best = null;
    let bd = Infinity;
    for (const l of this.limes) {
      if (l.taken) continue;
      const d = Math.hypot(l.x - me.x, l.y - me.y);
      if (d < bd) { bd = d; best = l; }
    }
    if (!best) return { x: 0, y: 0, btn: false };
    return { ...seek(me, best.x, best.y, me.skill), btn: bd > 150 && Math.random() < 0.05 };
  }

  update(dt, inputs) {
    this.t += dt;
    this.pt += dt;
    const alive = this.ps.filter((p) => !p.out);
    this.ps.forEach((p, i) => {
      if (p.out || p.has) return;
      drive(p, inputs[i], dt);
      dash(p, inputs[i]);
      keepIn(p, X0, Y0, X1, Y1, PR);
    });
    bump(this.ps.filter((p) => !p.has), PR);

    if (this.phase === 'wait' && this.pt >= this.waitFor) {
      this.phase = 'grab';
      this.pt = 0;
      this.limes = [];
      for (let k = 0; k < alive.length - 1; k++) {
        this.limes.push({ x: rand(X0 + 60, X1 - 60), y: rand(Y0 + 60, Y1 - 60), taken: false });
      }
    } else if (this.phase === 'grab') {
      for (const l of this.limes) {
        if (l.taken) continue;
        for (const p of alive) {
          if (!p.has && Math.hypot(p.x - l.x, p.y - l.y) < PR + 18) { l.taken = true; p.has = true; break; }
        }
      }
      if (this.limes.every((l) => l.taken) || this.pt > GRAB_TIME) {
        const holders = alive.filter((p) => p.has);
        // If nobody grabbed one, nobody goes out and the round is replayed.
        if (holders.length) {
          const gone = [];
          this.ps.forEach((p, i) => { if (!p.out && !p.has) { p.out = true; p.outT = this.t; gone.push(i); emit('out', p); } });
          if (gone.length) this.outOrder.push(gone);
        }
        this.phase = 'show';
        this.pt = 0;
      }
    } else if (this.phase === 'show' && this.pt > 1.4) {
      this.ps.forEach((p) => { p.has = false; });
      this.limes = [];
      this.phase = 'wait';
      this.pt = 0;
      this.waitFor = rand(1.5, 3.5);
    }

    const left = this.ps.filter((p) => !p.out).length;
    if ((left <= 1 && this.phase !== 'grab') || this.t >= LIMIT) {
      const survivors = this.ps.map((p, i) => i).filter((i) => !this.ps[i].out);
      this.ranking = [survivors, ...this.outOrder.slice().reverse()].filter((grp) => grp.length);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    arena(s, { ground: '#152016' });
    s.flat((X0 + X1) / 2, (Y0 + Y1) / 2, X1 - X0, Y1 - Y0, '#1d2c1f', { z: 0 });
    rails(s, X0, Y0, X1, Y1, '#2f4a31');
    this.limes.forEach((l, k) => {
      if (!l.taken) s.char('lime' + k, 'lime', l.x, l.y, { r: 18, t: this.t, hop: 8 + Math.sin(this.t * 6 + k) * 8 });
    });
    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      if (p.out) {
        const k = (this.t - p.outT) / 0.8;
        if (k < 1) s.char('p' + i, info.char, p.x, p.y, { r: PR, t: this.t, sad: true, alpha: 1 - k, drunk: info.drunk });
        return;
      }
      mover3(s, g, info, p, PR, this.t, { ring: !p.has });
      if (p.has) s.char('held' + i, 'lime', p.x, p.y, { r: 13, z: PR * 2.5 });
    });
    if (this.phase === 'wait') banner(g, 'Wait for it…', 110, COLORS.dim, 34);
    if (this.phase === 'grab') banner(g, 'GRAB A LIME!', 110, COLORS.good, 48);
    text(g, `${this.ps.filter((p) => !p.out).length} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }

  draw(g) {
    floor(g, '#152016', 64);
    g.fillStyle = '#1d2c1f';
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.strokeStyle = '#2f4a31';
    g.lineWidth = 4;
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    for (const l of this.limes) {
      if (l.taken) continue;
      drawCharacter(g, 'lime', l.x, l.y + Math.sin(this.t * 6) * 4, 18, { shadow: true, t: this.t });
    }
    const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        const k = (this.t - p.outT) / 0.8;
        if (k < 1) drawCharacter(g, info.char, p.x, p.y, PR, { t: this.t, sad: true, alpha: 1 - k, drunk: info.drunk });
        continue;
      }
      drawMover(g, info, p, PR, this.t, { ring: !p.has });
      if (p.has) drawCharacter(g, 'lime', p.x + 26, p.y - 30, 12, { shadow: false });
    }
    if (this.phase === 'wait') banner(g, 'Wait for it…', 110, COLORS.dim, 34);
    if (this.phase === 'grab') banner(g, 'GRAB A LIME!', 110, COLORS.good, 48);
    text(g, `${this.ps.filter((p) => !p.out).length} left`, W - 24, 86, { size: 22, align: 'right', color: COLORS.dim });
  }
}

export default {
  name: 'Lime Grab',
  type: 'ffa',
  howTo: [
    'When the limes drop, grab one.',
    'There is always one fewer than players.',
    'Left stick to move. A to shove.',
  ],
  create: (ctx) => new LimeGrab(ctx),
};
