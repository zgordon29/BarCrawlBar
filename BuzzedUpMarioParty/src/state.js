import { DrunkFilter } from './drunk.js';
import { characterById } from './characters.js';

// A beer is about this many sips.
export const SIPS_PER_BEER = 12;

// mult scales every sip amount; cap is the most sips one player can take per round; pace is
// how many sips a round a player ends up taking on average, measured over simulated crawls
// (src/dev/sim.js). Rowdy is tuned to a beer about every two rounds: measure again after
// changing mult or cap, or anything else that hands out sips.
export const INTENSITY = {
  chill: { label: 'Chill', mult: 0.5, cap: 2, pace: 1.2 },
  normal: { label: 'Normal', mult: 1, cap: 4, pace: 2 },
  rowdy: { label: 'Rowdy', mult: 3, cap: 10, pace: 5.7 },
};
export const INTENSITY_ORDER = ['chill', 'normal', 'rowdy'];
export const TURN_OPTIONS = [5, 10, 15, 20, 25, 30];
export const RATINGS = { pg13: 'PG-13', r: 'R-rated' };
// Party: the full chaos. Pro: less luck (no hidden stashes, no Spin the Bottle, a gentler Tab,
// and a single bonus cap that everyone knows about from the start).
export const RULES = { party: 'Party', pro: 'Pro' };
// How well computer players handle the stick in minigames.
export const CPU_SKILL = {
  easy: { label: 'Easy', stick: 0.75 },
  normal: { label: 'Normal', stick: 0.9 },
  hard: { label: 'Hard', stick: 1 },
};
export const NON_DRINKER_COINS_PER_SIP = 3;

export const state = {
  players: [],
  mode: 'crawl',     // 'crawl' = the full board game, 'free' = pick minigames from a menu
  autoplay: false,   // testing: computer players only, prompts confirm themselves
  settings: { turns: 15, intensity: 'normal', rating: 'pg13', cpuFill: true, rules: 'party', cpuSkill: 'normal' },
  game: null,        // the crawl in progress (see BoardScene)
};

export function makePlayer(index, device, charId, nonDrinker = false) {
  const c = characterById(charId);
  return {
    index,
    device,
    cpu: device === 'cpu',
    char: charId,
    name: c.name,
    color: c.color,
    label: '',
    coins: 10,
    caps: 0,
    sips: 0,
    roundSips: 0,
    wins: 0,
    node: 0,
    items: [],
    tint: null,       // 'blue' or 'red': decides this round's minigame teams
    cursed: false,    // next roll is 1-3 (Heavy Pour)
    stats: { mgCoins: 0, peak: 10, cards: 0 },
    nonDrinker,
    filter: new DrunkFilter(index + 1),
  };
}

export function isPro() { return state.settings.rules === 'pro'; }

// Sips as beers, to the nearest half: "about 3½ beers".
export function beersText(sips) {
  const halves = Math.round((sips / SIPS_PER_BEER) * 2);
  if (halves < 1) return 'under half a beer';
  const whole = Math.floor(halves / 2);
  const amount = `${whole || ''}${halves % 2 ? '½' : ''}`;
  return `about ${amount} beer${halves > 2 ? 's' : ''}`;
}

export function scaledSips(n) {
  return Math.max(1, Math.round(n * INTENSITY[state.settings.intensity].mult));
}

export function sipRoom(p) {
  return Math.max(0, INTENSITY[state.settings.intensity].cap - p.roundSips);
}

// Gives a player sips, limited by the per-round cap. Returns how many were actually taken.
export function addSips(p, n) {
  const got = Math.min(n, sipRoom(p));
  p.sips += got;
  p.roundSips += got;
  return got;
}

export function newRound() {
  for (const p of state.players) p.roundSips = 0;
}

export function humanDevices() {
  return state.players.filter((p) => !p.cpu).map((p) => p.device);
}

// Standing order: caps first, coins break ties.
export function standings() {
  return [...state.players].sort((a, b) => b.caps - a.caps || b.coins - a.coins);
}

export function trackPeaks() {
  for (const p of state.players) if (p.coins > p.stats.peak) p.stats.peak = p.coins;
}
