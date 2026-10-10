import { W, H, COLORS } from '../config.js';
import { text, panel } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { drunkLevel } from '../drunk.js';
import { state, CPU_SKILL } from '../state.js';
import { sfx } from '../audio.js';
import { stage } from '../gl/stage.js';
import { TYPE_LABELS } from './index.js';
import { ResultsScene } from '../scenes/results.js';
import { drain } from './fx.js';

// How each kind of feedback event lands: its sound, how hard the camera shakes, how long the
// action freezes, and the buzz for whoever did it (`buzz`) and whoever it happened to (`buzzHit`),
// each as [milliseconds, strength]. Different pulse shapes mean different things.
const FEEL = {
  dash: { sound: 'whoosh', shake: 0, freeze: 0, buzz: [60, 0.3] },
  shove: { sound: 'thump', shake: 7, freeze: 0.05, buzz: [90, 0.5], buzzHit: [220, 0.9] },
  hit: { sound: 'ouch', shake: 8, freeze: 0.06, buzz: [220, 0.8] },
  out: { sound: 'ko', shake: 14, freeze: 0.12, buzz: [450, 1] },
  score: { sound: 'ding', shake: 3, freeze: 0, buzz: [80, 0.6] },
  fail: { sound: 'oops', shake: 5, freeze: 0, buzz: [160, 0.6] },
};

const INTRO_TIMEOUT = 30;

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Team index per player. FFA: everyone alone. 2v2: random pairs. 1v3: team 0 is the solo player.
function assignTeams(type, n) {
  if (type === 'ffa') return Array.from({ length: n }, (_, i) => i);
  const order = shuffled(Array.from({ length: n }, (_, i) => i));
  const teams = new Array(n).fill(1);
  const first = type === '2v2' ? Math.floor(n / 2) : 1;
  for (let i = 0; i < first; i++) teams[order[i]] = 0;
  return teams;
}

// Runs one minigame: how-to screen (with optional practice), countdown, play, finish, then
// hands off to the results screen.
//
// A minigame module is { name, type, howTo: [lines], create(ctx) } where the instance has
// update(dt, inputs), draw(g), bot(i) -> {x, y, btn}, timeLeft(), and sets `finished` plus
// `ranking`: groups of player indices, best first (a group is a tie or a team).
//
// opts.participants: indices into state.players of who is playing (default: everyone).
// opts.teams: team number for each participant (default: chosen at random for team games).
// opts.settle: what is at stake: { kind: 'round' } (default), { kind: 'duel', wager } or
//              { kind: 'battle', pot }.
export class MinigameScene {
  // onDone runs after the results screen; the caller decides where the game goes next.
  constructor(def, onDone, opts = {}) {
    this.def = def;
    this.onDone = onDone;
    this.opts = opts;
  }

  enter() {
    sfx('start');
    this.ids = this.opts.participants || state.players.map((p, i) => i);
    this.players = this.ids.map((i) => state.players[i]);
    this.teams = this.opts.teams || assignTeams(this.def.type, this.players.length);
    this.settle = this.opts.settle || { kind: 'round' };
    this.phase = 'intro';
    this.t = 0;
    this.ready = this.players.map((p) => p.cpu);
    this.stumbling = this.players.map(() => false);
    this.shake = 0;
    this.freeze = 0;
    drain();
    this.build();
  }

  // A fresh copy of the minigame; practice rounds throw theirs away.
  build() {
    this.prevBtn = this.players.map(() => false);
    this.inst = this.def.create({
      players: this.players.map((p, k) => ({
        index: k, char: p.char, color: p.color, label: p.label, name: p.name,
        team: this.teams[k], drunk: drunkLevel(p.sips),
      })),
      teams: this.teams,
    });
  }

  inputs(dt) {
    const stick = CPU_SKILL[state.settings.cpuSkill].stick;
    return this.players.map((p, i) => {
      let raw;
      if (p.cpu) {
        const b = this.inst.bot(i);
        raw = { x: b.x * stick, y: b.y * stick, btn: !!b.btn, pressed: !!b.btn && !this.prevBtn[i] };
        this.prevBtn[i] = !!b.btn;
      } else {
        raw = this.game.input.get(p.device);
      }
      const out = p.filter.apply(raw, drunkLevel(p.sips), dt);
      // The controller buzzes when its character lurches.
      if (out.stumbling && !this.stumbling[i] && !p.cpu) this.game.input.rumble(p.device, 180, 0.6);
      this.stumbling[i] = out.stumbling;
      out.seat = i;   // lets the minigame say whose controller should feel what happens next
      return out;
    });
  }

  // Turns what the minigame says happened into sound, shake, a freeze frame and controller buzz.
  feedback() {
    for (const e of drain()) {
      const feel = FEEL[e.kind];
      if (!feel) continue;
      sfx(feel.sound);
      this.shake = Math.max(this.shake, feel.shake);
      this.freeze = Math.max(this.freeze, feel.freeze);
      for (const [seat, buzz] of [[e.seat, feel.buzz], [e.hit, feel.buzzHit]]) {
        const p = this.players[seat];
        if (p && buzz && !p.cpu) this.game.input.rumble(p.device, buzz[0], buzz[1]);
      }
    }
  }

  // One step of the minigame itself. A big hit holds the action still for a moment first.
  step(dt) {
    this.shake *= Math.exp(-9 * dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.inst.update(dt, this.inputs(dt));
    this.feedback();
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    if (this.phase === 'intro') {
      let practice = false;
      this.players.forEach((p, i) => {
        if (p.cpu) return;
        const s = input.get(p.device);
        if (s.pressed) { this.ready[i] = true; sfx('select'); }
        if (s.down && !state.autoplay) practice = true;
      });
      if (practice) { this.phase = 'practice'; this.t = 0; sfx('go'); return; }
      if (this.ready.every(Boolean) || this.t > INTRO_TIMEOUT) { this.phase = 'countdown'; this.t = 0; }
    } else if (this.phase === 'practice') {
      this.step(dt);
      if (this.inst.finished || input.backPressed() || input.startPressed()) {
        this.build();
        this.ready = this.players.map((p) => p.cpu);
        this.phase = 'intro';
        this.t = 0;
      }
    } else if (this.phase === 'countdown') {
      if (Math.floor(this.t) !== Math.floor(this.t - dt) || this.t === dt) sfx('tick');
      if (this.t >= 3) { this.phase = 'play'; this.t = 0; sfx('go'); }
    } else if (this.phase === 'play') {
      this.step(dt);
      if (this.inst.finished) { this.phase = 'finish'; this.t = 0; sfx('finish'); }
    } else if (this.t > 1.8) {
      // Translate the result from "seat in this minigame" back to players in the game.
      const ranking = this.inst.ranking.map((group) => group.map((k) => this.ids[k]));
      const teams = state.players.map(() => -1);
      this.ids.forEach((id, k) => { teams[id] = this.teams[k]; });
      this.game.go(new ResultsScene(this.def, ranking, teams, this.onDone, this.settle));
    }
  }

  draw(g) {
    // Each minigame can draw itself in 3D, with its original flat drawing as the fallback.
    const bar = () => panel(g, 0, 0, W, 56, { r: 0, fill: 'rgba(13,10,20,.88)', line: null });
    // In 3D the world is on its own canvas underneath, so the bar goes down first and the
    // minigame's own labels (scores and so on) sit on top of it.
    stage.shake = this.phase === 'play' || this.phase === 'practice' ? this.shake : 0;
    if (stage.on && this.inst.draw3d) { bar(); this.inst.draw3d(stage, g); } else { this.inst.draw(g); bar(); }
    stage.shake = 0;
    text(g, this.def.name, 24, 29, { size: 26, align: 'left', color: COLORS.gold });
    if (this.phase === 'play' || this.phase === 'practice') {
      text(g, String(Math.ceil(this.inst.timeLeft())), W - 24, 29, { size: 30, align: 'right' });
    }
    if (this.phase === 'practice') {
      text(g, 'PRACTICE: this round does not count.  B / Esc / Start ends it', W / 2, H - 22, {
        size: 20, color: COLORS.gold, stroke: '#140f1f', strokeW: 6,
      });
    }
    if (this.phase === 'intro') this.drawIntro(g);
    if (this.phase === 'countdown') {
      const n = 3 - Math.floor(this.t);
      const pulse = 1 - (this.t % 1);
      text(g, String(n), W / 2, H / 2, { size: 160 + pulse * 80, weight: 900, glow: COLORS.pink, blur: 40 });
    }
    if (this.phase === 'play' && this.t < 0.8) {
      text(g, 'GO!', W / 2, H / 2, { size: 200, weight: 900, glow: COLORS.good, blur: 40 });
    }
    if (this.phase === 'finish') {
      text(g, 'FINISH!', W / 2, H / 2, { size: 150, weight: 900, glow: COLORS.gold, blur: 40, stroke: '#140f1f', strokeW: 14 });
    }
  }

  stakeLine() {
    if (this.settle.kind === 'duel') return `DUEL: winner takes ${this.settle.wager} coins from the loser`;
    if (this.settle.kind === 'battle') return `BAR FIGHT: ${this.settle.pot} coins in the pot. 1st takes 70%, 2nd 30%`;
    return TYPE_LABELS[this.def.type];
  }

  drawIntro(g) {
    g.fillStyle = 'rgba(13,10,20,.8)';
    g.fillRect(0, 0, W, H);
    panel(g, 190, 80, 900, 570, { line: COLORS.pink });
    text(g, this.def.name, W / 2, 138, { size: 60, weight: 900, glow: COLORS.pink });
    text(g, this.stakeLine(), W / 2, 192, { size: 24, color: this.settle.kind === 'round' ? COLORS.blue : COLORS.gold });
    this.def.howTo.forEach((line, i) => {
      text(g, line, W / 2, 252 + i * 40, { size: 26, weight: 700 });
    });
    const n = this.players.length;
    const teamGame = new Set(this.teams).size < n;
    this.players.forEach((p, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * 190;
      drawCharacter(g, p.char, x, 452, 40, { t: this.t, drunk: drunkLevel(p.sips), phase: i });
      text(g, `${p.label} ${p.name}`, x, 522, { size: 20, color: p.color });
      if (teamGame) {
        const solo = this.def.type === '1v3';
        const name = this.teams[i] === 0 ? (solo ? 'Solo' : 'Team A') : (solo ? 'Trio' : 'Team B');
        text(g, name, x, 394, { size: 18, color: this.teams[i] === 0 ? COLORS.pink : COLORS.blue });
      }
      text(g, this.ready[i] ? 'READY' : 'Press A', x, 552, {
        size: 18, color: this.ready[i] ? COLORS.good : COLORS.dim,
      });
    });
    text(g, 'Push the stick down to try a practice round first', W / 2, 612, { size: 17, weight: 700, color: COLORS.dim });
  }
}
