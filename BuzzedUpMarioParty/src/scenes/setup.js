import { W, COLORS } from '../config.js';
import { text, panel, backdrop } from '../draw.js';
import { CHARACTERS, drawCharacter } from '../characters.js';
import {
  state, makePlayer, INTENSITY, INTENSITY_ORDER, TURN_OPTIONS, RATINGS, RULES, CPU_SKILL, beersText,
} from '../state.js';
import { TitleScene } from './title.js';
import { SelectScene } from './select.js';
import { BoardScene } from './board.js';
import { ControlsScene } from './controls.js';
import { sfx } from '../audio.js';

const ROWS = ['cpu', 'cpuSkill', 'turns', 'rules', 'intensity', 'rating', 'start'];

export class SetupScene {
  enter() {
    this.t = 0;
    this.slots = [null, null, null, null];
    this.phase = 'join';
    this.cursor = 0;
    this.settings = { ...state.settings };
    // Phone controllers need the local server; without it this box just stays hidden.
    this.phoneUrl = '';
    this.qr = null;
    fetch('/info').then((r) => r.json()).then((info) => {
      this.phoneUrl = info.phoneUrl;
      const img = new Image();
      img.onload = () => { this.qr = img; };
      img.src = '/qr.svg';
    }).catch(() => {});
  }

  taken(charIdx, except) {
    return this.slots.some((s) => s && s !== except && s.charIdx === charIdx);
  }

  freeChar(from, dir, except) {
    let i = from;
    for (let n = 0; n < CHARACTERS.length; n++) {
      i = (i + dir + CHARACTERS.length) % CHARACTERS.length;
      if (!this.taken(i, except)) return i;
    }
    return from;
  }

  update(dt) {
    this.t += dt;
    const input = this.game.input;
    if (input.startPressed()) { this.game.go(new ControlsScene(this)); return; }
    // A phone that disconnects gives up its seat.
    this.slots = this.slots.map((s) => (s && s.device.startsWith('phone') && !input.devices.has(s.device) ? null : s));
    if (this.phase === 'settings' && !this.slots.some(Boolean)) this.phase = 'join';
    if (this.phase === 'join') this.updateJoin(input);
    else this.updateSettings(input);
  }

  updateJoin(input) {
    for (const id of input.pressedDevices()) {
      const mine = this.slots.find((s) => s && s.device === id);
      sfx('select');
      if (mine) { mine.ready = true; continue; }
      const empty = this.slots.indexOf(null);
      if (empty < 0) continue;
      const slot = { device: id, charIdx: this.freeChar(-1, 1, null), ready: false, nonDrinker: false };
      this.slots[empty] = slot;
      input.tell(id, CHARACTERS[slot.charIdx].name, CHARACTERS[slot.charIdx].color);
    }
    for (const s of this.slots) {
      if (!s || s.ready) continue;
      const d = input.get(s.device);
      const before = s.charIdx;
      if (d.left) s.charIdx = this.freeChar(s.charIdx, -1, s);
      if (d.right) s.charIdx = this.freeChar(s.charIdx, 1, s);
      if (s.charIdx !== before) input.tell(s.device, CHARACTERS[s.charIdx].name, CHARACTERS[s.charIdx].color);
      if (d.up || d.down) s.nonDrinker = !s.nonDrinker;
    }
    if (input.backPressed()) {
      const joined = this.slots.filter(Boolean);
      if (joined.some((s) => s.ready)) joined.forEach((s) => { s.ready = false; });
      else if (joined.length) this.slots = [null, null, null, null];
      else this.game.go(new TitleScene());
      return;
    }
    const joined = this.slots.filter(Boolean);
    if (joined.length && joined.every((s) => s.ready)) {
      this.phase = 'settings';
      this.cursor = ROWS.length - 1;
    }
  }

  updateSettings(input) {
    const m = input.merged(this.slots.filter(Boolean).map((s) => s.device));
    const st = this.settings;
    if (m.up) this.cursor = (this.cursor + ROWS.length - 1) % ROWS.length;
    if (m.down) this.cursor = (this.cursor + 1) % ROWS.length;
    const dir = (m.right ? 1 : 0) - (m.left ? 1 : 0);
    const row = ROWS[this.cursor];
    if (dir) {
      const cycle = (list, cur) => list[(list.indexOf(cur) + dir + list.length) % list.length];
      sfx('move');
      if (row === 'cpu') st.cpuFill = !st.cpuFill;
      if (row === 'cpuSkill') st.cpuSkill = cycle(Object.keys(CPU_SKILL), st.cpuSkill);
      if (row === 'rules') st.rules = cycle(Object.keys(RULES), st.rules);
      if (row === 'turns') st.turns = cycle(TURN_OPTIONS, st.turns);
      if (row === 'intensity') st.intensity = cycle(INTENSITY_ORDER, st.intensity);
      if (row === 'rating') st.rating = cycle(Object.keys(RATINGS), st.rating);
    }
    if (input.backPressed()) {
      this.phase = 'join';
      this.slots.forEach((s) => { if (s) s.ready = false; });
      return;
    }
    if (m.pressed && row === 'start' && this.playerCount() >= 2) this.start();
  }

  playerCount() {
    return this.settings.cpuFill ? 4 : this.slots.filter(Boolean).length;
  }

  start() {
    const players = [];
    const used = new Set();
    let human = 0;
    for (const s of this.slots) {
      if (!s) continue;
      const p = makePlayer(players.length, s.device, CHARACTERS[s.charIdx].id, s.nonDrinker);
      p.label = 'P' + (++human);
      used.add(s.charIdx);
      players.push(p);
    }
    if (this.settings.cpuFill) {
      for (let i = 0; i < CHARACTERS.length && players.length < 4; i++) {
        if (used.has(i)) continue;
        const p = makePlayer(players.length, 'cpu', CHARACTERS[i].id);
        p.label = 'CPU';
        players.push(p);
      }
    }
    state.players = players;
    state.settings = { ...this.settings };
    sfx('start');
    this.game.go(state.mode === 'crawl' ? new BoardScene() : new SelectScene());
  }

  draw(g) {
    backdrop(g, this.t);
    text(g, state.mode === 'crawl' ? 'WHO\'S CRAWLING?' : 'WHO\'S PLAYING?', W / 2, 54, { size: 48, weight: 900, glow: COLORS.pink });
    const input = this.game.input;

    this.slots.forEach((s, i) => {
      const x = 50 + i * 300;
      const y = 100;
      panel(g, x, y, 280, 320, { line: s ? CHARACTERS[s.charIdx].color : COLORS.panelLine });
      if (!s) {
        text(g, 'Open seat', x + 140, y + 130, { size: 28, color: COLORS.dim });
        text(g, 'Press A / Space / Enter', x + 140, y + 175, { size: 18, weight: 600, color: COLORS.dim });
        text(g, 'to join', x + 140, y + 200, { size: 18, weight: 600, color: COLORS.dim });
        return;
      }
      const c = CHARACTERS[s.charIdx];
      text(g, `P${this.slots.filter(Boolean).indexOf(s) + 1}`, x + 30, y + 32, { size: 24, color: c.color });
      drawCharacter(g, c.id, x + 140, y + 110, 56, { t: this.t, phase: i });
      text(g, s.ready ? c.name : `◄  ${c.name}  ►`, x + 140, y + 205, { size: 28 });
      text(g, input.label(s.device), x + 140, y + 238, { size: 16, weight: 600, color: COLORS.dim });
      text(g, s.nonDrinker ? 'Not drinking' : 'Drinking', x + 140, y + 266, {
        size: 18, color: s.nonDrinker ? COLORS.blue : COLORS.gold,
      });
      if (s.ready) {
        text(g, 'READY', x + 140, y + 298, { size: 22, color: COLORS.good });
      } else {
        text(g, 'Up/Down: drinking   A: ready', x + 140, y + 298, { size: 14, weight: 600, color: COLORS.dim });
      }
    });

    const st = this.settings;
    const active = this.phase === 'settings';
    panel(g, 290, 440, 700, 262, { line: active ? COLORS.gold : COLORS.panelLine });
    const rows = [
      ['Empty seats', st.cpuFill ? 'Computer players' : 'Left empty'],
      ['Computer skill', CPU_SKILL[st.cpuSkill].label],
      ['Turns', st.turns === 5 ? '5 (Frenzy: start with 50 coins, a cap, an item)' : String(st.turns)],
      ['Rules', st.rules === 'pro' ? 'Pro (less luck, one bonus cap)' : 'Party (all the chaos)'],
      // Said in real drinks for the length of crawl chosen, so nobody is surprised at turn ten.
      ['Intensity', `${INTENSITY[st.intensity].label}: ${beersText(INTENSITY[st.intensity].pace * st.turns)} each over the crawl`],
      ['Cards', RATINGS[st.rating]],
    ];
    rows.forEach(([name, value], i) => {
      const y = 462 + i * 32;
      const sel = active && this.cursor === i;
      text(g, name, 320, y, { size: 19, align: 'left', color: sel ? COLORS.gold : COLORS.dim });
      text(g, sel ? `◄  ${value}  ►` : value, 960, y, { size: 19, align: 'right', color: sel ? COLORS.ink : COLORS.dim });
    });
    const sel = active && this.cursor === ROWS.length - 1;
    const ok = this.playerCount() >= 2;
    text(g, ok ? 'START' : 'Need at least 2 players', 640, 670, {
      size: 30, weight: 900, color: !active ? COLORS.dim : sel && ok ? COLORS.good : COLORS.ink,
      glow: sel && ok ? COLORS.good : null,
    });
    if (!active) {
      text(g, 'Everyone press A when ready', 640, 428, { size: 16, weight: 600, color: COLORS.dim });
    }

    if (this.phoneUrl) {
      panel(g, 50, 440, 220, 262);
      text(g, 'Use your phone', 160, 464, { size: 20, color: COLORS.blue });
      if (this.qr) g.drawImage(this.qr, 85, 482, 150, 150);
      text(g, 'Scan on the same Wi-Fi, or open', 160, 650, { size: 12, weight: 600, color: COLORS.dim });
      text(g, this.phoneUrl.replace('http://', ''), 160, 674, { size: 15, color: COLORS.ink });
    }
    panel(g, 1010, 440, 220, 262);
    text(g, 'Controls', 1120, 464, { size: 20, color: COLORS.blue });
    const help = [
      ['Stick / D-pad', 'move'], ['A', 'join, ready, select'], ['B / Esc', 'back'], ['Start / Tab', 'options'],
    ];
    help.forEach(([key, what], i) => {
      text(g, key, 1120, 506 + i * 48, { size: 17, color: COLORS.ink });
      text(g, what, 1120, 526 + i * 48, { size: 14, weight: 600, color: COLORS.dim });
    });
  }
}
