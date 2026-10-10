// Balance testing: plays whole crawls with computer players, as fast as the machine allows,
// and reports what happened. Not loaded by the game. From the browser console:
//
//   const { many } = await import('/src/dev/sim.js');
//   many(10, { settings: { intensity: 'rowdy', turns: 15 } });
import { state, makePlayer } from '../state.js';
import { CHARACTERS } from '../characters.js';
import { BoardScene } from '../scenes/board.js';

// Plays one crawl. o.settings overrides the game settings, o.players is how many play (2-4).
export function sim(o = {}) {
  const game = window.__game;
  game.paused = true;
  state.autoplay = true;
  state.mode = 'crawl';
  Object.assign(state.settings, { turns: 15, intensity: 'normal', rating: 'pg13', rules: 'party', cpuSkill: 'normal' }, o.settings || {});
  const n = o.players || 4;
  state.players = Array.from({ length: n }, (_, i) => makePlayer(i, 'cpu', CHARACTERS[i].id, false));
  state.players.forEach((p, i) => { p.label = 'P' + (i + 1); });
  game.go(new BoardScene('new'));

  const games = [];     // [round, name, type, kind] for every minigame played
  const forks = {};     // fork space -> how often each way was taken
  const capAt = {};     // cap space -> caps bought there
  const roundSips = []; // sips taken by each player in each round
  let before = state.players.map(() => 0);
  let lastScene = null;
  let lastRound = 1;
  let frames = 0;
  while (frames < 3e6) {
    const sc = game.scene;
    const kind = sc.constructor.name;
    if (sc !== lastScene) {
      lastScene = sc;
      if (kind === 'MinigameScene') games.push([state.game.round, sc.def.name, sc.def.type, sc.settle ? sc.settle.kind : 'round']);
    }
    if (state.game && state.game.round !== lastRound) {
      lastRound = state.game.round;
      state.players.forEach((p, i) => { roundSips.push(p.sips - before[i]); });
      before = state.players.map((p) => p.sips);
    }
    if (kind === 'FinalScene' && sc.finished) break;
    if (kind === 'BoardScene' && sc.pt === 0) {
      if (sc.phase === 'branch') {
        const id = sc.player.node;
        forks[id] = forks[id] || [0, 0];
        forks[id][sc.sel]++;
      }
      if (sc.phase === 'capGot') capAt[sc.player.node] = (capAt[sc.player.node] || 0) + 1;
    }
    try {
      sc.update(1 / 60);
    } catch (e) {
      return { error: String(e), stack: (e.stack || '').split('\n').slice(0, 5), scene: kind, phase: sc.phase, frames };
    }
    frames++;
  }
  state.players.forEach((p, i) => { roundSips.push(p.sips - before[i]); });

  // Any minigame played again within five rounds of its last outing.
  const lastSeen = {};
  const repeats = [];
  for (const [round, name] of games) {
    if (name in lastSeen && round - lastSeen[name] <= 5) repeats.push([name, lastSeen[name], round]);
    lastSeen[name] = round;
  }
  return {
    done: game.scene.constructor.name === 'FinalScene',
    sips: state.players.map((p) => p.sips),
    perRound: state.players.reduce((a, p) => a + p.sips, 0) / n / state.settings.turns,
    roundSips,
    caps: state.players.map((p) => p.caps),
    coins: state.players.map((p) => p.coins),
    games, repeats, forks, capAt,
  };
}

// Plays k crawls and adds the results up.
export function many(k, o) {
  const out = { runs: 0, perRound: 0, atCap: 0, least: Infinity, most: 0, caps: 0, repeats: 0, forks: {}, capAt: {}, kinds: {}, errors: [] };
  const all = [];
  for (let i = 0; i < k; i++) {
    const r = sim(o);
    if (r.error) { out.errors.push(r); continue; }
    out.runs++;
    out.perRound += r.perRound;
    out.least = Math.min(out.least, ...r.sips);
    out.most = Math.max(out.most, ...r.sips);
    out.caps += r.caps.reduce((a, b) => a + b, 0);
    out.repeats += r.repeats.length;
    all.push(...r.roundSips);
    for (const [id, v] of Object.entries(r.forks)) {
      out.forks[id] = out.forks[id] || [0, 0];
      out.forks[id][0] += v[0];
      out.forks[id][1] += v[1];
    }
    for (const [id, v] of Object.entries(r.capAt)) out.capAt[id] = (out.capAt[id] || 0) + v;
    for (const g of r.games) out.kinds[g[3] + ' ' + g[2]] = (out.kinds[g[3] + ' ' + g[2]] || 0) + 1;
  }
  out.perRound = +(out.perRound / out.runs).toFixed(2);
  out.capsPerGame = +(out.caps / out.runs).toFixed(1);
  // How often a player's round ended at the per-round limit, and the spread of a round's sips.
  const limit = Math.max(...all);
  out.atCap = +(all.filter((s) => s >= limit).length / all.length).toFixed(2);
  out.roundMax = limit;
  out.quiet = +(all.filter((s) => s === 0).length / all.length).toFixed(2);
  return out;
}
