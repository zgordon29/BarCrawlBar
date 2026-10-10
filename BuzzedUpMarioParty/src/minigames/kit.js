// Shared pieces for minigames: movement, collisions, ranking and common drawing.
import { W, H } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { emit } from './fx.js';

export const TOP = 56; // height of the HUD bar the runner draws

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function mover(x, y) {
  // Movers start out facing the camera.
  return { x, y, vx: 0, vy: 0, face: Math.PI / 2, walk: 0, moving: false, cd: 0, dashT: 0, stun: 0, out: false };
}

// ---- 3D helpers (each minigame's draw3d uses these; `s` is the stage from gl/stage.js) ----

// Sets up the usual minigame view: looking down at the 1280 x 720 play area from the near side.
// o: { cx, cy, dist, pitch, lookZ, ground (colour), groundZ }
export function arena(s, o = {}) {
  s.use('arena');
  s.cam(o.cx === undefined ? W / 2 : o.cx, o.cy === undefined ? H / 2 + 40 : o.cy, o.dist || 1100, o.pitch || 60, o);
  s.flat(W / 2, H / 2, 6000, 5000, o.ground || '#17121f', { z: o.groundZ === undefined ? -1 : o.groundZ });
}

// Text on the 2D canvas, placed over a point in the 3D world.
export function label3(s, g, str, x, y, z, o = {}) {
  const at = s.project(x, y, z);
  text(g, str, at.x, at.y, { size: 18, stroke: '#140f1f', strokeW: 5, ...o });
}

export function tag3(s, g, info, x, y, z = 80) {
  label3(s, g, info.label, x, y, z, { color: info.color });
}

// The 3D version of drawMover: the character, an optional cooldown ring at its feet, its label.
export function mover3(s, g, info, m, r, t, o = {}) {
  if (o.ring) s.torus(m.x, m.y, (o.z || 0) + 3, r * 1.15, m.cd <= 0 ? info.color : '#55506a', { tube: 3 });
  s.char('p' + info.index, info.char, m.x, m.y, {
    r, t, drunk: info.drunk, moving: m.moving, walk: m.walk, phase: info.index, face: m.face, ...o,
  });
  if (o.label !== false) tag3(s, g, info, m.x, m.y, (o.z || 0) + r * 2.7);
}

// A low wall around a rectangular play area.
export function rails(s, x0, y0, x1, y1, color, h = 16) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  s.box(mx, y0 - 6, x1 - x0 + 24, 12, h, color);
  s.box(mx, y1 + 6, x1 - x0 + 24, 12, h, color);
  s.box(x0 - 6, my, 12, y1 - y0, h, color);
  s.box(x1 + 6, my, 12, y1 - y0, h, color);
}

// Colour from hue (0-360), saturation and lightness (0-100), as a hex string.
export function hsl(h, sat, light) {
  const a = (sat / 100) * Math.min(light / 100, 1 - light / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = light / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Momentum movement: stick accelerates, friction slows. Top speed is about accel / friction.
export function drive(m, inp, dt, accel = 1500, friction = 5.5) {
  // Remember whose stick this is, so feedback about this mover reaches the right controller.
  if (inp.seat !== undefined) m.seat = inp.seat;
  const mag = Math.hypot(inp.x, inp.y);
  m.moving = mag > 0.2;
  if (m.moving) { m.face = Math.atan2(inp.y, inp.x); m.walk += dt; }
  m.vx += inp.x * accel * dt;
  m.vy += inp.y * accel * dt;
  const f = Math.exp(-friction * dt);
  m.vx *= f;
  m.vy *= f;
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  m.cd -= dt;
  m.dashT -= dt;
}

// A burst of speed in the facing direction, with a cooldown. Returns true if it fired.
export function dash(m, inp, power = 620, cooldown = 1.2) {
  if (!inp.pressed || m.cd > 0) return false;
  m.vx += Math.cos(m.face) * power;
  m.vy += Math.sin(m.face) * power;
  m.dashT = 0.25;
  m.cd = cooldown;
  emit('dash', m);
  return true;
}

// Pushes overlapping circles apart and bounces them. A dashing mover shoves the other one.
export function bump(list, r, shove = 380) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.out || b.out) continue;
      const ra = a.r || r;
      const rb = b.r || r;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= ra + rb) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = ra + rb - d;
      a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
      b.x += nx * overlap / 2; b.y += ny * overlap / 2;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -rel * 0.95;
        a.vx -= nx * imp; a.vy -= ny * imp;
        b.vx += nx * imp; b.vy += ny * imp;
      }
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (a.dashT > 0) { b.vx += nx * shove; b.vy += ny * shove; a.dashT = 0; emit('shove', { ...mid, seat: a.seat, hit: b.seat }); }
      if (b.dashT > 0) { a.vx -= nx * shove; a.vy -= ny * shove; b.dashT = 0; emit('shove', { ...mid, seat: b.seat, hit: a.seat }); }
    }
  }
}

export function keepIn(m, x0, y0, x1, y1, r) {
  if (m.x < x0 + r) { m.x = x0 + r; m.vx = Math.abs(m.vx) * 0.3; }
  if (m.x > x1 - r) { m.x = x1 - r; m.vx = -Math.abs(m.vx) * 0.3; }
  if (m.y < y0 + r) { m.y = y0 + r; m.vy = Math.abs(m.vy) * 0.3; }
  if (m.y > y1 - r) { m.y = y1 - r; m.vy = -Math.abs(m.vy) * 0.3; }
}

// Stick direction that heads from `m` towards a point.
export function seek(m, tx, ty, strength = 1) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return { x: 0, y: 0 };
  return { x: (dx / d) * strength, y: (dy / d) * strength };
}

// Ranks players by score into groups, best first; equal scores share a group.
export function rankBy(scores, higherIsBetter = true) {
  const order = scores.map((s, i) => i).sort((a, b) => (higherIsBetter ? scores[b] - scores[a] : scores[a] - scores[b]));
  const groups = [];
  for (const i of order) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(scores[last[0]] - scores[i]) < 1e-6) last.push(i);
    else groups.push([i]);
  }
  return groups;
}

// Ranking for team games: winners first. `winner` is a team number, or -1 for a draw.
export function teamRanking(teams, winner) {
  const all = teams.map((t, i) => i);
  if (winner < 0) return [all];
  return [all.filter((i) => teams[i] === winner), all.filter((i) => teams[i] !== winner)];
}

export function floor(g, color = '#17121f', grid = 80) {
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  if (!grid) return;
  g.strokeStyle = 'rgba(255,255,255,.04)';
  g.lineWidth = 2;
  for (let x = 0; x < W; x += grid) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += grid) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}

export function tag(g, info, x, y, extra = '') {
  text(g, info.label + extra, x, y, { size: 18, color: info.color, stroke: '#140f1f', strokeW: 5 });
}

// Draws a player's character at a mover, with its label and an optional cooldown ring.
export function drawMover(g, info, m, r, t, o = {}) {
  if (o.ring) {
    g.beginPath();
    g.arc(m.x, m.y + r * 0.9, r * 0.95, 0, Math.PI * 2);
    g.strokeStyle = m.cd <= 0 ? info.color : 'rgba(255,255,255,.2)';
    g.lineWidth = 4;
    g.stroke();
  }
  drawCharacter(g, info.char, m.x, m.y, r, {
    t, drunk: info.drunk, moving: m.moving, walk: m.walk, phase: info.index,
    lookX: Math.cos(m.face), lookY: Math.sin(m.face), ...o,
  });
  if (o.label !== false) tag(g, info, m.x, m.y - r - 22);
}

export function banner(g, s, y = H / 2, color = '#fff7e6', size = 44) {
  text(g, s, W / 2, y, { size, weight: 900, color, stroke: '#140f1f', strokeW: 10 });
}
