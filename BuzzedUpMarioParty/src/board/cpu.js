// Decisions for computer players on the board: which item to use, what to buy, who to rob.
// They read only what a human could see on screen, and never peek at dice.
import { state } from '../state.js';
import { MAP, stepsBetween } from './map.js';
import { hasRoom } from './items.js';
import { STEAL_COINS_FEE, STEAL_CAP_FEE, DIE_MAX } from './consts.js';

const rivals = (p) => state.players.filter((q) => q !== p);

// The rival doing best: most caps, then most coins.
export function leaderOf(p) {
  return rivals(p).sort((a, b) => b.caps - a.caps || b.coins - a.coins || Math.random() - 0.5)[0];
}

// Chooses an item to use before rolling, or null. Returns { id, target?, value? }.
export function cpuPickItem(p, capCost, lastCall) {
  const G = state.game;
  const has = (id) => p.items.includes(id);
  const dist = stepsBetween(p.node, G.capNode);
  const canBuy = p.coins >= capCost;

  if (has('bus') && canBuy) return { id: 'bus' };
  if (canBuy) {
    // Close enough to walk there exactly: do it.
    if (has('loaded') && dist <= DIE_MAX) return { id: 'loaded', value: dist };
    if (has('espresso') && dist > DIE_MAX) return { id: 'espresso' };
    if (has('energy') && dist > 6) return { id: 'energy' };
    if (has('espresso') && dist > 7) return { id: 'espresso' };
  }
  if (has('heavy')) {
    // Slow down a rival who is about to reach the cap with the money to buy it.
    const threat = rivals(p).find((q) => q.coins >= capCost && stepsBetween(q.node, G.capNode) <= DIE_MAX && !q.cursed);
    if (threat) return { id: 'heavy', target: threat.index };
    if (Math.random() < 0.2) return { id: 'heavy', target: leaderOf(p).index };
  }
  if (has('fingers') && hasRoom(p)) {
    const marks = rivals(p).filter((q) => q.items.length).sort((a, b) => b.items.length - a.items.length || b.caps - a.caps);
    if (marks.length) return { id: 'fingers', target: marks[0].index };
  }
  if (has('bet') && p.coins >= 10 && Math.random() < 0.4) {
    const rich = rivals(p).filter((q) => q.coins >= 10).sort((a, b) => b.coins - a.coins);
    if (rich.length) return { id: 'bet', target: rich[0].index };
  }
  if (has('uber') && dist > 18 && Math.random() < 0.4) {
    if (rivals(p).some((q) => stepsBetween(q.node, G.capNode) < dist - 6)) return { id: 'uber' };
  }
  // Late in the game an unused movement item is worth nothing, so burn it.
  if (lastCall || Math.random() < 0.15) {
    if (has('energy')) return { id: 'energy' };
    if (has('espresso') && lastCall) return { id: 'espresso' };
  }
  return null;
}

// Chooses what to buy from a shop shelf, or null to walk on. `price(id)` gives today's price.
export function cpuShop(p, stock, price, capCost) {
  if (!hasRoom(p)) return null;
  const dist = stepsBetween(p.node, state.game.capNode);
  // Keep enough back to buy the cap if it is within a couple of turns.
  const reserve = dist <= 14 ? capCost : 5;
  const want = stock.filter((id) => price(id) <= p.coins - reserve && !(id === 'buddy' && p.items.includes('buddy')));
  if (!want.length || Math.random() < 0.25) return null;
  const order = ['bus', 'espresso', 'loaded', 'energy', 'heavy', 'fingers', 'bet', 'buddy', 'uber'];
  want.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // Usually the most useful thing on the shelf, sometimes whatever catches the eye.
  return Math.random() < 0.7 ? want[0] : want[Math.floor(Math.random() * want.length)];
}

// What to do at the Hustler: { what: 'cap' | 'coins', target } or null.
export function cpuHustle(p) {
  const capMarks = rivals(p).filter((q) => q.caps > 0).sort((a, b) => b.caps - a.caps || b.coins - a.coins);
  if (p.coins >= STEAL_CAP_FEE && capMarks.length) return { what: 'cap', target: capMarks[0].index };
  const coinMarks = rivals(p).filter((q) => q.coins >= 10).sort((a, b) => b.caps - a.caps || b.coins - a.coins);
  if (p.coins >= STEAL_COINS_FEE && coinMarks.length) return { what: 'coins', target: coinMarks[0].index };
  return null;
}

// Which way to go at a fork: an index into the space's ways on.
export function cpuBranch(node, p, capCost) {
  const onCrawl = !node.spur;
  // Too poor for the cap: keep to the crawl, where the coins are.
  if (onCrawl && p.coins < capCost - 6 && Math.random() < 0.6) return 0;
  // Rich enough to steal a cap: go and see the Hustler. Otherwise head for the cap.
  let goal = state.game.capNode;
  if (node.type !== 'hustler' && p.coins >= STEAL_CAP_FEE + capCost && rivals(p).some((q) => q.caps > 0)) {
    const hustler = MAP.nodes.find((n) => n.type === 'hustler').id;
    if (stepsBetween(node.id, hustler) <= 12) goal = hustler;
  }
  const far = node.next.map((id) => stepsBetween(id, goal));
  const best = far.indexOf(Math.min(...far));
  // A back way has to save a few steps to be worth what it costs in sips and coins.
  if (onCrawl && best !== 0 && far[0] - far[best] < 3) return 0;
  return best;
}
