import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, rankBy, floor, rand, arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 40;
const SLIDES = 3;
const BAR_X0 = 200;
const BAR_X1 = 1180;
const HALF_WIDTH = 34;   // how far the pint can drift sideways before it falls off
const AIM_TIME = 6;

class BarSlide {
  constructor(ctx) {
    this.ctx = ctx;
    this.ls = ctx.players.map((p) => ({
      phase: 'aim', t: 0, power: 0, charging: false, pos: 0, target: 0, side: 0, left: SLIDES,
      best: 0, last: null, fell: false, skill: rand(0.72, 0.9), want: 0, drunk: p.drunk, offset: rand(0, 2),
    }));
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  // Power swings back and forth; drunk players get an uneven swing.
  meter(l) {
    const wobble = l.drunk * 0.35 * Math.sin(l.t * 7.3);
    const phase = (((l.t * 1.5 + wobble + l.offset) % 2) + 2) % 2;
    return phase < 1 ? phase : 2 - phase;
  }

  launch(l) {
    l.phase = 'slide';
    l.target = l.power * 1.14;   // full power overshoots the end of the bar
    l.pos = 0;
    l.side = 0;
    l.t = 0;
    l.fell = false;
    l.want = 0;
  }

  bot(i) {
    const l = this.ls[i];
    if (l.phase === 'aim') {
      if (!l.want) l.want = rand(0.8 - (1 - l.skill) * 0.9, 0.88);
      const m = this.meter(l);
      return { x: 0, y: 0, btn: l.t < 0.4 || Math.abs(m - l.want) > 0.03 };
    }
    return { x: 0, y: Math.max(-1, Math.min(1, -l.side / 14)), btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    this.ls.forEach((l, i) => {
      const inp = inputs[i];
      l.t += dt;
      if (l.phase === 'aim') {
        if (inp.btn) { l.charging = true; l.power = this.meter(l); }
        else if (l.charging) this.launch(l);
        // Out of time: the pint goes with whatever the meter shows.
        if (l.phase === 'aim' && l.t > AIM_TIME) { l.power = this.meter(l); this.launch(l); }
      } else if (l.phase === 'slide') {
        // Ease out towards the stopping point while the player keeps the pint on the bar.
        l.pos += (l.target - l.pos) * (1 - Math.exp(-2.6 * dt)) + 0.02 * dt;
        l.side += inp.y * 90 * dt;
        if (Math.abs(l.side) > HALF_WIDTH || l.pos > 1) { l.fell = true; this.endSlide(l); }
        else if (l.pos >= l.target - 0.004 || l.t > 4) this.endSlide(l);
      } else if (l.phase === 'rest' && l.t > 1.1) {
        if (l.left > 0) { l.phase = 'aim'; l.t = 0; l.charging = false; l.power = 0; }
        else l.phase = 'done';
      }
    });
    if (this.t >= LIMIT || this.ls.every((l) => l.phase === 'done')) {
      this.ranking = rankBy(this.ls.map((l) => l.best));
      this.finished = true;
    }
  }

  endSlide(l) {
    emit(l.fell ? 'fail' : 'score', { seat: this.ls.indexOf(l) });
    l.last = l.fell ? 0 : Math.min(1, l.pos);
    l.best = Math.max(l.best, l.last);
    l.left--;
    l.phase = 'rest';
    l.t = 0;
  }

  // One bar top per player, side by side going away from the camera.
  draw3d(s, g) {
    const n = this.ls.length;
    const gap = 560 / n;
    const len = BAR_X1 - BAR_X0;
    const wide = HALF_WIDTH * 2 + 12;
    arena(s, { cy: 380, pitch: 52, dist: 1250, ground: '#1b1424' });
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const lz = 110 + gap * i + gap / 2;
      s.box((BAR_X0 + BAR_X1) / 2, lz, len, wide, 60, '#8a5a2b');
      s.box((BAR_X0 + BAR_X1) / 2, lz, len + 12, wide + 12, 10, '#3b2313');
      s.flat(BAR_X1 - 45, lz, 90, wide, '#ffc83d', { z: 60.6, opacity: 0.45 });
      if (l.best > 0) s.box(BAR_X0 + l.best * len, lz, 5, wide, 3, info.color, { z: 60 });
      s.char('p' + i, info.char, 110, lz, { r: 34, t: this.t, drunk: info.drunk, phase: i, face: 0.45 });
      label3(s, g, `${info.label} ${info.name}`, 110, lz + 46, 0, { size: 16, color: info.color });
      label3(s, g, `Best ${Math.round(l.best * 100)}`, BAR_X1 + 24, lz - 8, 60, { size: 17, color: COLORS.gold, align: 'left' });
      label3(s, g, `${Math.max(0, l.left)} left`, BAR_X1 + 24, lz + 16, 60, { size: 13, weight: 700, color: COLORS.dim, align: 'left' });

      if (l.phase === 'aim') {
        const at = s.project(BAR_X0 + 120, lz, 110);
        const bw = 150;
        const m = l.charging ? l.power : 0;
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.fillRect(at.x - bw / 2, at.y - 10, bw, 20);
        g.fillStyle = m > 0.88 ? COLORS.bad : m > 0.7 ? COLORS.good : COLORS.gold;
        g.fillRect(at.x - bw / 2, at.y - 10, bw * m, 20);
        g.fillStyle = '#fff';
        g.fillRect(at.x - bw / 2 + bw * 0.877, at.y - 14, 3, 28);
        text(g, l.charging ? 'Release!' : 'Hold A', at.x + bw / 2 + 56, at.y, { size: 20, color: COLORS.ink, stroke: '#140f1f', strokeW: 5 });
      } else if (l.phase === 'slide' || l.phase === 'rest') {
        const x = BAR_X0 + Math.min(1.05, l.pos) * len;
        const fallen = l.fell && l.phase === 'rest';
        // A pint that leaves the bar drops to the floor.
        const dz = fallen ? Math.max(-60, -l.t * l.t * 600) : 0;
        if (!fallen || l.t < 0.7) {
          s.cyl(x, lz + l.side, 14, 30, '#f2a51d', { z: 60 + dz });
          s.cyl(x, lz + l.side, 14.5, 7, '#fffaf0', { z: 90 + dz });
        }
        if (l.phase === 'rest') {
          label3(s, g, fallen ? 'SMASH!' : String(Math.round(l.last * 100)), x, lz, 140, { size: 26, color: fallen ? COLORS.bad : COLORS.good });
        }
      }
    });
  }

  draw(g) {
    floor(g, '#1b1424', 0);
    const n = this.ls.length;
    const laneH = (H - TOP) / n;
    this.ls.forEach((l, i) => {
      const info = this.ctx.players[i];
      const mid = TOP + laneH * i + laneH / 2;
      // The bar top.
      g.fillStyle = '#3b2313';
      g.fillRect(BAR_X0, mid - HALF_WIDTH - 6, BAR_X1 - BAR_X0, HALF_WIDTH * 2 + 20);
      g.fillStyle = '#8a5a2b';
      g.fillRect(BAR_X0, mid - HALF_WIDTH - 6, BAR_X1 - BAR_X0, HALF_WIDTH * 2 + 12);
      g.fillStyle = 'rgba(255,200,61,.25)';
      g.fillRect(BAR_X1 - 90, mid - HALF_WIDTH - 6, 90, HALF_WIDTH * 2 + 12);
      // Best mark so far.
      if (l.best > 0) {
        const bx = BAR_X0 + l.best * (BAR_X1 - BAR_X0);
        g.fillStyle = info.color;
        g.fillRect(bx - 2, mid - HALF_WIDTH - 6, 4, HALF_WIDTH * 2 + 12);
      }
      drawCharacter(g, info.char, 110, mid - 6, 34, { t: this.t, drunk: info.drunk, phase: i });
      text(g, `${info.label} ${info.name}`, 110, mid + 54, { size: 16, color: info.color });
      text(g, `Slides left: ${Math.max(0, l.left)}`, BAR_X1 + 12, mid - 24, { size: 14, weight: 700, align: 'left', color: COLORS.dim });
      text(g, `Best ${Math.round(l.best * 100)}`, BAR_X1 + 12, mid + 2, { size: 20, align: 'left', color: COLORS.gold });

      if (l.phase === 'aim') {
        const bw = 150;
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.fillRect(BAR_X0 + 16, mid - 10, bw, 20);
        const m = l.charging ? l.power : 0;
        g.fillStyle = m > 0.88 ? COLORS.bad : m > 0.7 ? COLORS.good : COLORS.gold;
        g.fillRect(BAR_X0 + 16, mid - 10, bw * m, 20);
        g.fillStyle = '#fff';
        g.fillRect(BAR_X0 + 16 + bw * 0.877, mid - 14, 3, 28);
        text(g, l.charging ? 'Release!' : 'Hold A', BAR_X0 + 16 + bw + 60, mid, { size: 20, color: COLORS.ink });
      } else if (l.phase === 'slide' || l.phase === 'rest') {
        const x = BAR_X0 + Math.min(1.05, l.pos) * (BAR_X1 - BAR_X0);
        const fallen = l.fell && l.phase === 'rest';
        g.globalAlpha = fallen ? Math.max(0, 1 - l.t * 2) : 1;
        g.fillStyle = '#f2a51d';
        g.beginPath();
        g.roundRect(x - 14, mid + l.side - 18 + (fallen ? l.t * 80 : 0), 28, 34, 5);
        g.fill();
        g.fillStyle = '#fffaf0';
        g.fillRect(x - 14, mid + l.side - 22 + (fallen ? l.t * 80 : 0), 28, 9);
        g.globalAlpha = 1;
        if (l.phase === 'rest') {
          text(g, fallen ? 'SMASH!' : String(Math.round(l.last * 100)), x, mid - 40, {
            size: 26, color: fallen ? COLORS.bad : COLORS.good, stroke: '#140f1f', strokeW: 5,
          });
        }
      }
    });
  }
}

export default {
  name: 'Bar Slide',
  type: 'ffa',
  howTo: [
    'Hold A to charge, release to slide your pint.',
    'Stop closest to the end. Too hard and it falls off.',
    'Steer with the stick to keep it on the bar. Best of 3.',
  ],
  create: (ctx) => new BarSlide(ctx),
};
