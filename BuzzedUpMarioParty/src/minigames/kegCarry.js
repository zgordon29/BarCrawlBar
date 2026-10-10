import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import {
  TOP, mover, drive, keepIn, teamRanking, floor, drawMover, rand, seek, clamp, arena, mover3, label3,
} from './kit.js';
import { emit } from './fx.js';

const LIMIT = 40;
const PR = 24;
const KEG_R = 26;
const START_X = 110;
const GOAL_X = 1190;
const MAX_STRETCH = 150;  // teammates further apart than this drop the keg
const LANE_H = (H - TOP) / 2;

class KegCarry {
  constructor(ctx) {
    this.ctx = ctx;
    this.ps = ctx.players.map(() => mover(0, 0));
    // Both lanes get the same obstacle layout so the race is fair.
    const layout = [];
    for (let x = 290; x <= 1060; x += 128) layout.push({ dx: x, dy: rand(-95, 95), r: rand(26, 34) });
    this.teams = [0, 1].map((t) => {
      const mid = TOP + t * LANE_H + LANE_H / 2;
      const team = {
        members: ctx.players.filter((p) => p.team === t).map((p) => p.index),
        y0: TOP + t * LANE_H, y1: TOP + (t + 1) * LANE_H, mid,
        obstacles: layout.map((o) => ({ x: o.dx, y: mid + o.dy, r: o.r })),
        keg: { x: START_X, y: mid }, stun: 0, done: false, time: 0, drops: 0, skill: rand(0.68, 0.92),
      };
      this.place(team, START_X);
      return team;
    });
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  place(team, x) {
    team.members.forEach((i, k) => {
      const p = this.ps[i];
      p.x = x + (team.members.length > 1 ? (k ? -38 : 38) : 40);
      p.y = team.mid;
      p.vx = 0;
      p.vy = 0;
    });
    this.setKeg(team);
  }

  setKeg(team) {
    const ms = team.members.map((i) => this.ps[i]);
    if (ms.length > 1) {
      team.keg.x = (ms[0].x + ms[1].x) / 2;
      team.keg.y = (ms[0].y + ms[1].y) / 2;
    } else if (ms.length) {
      team.keg.x = ms[0].x - 40;
      team.keg.y = ms[0].y;
    }
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const team = this.teams[this.ctx.players[i].team];
    if (team.stun > 0 || team.done) return { x: 0, y: 0, btn: false };
    const k = team.members.indexOf(i);
    let ty = team.mid;
    let near = Infinity;
    for (const o of team.obstacles) {
      const ahead = o.x - team.keg.x;
      if (ahead > -30 && ahead < 180 && ahead < near && Math.abs(o.y - team.keg.y) < o.r + KEG_R + 44) {
        near = ahead;
        ty = o.y >= team.mid ? o.y - 112 : o.y + 112;
      }
    }
    ty = clamp(ty, team.y0 + 40, team.y1 - 40);
    return { ...seek(this.ps[i], team.keg.x + 90 + (k ? -38 : 38), ty, team.skill), btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    for (const team of this.teams) {
      if (team.done) continue;
      if (team.stun > 0) { team.stun -= dt; continue; }
      for (const i of team.members) {
        const p = this.ps[i];
        drive(p, inputs[i], dt, 1300, 5);
        keepIn(p, 20, team.y0 + 6, W - 20, team.y1 - 6, PR);
        for (const o of team.obstacles) {
          const dx = p.x - o.x;
          const dy = p.y - o.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d < PR + o.r) { p.x = o.x + (dx / d) * (PR + o.r); p.y = o.y + (dy / d) * (PR + o.r); }
        }
      }
      this.setKeg(team);
      const ms = team.members.map((i) => this.ps[i]);
      const apart = ms.length > 1 ? Math.hypot(ms[0].x - ms[1].x, ms[0].y - ms[1].y) : 0;
      const hit = team.obstacles.some((o) => Math.hypot(team.keg.x - o.x, team.keg.y - o.y) < KEG_R + o.r);
      if (apart > MAX_STRETCH || hit) {
        team.drops++;
        team.stun = 1;
        emit('fail', team.keg);
        this.place(team, Math.max(START_X, team.keg.x - 90));
      } else if (team.keg.x >= GOAL_X) {
        team.done = true;
        emit('score', team.keg);
        team.time = this.t;
      }
    }
    const anyDone = this.teams.some((t) => t.done);
    if (anyDone || this.t >= LIMIT) {
      const [a, b] = this.teams;
      let winner = -1;
      if (a.done !== b.done) winner = a.done ? 0 : 1;
      else if (Math.abs(a.keg.x - b.keg.x) > 2) winner = a.keg.x > b.keg.x ? 0 : 1;
      this.ranking = teamRanking(this.ctx.teams, winner);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    arena(s, { ground: '#17121f' });
    this.teams.forEach((team, t) => {
      s.flat(W / 2, team.mid, W - 20, LANE_H - 12, t ? '#231c30' : '#281f36', { z: 0 });
      s.flat((GOAL_X + W) / 2, team.mid, W - GOAL_X, LANE_H - 12, '#2f5a3a', { z: 1 });
      for (const o of team.obstacles) {
        // Bar stools.
        s.cyl(o.x, o.y, o.r * 0.3, 34, '#3a2a1a');
        s.cyl(o.x, o.y, o.r, 8, '#a63a3a', { z: 34 });
      }
      const ms = team.members.map((i) => this.ps[i]);
      if (ms.length > 1) {
        const apart = Math.hypot(ms[0].x - ms[1].x, ms[0].y - ms[1].y);
        s.beam(ms[0].x, ms[0].y, 40, ms[1].x, ms[1].y, 40, 5, apart > MAX_STRETCH * 0.8 ? '#ff6b5e' : '#c9a36a');
      }
      const shake = team.stun > 0 ? Math.sin(this.t * 40) * 5 : 0;
      const kz = team.stun > 0 ? 0 : 22;   // a dropped keg sits on the floor
      s.cyl(team.keg.x + shake, team.keg.y, KEG_R * 0.85, 46, '#b0b7c2', { z: kz });
      s.cyl(team.keg.x + shake, team.keg.y, KEG_R * 0.9, 5, '#6b7380', { z: kz + 8 });
      s.cyl(team.keg.x + shake, team.keg.y, KEG_R * 0.9, 5, '#6b7380', { z: kz + 33 });
      for (const i of team.members) mover3(s, g, this.ctx.players[i], this.ps[i], PR, this.t);
      if (team.stun > 0) label3(s, g, 'DROPPED!', team.keg.x, team.keg.y, 110, { size: 24, color: COLORS.bad });
      label3(s, g, t ? 'TEAM B' : 'TEAM A', 70, team.y0 + 26, 4, { color: t ? COLORS.blue : COLORS.pink });
    });
    s.box(W / 2, TOP + LANE_H, W, 6, 12, '#0d0a14');
  }

  draw(g) {
    floor(g, '#17121f', 0);
    this.teams.forEach((team, t) => {
      g.fillStyle = t ? '#231c30' : '#281f36';
      g.fillRect(0, team.y0, W, LANE_H);
      g.fillStyle = 'rgba(110,226,122,.16)';
      g.fillRect(GOAL_X, team.y0, W - GOAL_X, LANE_H);
      text(g, t ? 'TEAM B' : 'TEAM A', 60, team.y0 + 24, { size: 18, color: t ? COLORS.blue : COLORS.pink });
      for (const o of team.obstacles) {
        // Bar stools.
        g.beginPath();
        g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        g.fillStyle = '#5e3a18';
        g.fill();
        g.beginPath();
        g.arc(o.x, o.y, o.r * 0.7, 0, Math.PI * 2);
        g.fillStyle = '#a63a3a';
        g.fill();
      }
      const ms = team.members.map((i) => this.ps[i]);
      if (ms.length > 1) {
        const apart = Math.hypot(ms[0].x - ms[1].x, ms[0].y - ms[1].y);
        g.strokeStyle = apart > MAX_STRETCH * 0.8 ? COLORS.bad : '#c9a36a';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(ms[0].x, ms[0].y);
        g.lineTo(ms[1].x, ms[1].y);
        g.stroke();
      }
      const shake = team.stun > 0 ? Math.sin(this.t * 40) * 5 : 0;
      g.beginPath();
      g.arc(team.keg.x + shake, team.keg.y, KEG_R, 0, Math.PI * 2);
      g.fillStyle = '#b0b7c2';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#6b7380';
      g.stroke();
      g.beginPath();
      g.arc(team.keg.x + shake, team.keg.y, KEG_R * 0.55, 0, Math.PI * 2);
      g.stroke();
      for (const i of team.members) drawMover(g, this.ctx.players[i], this.ps[i], PR, this.t);
      if (team.stun > 0) text(g, 'DROPPED!', team.keg.x, team.keg.y - 60, { size: 24, color: COLORS.bad, stroke: '#140f1f', strokeW: 5 });
    });
    g.fillStyle = '#0d0a14';
    g.fillRect(0, TOP + LANE_H - 3, W, 6);
  }
}

export default {
  name: 'Keg Carry',
  type: '2v2',
  howTo: [
    'Carry the keg to the end with your teammate.',
    'Pull too far apart or hit a stool and you drop it.',
    'Left stick to walk. Stay together!',
  ],
  create: (ctx) => new KegCarry(ctx),
};
