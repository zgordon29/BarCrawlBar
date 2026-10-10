// The bar crawl: one clockwise loop of spaces through five Bloomington bars, with back alleys
// and Kirkwood Ave cutting across the middle so there is more than one way between them.

export const WORLD = { w: 2600, h: 1500 };

export const ZONES = [
  { id: 'sports', name: 'THE UPSTAIRS PUB', sub: 'Sports Bar', x: 60, y: 50, w: 840, h: 480 },
  { id: 'pub', name: 'NICK\'S ENGLISH HUT', sub: 'Pub & Tavern', x: 940, y: 50, w: 800, h: 480 },
  { id: 'dive', name: 'ROOT CELLAR', sub: 'Dive Bar', x: 1780, y: 50, w: 760, h: 900 },
  { id: 'speak', name: 'VIDEO SALOON', sub: 'Pool, Darts & Arcade', x: 1000, y: 990, w: 1540, h: 460 },
  { id: 'club', name: 'NIGHT MOVES', sub: 'Club', x: 60, y: 570, w: 900, h: 880 },
];
export const ALLEY = { id: 'alley', name: 'KIRKWOOD AVE', sub: 'Back Alleys', x: 1000, y: 570, w: 740, h: 380 };

// Every kind of space. `pass` spaces are services that trigger when you walk past them, not
// only when you stop on them. `tint` is the colour the space gives you for picking the
// round's minigame teams: blue, red, or (null) a coin flip.
export const TILE = {
  start: { label: 'GO', color: '#fff7e6', name: 'Start', text: 'Nothing happens', tint: 'blue' },
  coin: { label: '+3', color: '#4fa8ff', name: 'Tip', text: 'Gain 3 coins', tint: 'blue' },
  bad: { label: '-3', color: '#ff5d52', name: 'Spill', text: 'Lose 3 coins', tint: 'red' },
  drink: { label: 'SIP', color: '#f2a51d', name: 'Sip', text: 'You drink', tint: 'blue' },
  give: { label: 'GIVE', color: '#5fd66b', name: 'Cheers', text: 'Hand out a sip', tint: 'blue' },
  round: { label: 'ALL', color: '#ff4fa3', name: 'Round', text: 'Everyone drinks', tint: 'blue' },
  card: { label: '?', color: '#a66bff', name: 'Card', text: 'Draw an event card', tint: null },
  item: { label: 'ITEM', color: '#2fd3c0', name: 'Freebie', text: 'Get a free item', tint: 'blue' },
  chance: { label: 'SPIN', color: '#151019', ink: '#ffd23d', name: 'Spin the Bottle', text: 'Something big moves between two players', tint: null },
  tab: { label: 'TAB', color: '#8a1c1c', ink: '#fff7e6', name: 'The Tab', text: 'The bill arrives. It is never good.', tint: 'red' },
  battle: { label: 'FIGHT', color: '#ff8a2a', name: 'Bar Fight', text: 'Everyone antes up and plays for the pot', tint: null },
  shop: { label: 'SHOP', color: '#ffe08a', name: 'Shop', text: 'Buy an item as you pass', pass: true, tint: 'blue' },
  hustler: { label: 'STEAL', color: '#2b2140', ink: '#fff7e6', name: 'The Hustler', text: 'Pay to steal coins or a cap as you pass', pass: true, tint: 'blue' },
  bank: { label: 'TIPS', color: '#c9d2e0', name: 'Tip Jar', text: 'Pass: tip 5 coins. Land: take the jar', pass: true, tint: 'blue' },
};

const LEFT = 220, RIGHT = 2380, TOP = 300, BOTTOM = 1230;
const LOOP_COUNT = 44;

// The loop, space by space, starting at GO in the Upstairs Pub and running clockwise.
// Landmarks: shops in Nick's and Night Moves, the tip jar on the Video Saloon corner, a bar
// fight in Root Cellar and Night Moves, and the bill waiting near the end of both of those.
const LOOP_TILES = [
  'start', 'coin', 'drink', 'card', 'coin',                                          // The Upstairs Pub
  'give', 'shop', 'coin', 'coin', 'card', 'bad',                                     // Nick's English Hut
  'coin', 'drink', 'item', 'coin', 'battle', 'coin', 'card', 'coin', 'tab', 'drink', // Root Cellar
  'coin', 'bank', 'give', 'card', 'coin', 'chance', 'bad', 'item', 'coin', 'round', 'card', // Video Saloon
  'coin', 'shop', 'drink', 'card', 'coin', 'give', 'battle', 'bad', 'item', 'tab', 'drink', // Night Moves
  'round',                                                                           // back to the Upstairs Pub
];

// Back ways between bars. Each one leaves the loop (or another back way) at `from`, runs in a
// straight line through its own spaces, and rejoins at `to`. Travel is one way, like the loop.
//   alley:     Nick's south to the crossroads on Kirkwood Ave (the Hustler's corner), then on
//              south into Video Saloon
//   east:      Root Cellar west along Kirkwood to the crossroads
//   west:      the crossroads west along Kirkwood, through a second corner, into Night Moves
//   stairs:    The Upstairs Pub down to Kirkwood, joining the way into Night Moves
//   back door: Video Saloon back up into Root Cellar
//   escape:    Night Moves north up the side street to the second corner
//   north:     the second corner north to Nick's
// Four of them cut ahead across the board, top to bottom and side to side. The stairs and the
// back door lead back the way you came, for a second go at a bar you have just left. Wherever
// the bottle cap is, there is a choice to make about how to reach it.
const SPURS = [
  { key: 'alley', from: 8, to: 29, tiles: ['drink', 'bad', 'hustler', 'card', 'drink'] },
  { key: 'east', from: 18, to: ['alley', 2], tiles: ['coin', 'drink', 'card', 'bad', 'coin', 'item'] },
  { key: 'west', from: ['alley', 2], to: 41, tiles: ['drink', 'coin', 'coin', 'bad', 'card', 'drink', 'coin'] },
  { key: 'stairs', from: 4, to: ['west', 3], tiles: ['coin', 'give', 'drink'] },
  { key: 'backdoor', from: 25, to: 19, tiles: ['drink', 'coin', 'card'] },
  { key: 'escape', from: 32, to: ['west', 2], tiles: ['coin', 'drink', 'bad'] },
  { key: 'north', from: ['west', 2], to: 5, tiles: ['card', 'drink', 'coin'] },
];

// What each way at a fork is called, in the order the routes leave it (the first is the one
// that was there first: the crawl itself, or the back way you are already on). Forks on the
// loop are named by their space number, forks on a back way by its key and space.
const FORK_LABELS = {
  4: ['On to Nick\'s', 'Stairs down to Night Moves'],
  8: ['Stay on the crawl', 'Back alley to Kirkwood'],
  18: ['Stay on the crawl', 'West along Kirkwood'],
  25: ['Stay on the crawl', 'Back door to Root Cellar'],
  32: ['Stay on the crawl', 'Side street north'],
  'alley:2': ['South to Video Saloon', 'West along Kirkwood'],
  'west:2': ['West to Night Moves', 'North to Nick\'s'],
};

// Loop spaces where the bottle cap can appear, one per bar. None of them is a fork, and each
// back way reaches some of them sooner and skips others, so the best route changes as it moves.
const CAP_SPOTS = [3, 9, 20, 31, 42];

function inRect(z, x, y) {
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

function zoneAt(x, y) {
  if (inRect(ALLEY, x, y)) return 'alley';
  let best = ZONES[0];
  let bd = Infinity;
  for (const z of ZONES) {
    const dx = Math.max(z.x - x, 0, x - (z.x + z.w));
    const dy = Math.max(z.y - y, 0, y - (z.y + z.h));
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = z; }
  }
  return best.id;
}

function build() {
  const nodes = [];
  const w = RIGHT - LEFT;
  const h = BOTTOM - TOP;
  const perimeter = 2 * (w + h);
  for (let i = 0; i < LOOP_COUNT; i++) {
    let s = (i / LOOP_COUNT) * perimeter;
    let x, y;
    if (s < w) { x = LEFT + s; y = TOP; }
    else if ((s -= w) < h) { x = RIGHT; y = TOP + s; }
    else if ((s -= h) < w) { x = RIGHT - s; y = BOTTOM; }
    else { s -= w; x = LEFT; y = BOTTOM - s; }
    nodes.push({
      id: i, x, y, type: LOOP_TILES[i],
      next: [(i + 1) % LOOP_COUNT], prev: (i + LOOP_COUNT - 1) % LOOP_COUNT, zone: zoneAt(x, y),
    });
  }

  const spurs = {};
  const resolve = (ref) => (Array.isArray(ref) ? spurs[ref[0]][ref[1]] : ref);
  for (const spur of SPURS) {
    const from = nodes[resolve(spur.from)];
    const to = nodes[resolve(spur.to)];
    const ids = [];
    let prev = from.id;
    spur.tiles.forEach((type, k) => {
      const id = nodes.length;
      const t = (k + 1) / (spur.tiles.length + 1);
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      nodes.push({ id, x, y, type, next: [], prev, zone: zoneAt(x, y), spur: spur.key, at: k });
      nodes[prev].next.push(id);
      ids.push(id);
      prev = id;
    });
    nodes[prev].next.push(to.id);
    spurs[spur.key] = ids;
  }

  // forks: space id -> the names of the ways on from it, in the order of its `next` list.
  const forks = {};
  for (const n of nodes) {
    if (n.next.length > 1) forks[n.id] = FORK_LABELS[n.spur ? `${n.spur}:${n.at}` : n.id];
  }
  return { nodes, capSpots: CAP_SPOTS, forks };
}

export const MAP = build();

// Fewest steps from one space to another, following the direction of travel.
export function stepsBetween(from, to) {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) return seen.get(id);
    for (const n of MAP.nodes[id].next) {
      if (!seen.has(n)) { seen.set(n, seen.get(id) + 1); queue.push(n); }
    }
  }
  return Infinity;
}

// Where the bottle cap goes next: never where it is now, and not straight back to where it
// was before that, so it does not bounce between the same two bars.
export function otherCapSpot(current, previous = -1) {
  let options = MAP.capSpots.filter((id) => id !== current && id !== previous);
  if (!options.length) options = MAP.capSpots.filter((id) => id !== current);
  return options[Math.floor(Math.random() * options.length)];
}

export function zoneInfo(id) {
  return id === 'alley' ? ALLEY : ZONES.find((z) => z.id === id);
}
