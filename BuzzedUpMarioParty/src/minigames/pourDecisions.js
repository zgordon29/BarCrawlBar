import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, rankBy, floor, rand, clamp, arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 20;
const RATE = 0.36;        // glass fills per second while the stream lands in it
const GLASS_W = 70;
const GLASS_H = 260;

class PourDecisions {
  constructor(ctx) {
    this.ctx = ctx;
    this.target = rand(0.6, 0.88);
    this.phase = rand(0, 6.28);
    this.ls = ctx.players.map(() => ({
      tap: 0, level: 0, bust: false, pouring: false, skill: rand(0.5, 0.95), stopAt: 0,
    }));
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  // The glass slides side to side on the bar; same motion for everyone.
  glassX() { return 70 * Math.sin(this.t * 1.7 + this.phase) + 25 * Math.sin(this.t * 3.1); }

  bot(i) {
    const l = this.ls[i];
    if (!l.stopAt) l.stopAt = this.target - (1 - l.skill) * rand(-0.06, 0.14);
    const dx = this.glassX() - l.tap;
    return { x: clamp(dx / 25, -1, 1), y: 0, btn: l.level < l.stopAt && Math.abs(dx) < 30 };
  }

  update(dt, inputs) {
    this.t += dt;
    const gx = this.glassX();
    this.ls.forEach((l, i) => {
      if (l.bust) return;
      const inp = inputs[i];
      l.tap = clamp(l.tap + inp.x * 260 * dt, -130, 130);
      l.pouring = inp.btn;
      l.hit = l.pouring && Math.abs(l.tap - gx) < GLASS_W / 2;
      if (l.hit) l.level += RATE * dt;
      if (l.level > 1) { if (!l.bust) emit('fail', { seat: i }); l.bust = true; l.level = 1; }
    });
    if (this.t >= LIMIT) {
      // Closest to the line wins; an overflowing glass is last.
      this.ranking = rankBy(this.ls.map((l) => (l.bust ? -1 : 1 - Math.abs(l.level - this.target))));
      this.finished = true;
    }
  }

  // Seen from the front: a long bar with a tall glass and a tap for each player.
  draw3d(s, g) {
    const n = this.ls.length;
    const cw = W / n;
    const gx = this.glassX();
    const BAR = 60;     // height of the bar top
    const TAP = 440;    // height of the tap spout
    // A long lens from further back keeps the glasses upright at the edges of the picture.
    arena(s, { cy: 330, pitch: 13, dist: 1750, fov: 26, lookZ: 215, ground: '#1b1424' });
    s.box(W / 2, 200, 1700, 20, 640, '#221a2d');
    s.box(W / 2, 330, 1500, 130, BAR, '#8a5a2b');
    s.box(W / 2, 330, 1520, 150, 10, '#3b2313');
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const cx = cw * i + cw / 2;
      const top = BAR + GLASS_H * l.level;
      if (l.level > 0.01) {
        s.cyl(cx + gx, 330, GLASS_W / 2 - 4, GLASS_H * l.level, l.bust ? '#ff6b5e' : '#f2a51d', { z: BAR });
        s.cyl(cx + gx, 330, GLASS_W / 2 - 4, 8, '#fffaf0', { z: top });
      }
      s.cyl(cx + gx, 330, GLASS_W / 2, GLASS_H, '#d6f1ff', { z: BAR, opacity: 0.22 });
      s.torus(cx + gx, 330, BAR + GLASS_H * this.target, GLASS_W / 2 + 3, '#6ee27a', { tube: 3.5, glow: 0.8 });
      s.box(cx + l.tap, 330, 26, 26, 36, '#c9c2d6', { z: TAP });
      s.box(cx + l.tap, 268, 14, 110, 14, '#c9c2d6', { z: TAP + 20 });
      if (l.pouring && !l.bust) {
        const bottom = l.hit ? top : BAR;
        s.cyl(cx + l.tap, 330, 5, TAP - bottom, '#f2a51d', { z: bottom, shadow: false });
      }
      s.char('p' + i, info.char, cx - cw / 2 + 60, 440, { r: 34, t: this.t, drunk: info.drunk, phase: i, sad: l.bust });
      label3(s, g, `${info.label} ${info.name}`, cx + 30, 470, 30, { size: 20, color: info.color });
      const off = Math.round((l.level - this.target) * 100);
      label3(s, g, l.bust ? 'OVERFLOW!' : `${off > 0 ? '+' : ''}${off}`, cx + 30, 470, 0, {
        size: 22, color: l.bust ? COLORS.bad : Math.abs(off) <= 3 ? COLORS.good : COLORS.ink,
      });
    });
  }

  draw(g) {
    floor(g, '#1b1424', 0);
    const n = this.ls.length;
    const cw = W / n;
    const gx = this.glassX();
    const base = H - 110;
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const cx = cw * i + cw / 2;
      g.fillStyle = i % 2 ? '#221a2d' : '#261d33';
      g.fillRect(cw * i, TOP, cw, H - TOP);
      g.fillStyle = '#8a5a2b';
      g.fillRect(cw * i, base, cw, 22);
      g.fillStyle = '#3b2313';
      g.fillRect(cw * i, base + 22, cw, 12);

      const x = cx + gx - GLASS_W / 2;
      const y = base - GLASS_H;
      g.fillStyle = 'rgba(214,241,255,.14)';
      g.fillRect(x, y, GLASS_W, GLASS_H);
      const fill = GLASS_H * l.level;
      g.fillStyle = l.bust ? COLORS.bad : '#f2a51d';
      g.fillRect(x, base - fill, GLASS_W, fill);
      if (l.level > 0.02) { g.fillStyle = '#fffaf0'; g.fillRect(x, base - fill - 8, GLASS_W, 10); }
      g.strokeStyle = '#d6f1ff';
      g.lineWidth = 4;
      g.strokeRect(x, y, GLASS_W, GLASS_H);
      // The line to hit.
      const ly = base - GLASS_H * this.target;
      g.strokeStyle = COLORS.good;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x - 16, ly);
      g.lineTo(x + GLASS_W + 16, ly);
      g.stroke();

      // The tap and its stream.
      const tx = cx + l.tap;
      g.fillStyle = '#c9c2d6';
      g.fillRect(tx - 12, TOP + 60, 24, 34);
      g.fillRect(tx - 30, TOP + 50, 60, 14);
      if (l.pouring && !l.bust) {
        g.fillStyle = '#f2a51d';
        g.fillRect(tx - 5, TOP + 94, 10, (l.hit ? base - fill : base) - TOP - 94);
      }
      drawCharacter(g, info.char, cw * i + 44, base - 34, 28, { t: this.t, drunk: info.drunk, phase: i, sad: l.bust });
      text(g, `${info.label} ${info.name}`, cx, H - 62, { size: 20, color: info.color });
      const off = Math.round((l.level - this.target) * 100);
      text(g, l.bust ? 'OVERFLOW!' : `${off > 0 ? '+' : ''}${off}`, cx, H - 32, {
        size: 22, color: l.bust ? COLORS.bad : Math.abs(off) <= 3 ? COLORS.good : COLORS.ink,
      });
    });
  }
}

export default {
  name: 'Pour Decisions',
  type: 'ffa',
  howTo: [
    'Fill your glass to the green line. Closest wins.',
    'The glass slides around, so keep the tap over it.',
    'Stick moves the tap. Hold A to pour. Overflow and you lose.',
  ],
  create: (ctx) => new PourDecisions(ctx),
};
