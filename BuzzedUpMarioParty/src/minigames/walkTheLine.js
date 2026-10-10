import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LENGTH = 3000;  // course length in pixels
const TOLERANCE = 24;  // how far from the line you can stray
const SPEED = 230;
const LIMIT = 40;
const TOP = 56;
const PLAYER_SCREEN_X = 260;

class WalkTheLine {
  constructor(ctx) {
    this.ctx = ctx;
    const p1 = Math.random() * 6.28;
    const p2 = Math.random() * 6.28;
    // Same wobbly line for everyone; it starts straight and gets wavier.
    this.lineY = (x) => {
      const ramp = Math.min(1, Math.max(0, x) / 250);
      return ramp * (40 * Math.sin(x / 135 + p1) + 16 * Math.sin(x / 52 + p2));
    };
    this.lanes = ctx.players.map(() => ({
      x: 0, y: 0, stun: 0, done: false, time: 0, falls: 0, walk: 0, moving: false,
      skill: 0.72 + Math.random() * 0.2, wob: Math.random() * 6.28,
    }));
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const l = this.lanes[i];
    if (l.stun > 0 || l.done) return { x: 0, y: 0, btn: false };
    const dy = this.lineY(l.x + 28) - l.y;
    const noise = Math.sin(this.t * 5 + l.wob) * 0.3 * (1 - l.skill) * 3;
    return { x: l.skill, y: Math.max(-1, Math.min(1, dy / 14)) + noise, btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    this.lanes.forEach((l, i) => {
      if (l.done) return;
      if (l.stun > 0) { l.stun -= dt; l.moving = false; return; }
      const inp = inputs[i];
      l.x = Math.max(0, l.x + inp.x * SPEED * dt);
      l.y += inp.y * SPEED * dt;
      l.moving = Math.hypot(inp.x, inp.y) > 0.15;
      if (l.moving) l.walk += dt;
      if (Math.abs(l.y - this.lineY(l.x)) > TOLERANCE) {
        l.falls++;
        l.stun = 0.7;
        emit('fail', { seat: i });
        l.x = Math.max(0, l.x - 70);
        l.y = this.lineY(l.x);
      }
      if (l.x >= LENGTH && !l.done) { l.done = true; l.time = this.t; emit('score', { seat: i }); }
    });
    if (this.t >= LIMIT || this.lanes.every((l) => l.done)) this.finish();
  }

  finish() {
    const order = this.lanes.map((l, i) => i).sort((a, b) => {
      const la = this.lanes[a];
      const lb = this.lanes[b];
      if (la.done !== lb.done) return la.done ? -1 : 1;
      return la.done ? la.time - lb.time : lb.x - la.x;
    });
    this.ranking = order.map((i) => [i]);
    this.finished = true;
  }

  // Lanes are laid side by side going away from the camera. Each one scrolls under its own
  // player, so everyone stays at the same place on screen however far apart they really are.
  draw3d(s, g) {
    const n = this.lanes.length;
    const gap = 560 / n;
    arena(s, { cy: 370, pitch: 56, dist: 1300 });
    this.lanes.forEach((l, i) => {
      const p = this.ctx.players[i];
      const lz = 110 + gap * i + gap / 2;
      const cam = l.x - PLAYER_SCREEN_X;
      const wide = gap - 14;
      s.flat(W / 2, lz, 1600, wide, i % 2 ? '#2b2338' : '#251d31', { z: 0.5 });
      for (let fx = Math.floor(cam / 160) * 160; fx < cam + W + 160; fx += 160) s.flat(fx - cam, lz, 4, wide, '#3a3050', { z: 1 });
      const from = Math.max(0, Math.floor(cam / 30) * 30);
      for (let x = from; x < Math.min(LENGTH, cam + W + 120); x += 30) {
        s.strip(x - cam, lz + this.lineY(x), x + 30 - cam, lz + this.lineY(x + 30), TOLERANCE * 2 - 10, '#f5e9c8', { z: 2 });
      }
      const fx = LENGTH - cam;
      if (fx < W + 160) {
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 2; c++) s.flat(fx + 12 + c * 24, lz - wide / 2 + (r + 0.5) * (wide / 6), 24, wide / 6, (r + c) % 2 ? '#ffffff' : '#111111', { z: 2.5 });
        }
      }
      const shake = l.stun > 0 ? Math.sin(this.t * 40) * 5 : 0;
      s.char('p' + i, p.char, l.x - cam + shake, lz + l.y, {
        r: 30, t: this.t, drunk: p.drunk, moving: l.moving, walk: l.walk, phase: i, face: 0.45,
        tilt: l.stun > 0 ? 0.5 : 0, sad: l.stun > 0,
      });
      label3(s, g, `${p.label} ${p.name}`, 30, lz - wide / 2 + 22, 4, { color: p.color, align: 'left' });
      if (l.stun > 0) label3(s, g, 'STUMBLE!', l.x - cam, lz + l.y, 110, { size: 22, color: COLORS.bad });
      if (l.done) label3(s, g, `${l.time.toFixed(1)}s`, 1150, lz, 30, { size: 34, color: COLORS.gold });
      const at = s.project(960, lz - wide / 2 + 22, 4);
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(at.x, at.y - 5, 170, 10);
      g.fillStyle = p.color;
      g.fillRect(at.x, at.y - 5, 170 * Math.min(1, l.x / LENGTH), 10);
    });
  }

  draw(g) {
    const n = this.lanes.length;
    const laneH = (H - TOP) / n;
    g.fillStyle = '#17121f';
    g.fillRect(0, 0, W, H);
    this.lanes.forEach((l, i) => {
      const p = this.ctx.players[i];
      const top = TOP + i * laneH;
      const mid = top + laneH / 2;
      const cam = l.x - PLAYER_SCREEN_X;
      g.save();
      g.beginPath();
      g.rect(0, top, W, laneH);
      g.clip();
      g.fillStyle = i % 2 ? '#2b2338' : '#251d31';
      g.fillRect(0, top, W, laneH);
      // Floor seams scroll past to show movement.
      g.strokeStyle = 'rgba(255,255,255,.05)';
      g.lineWidth = 2;
      for (let fx = Math.floor(cam / 120) * 120; fx < cam + W; fx += 120) {
        g.beginPath();
        g.moveTo(fx - cam, top);
        g.lineTo(fx - cam, top + laneH);
        g.stroke();
      }
      // The line.
      g.strokeStyle = '#f5e9c8';
      g.lineWidth = TOLERANCE * 2 - 10;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      const from = Math.max(0, Math.floor(cam / 12) * 12);
      for (let x = from; x <= Math.min(LENGTH, cam + W + 12); x += 12) {
        const sx = x - cam;
        const sy = mid + this.lineY(x);
        if (x === from) g.moveTo(sx, sy); else g.lineTo(sx, sy);
      }
      g.stroke();
      // Finish banner.
      const fx = LENGTH - cam;
      if (fx < W + 40) {
        for (let r = 0; r < Math.ceil(laneH / 16); r++) {
          for (let c = 0; c < 2; c++) {
            g.fillStyle = (r + c) % 2 ? '#fff' : '#111';
            g.fillRect(fx + c * 16, top + r * 16, 16, 16);
          }
        }
      }
      const shake = l.stun > 0 ? Math.sin(this.t * 40) * 5 : 0;
      drawCharacter(g, p.char, l.x - cam + shake, mid + l.y - 27, 30, {
        t: this.t, drunk: p.drunk, moving: l.moving, walk: l.walk, phase: i,
        tilt: l.stun > 0 ? 0.5 : 0, sad: l.stun > 0,
      });
      if (l.stun > 0) {
        text(g, 'STUMBLE!', l.x - cam, mid + l.y - 82, { size: 22, color: COLORS.bad, stroke: '#140f1f', strokeW: 5 });
      }
      g.restore();

      text(g, `${p.label} ${p.name}`, 16, top + 20, { size: 18, align: 'left', color: p.color, stroke: '#140f1f', strokeW: 4 });
      // Progress bar.
      const bw = 220;
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(W - bw - 20, top + 12, bw, 10);
      g.fillStyle = p.color;
      g.fillRect(W - bw - 20, top + 12, bw * Math.min(1, l.x / LENGTH), 10);
      if (l.done) {
        text(g, `${l.time.toFixed(1)}s`, W - 30, mid, { size: 38, align: 'right', color: COLORS.gold, stroke: '#140f1f', strokeW: 6 });
      }
    });
  }
}

export default {
  name: 'Walk the Line',
  type: 'ffa',
  howTo: [
    'Follow the painted line to the finish.',
    'Step off it and you stumble backwards.',
    'Left stick to walk. No button needed.',
  ],
  create: (ctx) => new WalkTheLine(ctx),
};
