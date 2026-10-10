import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import {
  TOP, mover, drive, dash, keepIn, teamRanking, floor, drawMover, seek, clamp, rand, arena, mover3, label3,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 30;
const X0 = 60, X1 = W - 60, Y0 = TOP + 20, Y1 = H - 20;
const MID_Y = (Y0 + Y1) / 2;
const DOOR = 90;        // half-height of the door
const BOUNCER_R = 44;
const SNEAK_R = 24;
const NEED_IN = 2;

class TheBouncer {
  constructor(ctx) {
    this.ctx = ctx;
    this.solo = ctx.players.find((p) => p.team === 0).index;
    this.trio = ctx.players.filter((p) => p.team !== 0).map((p) => p.index);
    this.ps = ctx.players.map(() => mover(0, 0));
    this.ps[this.solo].x = X1 - 170;
    this.ps[this.solo].y = MID_Y;
    this.home = {};
    this.trio.forEach((i, k) => {
      this.home[i] = MID_Y + (k - (this.trio.length - 1) / 2) * 170;
      this.sendBack(i, 0);
      this.ps[i].inside = false;
      this.ps[i].aim = rand(-60, 60);
    });
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  sendBack(i, stun) {
    const p = this.ps[i];
    p.x = X0 + 60;
    p.y = this.home[i];
    p.vx = 0;
    p.vy = 0;
    p.stun = stun;
    emit('hit', { seat: i });
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const me = this.ps[i];
    const b = this.ps[this.solo];
    if (i === this.solo) {
      // Guard whoever is closest to getting in.
      let threat = null;
      for (const j of this.trio) {
        const s = this.ps[j];
        if (s.inside || s.stun > 0) continue;
        if (!threat || s.x > threat.x) threat = s;
      }
      if (!threat) return { ...seek(me, X1 - 150, MID_Y, 0.6), btn: false };
      const d = Math.hypot(threat.x - me.x, threat.y - me.y);
      if (d < 260) return { ...seek(me, threat.x, threat.y, 1), btn: d < 125 };
      return { ...seek(me, X1 - 150, clamp(threat.y, MID_Y - 110, MID_Y + 110), 0.9), btn: false };
    }
    if (me.inside || me.stun > 0) return { x: 0, y: 0, btn: false };
    let { x, y } = seek(me, X1 + 20, MID_Y + me.aim, 1);
    const dx = me.x - b.x;
    const dy = me.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 200) {
      // Swerve around the bouncer rather than straight into him.
      const side = dy >= 0 ? 1 : -1;
      x += (dx / d) * 0.6;
      y += side * 1.3;
      const m = Math.hypot(x, y) || 1;
      x /= m; y /= m;
    }
    return { x, y, btn: d < 130 && Math.random() < 0.2 };
  }

  update(dt, inputs) {
    this.t += dt;
    const b = this.ps[this.solo];
    drive(b, inputs[this.solo], dt, 1250, 5);
    dash(b, inputs[this.solo], 520, 1.6);
    keepIn(b, 420, Y0, X1, Y1, BOUNCER_R);
    for (const i of this.trio) {
      const p = this.ps[i];
      if (p.inside) continue;
      if (p.stun > 0) { p.stun -= dt; continue; }
      drive(p, inputs[i], dt, 1450, 5);
      dash(p, inputs[i], 480, 2);
      // The right wall is solid except for the doorway.
      const inDoor = Math.abs(p.y - MID_Y) < DOOR - SNEAK_R * 0.5;
      keepIn(p, X0, Y0, inDoor ? X1 + 80 : X1, Y1, SNEAK_R);
      if (p.x > X1 - 10 && inDoor) { p.inside = true; continue; }
      if (Math.hypot(p.x - b.x, p.y - b.y) < BOUNCER_R + SNEAK_R) this.sendBack(i, 1);
    }
    const inside = this.trio.filter((i) => this.ps[i].inside).length;
    if (inside >= Math.min(NEED_IN, this.trio.length) || this.t >= LIMIT) {
      this.ranking = teamRanking(this.ctx.teams, inside >= Math.min(NEED_IN, this.trio.length) ? 1 : 0);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    const my = (Y0 + Y1) / 2;
    const wallX = (X1 + W) / 2 + 30;
    const wallW = W - X1 + 60;
    const wall = '#3b1730';
    arena(s, { ground: '#17121f' });
    s.flat((X0 + X1) / 2, my, X1 - X0, Y1 - Y0, '#2b2338', { z: 0 });
    // The club's front wall, with the doorway in the middle of it.
    const side = MID_Y - DOOR - Y0;
    s.box(wallX, Y0 + side / 2, wallW, side, 170, wall);
    s.box(wallX, Y1 - side / 2, wallW, side, 170, wall);
    s.box(wallX, MID_Y, wallW, DOOR * 2, 40, wall, { z: 130 });
    s.flat(wallX, MID_Y, wallW, DOOR * 2, COLORS.gold, { z: 1, glow: 0.8 });
    label3(s, g, 'IN', X1 + 40, MID_Y, 4, { size: 24, color: '#140f1f', stroke: null });
    // Velvet rope the bouncer cannot cross.
    s.beam(420, Y0 + 10, 30, 420, Y1 - 10, 30, 5, COLORS.pink, { opacity: 0.7 });
    s.cyl(420, Y0 + 10, 5, 36, '#c9a13a');
    s.cyl(420, Y1 - 10, 5, 36, '#c9a13a');

    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      if (i === this.solo) {
        mover3(s, g, info, p, BOUNCER_R, this.t, { ring: true, label: false });
        label3(s, g, `${info.label} BOUNCER`, p.x, p.y, BOUNCER_R * 2.7, { color: info.color });
      } else if (!p.inside) {
        mover3(s, g, info, p, SNEAK_R, this.t, { ring: true, sad: p.stun > 0, tilt: p.stun > 0 ? 0.6 : 0 });
      }
    });
    const inside = this.trio.filter((i) => this.ps[i].inside).length;
    text(g, `In the club: ${inside} / ${Math.min(NEED_IN, this.trio.length)}`, W / 2, 29, { size: 24, color: COLORS.ink });
  }

  draw(g) {
    floor(g, '#17121f', 80);
    g.fillStyle = '#2b2338';
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    // Club wall and doorway on the right.
    g.fillStyle = '#3b1730';
    g.fillRect(X1, Y0, W - X1, Y1 - Y0);
    g.fillStyle = COLORS.gold;
    g.fillRect(X1, MID_Y - DOOR, W - X1, DOOR * 2);
    text(g, 'IN', X1 + 30, MID_Y, { size: 24, weight: 900, color: '#140f1f' });
    // Velvet rope line the bouncer cannot cross.
    g.strokeStyle = 'rgba(255,79,163,.35)';
    g.setLineDash([10, 10]);
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(420, Y0); g.lineTo(420, Y1); g.stroke();
    g.setLineDash([]);

    const order = this.ps.map((p, i) => i).sort((a, b2) => this.ps[a].y - this.ps[b2].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      if (i === this.solo) {
        drawMover(g, info, p, BOUNCER_R, this.t, { ring: true });
        text(g, 'BOUNCER', p.x, p.y + BOUNCER_R + 26, { size: 14, weight: 800, color: COLORS.ink, stroke: '#140f1f', strokeW: 4 });
      } else if (!p.inside) {
        drawMover(g, info, p, SNEAK_R, this.t, { ring: true, sad: p.stun > 0, tilt: p.stun > 0 ? 0.6 : 0 });
      }
    }
    const inside = this.trio.filter((i) => this.ps[i].inside).length;
    text(g, `In the club: ${inside} / ${Math.min(NEED_IN, this.trio.length)}`, W / 2, 29, { size: 24, color: COLORS.ink });
  }
}

export default {
  name: 'The Bouncer',
  type: '1v3',
  howTo: [
    'Trio: get two of you through the door.',
    'Bouncer: tag them to throw them back to the start.',
    'Left stick to move. A to dash.',
  ],
  create: (ctx) => new TheBouncer(ctx),
};
