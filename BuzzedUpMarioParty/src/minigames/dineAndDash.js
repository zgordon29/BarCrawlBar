import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, teamRanking, floor, tag, clamp, rand, arena, label3 } from './kit.js';
import { emit } from './fx.js';

const LIMIT = 30;
const X_START = 110;
const X_EXIT = 1180;
const Y0 = TOP + 150, Y1 = H - 150;   // the sneakers' corridor
const LIGHT_R = 170;
const LIGHT_SPEED = 560;
const SNEAK_SPEED = 175;
const SNEAK_R = 24;
const CATCH_TIME = 0.16;  // seconds of moving in the light before you are caught
const NEED_OUT = 2;

class DineAndDash {
  constructor(ctx) {
    this.ctx = ctx;
    this.solo = ctx.players.find((p) => p.team === 0).index;
    this.trio = ctx.players.filter((p) => p.team !== 0).map((p) => p.index);
    this.light = { x: W / 2, y: (Y0 + Y1) / 2, on: true, timer: rand(2, 3.5) };
    this.ss = {};
    this.trio.forEach((i, k) => {
      const y = Y0 + 40 + k * ((Y1 - Y0 - 80) / Math.max(1, this.trio.length - 1));
      this.ss[i] = {
        x: X_START, y, home: y, seen: 0, stun: 0, out: false, moving: false, walk: 0,
        skill: rand(0.3, 0.95), lag: 0, wasLit: false,
      };
    });
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  lit(s) {
    return this.light.on && Math.hypot(s.x - this.light.x, s.y - this.light.y) < LIGHT_R;
  }

  bot(i) {
    if (i === this.solo) {
      let target = null;
      for (const j of this.trio) {
        const s = this.ss[j];
        if (s.out || s.stun > 0) continue;
        if (!target || s.x > target.x) target = s;
      }
      if (!target) return { x: 0, y: 0, btn: false };
      const dx = target.x + 40 - this.light.x;
      const dy = target.y - this.light.y;
      const d = Math.hypot(dx, dy);
      return d < 12 ? { x: 0, y: 0, btn: false } : { x: dx / d, y: dy / d, btn: false };
    }
    const s = this.ss[i];
    if (s.out || s.stun > 0) return { x: 0, y: 0, btn: false };
    const danger = this.light.on && Math.hypot(s.x - this.light.x, s.y - this.light.y) < LIGHT_R + 25;
    // A slow reaction when the light lands on you is how a bot gets caught.
    if (danger && !s.wasLit) s.lag = (1 - s.skill) * 0.45;
    s.wasLit = danger;
    if (danger && s.lag <= 0) return { x: 0, y: 0, btn: false };
    return { x: 1, y: clamp((s.home - s.y) / 40, -0.4, 0.4), btn: false };
  }

  update(dt, inputs) {
    this.t += dt;
    const L = this.light;
    const li = inputs[this.solo];
    L.x = clamp(L.x + li.x * LIGHT_SPEED * dt, 60, W - 60);
    L.y = clamp(L.y + li.y * LIGHT_SPEED * dt, TOP + 40, H - 40);
    // The bulb flickers off now and then, giving the sneakers a window.
    L.timer -= dt;
    if (L.timer <= 0) { L.on = !L.on; L.timer = L.on ? rand(2, 3.8) : 0.9; }

    for (const i of this.trio) {
      const s = this.ss[i];
      if (s.out) continue;
      s.lag -= dt;
      if (s.stun > 0) { s.stun -= dt; s.moving = false; continue; }
      const inp = inputs[i];
      s.moving = Math.hypot(inp.x, inp.y) > 0.22;
      if (s.moving) {
        s.x = Math.max(60, s.x + inp.x * SNEAK_SPEED * dt);
        s.y = clamp(s.y + inp.y * SNEAK_SPEED * dt, Y0, Y1);
        s.walk += dt;
      }
      if (this.lit(s) && s.moving) {
        s.seen += dt;
        if (s.seen >= CATCH_TIME) { emit('fail', { x: s.x, y: s.y, seat: i }); s.x = X_START; s.y = s.home; s.stun = 0.8; s.seen = 0; }
      } else {
        s.seen = 0;
      }
      if (s.x >= X_EXIT && !s.out) { s.out = true; emit('score', { x: s.x, y: s.y, seat: i }); }
    }
    const escaped = this.trio.filter((i) => this.ss[i].out).length;
    const need = Math.min(NEED_OUT, this.trio.length);
    if (escaped >= need || this.t >= LIMIT) {
      this.ranking = teamRanking(this.ctx.teams, escaped >= need ? 1 : 0);
      this.finished = true;
    }
  }

  draw3d(s, g) {
    const my = (Y0 + Y1) / 2;
    const L = this.light;
    arena(s, { ground: '#0f0b16' });
    s.flat(W / 2, my, W + 200, Y1 - Y0 + 100, '#1b1526', { z: 0 });
    s.flat((X_EXIT + W) / 2 + 50, my, W - X_EXIT + 100, Y1 - Y0 + 100, '#2f5a3a', { z: 1 });
    label3(s, g, 'EXIT', X_EXIT + 50, Y0 - 30, 4, { size: 20, color: COLORS.good });
    // Restaurant tables either side of the corridor.
    for (let x = 240; x < X_EXIT; x += 190) {
      for (const y of [Y0 - 110, Y1 + 110]) {
        s.cyl(x, y, 8, 40, '#1b1320');
        s.cyl(x, y, 38, 6, '#3b2313', { z: 40 });
        s.ball(x, y, 54, 5, '#ffc83d', { glow: 1.2, shadow: false });
      }
    }
    if (L.on) {
      // A pool of light on the floor under a hanging lamp; it flickers just before it goes out.
      const warn = L.timer < 0.35 && Math.sin(this.t * 60) > 0;
      s.cyl(L.x, L.y, LIGHT_R, 1.5, '#fff0aa', { z: 1.5, opacity: warn ? 0.12 : 0.38, glow: 0.8 });
      s.cone(L.x, L.y, LIGHT_R, 640, '#fff0aa', { opacity: warn ? 0.03 : 0.08, glow: 0.6 });
      s.ball(L.x, L.y, 650, 18, '#fff0aa', { glow: 2, shadow: false });
    } else {
      s.torus(L.x, L.y, 2, LIGHT_R, '#8a8494', { tube: 2, opacity: 0.6 });
      label3(s, g, 'LIGHT OFF', L.x, L.y, 10, { size: 20, color: 'rgba(255,255,255,.5)' });
    }
    for (const i of this.trio) {
      const sn = this.ss[i];
      const info = this.ctx.players[i];
      if (sn.out) continue;
      const shake = sn.stun > 0 ? Math.sin(this.t * 40) * 4 : 0;
      s.char('p' + i, info.char, sn.x + shake, sn.y, {
        r: SNEAK_R, t: this.t, drunk: info.drunk, moving: sn.moving, walk: sn.walk, phase: i, sad: sn.stun > 0, face: 0.45,
      });
      label3(s, g, info.label, sn.x, sn.y, SNEAK_R * 2.7, { color: info.color });
      if (sn.stun > 0) label3(s, g, 'CAUGHT!', sn.x, sn.y, SNEAK_R * 2.7 + 30, { color: COLORS.bad });
      else if (this.lit(sn) && !sn.moving) label3(s, g, 'frozen', sn.x, sn.y + 34, 0, { size: 14, weight: 700, color: COLORS.good });
    }
    const soloInfo = this.ctx.players[this.solo];
    text(g, `${soloInfo.label} ${soloInfo.name} runs the spotlight`, 24, 86, { size: 18, align: 'left', color: soloInfo.color });
    const escaped = this.trio.filter((i) => this.ss[i].out).length;
    text(g, `Escaped: ${escaped} / ${Math.min(NEED_OUT, this.trio.length)}`, W / 2, 29, { size: 24 });
  }

  draw(g) {
    floor(g, '#0f0b16', 0);
    g.fillStyle = '#1b1526';
    g.fillRect(0, Y0 - 50, W, Y1 - Y0 + 100);
    g.fillStyle = 'rgba(110,226,122,.2)';
    g.fillRect(X_EXIT, Y0 - 50, W - X_EXIT, Y1 - Y0 + 100);
    text(g, 'EXIT', X_EXIT + 50, Y0 - 24, { size: 20, color: COLORS.good });
    // Restaurant tables as scenery.
    for (let x = 240; x < X_EXIT; x += 190) {
      for (const y of [Y0 - 100, Y1 + 100]) {
        g.beginPath();
        g.arc(x, y, 34, 0, Math.PI * 2);
        g.fillStyle = '#3b2313';
        g.fill();
      }
    }
    const L = this.light;
    if (L.on) {
      const warn = L.timer < 0.35 && Math.sin(this.t * 60) > 0;
      const grad = g.createRadialGradient(L.x, L.y, 10, L.x, L.y, LIGHT_R);
      grad.addColorStop(0, warn ? 'rgba(255,240,170,.25)' : 'rgba(255,240,170,.6)');
      grad.addColorStop(1, 'rgba(255,240,170,.12)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(L.x, L.y, LIGHT_R, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(L.x, L.y, LIGHT_R, 0, Math.PI * 2);
    g.strokeStyle = L.on ? 'rgba(255,240,170,.9)' : 'rgba(255,255,255,.25)';
    g.setLineDash(L.on ? [] : [8, 10]);
    g.lineWidth = 3;
    g.stroke();
    g.setLineDash([]);
    if (!L.on) text(g, 'LIGHT OFF', L.x, L.y, { size: 20, color: 'rgba(255,255,255,.4)' });

    for (const i of this.trio) {
      const s = this.ss[i];
      const info = this.ctx.players[i];
      if (s.out) continue;
      drawCharacter(g, info.char, s.x + (s.stun > 0 ? Math.sin(this.t * 40) * 4 : 0), s.y, SNEAK_R, {
        t: this.t, drunk: info.drunk, moving: s.moving, walk: s.walk, phase: i, sad: s.stun > 0,
      });
      tag(g, info, s.x, s.y - SNEAK_R - 22);
      if (s.stun > 0) text(g, 'CAUGHT!', s.x, s.y + 46, { size: 18, color: COLORS.bad, stroke: '#140f1f', strokeW: 4 });
      else if (this.lit(s) && !s.moving) text(g, 'frozen', s.x, s.y + 44, { size: 14, weight: 700, color: COLORS.good });
    }
    const soloInfo = this.ctx.players[this.solo];
    text(g, `${soloInfo.label} ${soloInfo.name} runs the spotlight`, 24, 86, { size: 18, align: 'left', color: soloInfo.color });
    const escaped = this.trio.filter((i) => this.ss[i].out).length;
    text(g, `Escaped: ${escaped} / ${Math.min(NEED_OUT, this.trio.length)}`, W / 2, 29, { size: 24 });
  }
}

export default {
  name: 'Dine and Dash',
  type: '1v3',
  howTo: [
    'Trio: sneak to the exit. Freeze when the light is on you.',
    'Spotlight: catch anyone moving to send them back.',
    'Two escapes wins it for the trio. Left stick only.',
  ],
  create: (ctx) => new DineAndDash(ctx),
};
