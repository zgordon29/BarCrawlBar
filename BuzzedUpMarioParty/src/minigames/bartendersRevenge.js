import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import {
  TOP, mover, drive, dash, bump, keepIn, teamRanking, floor, drawMover, clamp, rand, arena, mover3, label3, rails,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 30;
const X0 = 120, X1 = W - 120;
const BAR_Y = TOP + 80;
const Y0 = TOP + 190, Y1 = H - 24;
const PR = 26;
const MUG_R = 22;
const MUG_SPEED = 700;
const FIRE_COOLDOWN = 0.3;
const LIVES = 2;

class BartendersRevenge {
  constructor(ctx) {
    this.ctx = ctx;
    this.solo = ctx.players.find((p) => p.team === 0).index;
    this.trio = ctx.players.filter((p) => p.team !== 0).map((p) => p.index);
    this.bar = { x: W / 2, cd: 1, aim: 0, aimT: 0 };
    this.ps = ctx.players.map(() => mover(0, 0));
    this.trio.forEach((i, k) => {
      const p = this.ps[i];
      p.x = W / 2 + (k - (this.trio.length - 1) / 2) * 260;
      p.y = Y0 + 150 + (k % 2) * 110;
      p.lives = LIVES;
      p.safe = 0;
      p.homeX = p.x;
      p.homeY = p.y;
      p.skill = rand(0.5, 0.95);
    });
    this.mugs = [];
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    if (i === this.solo) {
      const alive = this.trio.map((j) => this.ps[j]).filter((p) => !p.out);
      if (!alive.length) return { x: 0, y: 0, btn: false };
      // Switch targets every couple of seconds so nobody gets a free ride.
      this.bar.aimT -= 1 / 60;
      if (this.bar.aimT <= 0) { this.bar.aim = Math.floor(Math.random() * alive.length); this.bar.aimT = 2; }
      const target = alive[this.bar.aim % alive.length];
      const dx = target.x + target.vx * 0.35 - this.bar.x;
      return { x: clamp(dx / 40, -1, 1), y: 0, btn: Math.abs(dx) < 34 && Math.floor(this.t * 20) % 2 === 0 };
    }
    const me = this.ps[i];
    if (me.out) return { x: 0, y: 0, btn: false };
    let x = clamp((me.homeX - me.x) / 200, -0.4, 0.4);
    for (const m of this.mugs) {
      if (m.y < me.y && me.y - m.y < 210 * me.skill + 40 && Math.abs(m.x - me.x) < PR + MUG_R + 10) {
        x = m.x > me.x ? -1 : 1;
        if (m.x === me.x) x = i % 2 ? 1 : -1;
      }
    }
    return { x, y: clamp((me.homeY - me.y) / 120, -0.5, 0.5), btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    const b = this.bar;
    const bi = inputs[this.solo];
    b.x = clamp(b.x + bi.x * 430 * dt, X0, X1);
    b.cd -= dt;
    if (bi.pressed && b.cd <= 0) {
      this.mugs.push({ x: b.x, y: BAR_Y + 30 });
      b.cd = FIRE_COOLDOWN;
    }
    for (const m of this.mugs) m.y += MUG_SPEED * dt;
    this.mugs = this.mugs.filter((m) => m.y < H + 40 && !m.gone);

    const alive = [];
    for (const i of this.trio) {
      const p = this.ps[i];
      if (p.out) continue;
      alive.push(p);
      p.safe -= dt;
      drive(p, inputs[i], dt);
      dash(p, inputs[i], 520, 1.5);
      keepIn(p, X0, Y0, X1, Y1, PR);
      if (p.safe > 0) continue;
      for (const m of this.mugs) {
        if (!m.gone && Math.hypot(m.x - p.x, m.y - p.y) < PR + MUG_R) {
          m.gone = true;
          p.lives--;
          emit(p.lives <= 0 ? 'out' : 'hit', p);
          p.safe = 1;
          if (p.lives <= 0) { p.out = true; p.outT = this.t; }
          break;
        }
      }
    }
    bump(alive, PR, 300);
    const left = this.trio.filter((i) => !this.ps[i].out).length;
    if (left === 0 || this.t >= LIMIT) {
      this.ranking = teamRanking(this.ctx.teams, left === 0 ? 0 : 1);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    const bottles = ['#3f9a22', '#f2a51d', '#7fd6ff', '#ff7ac2'];
    arena(s, { ground: '#1b1424' });
    s.flat(W / 2, (Y0 + Y1) / 2, X1 - X0, Y1 - Y0, '#261d33', { z: 0 });
    rails(s, X0, Y0, X1, Y1, '#3b2d5c', 10);
    // The bar, with the bartender behind it and a shelf of bottles on the wall.
    s.box(W / 2, BAR_Y - 60, X1 - X0 + 200, 16, 210, '#221a2d');
    s.box(W / 2, BAR_Y - 46, X1 - X0 + 140, 18, 6, '#5e3a18', { z: 120 });
    for (let k = 0; k < 14; k++) s.cyl(170 + k * 72, BAR_Y - 44, 7, 30, bottles[k % 4], { z: 126 });
    s.box(W / 2, BAR_Y + 40, X1 - X0 + 120, 36, 56, '#8a5a2b');
    const sInfo = this.ctx.players[this.solo];
    s.char('p' + this.solo, sInfo.char, this.bar.x, BAR_Y - 6, { r: 34, t: this.t, drunk: sInfo.drunk, phase: this.solo });
    label3(s, g, `${sInfo.label} BARTENDER`, this.bar.x, BAR_Y - 6, 110, { size: 16, color: sInfo.color });

    for (const m of this.mugs) {
      s.cyl(m.x, m.y, 13, 30, '#f2a51d');
      s.cyl(m.x, m.y, 13.5, 7, '#fffaf0', { z: 30 });
    }
    for (const i of this.trio) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        const k = Math.min(1, (this.t - p.outT) / 0.6);
        s.char('p' + i, info.char, p.x, p.y, { r: PR, t: this.t, sad: true, tilt: 1.5 * k, alpha: 1 - k * 0.6, drunk: info.drunk });
        continue;
      }
      const blink = p.safe > 0 && Math.floor(this.t * 12) % 2 === 0;
      mover3(s, g, info, p, PR, this.t, { ring: true, alpha: blink ? 0.4 : 1 });
      const at = s.project(p.x, p.y + PR + 14, 0);
      for (let k = 0; k < p.lives; k++) {
        g.beginPath();
        g.arc(at.x - 8 + k * 16, at.y, 5, 0, Math.PI * 2);
        g.fillStyle = COLORS.bad;
        g.fill();
      }
    }
    const left = this.trio.filter((i) => !this.ps[i].out).length;
    text(g, `Survivors: ${left}`, W / 2, 29, { size: 24 });
  }

  draw(g) {
    floor(g, '#1b1424', 64);
    g.fillStyle = '#3b2313';
    g.fillRect(X0 - 60, BAR_Y + 30, X1 - X0 + 120, 34);
    g.fillStyle = '#8a5a2b';
    g.fillRect(X0 - 60, BAR_Y + 22, X1 - X0 + 120, 26);
    g.strokeStyle = 'rgba(255,255,255,.06)';
    g.lineWidth = 3;
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);

    const sInfo = this.ctx.players[this.solo];
    drawCharacter(g, sInfo.char, this.bar.x, BAR_Y - 14, 34, { t: this.t, drunk: sInfo.drunk, phase: this.solo });
    text(g, `${sInfo.label} BARTENDER`, this.bar.x, BAR_Y - 64, { size: 16, color: sInfo.color, stroke: '#140f1f', strokeW: 4 });

    for (const m of this.mugs) {
      g.fillStyle = '#f2a51d';
      g.beginPath();
      g.roundRect(m.x - 13, m.y - 16, 26, 32, 5);
      g.fill();
      g.fillStyle = '#fffaf0';
      g.fillRect(m.x - 13, m.y - 20, 26, 8);
    }
    for (const i of this.trio) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (p.out) {
        const k = Math.min(1, (this.t - p.outT) / 0.6);
        drawCharacter(g, info.char, p.x, p.y, PR, { t: this.t, sad: true, tilt: 1.57 * k, alpha: 1 - k * 0.7, drunk: info.drunk });
        continue;
      }
      const blink = p.safe > 0 && Math.floor(this.t * 12) % 2 === 0;
      drawMover(g, info, p, PR, this.t, { ring: true, alpha: blink ? 0.4 : 1 });
      for (let k = 0; k < p.lives; k++) {
        g.beginPath();
        g.arc(p.x - 8 + k * 16, p.y + PR + 16, 5, 0, Math.PI * 2);
        g.fillStyle = COLORS.bad;
        g.fill();
      }
    }
    const left = this.trio.filter((i) => !this.ps[i].out).length;
    text(g, `Survivors: ${left}`, W / 2, 29, { size: 24 });
  }
}

export default {
  name: 'Bartender\'s Revenge',
  type: '1v3',
  howTo: [
    'Bartender: sling mugs down the bar at the trio.',
    'Trio: two hits and you are out. Survive until time runs out.',
    'Stick to move. A slings a mug (bartender) or dashes (trio).',
  ],
  create: (ctx) => new BartendersRevenge(ctx),
};
