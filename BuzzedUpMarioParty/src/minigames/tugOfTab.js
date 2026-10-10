import { W, H, COLORS } from '../config.js';
import { text } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { TOP, teamRanking, floor, rand, arena, label3 } from './kit.js';

const LIMIT = 30;
const BEAT = 1.2;       // seconds between "PULL!" calls
const BEAT_WINDOW = 0.16;
const REACH = 300;      // pixels the marker must travel to win

class TugOfTab {
  constructor(ctx) {
    this.ctx = ctx;
    this.pos = 0;   // -1 = team A wins (left), +1 = team B wins (right)
    this.vel = 0;
    this.skill = ctx.players.map(() => rand(0.55, 0.95));
    this.pulse = ctx.players.map(() => 0);
    this.t = 0;
    this.finished = false;
    this.ranking = [];
  }

  timeLeft() { return Math.max(0, LIMIT - this.t); }

  onBeat() {
    const ph = this.t % BEAT;
    return ph < BEAT_WINDOW || ph > BEAT - BEAT_WINDOW;
  }

  bot(i) {
    const side = this.ctx.players[i].team ? 1 : -1;
    return { x: side, y: 0, btn: Math.floor(this.t * (9 + 8 * this.skill[i])) % 2 === 0 };
  }

  update(dt, inputs) {
    this.t += dt;
    const beat = this.onBeat();
    inputs.forEach((inp, i) => {
      this.pulse[i] -= dt;
      if (!inp.pressed) return;
      const side = this.ctx.players[i].team ? 1 : -1;
      // Leaning the stick your way puts your weight into the pull.
      const lean = 0.35 + 0.65 * Math.max(0, inp.x * side);
      this.vel += side * 0.4 * lean * (beat ? 2 : 1);
      this.pulse[i] = 0.12;
    });
    this.vel *= Math.exp(-6 * dt);
    this.pos += this.vel * dt;
    if (Math.abs(this.pos) >= 1 || this.t >= LIMIT) {
      const winner = Math.abs(this.pos) < 0.02 ? -1 : this.pos < 0 ? 0 : 1;
      this.ranking = teamRanking(this.ctx.teams, winner);
      this.finished = true;
    }
  }

  // Seen from the side: two teams, one rope, and the bar tab tied to the middle of it.
  draw3d(s, g) {
    const LINE = 420;   // how far back the rope is
    const mx = W / 2 + this.pos * REACH;
    arena(s, { cy: LINE, pitch: 18, dist: 1750, fov: 26, lookZ: 90, ground: '#141019' });
    s.flat(W / 2, LINE, 1700, 460, '#1f1829', { z: 0 });
    s.flat((W / 2 - REACH) / 2 - 100, LINE, W / 2 - REACH + 200, 460, COLORS.pink, { z: 0.6, opacity: 0.2 });
    s.flat(W - (W / 2 - REACH) / 2 + 100, LINE, W / 2 - REACH + 200, 460, COLORS.blue, { z: 0.6, opacity: 0.2 });
    for (const x of [W / 2 - REACH, W / 2, W / 2 + REACH]) s.flat(x, LINE, 5, 460, '#ffffff', { z: 1, opacity: 0.3 });
    s.beam(mx - 520, LINE, 56, mx + 520, LINE, 56, 9, '#c9a36a');
    s.box(mx, LINE, 62, 6, 88, '#fff7e6', { z: 12 });
    label3(s, g, 'TAB', mx, LINE + 6, 80, { color: '#140f1f', stroke: null });

    [0, 1].forEach((t) => {
      const members = this.ctx.players.filter((p) => p.team === t);
      members.forEach((info, k) => {
        const x = mx + (t ? 1 : -1) * (190 + k * 120);
        const pulling = this.pulse[info.index] > 0;
        s.char('p' + info.index, info.char, x, LINE, {
          r: 44, t: this.t, drunk: info.drunk, phase: info.index,
          // Each side faces the middle and leans back into the pull.
          face: t ? Math.PI - 0.4 : 0.4, lean: pulling ? -0.45 : -0.15,
        });
        label3(s, g, info.label, x, LINE + 60, 0, { color: info.color });
      });
    });
    text(g, 'TEAM A', 110, TOP + 34, { size: 22, color: COLORS.pink });
    text(g, 'TEAM B', W - 110, TOP + 34, { size: 22, color: COLORS.blue });
    const beat = this.onBeat();
    text(g, 'PULL!', W / 2, TOP + 90, {
      size: beat ? 80 : 44, weight: 900, color: beat ? COLORS.gold : 'rgba(255,255,255,.2)', glow: beat ? COLORS.gold : null,
    });
    text(g, 'Presses on PULL! count double', W / 2, H - 30, { size: 16, weight: 700, color: COLORS.dim });
  }

  draw(g) {
    floor(g, '#1b1424', 0);
    const cy = H / 2 + 40;
    const mx = W / 2 + this.pos * REACH;
    g.fillStyle = 'rgba(255,79,163,.12)';
    g.fillRect(0, TOP, W / 2 - REACH, H - TOP);
    g.fillStyle = 'rgba(79,216,255,.12)';
    g.fillRect(W / 2 + REACH, TOP, W / 2 - REACH, H - TOP);
    g.strokeStyle = 'rgba(255,255,255,.25)';
    g.setLineDash([10, 12]);
    g.lineWidth = 4;
    for (const x of [W / 2 - REACH, W / 2, W / 2 + REACH]) {
      g.beginPath(); g.moveTo(x, TOP + 60); g.lineTo(x, H - 40); g.stroke();
    }
    g.setLineDash([]);
    // The rope and the bar tab tied to its middle.
    g.strokeStyle = '#c9a36a';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(mx - 480, cy);
    g.lineTo(mx + 480, cy);
    g.stroke();
    g.fillStyle = '#fff7e6';
    g.fillRect(mx - 34, cy - 50, 68, 90);
    g.fillStyle = '#140f1f';
    text(g, 'TAB', mx, cy - 28, { size: 18, color: '#140f1f' });
    for (let r = 0; r < 4; r++) g.fillRect(mx - 22, cy - 8 + r * 11, 44, 3);

    [0, 1].forEach((t) => {
      const members = this.ctx.players.filter((p) => p.team === t);
      members.forEach((info, k) => {
        const x = mx + (t ? 1 : -1) * (190 + k * 120);
        const lean = this.pulse[info.index] > 0 ? (t ? 0.35 : -0.35) : (t ? 0.15 : -0.15);
        drawCharacter(g, info.char, x, cy - 10, 44, { t: this.t, drunk: info.drunk, phase: info.index, tilt: lean });
        text(g, info.label, x, cy + 66, { size: 18, color: info.color });
      });
    });
    text(g, 'TEAM A', 110, TOP + 34, { size: 22, color: COLORS.pink });
    text(g, 'TEAM B', W - 110, TOP + 34, { size: 22, color: COLORS.blue });
    const beat = this.onBeat();
    text(g, 'PULL!', W / 2, TOP + 90, {
      size: beat ? 80 : 44, weight: 900, color: beat ? COLORS.gold : 'rgba(255,255,255,.2)', glow: beat ? COLORS.gold : null,
    });
    text(g, 'Presses on PULL! count double', W / 2, H - 30, { size: 16, weight: 700, color: COLORS.dim });
  }
}

export default {
  name: 'Tug of Tab',
  type: '2v2',
  howTo: [
    'Out-pull the other team. The losers get stuck with the tab.',
    'Mash A, and hold the stick toward your own side.',
    'Presses timed with PULL! count double.',
  ],
  create: (ctx) => new TugOfTab(ctx),
};
