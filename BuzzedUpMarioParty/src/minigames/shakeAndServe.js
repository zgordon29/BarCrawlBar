import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, teamRanking, floor, rand, clamp, arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 35;
const HALF = W / 2;
const CATCH_Y = H - 110;
const NEED = 3;       // ingredients per cocktail
const SHAKES = 14;    // button presses to shake one
const GOOD = ['#7ed63c', '#e8323c', '#d6f1ff', '#f2a51d'];

class ShakeAndServe {
  constructor(ctx) {
    this.ctx = ctx;
    this.teams = [0, 1].map((t) => {
      const members = ctx.players.filter((p) => p.team === t).map((p) => p.index);
      return {
        catcher: members[0], shaker: members.length > 1 ? members[1] : members[0],
        x: HALF / 2, stun: 0, stock: 0, shake: 0, working: false, served: 0, items: [], next: 0.4,
        skill: rand(0.6, 0.95), flash: 0,
      };
    });
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  bot(i) {
    const team = this.teams[this.ctx.players[i].team];
    const out = { x: 0, y: 0, btn: false };
    if (i === team.shaker) out.btn = (team.working || team.stock >= NEED) && Math.floor(this.t * 16 * team.skill) % 2 === 0;
    if (i === team.catcher) {
      let target = null;
      for (const it of team.items) {
        if (it.junk) {
          // Step out from under junk that is about to land.
          if (it.y > CATCH_Y - 170 && Math.abs(it.x - team.x) < 62) { out.x = it.x > team.x ? -1 : 1; return out; }
          continue;
        }
        if (!target || it.y > target.y) target = it;
      }
      if (target) out.x = clamp((target.x - team.x) / 30, -1, 1);
    }
    return out;
  }

  update(dt, inputs) {
    this.t += dt;
    for (const team of this.teams) {
      team.flash -= dt;
      team.stun -= dt;
      if (team.stun <= 0) team.x = clamp(team.x + inputs[team.catcher].x * 380 * dt, 50, HALF - 50);
      team.next -= dt;
      if (team.next <= 0) {
        team.next = rand(0.45, 0.8);
        team.items.push({
          x: rand(60, HALF - 60), y: TOP, junk: Math.random() < 0.24, color: GOOD[Math.floor(Math.random() * GOOD.length)],
        });
      }
      for (const it of team.items) {
        it.y += 250 * dt;
        if (!it.gone && it.y >= CATCH_Y - 26 && it.y <= CATCH_Y + 18 && Math.abs(it.x - team.x) < 46) {
          it.gone = true;
          if (it.junk) { team.stock = Math.max(0, team.stock - 1); team.stun = 0.4; emit('fail', { seat: team.catcher }); }
          else team.stock = Math.min(6, team.stock + 1);
        }
      }
      team.items = team.items.filter((it) => !it.gone && it.y < H);
      if (inputs[team.shaker].pressed) {
        if (!team.working && team.stock >= NEED) { team.stock -= NEED; team.working = true; team.shake = 0; }
        if (team.working) {
          team.shake++;
          if (team.shake >= SHAKES) { team.working = false; team.served++; team.flash = 0.8; emit('score', { seat: team.shaker }); }
        }
      }
    }
    if (this.t >= LIMIT) {
      const score = (tm) => tm.served * 100 + (tm.working ? tm.shake : 0) + tm.stock * 0.1;
      const a = score(this.teams[0]);
      const b = score(this.teams[1]);
      this.ranking = teamRanking(this.ctx.teams, Math.abs(a - b) < 0.05 ? -1 : a > b ? 0 : 1);
      this.finished = true;
    }
  }

  // Seen from the front: ingredients rain down a wall, catchers run along the floor, and
  // each team's shaker stands at the back.
  draw3d(s, g) {
    const PLANE = 340;   // how far back the catching happens
    arena(s, { cy: 380, pitch: 12, dist: 1900, fov: 26, lookZ: 300, ground: '#17121f' });
    this.teams.forEach((team, t) => {
      const ox = t * HALF;
      const col = t ? COLORS.blue : COLORS.pink;
      s.box(ox + HALF / 2, 190, HALF - 6, 20, 760, t ? '#201a2d' : '#261d33');
      s.flat(ox + HALF / 2, 380, HALF - 6, 360, t ? '#2a2238' : '#30263f', { z: 0 });
      for (const it of team.items) {
        const up = CATCH_Y - it.y + 70;   // an item reaches tray height just as it gets to the catcher
        if (it.junk) s.box(ox + it.x, PLANE, 26, 26, 22, '#5a5560', { z: up - 11, rot: it.y * 0.02 });
        else s.ball(ox + it.x, PLANE, up, 15, it.color);
      }
      const cInfo = this.ctx.players[team.catcher];
      const shake = team.stun > 0 ? Math.sin(this.t * 40) * 4 : 0;
      s.char('p' + team.catcher, cInfo.char, ox + team.x + shake, PLANE, {
        r: 28, t: this.t, drunk: cInfo.drunk, phase: team.catcher, sad: team.stun > 0,
      });
      s.cyl(ox + team.x, PLANE, 46, 4, '#c9c2d6', { z: 66 });
      label3(s, g, cInfo.label, ox + team.x, PLANE + 50, 0, { size: 16, color: cInfo.color });

      const sInfo = this.ctx.players[team.shaker];
      const sx = ox + (t ? HALF - 80 : 80);
      const bob = team.working ? Math.abs(Math.sin(this.t * 30)) * 14 : 0;
      if (team.shaker !== team.catcher) {
        s.char('p' + team.shaker, sInfo.char, sx, 250, { r: 32, t: this.t, drunk: sInfo.drunk, phase: team.shaker, hop: bob });
      }
      s.cyl(sx + 34, 250, 9, 28, '#d9d9e6', { z: 60 + bob * 2 });
      const at = s.project(sx, 250, 150);
      text(g, sInfo.label, at.x, at.y - 36, { size: 16, color: sInfo.color, stroke: '#140f1f', strokeW: 4 });
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(at.x - 40, at.y - 22, 80, 10);
      g.fillStyle = COLORS.gold;
      g.fillRect(at.x - 40, at.y - 22, 80 * (team.working ? team.shake / SHAKES : 0), 10);
      text(g, team.working ? 'MASH A!' : team.stock >= NEED ? 'Press A' : 'Waiting…', at.x, at.y + 4, {
        size: 14, weight: 700, color: team.working || team.stock >= NEED ? COLORS.gold : COLORS.dim, stroke: '#140f1f', strokeW: 4,
      });

      const mid = ox + HALF / 2;
      text(g, t ? 'TEAM B' : 'TEAM A', mid, TOP + 26, { size: 18, color: col });
      text(g, `${team.served}`, mid, TOP + 78, { size: 64, weight: 900, color: team.flash > 0 ? COLORS.gold : COLORS.ink, stroke: '#140f1f', strokeW: 8 });
      text(g, 'served', mid, TOP + 118, { size: 16, weight: 700, color: COLORS.dim });
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(mid - 50 + k * 20, TOP + 146, 7, 0, Math.PI * 2);
        g.fillStyle = k < team.stock ? COLORS.good : 'rgba(255,255,255,.18)';
        g.fill();
      }
    });
    s.box(HALF, 380, 6, 380, 40, '#0d0a14');
  }

  draw(g) {
    floor(g, '#17121f', 0);
    this.teams.forEach((team, t) => {
      const ox = t * HALF;
      const col = t ? COLORS.blue : COLORS.pink;
      g.fillStyle = t ? '#201a2d' : '#261d33';
      g.fillRect(ox, TOP, HALF, H - TOP);
      g.fillStyle = '#3b2313';
      g.fillRect(ox, CATCH_Y + 36, HALF, H - CATCH_Y);
      for (const it of team.items) {
        g.beginPath();
        if (it.junk) {
          g.fillStyle = '#5a5560';
          g.roundRect(ox + it.x - 14, it.y - 10, 28, 20, 4);
          g.fill();
          text(g, '✕', ox + it.x, it.y + 1, { size: 16, color: COLORS.bad });
        } else {
          g.arc(ox + it.x, it.y, 15, 0, Math.PI * 2);
          g.fillStyle = it.color;
          g.fill();
        }
      }
      // The catcher holds a tray; the shaker stands on the bar with the shaker.
      const cInfo = this.ctx.players[team.catcher];
      g.fillStyle = '#c9c2d6';
      g.fillRect(ox + team.x - 46, CATCH_Y - 30, 92, 8);
      drawCharacter(g, cInfo.char, ox + team.x + (team.stun > 0 ? Math.sin(this.t * 40) * 4 : 0), CATCH_Y + 4, 28, {
        t: this.t, drunk: cInfo.drunk, phase: team.catcher, sad: team.stun > 0,
      });
      text(g, cInfo.label, ox + team.x, CATCH_Y + 54, { size: 16, color: cInfo.color });

      const sInfo = this.ctx.players[team.shaker];
      const sx = ox + (t ? HALF - 70 : 70);
      const bob = team.working ? Math.sin(this.t * 40) * 6 : 0;
      drawCharacter(g, sInfo.char, sx, TOP + 150 + bob, 32, { t: this.t, drunk: sInfo.drunk, phase: team.shaker });
      text(g, sInfo.label, sx, TOP + 205, { size: 16, color: sInfo.color });
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(sx - 40, TOP + 222, 80, 10);
      g.fillStyle = COLORS.gold;
      g.fillRect(sx - 40, TOP + 222, 80 * (team.working ? team.shake / SHAKES : 0), 10);
      text(g, team.working ? 'MASH A!' : team.stock >= NEED ? 'Press A' : 'Waiting…', sx, TOP + 250, {
        size: 14, weight: 700, color: team.working || team.stock >= NEED ? COLORS.gold : COLORS.dim,
      });

      const mid = ox + HALF / 2;
      text(g, t ? 'TEAM B' : 'TEAM A', mid, TOP + 26, { size: 18, color: col });
      text(g, `${team.served}`, mid, TOP + 78, { size: 64, weight: 900, color: team.flash > 0 ? COLORS.gold : COLORS.ink });
      text(g, 'served', mid, TOP + 118, { size: 16, weight: 700, color: COLORS.dim });
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.arc(mid - 50 + k * 20, TOP + 146, 7, 0, Math.PI * 2);
        g.fillStyle = k < team.stock ? COLORS.good : 'rgba(255,255,255,.12)';
        g.fill();
      }
    });
    g.fillStyle = '#0d0a14';
    g.fillRect(HALF - 3, TOP, 6, H - TOP);
  }
}

export default {
  name: 'Shake & Serve',
  type: '2v2',
  howTo: [
    'One of you catches ingredients, the other shakes.',
    'Three ingredients make a cocktail. Dodge the junk.',
    'Catcher: left stick. Shaker: mash A. Most served wins.',
  ],
  create: (ctx) => new ShakeAndServe(ctx),
};
