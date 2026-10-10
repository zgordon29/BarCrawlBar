import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import {
  TOP, mover, drive, dash, bump, keepIn, teamRanking, floor, drawMover, seek, clamp, arena, mover3,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 40;
const OVERTIME = 15;
const PR = 32;
const PUCK_R = 18;
const X0 = 90, X1 = W - 90, Y0 = TOP + 36, Y1 = H - 36;
const MID_Y = (Y0 + Y1) / 2;
const MOUTH = 110;   // half-height of each goal
const TO_WIN = 3;

class CoasterHockey {
  constructor(ctx) {
    this.ctx = ctx;
    this.ps = ctx.players.map(() => mover(0, 0));
    this.members = [0, 1].map((t) => ctx.players.filter((p) => p.team === t).map((p) => p.index));
    this.score = [0, 0];
    this.puck = { x: W / 2, y: MID_Y, vx: 0, vy: 0 };
    this.pause = 0;
    this.goalFlash = 0;
    this.reset();
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  reset() {
    this.members.forEach((list, t) => {
      list.forEach((i, k) => {
        const p = this.ps[i];
        p.x = t ? X1 - 200 - k * 130 : X0 + 200 + k * 130;
        p.y = MID_Y + (k ? 90 : -90) * (t ? 1 : -1);
        p.vx = 0;
        p.vy = 0;
      });
    });
    this.puck = { x: W / 2, y: MID_Y, vx: 0, vy: 0 };
    this.pause = 1;
  }

  timeLeft() { return Math.max(0, (this.t >= LIMIT ? LIMIT + OVERTIME : LIMIT) - this.t); }

  bot(i) {
    const me = this.ps[i];
    const team = this.ctx.players[i].team;
    const dir = team ? -1 : 1;           // which way this team attacks
    const k = this.members[team].indexOf(i);
    const puck = this.puck;
    const ownX = team ? X1 : X0;
    if (k === 1 || this.members[team].length === 1 && (puck.x - W / 2) * dir < -200) {
      // Defender: sit in front of the goal, clear the puck when it gets close.
      if (Math.abs(puck.x - ownX) < 240) return { ...seek(me, puck.x, puck.y, 1), btn: Math.random() < 0.05 };
      return { ...seek(me, ownX + dir * 130, clamp(puck.y, MID_Y - 90, MID_Y + 90), 0.8), btn: false };
    }
    // Attacker: get behind the puck, then drive it at the far goal.
    const gx = (team ? X0 : X1) - puck.x;
    const gy = MID_Y - puck.y;
    const gl = Math.hypot(gx, gy) || 1;
    const behind = (puck.x - me.x) * dir > 8;
    if (behind) {
      const close = Math.hypot(puck.x - me.x, puck.y - me.y) < 90;
      return { ...seek(me, puck.x + (gx / gl) * 20, puck.y + (gy / gl) * 20, 1), btn: close && Math.random() < 0.1 };
    }
    const side = me.y < puck.y ? -70 : 70;
    return { ...seek(me, puck.x - dir * 70, puck.y + side, 1), btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    this.goalFlash -= dt;
    if (this.pause > 0) { this.pause -= dt; return; }
    this.ps.forEach((p, i) => {
      drive(p, inputs[i], dt, 1500, 5);
      dash(p, inputs[i], 520, 1);
      keepIn(p, X0, Y0, X1, Y1, PR);
    });
    bump(this.ps, PR, 200);

    const k = this.puck;
    const f = Math.exp(-0.5 * dt);
    k.vx *= f; k.vy *= f;
    k.x += k.vx * dt;
    k.y += k.vy * dt;
    for (const p of this.ps) {
      const dx = k.x - p.x;
      const dy = k.y - p.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= PR + PUCK_R) continue;
      const nx = dx / d;
      const ny = dy / d;
      k.x = p.x + nx * (PR + PUCK_R);
      k.y = p.y + ny * (PR + PUCK_R);
      const rel = (k.vx - p.vx) * nx + (k.vy - p.vy) * ny;
      if (rel < 0) { k.vx -= 1.8 * rel * nx; k.vy -= 1.8 * rel * ny; }
      if (p.dashT > 0) { k.vx += nx * 320; k.vy += ny * 320; p.dashT = 0; }
    }
    const sp = Math.hypot(k.vx, k.vy);
    if (sp > 950) { k.vx *= 950 / sp; k.vy *= 950 / sp; }
    if (k.y < Y0 + PUCK_R) { k.y = Y0 + PUCK_R; k.vy = Math.abs(k.vy); }
    if (k.y > Y1 - PUCK_R) { k.y = Y1 - PUCK_R; k.vy = -Math.abs(k.vy); }
    const inMouth = Math.abs(k.y - MID_Y) < MOUTH;
    if (k.x < X0 + PUCK_R) {
      if (inMouth) this.goal(1); else { k.x = X0 + PUCK_R; k.vx = Math.abs(k.vx); }
    } else if (k.x > X1 - PUCK_R) {
      if (inMouth) this.goal(0); else { k.x = X1 - PUCK_R; k.vx = -Math.abs(k.vx); }
    }

    // Level at full time: next goal wins, for up to 15 more seconds.
    const [a, b] = this.score;
    const over = this.t >= LIMIT + OVERTIME || (this.t >= LIMIT && a !== b);
    if (a >= TO_WIN || b >= TO_WIN || over) {
      this.ranking = teamRanking(this.ctx.teams, a === b ? -1 : a > b ? 0 : 1);
      this.finished = true;
    }
  }

  goal(team) {
    this.score[team]++;
    emit('score');
    this.goalFlash = 1;
    this.reset();
  }

  // A bar-top hockey table, standing a little above the floor.
  draw3d(s, g) {
    const w = X1 - X0;
    const d = Y1 - Y0;
    const mx = (X0 + X1) / 2;
    const my = (Y0 + Y1) / 2;
    const rail = '#5e3a18';
    arena(s, { ground: '#140f1f', groundZ: -90 });
    s.box(mx, my, w + 44, d + 44, 90, '#3b2313', { z: -90.5 });
    s.flat(mx, my, w, d, '#8a5a2b', { z: 0.2 });
    s.flat(W / 2, my, 4, d, '#6b4420', { z: 0.6 });
    s.torus(W / 2, MID_Y, 1, 90, '#6b4420', { tube: 2 });
    s.box(mx, Y0 - 8, w + 32, 16, 18, rail);
    s.box(mx, Y1 + 8, w + 32, 16, 18, rail);
    // Side rails, with a gap for each goal.
    const side = MID_Y - MOUTH - Y0;
    for (const x of [X0 - 8, X1 + 8]) {
      s.box(x, Y0 + side / 2, 16, side, 18, rail);
      s.box(x, Y1 - side / 2, 16, side, 18, rail);
    }
    s.box(X0 - 16, MID_Y, 12, MOUTH * 2, 30, COLORS.pink, { glow: 0.5 });
    s.box(X1 + 16, MID_Y, 12, MOUTH * 2, 30, COLORS.blue, { glow: 0.5 });

    this.ps.forEach((p, i) => {
      const info = this.ctx.players[i];
      s.cyl(p.x, p.y, PR + 6, 6, info.team ? COLORS.blue : COLORS.pink);
      mover3(s, g, info, p, PR - 4, this.t, { z: 6 });
    });
    const k = this.puck;
    s.box(k.x, k.y, PUCK_R * 1.7, PUCK_R * 1.7, PUCK_R * 1.7, '#c8f0ff', { opacity: 0.85, rot: this.t * 2 });

    text(g, `${this.score[0]}`, W / 2 - 60, 29, { size: 34, weight: 900, color: COLORS.pink });
    text(g, '-', W / 2, 29, { size: 30 });
    text(g, `${this.score[1]}`, W / 2 + 60, 29, { size: 34, weight: 900, color: COLORS.blue });
    if (this.t >= LIMIT) text(g, 'NEXT GOAL WINS', W / 2, 86, { size: 22, color: COLORS.gold });
    if (this.goalFlash > 0) text(g, 'GOAL!', W / 2, H / 2, { size: 130, weight: 900, glow: COLORS.gold, blur: 40 });
  }

  draw(g) {
    floor(g, '#140f1f', 0);
    g.fillStyle = '#8a5a2b';
    g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.strokeStyle = 'rgba(0,0,0,.18)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(W / 2, Y0); g.lineTo(W / 2, Y1);
    g.moveTo(W / 2 + 90, MID_Y); g.arc(W / 2, MID_Y, 90, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 10;
    g.strokeStyle = '#3b2313';
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    // Goals: team A defends the left (pink), team B the right (blue).
    g.fillStyle = COLORS.pink;
    g.fillRect(X0 - 16, MID_Y - MOUTH, 16, MOUTH * 2);
    g.fillStyle = COLORS.blue;
    g.fillRect(X1, MID_Y - MOUTH, 16, MOUTH * 2);

    const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].y - this.ps[b].y);
    for (const i of order) {
      const p = this.ps[i];
      const info = this.ctx.players[i];
      g.beginPath();
      g.arc(p.x, p.y + 6, PR + 6, 0, Math.PI * 2);
      g.fillStyle = info.team ? COLORS.blue : COLORS.pink;
      g.globalAlpha = 0.55;
      g.fill();
      g.globalAlpha = 1;
      drawMover(g, info, p, PR - 4, this.t);
    }
    // The puck is an ice cube.
    const k = this.puck;
    g.save();
    g.translate(k.x, k.y);
    g.rotate(this.t * 2);
    g.fillStyle = 'rgba(200,240,255,.95)';
    g.strokeStyle = '#7fd6ff';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(-PUCK_R, -PUCK_R, PUCK_R * 2, PUCK_R * 2, 6);
    g.fill();
    g.stroke();
    g.restore();

    text(g, `${this.score[0]}`, W / 2 - 60, 29, { size: 34, weight: 900, color: COLORS.pink });
    text(g, '-', W / 2, 29, { size: 30 });
    text(g, `${this.score[1]}`, W / 2 + 60, 29, { size: 34, weight: 900, color: COLORS.blue });
    if (this.t >= LIMIT) text(g, 'NEXT GOAL WINS', W / 2, 86, { size: 22, color: COLORS.gold });
    if (this.goalFlash > 0) text(g, 'GOAL!', W / 2, H / 2, { size: 130, weight: 900, glow: COLORS.gold, blur: 40 });
  }
}

export default {
  name: 'Coaster Hockey',
  type: '2v2',
  howTo: [
    'Knock the ice cube into the other team\'s goal.',
    'First to 3 wins. Pink defends left, blue defends right.',
    'Left stick to move. A to dash.',
  ],
  create: (ctx) => new CoasterHockey(ctx),
};
