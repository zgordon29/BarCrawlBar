// Items: each one adds a verb to a player's turn. They are bought at shops, found on Freebie
// spaces, and used before rolling (one per turn). The classic item each is modelled on is noted.
import { MAX_ITEMS } from './consts.js';

export const ITEMS = {
  energy: {
    name: 'Energy Drink', cost: 10, kind: 'move', color: '#6ee27a',
    text: 'Roll two dice this turn.',                              // Mushroom / Double Dice
  },
  espresso: {
    name: 'Espresso Martini', cost: 20, kind: 'move', color: '#b07a4a',
    text: 'Roll three dice this turn.',                            // Golden Mushroom / Triple Dice
  },
  loaded: {
    name: 'Loaded Die', cost: 15, kind: 'move', color: '#fff7e6',
    text: 'Choose your roll, from 1 to 10.',                       // Custom Dice Block
  },
  heavy: {
    name: 'Heavy Pour', cost: 10, kind: 'target', color: '#f2a51d',
    text: 'Pick a rival. Their next roll is only 1 to 3.',         // Cursed Dice Block
  },
  uber: {
    name: 'Wrong Uber', cost: 15, kind: 'instant', color: '#4fd8ff',
    text: 'Swap places with a random rival.',                      // Warp Block
  },
  bus: {
    name: 'Party Bus', cost: 30, kind: 'instant', color: '#ff4fa3',
    text: 'Ride straight to the bottle cap.',                      // Magic Lamp
  },
  fingers: {
    name: 'Sticky Fingers', cost: 15, kind: 'target', color: '#a66bff',
    text: 'Steal a random item from a rival.',                     // Plunder Chest
  },
  bet: {
    name: 'Bar Bet', cost: 15, kind: 'target', color: '#ff8a2a',
    text: 'Challenge a rival to a duel for coins.',                // Dueling Glove
  },
  buddy: {
    name: 'Bouncer Buddy', cost: 10, kind: 'passive', color: '#c9d2e0',
    text: 'Blocks the next thing stolen from you. Works by itself.', // Boo Repellent
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

export function hasRoom(p) { return p.items.length < MAX_ITEMS; }

export function addItem(p, id) {
  if (!hasRoom(p)) return false;
  p.items.push(id);
  return true;
}

export function takeItem(p, id) {
  const i = p.items.indexOf(id);
  if (i < 0) return false;
  p.items.splice(i, 1);
  return true;
}

// A random item, leaning towards the cheaper ones.
export function randomItem() {
  const pool = [];
  for (const id of ITEM_IDS) {
    const weight = ITEMS[id].cost <= 10 ? 3 : ITEMS[id].cost <= 15 ? 2 : 1;
    for (let k = 0; k < weight; k++) pool.push(id);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// What a shop puts on its shelf for one visit: four different items.
export function shopStock() {
  const ids = [...ITEM_IDS].sort(() => Math.random() - 0.5).slice(0, 4);
  return ids.sort((a, b) => ITEMS[a].cost - ITEMS[b].cost);
}

// If the player holds a Bouncer Buddy it is used up and the theft is stopped.
export function blocksTheft(p) {
  return takeItem(p, 'buddy');
}

// A small round badge for an item, used in the HUD and menus.
export function drawItemIcon(g, id, x, y, r) {
  const it = ITEMS[id];
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = it.color;
  g.fill();
  g.lineWidth = Math.max(1.5, r * 0.16);
  g.strokeStyle = '#140f1f';
  g.stroke();
  g.fillStyle = '#140f1f';
  g.strokeStyle = '#140f1f';
  g.lineWidth = Math.max(1.5, r * 0.18);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const s = r * 0.55;
  g.beginPath();
  switch (id) {
    case 'energy':     // lightning bolt
      g.moveTo(x + s * 0.3, y - s); g.lineTo(x - s * 0.5, y + s * 0.1); g.lineTo(x, y + s * 0.1);
      g.lineTo(x - s * 0.3, y + s); g.lineTo(x + s * 0.5, y - s * 0.1); g.lineTo(x, y - s * 0.1);
      g.closePath(); g.fill();
      break;
    case 'espresso':   // martini glass
      g.moveTo(x - s, y - s * 0.7); g.lineTo(x + s, y - s * 0.7); g.lineTo(x, y + s * 0.2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x, y + s * 0.2); g.lineTo(x, y + s); g.moveTo(x - s * 0.5, y + s); g.lineTo(x + s * 0.5, y + s); g.stroke();
      break;
    case 'loaded':     // die face
      g.roundRect(x - s, y - s, s * 2, s * 2, s * 0.3); g.stroke();
      for (const [dx, dy] of [[-0.45, -0.45], [0.45, 0.45], [0, 0]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, s * 0.2, 0, Math.PI * 2); g.fill(); }
      break;
    case 'heavy':      // down arrow
      g.moveTo(x, y - s); g.lineTo(x, y + s * 0.5); g.stroke();
      g.beginPath(); g.moveTo(x - s * 0.7, y + s * 0.1); g.lineTo(x, y + s); g.lineTo(x + s * 0.7, y + s * 0.1); g.closePath(); g.fill();
      break;
    case 'uber':       // swap arrows
      g.moveTo(x - s, y - s * 0.4); g.lineTo(x + s, y - s * 0.4); g.lineTo(x + s * 0.4, y - s);
      g.moveTo(x + s, y + s * 0.4); g.lineTo(x - s, y + s * 0.4); g.lineTo(x - s * 0.4, y + s);
      g.stroke();
      break;
    case 'bus':        // bus
      g.roundRect(x - s, y - s * 0.7, s * 2, s * 1.2, s * 0.25); g.fill();
      g.beginPath(); g.arc(x - s * 0.5, y + s * 0.7, s * 0.28, 0, Math.PI * 2); g.arc(x + s * 0.5, y + s * 0.7, s * 0.28, 0, Math.PI * 2); g.fill();
      break;
    case 'fingers':    // grabbing hand
      for (const dx of [-0.6, -0.2, 0.2, 0.6]) { g.moveTo(x + dx * s, y + s * 0.2); g.lineTo(x + dx * s, y - s * 0.8); }
      g.stroke();
      g.beginPath(); g.roundRect(x - s * 0.8, y + s * 0.1, s * 1.6, s * 0.8, s * 0.3); g.fill();
      break;
    case 'bet':        // crossed swords, drawn as an X
      g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke();
      break;
    default:           // shield
      g.moveTo(x - s, y - s * 0.8); g.lineTo(x + s, y - s * 0.8); g.lineTo(x + s, y); g.quadraticCurveTo(x + s, y + s, x, y + s * 1.1);
      g.quadraticCurveTo(x - s, y + s, x - s, y); g.closePath(); g.fill();
  }
}
