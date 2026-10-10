import { W, H, COLORS } from '../config.js';
import { text, panel, drunkMeter, coin, bottleCap } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { drunkLevel, drunkStage, setDrunkScale } from '../drunk.js';
import {
  state, INTENSITY, RATINGS, RULES, addSips, scaledSips, sipRoom, newRound, humanDevices, isPro, trackPeaks,
  standings, NON_DRINKER_COINS_PER_SIP,
} from '../state.js';
import { sfx } from '../audio.js';
import { MAP, WORLD, TILE, ZONES, ALLEY, stepsBetween, zoneInfo } from '../board/map.js';
import { drawWorld } from '../board/art.js';
import { stage } from '../gl/stage.js';
import { drawBoard3D } from '../gl/board3d.js';
import { ITEMS, addItem, randomItem, drawItemIcon } from '../board/items.js';
import { cpuBranch } from '../board/cpu.js';
import {
  CAP_COST, DIE_MAX, LAST_CALL_TURNS, HAPPY_HOUR_EVERY, MAX_ITEMS, COIN_SPACE, HIDDEN_STASH_CHANCE, FRENZY_TURNS,
  STEP_TIME, CPU_DELAY, OVERVIEW, NEAR_ZOOM, VIEW_X, PROMPT_X, LAST_CALL_SPEED, FAST_FORWARD,
} from '../board/consts.js';
import { wrap, prompt, subPrompt, bigNote, choiceBox, drawSal } from '../board/ui.js';
import { orderPhases } from '../board/phases/order.js';
import { menuPhases } from '../board/phases/menu.js';
import { servicePhases } from '../board/phases/services.js';
import { eventPhases } from '../board/phases/events.js';
import { cardPhases } from '../board/phases/cards.js';
import { hostLine } from '../content/host.js';
import { MINIGAMES, playable, TYPE_LABELS } from '../minigames/index.js';
import { MinigameScene } from '../minigames/runner.js';
import { FinalScene } from './final.js';
import { TitleScene } from './title.js';

// A three-and-one colour split is played as a free-for-all this often instead of 1 vs 3.
// Left alone, the colour rule makes 1 vs 3 the most common game; this brings the mix to roughly
// half free-for-all, a quarter 1 vs 3 and a fifth 2 vs 2.
const ODD_ONE_OUT_TO_FFA = 0.45;
// The same minigame is not played again until this many rounds have gone by. Duels and bar
// fights count too.
const REPEAT_GAP = 5;

// Player panels sit in the four corners of the screen, as on a Mario Party board.
const PANEL_W = 250;
const PANEL_H = 84;
const PANEL_AT = [[12, 12], [W - PANEL_W - 12, 12], [12, H - PANEL_H - 12], [W - PANEL_W - 12, H - PANEL_H - 12]];
const RANKS = ['1st', '2nd', '3rd', '4th'];
const ZONE_COLORS = { sports: '#990000', pub: '#ffc83d', dive: '#6ee27a', speak: '#4fd8ff', club: '#ff4fa3', alley: '#a99cc2' };

// Phases where B / Esc means "go back" rather than "quit the game?".
const SUBMENUS = new Set(['itemMenu', 'itemTarget', 'itemLoaded', 'mapView', 'shop', 'hustler', 'hustleTarget']);
// Phases that show the whole board rather than following a player.
const WIDE = new Set(['roundIntro', 'pickGame', 'orderIntro', 'orderRoll', 'orderShow', 'lastCallIntro', 'mapView']);

// The bar-crawl board. Each round every player takes a turn (use an item, roll, move, resolve
// the space they stop on), then a minigame is played and its winnings go back into the board.
//
// A turn is a chain of small phases; each phase has a do_<name>(dt) method and usually a
// draw_<name>(g). The phases live in src/board/phases and are mixed in at the bottom of this file.
//
// mode: 'new' starts a crawl, 'round' comes back from the end-of-round minigame, and 'mid'
// comes back from a duel or bar fight in the middle of a round.
export class BoardScene {
  constructor(mode = 'new') { this.mode = mode; }

  enter() {
    this.t = 0;
    this.pt = 0;
    this.cam = { x: WORLD.w / 2, y: WORLD.h / 2, s: OVERVIEW };
    this.pops = [];
    this.host = { text: '', t: 0 };
    this.quit = 0;
    this.back = 'moving';
    this.focus = null;
    this.diceCount = 1;
    this.forced = 0;
    this.turn = -1;
    this.capDrop = 1;
    if (this.mode === 'new') this.newGame();
    this.G = state.game;
    this.resetTokens();
    if (this.mode === 'round') this.G.round++;
    if (this.G.round > state.settings.turns) { this.game.go(new FinalScene()); return; }
    this.lastCall = state.settings.turns - this.G.round < LAST_CALL_TURNS;
    this.happyHour = this.G.round % this.happyEvery() === 0;

    if (this.mode === 'new') {
      this.say('welcome');
      this.set('orderIntro');
    } else if (this.mode === 'round') {
      this.startRound();
    } else {
      this.turn = this.G.turn;
      if (this.G.resume === 'same') { this.openMenu(); this.set('turnIntro'); } else this.nextTurn();
    }
  }

  newGame() {
    const frenzy = state.settings.turns === FRENZY_TURNS;
    state.game = {
      round: 1,
      capNode: MAP.capSpots[1 + Math.floor(Math.random() * (MAP.capSpots.length - 1))],
      played: {},                                  // minigame name -> the round it was last played in
      recentCards: [], rule: null,
      turn: -1, usedItem: false, resume: 'next',   // where the current round has got to
      pot: 0,                                      // coins in the tip jar
      lastCallDone: false,
    };
    for (const p of state.players) {
      // A five-turn game has no time for a slow start, so everyone begins mid-game.
      const coins = frenzy ? 50 : 10;
      Object.assign(p, {
        node: 0, coins, caps: frenzy ? 1 : 0, wins: 0, sips: 0, roundSips: 0,
        items: frenzy ? ['energy'] : [], tint: null, cursed: false,
        stats: { mgCoins: 0, peak: coins, cards: 0 },
      });
    }
    // An average player ends the crawl just about hammered, whatever its length and intensity.
    setDrunkScale(state.settings.turns * INTENSITY[state.settings.intensity].pace * 1.25);
  }

  resetTokens() {
    this.vis = state.players.map((p) => ({ x: MAP.nodes[p.node].x, y: MAP.nodes[p.node].y, walk: 0, moving: false }));
  }

  get player() { return state.players[this.turn]; }
  happyEvery() { return state.settings.turns === FRENZY_TURNS ? 3 : HAPPY_HOUR_EVERY; }
  capCost() { return this.happyHour ? CAP_COST / 2 : CAP_COST; }

  say(event, name = '') {
    const line = hostLine(event, state.settings.rating, name);
    if (line) this.host = { text: line, t: 4.5 };
  }

  pop(p, s, color = COLORS.ink) {
    const v = this.vis[p.index];
    const stacked = this.pops.filter((q) => q.who === p.index && q.t < 0.6).length;
    this.pops.push({ x: v.x, y: v.y - 60 - stacked * 34, gx: v.x, gy: v.y, stack: stacked, s, color, t: 0, who: p.index });
  }

  // Input for whoever has to act. Computer players (and test autoplay) answer after a short pause.
  ctl(p) {
    if (p.cpu || state.autoplay) {
      return { pressed: this.pt > (state.autoplay ? 0.12 : CPU_DELAY), left: false, right: false, up: false, down: false, auto: true };
    }
    return this.game.input.get(p.device);
  }

  set(phase) { this.phase = phase; this.pt = 0; }

  sip(p, n) {
    const before = drunkStage(p.sips);
    const got = addSips(p, n);
    if (!got) { this.pop(p, 'at the limit', COLORS.dim); return 0; }
    if (p.nonDrinker) {
      const loss = Math.min(p.coins, NON_DRINKER_COINS_PER_SIP * got);
      p.coins -= loss;
      this.pop(p, `-${loss} coins (not drinking)`, COLORS.bad);
    } else {
      this.pop(p, `DRINK ${got}`, COLORS.bad);
    }
    sfx('drink');
    if (before !== 'Hammered' && drunkStage(p.sips) === 'Hammered') this.say('hammered', p.name);
    return got;
  }

  // Adds or removes coins (never below zero). Returns the change actually made.
  coins(p, n) {
    const change = n < 0 ? -Math.min(p.coins, -n) : n;
    p.coins += change;
    if (change) this.pop(p, `${change > 0 ? '+' : ''}${change}`, change > 0 ? COLORS.gold : COLORS.bad);
    sfx(change >= 0 ? 'coin' : 'bad');
    return change;
  }

  // ---- round and turn flow ----

  startRound() {
    newRound();
    for (const p of state.players) p.tint = null;
    this.turn = -1;
    this.G.turn = -1;
    if (this.lastCall && !this.G.lastCallDone) {
      this.G.lastCallDone = true;
      this.set('lastCallIntro');
      return;
    }
    if (this.happyHour) this.say('happyHour');
    this.set('roundIntro');
  }

  nextTurn() {
    this.turn++;
    this.G.turn = this.turn;
    this.G.usedItem = false;
    this.branchChoice = null;
    this.diceCount = 1;
    this.forced = 0;
    this.back = 'moving';
    if (this.turn >= state.players.length) { this.startGamePick(); return; }
    this.openMenu();
    this.set('turnIntro');
    this.say('turn', this.player.name);
  }

  // The end of a player's turn. In Last Call, stopping on someone's space starts a duel first.
  finishTurn() {
    const p = this.player;
    if (this.lastCall && p.coins > 0) {
      const here = state.players.filter((q) => q !== p && q.node === p.node && q.coins > 0);
      if (here.length) {
        this.openDuel(p, here[Math.floor(Math.random() * here.length)], 'next');
        return;
      }
    }
    this.nextTurn();
  }

  // A callback that brings the game back to the board after a mid-round minigame.
  makeReturn() {
    const game = this.game;
    return () => game.go(new BoardScene('mid'));
  }

  // ---- update ----

  // How fast the board runs right now: a little quicker in Last Call, and much quicker while a
  // human holds A during a computer player's turn, so waiting never drags.
  speed() {
    let k = this.lastCall ? LAST_CALL_SPEED : 1;
    const p = this.player;
    this.skipping = false;
    if (p && p.cpu && !state.autoplay) {
      this.skipping = humanDevices().some((id) => this.game.input.get(id).btn);
      if (this.skipping) k *= FAST_FORWARD;
    }
    return k;
  }

  update(realDt) {
    const dt = realDt * this.speed();
    this.t += dt;
    this.pt += dt;
    this.host.t -= dt;
    if (this.zoneBanner) { this.zoneBanner.t -= realDt; if (this.zoneBanner.t <= 0) this.zoneBanner = null; }
    for (const q of this.pops) q.t += dt;
    this.pops = this.pops.filter((q) => q.t < 1.8);
    state.players.forEach((p, i) => {
      const v = this.vis[i];
      const n = MAP.nodes[p.node];
      const k = 1 - Math.exp(-14 * dt);
      v.moving = Math.hypot(n.x - v.x, n.y - v.y) > 3;
      if (v.moving) v.walk += dt;
      v.x += (n.x - v.x) * k;
      v.y += (n.y - v.y) * k;
    });
    trackPeaks();
    this.updateCamera(dt);

    const input = this.game.input;
    this.backHit = input.backPressed();
    if (this.quit > 0) {
      this.quit -= dt;
      if (this.backHit) this.quit = 0;
      else if (input.merged(humanDevices()).pressed) this.game.go(new TitleScene());
      return;
    }
    if (this.backHit && !SUBMENUS.has(this.phase)) { this.quit = 8; return; }
    this['do_' + this.phase](dt);
  }

  updateCamera(dt) {
    let tx = WORLD.w / 2;
    let ty = WORLD.h / 2;
    let ts = OVERVIEW;
    if (this.focus) {
      tx = this.focus.x; ty = this.focus.y; ts = NEAR_ZOOM;
    } else if (!WIDE.has(this.phase) && this.turn >= 0 && this.turn < state.players.length) {
      const v = this.vis[this.turn];
      tx = v.x; ty = v.y; ts = NEAR_ZOOM;
    }
    const k = 1 - Math.exp(-3.5 * dt);
    const c = this.cam;
    c.s += (ts - c.s) * k;
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    // Keep the view inside the world.
    const left = VIEW_X / c.s;
    const right = (W - VIEW_X) / c.s;
    const hh = H / 2 / c.s;
    c.x = left + right >= WORLD.w ? WORLD.w / 2 : Math.max(left, Math.min(WORLD.w - right, c.x));
    c.y = hh * 2 >= WORLD.h ? WORLD.h / 2 : Math.max(hh, Math.min(WORLD.h - hh, c.y));
  }

  do_roundIntro() {
    const skip = state.autoplay ? this.pt > 0.2 : this.pt > 0.6 && this.game.input.merged(humanDevices()).pressed;
    if (this.pt > 2.6 || skip) this.nextTurn();
  }

  // ---- dice and movement ----

  startRoll() {
    this.dice = Array.from({ length: this.diceCount }, () => 1);
    this.dieT = 0;
    this.set('rolling');
  }

  // The dice spin until the player hits them (computer players wait a moment, then hit).
  do_rolling(dt) {
    const p = this.player;
    const max = p.cursed ? 3 : DIE_MAX;
    this.dieT -= dt;
    if (this.dieT <= 0) {
      this.dice = this.dice.map(() => 1 + Math.floor(Math.random() * max));
      this.dieT = 0.06;
      sfx('dice');
    }
    const c = this.ctl(p);
    const hit = c.auto ? this.pt > 0.8 : (this.pt > 0.3 && c.pressed) || this.pt > 8;
    if (!hit) return;
    if (this.forced) this.dice = [this.forced];
    this.steps = this.dice.reduce((a, b) => a + b, 0);
    p.cursed = false;
    if (this.dice.length === 1 && !this.forced) {
      if (this.steps === 1) this.say('roll1', p.name);
      if (this.steps === DIE_MAX) this.say('rollMax', p.name);
    }
    sfx('select');
    this.set('rolled');
  }

  do_rolled() {
    if (this.pt > 0.7) { this.set('moving'); this.pt = STEP_TIME; }
  }

  // One space at a time, so that forks and pass-by services can interrupt.
  do_moving() {
    const p = this.player;
    if (this.steps <= 0) { this.land(); return; }
    if (this.pt < STEP_TIME) return;
    const node = MAP.nodes[p.node];
    if (node.next.length > 1 && this.branchChoice === null) {
      this.sel = cpuBranch(node, p, this.capCost());
      this.set('branch');
      this.say('alley');
      return;
    }
    p.node = node.next[this.branchChoice || 0];
    this.branchChoice = null;
    this.steps--;
    this.pt = 0;
    sfx('step');
    // Walking into a different bar is announced, so everyone keeps their bearings.
    const here = MAP.nodes[p.node];
    if (here.zone !== node.zone) this.zoneBanner = { zone: here.zone, t: 1.6 };
    this.passService(here);
  }

  do_branch() {
    const c = this.ctl(this.player);
    const ways = MAP.nodes[this.player.node].next.length;
    if (c.left) this.sel = (this.sel + ways - 1) % ways;
    if (c.right) this.sel = (this.sel + 1) % ways;
    if (c.left || c.right) sfx('move');
    if (this.pt > 0.25 && c.pressed) { this.branchChoice = this.sel; this.set('moving'); this.pt = STEP_TIME; }
  }

  // Resolves the space the player stopped on.
  land() {
    const p = this.player;
    const G = this.G;
    const type = MAP.nodes[p.node].type;
    const double = this.lastCall ? 2 : 1;
    this.landed = type;
    this.landNote = '';
    // The space also decides which side the player is on in this round's minigame.
    p.tint = TILE[type].tint || (Math.random() < 0.5 ? 'blue' : 'red');

    if (type === 'coin' || (type === 'chance' && isPro())) {
      this.coins(p, COIN_SPACE * double);
      this.say('coin', p.name);
      if (!isPro() && Math.random() < HIDDEN_STASH_CHANCE) this.hiddenStash(p);
    } else if (type === 'bad') {
      this.coins(p, -COIN_SPACE * double);
      this.say('bad', p.name);
    } else if (type === 'drink') {
      this.sip(p, scaledSips(1));
      this.say('drink', p.name);
    } else if (type === 'round') {
      for (const q of state.players) this.sip(q, scaledSips(1));
      this.say('round');
    } else if (type === 'item') {
      const id = randomItem();
      if (addItem(p, id)) {
        this.pop(p, `+${ITEMS[id].name}`, COLORS.good);
        this.landNote = `${p.name} finds a free ${ITEMS[id].name}. ${ITEMS[id].text}`;
        sfx('card');
      } else {
        this.coins(p, 5);
        this.landNote = `${p.name}'s pockets are full, so it is 5 coins instead.`;
      }
      this.say('item', p.name);
    } else if (type === 'bank') {
      if (G.pot) {
        this.landNote = `${p.name} takes the tip jar: ${G.pot} coins!`;
        this.coins(p, G.pot);
        G.pot = 0;
        this.say('tipJar', p.name);
      } else {
        this.landNote = 'The tip jar is empty.';
      }
    } else if (type === 'give') {
      this.say('give', p.name);
      this.startGive(scaledSips(1), 'wait');
      return;
    } else if (type === 'card') {
      this.openCard();
      return;
    } else if (type === 'chance') {
      this.openChance();
      return;
    } else if (type === 'tab') {
      this.openTab();
      return;
    } else if (type === 'battle') {
      this.openBattle();
      return;
    }
    this.set('wait');
  }

  // A rare surprise on coin spaces (Party rules only).
  hiddenStash(p) {
    if (Math.random() < 0.2) {
      p.caps++;
      this.pop(p, '+1 BOTTLE CAP', COLORS.gold);
      this.landNote = `HIDDEN STASH! ${p.name} finds a bottle cap stuck under the bar.`;
      sfx('cap');
    } else {
      this.coins(p, 20);
      this.landNote = `HIDDEN STASH! ${p.name} finds 20 coins taped under the table.`;
    }
    this.say('hidden', p.name);
  }

  do_wait() {
    const hold = state.autoplay ? 0.2 : this.landNote ? 2.6 : 1.5;
    if (this.pt > hold) this.finishTurn();
  }

  // ---- handing out sips ----

  startGive(n, then) {
    this.give = { left: n, then };
    this.sel = -1;
    this.set('give');
  }

  giveTargets() {
    return state.players.filter((q) => q !== this.player && sipRoom(q) > 0).map((q) => q.index);
  }

  do_give() {
    const targets = this.giveTargets();
    if (!targets.length || this.give.left <= 0) { this.set(this.give.then); return; }
    if (!targets.includes(this.sel)) this.sel = targets[0];
    const c = this.ctl(this.player);
    const at = targets.indexOf(this.sel);
    if (c.left || c.up) this.sel = targets[(at + targets.length - 1) % targets.length];
    if (c.right || c.down) this.sel = targets[(at + 1) % targets.length];
    if (c.left || c.right || c.up || c.down) sfx('move');
    if (!c.pressed) return;
    if (c.auto) {
      // Pile it on whoever is winning.
      this.sel = [...targets].sort((a, b) => {
        const pa = state.players[a];
        const pb = state.players[b];
        return pb.caps - pa.caps || pb.coins - pa.coins || Math.random() - 0.5;
      })[0];
    }
    this.sip(state.players[this.sel], 1);
    this.give.left--;
    this.pt = 0;
  }

  // ---- choosing the round's minigame ----

  // The colours players picked up from their spaces decide the kind of game:
  // all the same colour is a free-for-all, two each is 2 vs 2, three and one is 1 vs 3.
  startGamePick() {
    const ps = state.players;
    const n = ps.length;
    let type = 'ffa';
    this.pickTeams = null;
    this.pickNote = 'Teams come from the colour of the space each player stopped on';
    if (n === 4) {
      const blues = ps.filter((p) => p.tint === 'blue').length;
      if (blues === 2) {
        type = '2v2';
        this.pickTeams = ps.map((p) => (p.tint === 'blue' ? 0 : 1));
      } else if ((blues === 1 || blues === 3) && Math.random() >= ODD_ONE_OUT_TO_FFA) {
        type = '1v3';
        const solo = blues === 1 ? 'blue' : 'red';
        this.pickTeams = ps.map((p) => (p.tint === solo ? 0 : 1));
      }
    }
    const ofKind = (kind) => MINIGAMES.filter((m) => m.type === kind && playable(m, n));
    // If every game of that kind was played in the last five rounds, play another kind rather
    // than repeat one. Teams the colours did not provide are set by the standings.
    if (!this.freshGames(ofKind(type)).length) {
      const other = ['ffa', '2v2', '1v3'].find((kind) => this.freshGames(ofKind(kind)).length);
      if (other) {
        type = other;
        this.pickTeams = type === 'ffa' ? null : this.standingTeams(type);
        this.pickNote = 'Every other kind of game was played too recently, so the standings set the sides';
      }
    }
    const ofType = ofKind(type);
    this.picked = this.chooseGame(ofType);
    this.spinPool = ofType;
    this.spin = 0;
    this.spinT = 0;
    this.landedGame = false;
    this.say('minigame');
    this.set('pickGame');
  }

  // The games in a list that have not been played in the last five rounds.
  freshGames(pool) {
    return pool.filter((m) => this.G.round - (this.G.played[m.name] ?? -99) > REPEAT_GAP);
  }

  // Picks a game that has not been played in the last five rounds and records it. If every
  // game in the list is that recent (a long run of duels can do it), takes the one played
  // longest ago.
  chooseGame(pool) {
    const last = (m) => this.G.played[m.name] ?? -99;
    let from = this.freshGames(pool);
    if (!from.length) {
      const oldest = Math.min(...pool.map(last));
      from = pool.filter((m) => last(m) === oldest);
    }
    const def = from[Math.floor(Math.random() * from.length)];
    this.G.played[def.name] = this.G.round;
    return def;
  }

  // Sides for a team game when the colours did not make any: the leader against the rest, or
  // first and last against the middle two.
  standingTeams(type) {
    const order = standings().map((p) => p.index);
    const side = type === '1v3' ? [order[0]] : [order[0], order[3]];
    return state.players.map((p) => (side.includes(p.index) ? 0 : 1));
  }

  do_pickGame(dt) {
    const spinFor = state.autoplay ? 0.1 : 2;
    if (this.pt < spinFor) {
      this.spinT -= dt;
      if (this.spinT <= 0) { this.spin++; this.spinT = 0.08; sfx('dice'); }
    } else if (!this.landedGame) {
      this.landedGame = true;
      sfx('select');
    }
    if (this.pt > spinFor + (state.autoplay ? 0.1 : 1.8)) {
      const game = this.game;
      game.go(new MinigameScene(this.picked, () => game.go(new BoardScene('round')), { teams: this.pickTeams }));
    }
  }

  // ---- drawing ----

  draw(g) {
    if (stage.on) {
      drawBoard3D(stage, this, g);
    } else {
      // The original flat view (no WebGL, or switched off with V).
      const c = this.cam;
      g.save();
      g.translate(VIEW_X, H / 2);
      g.scale(c.s, c.s);
      g.translate(-c.x, -c.y);
      drawWorld(g, this.t, state.settings.rating);
      this.drawPath(g);
      this.drawTokens(g);
      for (const q of this.pops) {
        g.globalAlpha = Math.max(0, 1 - q.t / 1.8);
        text(g, q.s, q.x, q.y - q.t * 30, { size: 26, weight: 900, color: q.color, stroke: '#140f1f', strokeW: 6 });
        g.globalAlpha = 1;
      }
      g.restore();
    }
    this.drawHud(g);
    const draw = this['draw_' + this.phase];
    if (draw) draw.call(this, g);
    if (this.quit > 0) {
      panel(g, W / 2 - 280, H / 2 - 60, 560, 120, { line: COLORS.bad });
      text(g, 'Quit the crawl?', W / 2, H / 2 - 20, { size: 30 });
      text(g, 'A: quit to title     B / Esc: keep playing', W / 2, H / 2 + 24, { size: 18, weight: 700, color: COLORS.dim });
    }
  }

  drawPath(g) {
    // A cream road with a dark kerb, so the route reads on every floor.
    g.lineCap = 'round';
    for (const [color, width] of [['#140f1f', 46], ['#f6e7b8', 34]]) {
      g.strokeStyle = color;
      g.lineWidth = width;
      for (const n of MAP.nodes) {
        for (const id of n.next) {
          const m = MAP.nodes[id];
          g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(m.x, m.y); g.stroke();
        }
      }
    }
    for (const n of MAP.nodes) {
      const tile = TILE[n.type];
      const r = tile.pass ? 32 : 28;
      // Pass-by services are square so they read differently from spaces you must stop on.
      const shape = (dy) => {
        g.beginPath();
        if (tile.pass) g.roundRect(n.x - r, n.y - r + dy, r * 2, r * 2, 12); else g.arc(n.x, n.y + dy, r, 0, Math.PI * 2);
      };
      shape(4);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fill();
      shape(0);
      g.fillStyle = tile.color;
      g.fill();
      g.lineWidth = 5;
      // Dark spaces get a gold rim so they stand out from the floor.
      g.strokeStyle = tile.ink ? '#ffd23d' : '#140f1f';
      g.stroke();
      let label = tile.label;
      if (this.lastCall && n.type === 'coin') label = '+6';
      if (this.lastCall && n.type === 'bad') label = '-6';
      text(g, label, n.x, n.y + 1, { size: label.length > 4 ? 13 : label.length > 2 ? 15 : 22, weight: 900, color: tile.ink || '#140f1f' });
      if (n.type === 'bank') {
        text(g, `${this.G.pot} in the jar`, n.x, n.y + 52, { size: 16, color: COLORS.gold, stroke: '#140f1f', strokeW: 5 });
      }
    }
    // The bottle cap hovers over its space. When it has just moved, it drops in from above.
    const cap = MAP.nodes[this.G.capNode];
    const drop = (1 - this.capDrop) * (1 - this.capDrop) * -420;
    const bob = Math.sin(this.t * 4) * 6 + drop;
    g.beginPath();
    g.arc(cap.x, cap.y, 40, 0, Math.PI * 2);
    g.strokeStyle = COLORS.gold;
    g.lineWidth = 5;
    g.setLineDash([10, 8]);
    g.stroke();
    g.setLineDash([]);
    bottleCap(g, cap.x, cap.y - 62 + bob, 26);
    text(g, `${this.capCost()} coins`, cap.x, cap.y - 102 + bob, { size: 18, color: COLORS.gold, stroke: '#140f1f', strokeW: 5 });
  }

  drawTokens(g) {
    const ps = state.players;
    const order = ps.map((p, i) => i).sort((a, b) => this.vis[a].y - this.vis[b].y || a - b);
    for (const i of order) {
      const p = ps[i];
      const v = this.vis[i];
      // Fan out players who share a space.
      const mates = ps.filter((q) => q.node === p.node);
      let ox = 0;
      if (mates.length > 1 && !v.moving) ox = (mates.indexOf(p) - (mates.length - 1) / 2) * 34;
      const active = i === this.turn;
      drawCharacter(g, p.char, v.x + ox, v.y - 34, active ? 32 : 26, {
        t: this.t, drunk: drunkLevel(p.sips), phase: i, moving: v.moving, walk: v.walk,
      });
      if (active) text(g, '▼', v.x + ox, v.y - 92 + Math.sin(this.t * 6) * 4, { size: 22, color: p.color, stroke: '#140f1f', strokeW: 5 });
    }
  }

  // One player's panel: who they are (portrait, colour, label), where they stand in the race,
  // and what they hold. The same colour and portrait follow the player onto the board.
  drawPanel(g, p, i, rank, leading) {
    const [x, y] = PANEL_AT[i];
    const active = i === this.turn;
    const picked = ['give', 'pick'].includes(this.phase) && this.sel === i;
    panel(g, x, y, PANEL_W, PANEL_H, {
      fill: 'rgba(20,15,31,.92)', line: picked ? COLORS.bad : active ? COLORS.gold : p.color, lineW: picked || active ? 5 : 3,
    });
    g.beginPath();
    g.arc(x + 40, y + 44, 28, 0, Math.PI * 2);
    g.fillStyle = '#120d1c';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = p.color;
    g.stroke();
    drawCharacter(g, p.char, x + 40, y + 43, 19, { t: this.t, drunk: drunkLevel(p.sips), phase: i, shadow: false });
    // Rank badge. Only the leader's is gold, so the eye finds them without the screen shouting.
    g.beginPath();
    g.roundRect(x + 4, y + 4, 38, 18, 6);
    g.fillStyle = leading ? COLORS.gold : '#3b2d5c';
    g.fill();
    text(g, RANKS[rank], x + 23, y + 14, { size: 12, weight: 900, color: leading ? '#140f1f' : COLORS.ink });

    text(g, `${p.label} ${p.name}`, x + 78, y + 17, { size: 15, align: 'left', color: p.color });
    if (p.cursed) text(g, 'rolls 1-3', x + 160, y + 17, { size: 11, weight: 800, align: 'left', color: COLORS.bad });
    // This round's minigame colour.
    if (p.tint) {
      g.beginPath();
      g.roundRect(x + PANEL_W - 24, y + 9, 15, 15, 4);
      g.fillStyle = p.tint === 'blue' ? '#4fa8ff' : '#ff5d52';
      g.fill();
    }
    bottleCap(g, x + 88, y + 42, 10);
    text(g, String(p.caps), x + 103, y + 43, { size: 20, align: 'left' });
    coin(g, x + 138, y + 42, 9);
    text(g, String(p.coins), x + 152, y + 43, { size: 20, align: 'left' });
    for (let k = 0; k < MAX_ITEMS; k++) {
      const ix = x + 196 + k * 20;
      if (p.items[k]) drawItemIcon(g, p.items[k], ix, y + 42, 8.5);
      else {
        g.beginPath();
        g.arc(ix, y + 42, 7.5, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,255,255,.14)';
        g.lineWidth = 2;
        g.stroke();
      }
    }
    drunkMeter(g, x + 78, y + 62, PANEL_W - 92, p, { h: 8, label: false });
  }

  // A small map of the whole crawl, shown while the camera is close on one player: the big view
  // answers "what now?", this answers "where is everyone, and where is the cap?".
  drawMinimap(g) {
    const w = 210;
    const k = w / WORLD.w;
    const h = WORLD.h * k;
    const x = W - w - 12;
    const y = 108;
    panel(g, x - 4, y - 4, w + 8, h + 8, { r: 10, fill: 'rgba(20,15,31,.9)' });
    for (const z of [...ZONES, ALLEY]) {
      g.fillStyle = ZONE_COLORS[z.id];
      g.globalAlpha = 0.28;
      g.fillRect(x + z.x * k, y + z.y * k, z.w * k, z.h * k);
      g.globalAlpha = 1;
    }
    g.strokeStyle = '#f6e7b8';
    g.lineWidth = 2;
    g.beginPath();
    for (const n of MAP.nodes) {
      for (const id of n.next) {
        const m = MAP.nodes[id];
        g.moveTo(x + n.x * k, y + n.y * k);
        g.lineTo(x + m.x * k, y + m.y * k);
      }
    }
    g.stroke();
    // Every place the cap can appear, and where it is now.
    for (const id of MAP.capSpots) {
      const n = MAP.nodes[id];
      g.beginPath();
      g.arc(x + n.x * k, y + n.y * k, 3.5, 0, Math.PI * 2);
      g.strokeStyle = COLORS.gold;
      g.lineWidth = 1.5;
      g.stroke();
    }
    const cap = MAP.nodes[this.G.capNode];
    bottleCap(g, x + cap.x * k, y + cap.y * k, 6 + Math.sin(this.t * 5) * 1.2);
    state.players.forEach((p, i) => {
      const v = this.vis[i];
      g.beginPath();
      g.arc(x + v.x * k, y + v.y * k, i === this.turn ? 5.5 : 4, 0, Math.PI * 2);
      g.fillStyle = p.color;
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = i === this.turn ? '#ffffff' : '#140f1f';
      g.stroke();
    });
  }

  drawHud(g) {
    const ps = state.players;
    const order = standings();
    const level = order.every((q) => q.caps === order[0].caps && q.coins === order[0].coins);
    ps.forEach((p, i) => {
      // Players level on caps and coins share a rank.
      const rank = order.findIndex((q) => q.caps === p.caps && q.coins === p.coins);
      this.drawPanel(g, p, i, rank, rank === 0 && !level);
    });

    const every = this.happyEvery();
    const toHappy = (every - (this.G.round % every)) % every;
    const toLastCall = state.settings.turns - this.G.round - LAST_CALL_TURNS + 1;
    panel(g, W / 2 - 140, 10, 280, 70, { fill: 'rgba(20,15,31,.92)', line: this.lastCall ? COLORS.bad : this.happyHour ? COLORS.gold : COLORS.panelLine });
    text(g, `Turn ${this.G.round} of ${state.settings.turns}`, W / 2, 29, { size: 20 });
    text(g, this.happyHour ? 'HAPPY HOUR: caps and items half price' : `Happy Hour in ${toHappy} turn${toHappy === 1 ? '' : 's'}`, W / 2, 49, {
      size: 12, weight: 800, color: this.happyHour ? COLORS.gold : COLORS.dim,
    });
    // The switch to Last Call is announced a turn early, so nobody is caught out by it.
    let third = `${RULES[state.settings.rules]} rules · ${RATINGS[state.settings.rating]}`;
    if (this.lastCall) third = 'LAST CALL: coins doubled, duels on';
    else if (toLastCall === 1) third = 'Last Call starts next turn';
    text(g, third, W / 2, 66, { size: 12, weight: 800, color: this.lastCall || toLastCall === 1 ? COLORS.bad : COLORS.dim });

    if (this.G.rule) {
      panel(g, 12, 108, PANEL_W, 86, { fill: 'rgba(20,15,31,.9)', line: COLORS.pink });
      text(g, `House rule: ${this.G.rule.title}`, 12 + PANEL_W / 2, 124, { size: 13, color: COLORS.pink });
      wrap(g, this.G.rule.text, 12 + PANEL_W / 2, 158, PANEL_W - 20, 14, { size: 11, weight: 600, color: COLORS.ink }, 3);
    }

    const wide = WIDE.has(this.phase);
    if (!wide) this.drawMinimap(g);
    if (this.zoneBanner && ['moving', 'wait', 'rolled'].includes(this.phase)) {
      const z = zoneInfo(this.zoneBanner.zone);
      g.globalAlpha = Math.min(1, this.zoneBanner.t * 3);
      panel(g, W / 2 - 190, 268, 380, 46, { r: 23, fill: 'rgba(20,15,31,.9)', line: ZONE_COLORS[z.id] });
      text(g, `Entering ${z.name}`, W / 2, 292, { size: 20, color: '#fff' });
      g.globalAlpha = 1;
    }
    const p = this.player;
    if (!wide && p && p.cpu && !state.autoplay) {
      text(g, this.skipping ? '▶▶ fast-forward' : 'Hold A to fast-forward', W / 2, H - 100, {
        size: 13, weight: 700, color: this.skipping ? COLORS.gold : COLORS.dim, stroke: '#140f1f', strokeW: 4,
      });
    }

    if (this.host.t > 0 && !this.card && !this.chance && this.phase !== 'mapView') {
      g.globalAlpha = Math.min(1, this.host.t * 2);
      panel(g, PROMPT_X - 350, H - 88, 700, 72, { fill: 'rgba(20,15,31,.92)', line: COLORS.gold });
      drawSal(g, PROMPT_X - 310, H - 52, 24);
      wrap(g, this.host.text, PROMPT_X - 270, H - 52, 600, 24, { size: 19, weight: 700, align: 'left' }, 2);
      g.globalAlpha = 1;
    }
  }

  draw_roundIntro(g) {
    text(g, `TURN ${this.G.round}`, PROMPT_X, H / 2 - 30, { size: 120, weight: 900, glow: COLORS.pink, blur: 40, stroke: '#140f1f', strokeW: 14 });
    const tag = this.happyHour ? 'HAPPY HOUR' : this.lastCall ? 'LAST CALL' : '';
    if (tag) text(g, tag, PROMPT_X, H / 2 + 70, { size: 54, weight: 900, color: this.happyHour ? COLORS.gold : COLORS.bad, stroke: '#140f1f', strokeW: 10 });
  }

  drawDice(g, values, settled) {
    const n = values.length;
    values.forEach((v, i) => {
      const x = PROMPT_X + (i - (n - 1) / 2) * 104;
      g.save();
      g.translate(x, 190);
      if (!settled) g.rotate(Math.sin(this.t * 30 + i * 2) * 0.2);
      g.beginPath();
      g.roundRect(-42, -42, 84, 84, 16);
      g.fillStyle = '#fff7e6';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = '#140f1f';
      g.stroke();
      text(g, String(v), 0, 4, { size: 56, weight: 900, color: '#140f1f' });
      g.restore();
    });
  }

  draw_rolling(g) {
    this.drawDice(g, this.forced ? [this.forced] : this.dice, false);
    if (!this.player.cpu) subPrompt(g, 'Press A to stop the dice', 262);
  }

  draw_rolled(g) {
    this.drawDice(g, this.dice, true);
    if (this.dice.length > 1) prompt(g, `${this.steps} spaces`, 268, COLORS.gold);
  }

  draw_moving(g) { if (this.steps > 0) this.drawDice(g, [this.steps], true); }

  // A fork shows what each way is worth before the player commits: how far it is to the cap.
  draw_branch(g) {
    const node = MAP.nodes[this.player.node];
    const ways = MAP.forks[node.id].map((name, n) => `${name} · cap in ${stepsBetween(node.next[n], this.G.capNode) + 1}`);
    choiceBox(g, `${this.player.name}: which way?`, ways, this.player.cpu ? -1 : this.sel,
      'Back ways are shorter, but they cost more sips and coins. Left / Right, then A', 360);
  }

  draw_wait(g) {
    if (this.landNote) { bigNote(g, this.landNote, 120, this.landNote.startsWith('HIDDEN') ? COLORS.gold : COLORS.ink); return; }
    const tile = TILE[this.landed];
    if (!tile || this.landed === 'start' || tile.pass) return;
    let line = tile.text;
    if (this.lastCall && this.landed === 'coin') line = 'Gain 6 coins';
    if (this.lastCall && this.landed === 'bad') line = 'Lose 6 coins';
    prompt(g, line);
  }

  draw_give(g) {
    const p = this.player;
    prompt(g, `${p.name}: hand out ${this.give.left} sip${this.give.left === 1 ? '' : 's'}`);
    subPrompt(g, p.cpu ? 'Choosing…' : 'Stick picks a player (their panel lights up), A gives');
  }

  draw_pickGame(g) {
    const spinning = !this.landedGame;
    const m = spinning ? this.spinPool[this.spin % this.spinPool.length] : this.picked;
    panel(g, W / 2 - 360, H / 2 - 130, 720, 270, { fill: 'rgba(20,15,31,.94)', line: spinning ? COLORS.panelLine : COLORS.gold, lineW: 6 });
    text(g, 'MINIGAME', W / 2, H / 2 - 92, { size: 24, color: COLORS.pink });
    text(g, m.name, W / 2, H / 2 - 28, { size: 58, weight: 900, color: spinning ? COLORS.dim : COLORS.ink, glow: spinning ? null : COLORS.gold });
    text(g, TYPE_LABELS[m.type], W / 2, H / 2 + 34, { size: 24, color: COLORS.blue });
    // Show how the colours split everyone up. (A 3-and-1 split is sometimes a free-for-all.)
    const ps = state.players;
    const names = (team) => ps.filter((p, i) => this.pickTeams[i] === team).map((p) => p.name).join(' & ');
    const line = this.pickTeams ? `${names(0)}  vs  ${names(1)}` : 'Everyone for themselves';
    text(g, line, W / 2, H / 2 + 78, { size: 20, color: COLORS.ink });
    text(g, this.pickNote, W / 2, H / 2 + 110, { size: 13, weight: 700, color: COLORS.dim });
  }
}

Object.assign(BoardScene.prototype, orderPhases, menuPhases, servicePhases, eventPhases, cardPhases);
