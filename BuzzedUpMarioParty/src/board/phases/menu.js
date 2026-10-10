// The start of a turn: roll, use an item first, or look at the map and rules.
import { W, H, COLORS } from '../../config.js';
import { text, panel, bottleCap } from '../../draw.js';
import { state, isPro } from '../../state.js';
import { sfx } from '../../audio.js';
import { MAP, TILE, stepsBetween, zoneInfo } from '../map.js';
import { ITEMS, addItem, takeItem, blocksTheft, drawItemIcon } from '../items.js';
import { cpuPickItem } from '../cpu.js';
import {
  CAP_COST, DIE_MAX, HAPPY_HOUR_EVERY, LAST_CALL_TURNS, STEAL_COINS_FEE, STEAL_CAP_FEE, TIP, PROMPT_X,
} from '../consts.js';
import { prompt, subPrompt, listBox, wrap } from '../ui.js';

export const menuPhases = {
  openMenu() {
    this.menuSel = 0;
    this.cpuDecided = false;
  },

  menuRows() {
    const p = this.player;
    const used = this.G.usedItem;
    return [
      { id: 'roll', label: 'Roll the dice' },
      {
        id: 'items', label: 'Use an item', dim: used || !p.items.length,
        right: used ? 'one per turn' : p.items.length ? `${p.items.length} held` : 'none',
      },
      { id: 'map', label: 'Map and rules' },
    ];
  },

  do_turnIntro() {
    const p = this.player;
    const c = this.ctl(p);
    if (c.auto) {
      if (!c.pressed) return;
      if (!this.G.usedItem && !this.cpuDecided) {
        this.cpuDecided = true;
        const pick = cpuPickItem(p, this.capCost(), this.lastCall);
        if (pick) { this.applyItem(pick.id, pick); return; }
      }
      this.startRoll();
      return;
    }
    const rows = this.menuRows();
    if (c.up) { this.menuSel = (this.menuSel + rows.length - 1) % rows.length; sfx('move'); }
    if (c.down) { this.menuSel = (this.menuSel + 1) % rows.length; sfx('move'); }
    if (this.pt < 0.25 || !c.pressed) return;
    const row = rows[this.menuSel];
    if (row.dim) { sfx('bad'); return; }
    sfx('select');
    if (row.id === 'roll') this.startRoll();
    else if (row.id === 'items') { this.sel = 0; this.set('itemMenu'); }
    else { this.mapPage = 0; this.set('mapView'); }
  },

  draw_turnIntro(g) {
    const p = this.player;
    if (p.cpu) { prompt(g, `${p.name} is thinking…`); return; }
    const note = p.cursed ? 'Heavy Pour: your roll this turn is only 1 to 3.' : '';
    listBox(g, `${p.label} ${p.name}'s turn`, this.menuRows(), this.menuSel, { w: 460, note });
  },

  // ---- items ----

  do_itemMenu() {
    const p = this.player;
    const c = this.ctl(p);
    const count = p.items.length + 1;
    if (c.up) { this.sel = (this.sel + count - 1) % count; sfx('move'); }
    if (c.down) { this.sel = (this.sel + 1) % count; sfx('move'); }
    if (this.backHit) { this.backToMenu(); return; }
    if (this.pt < 0.25 || !c.pressed) return;
    if (this.sel >= p.items.length) { this.backToMenu(); return; }
    const id = p.items[this.sel];
    const kind = ITEMS[id].kind;
    if (kind === 'passive') { sfx('bad'); return; }
    sfx('select');
    this.pending = id;
    if (kind === 'target') {
      this.targets = this.itemTargets(id);
      if (!this.targets.length) { sfx('bad'); return; }
      this.sel = 0;
      this.set('itemTarget');
    } else if (id === 'loaded') {
      this.loadedValue = Math.min(DIE_MAX, Math.max(1, stepsBetween(p.node, this.G.capNode)));
      this.set('itemLoaded');
    } else {
      this.applyItem(id, {});
    }
  },

  backToMenu() {
    sfx('back');
    this.set('turnIntro');
  },

  // Rivals an item can be aimed at.
  itemTargets(id) {
    const p = this.player;
    return state.players.filter((q) => {
      if (q === p) return false;
      if (id === 'fingers') return q.items.length > 0;
      if (id === 'bet') return q.coins > 0 && p.coins > 0;
      return true;
    }).map((q) => q.index);
  },

  draw_itemMenu(g) {
    const p = this.player;
    const rows = p.items.map((id) => ({
      label: ITEMS[id].name, icon: (gg, x, y) => drawItemIcon(gg, id, x, y, 15),
      right: ITEMS[id].kind === 'passive' ? 'automatic' : '',
    }));
    rows.push({ label: 'Back' });
    const id = p.items[this.sel];
    listBox(g, 'Use which item?', rows, this.sel, { note: id ? ITEMS[id].text : 'Go back to the turn menu.' });
  },

  do_itemTarget() {
    const c = this.ctl(this.player);
    const count = this.targets.length + 1;
    if (c.up) { this.sel = (this.sel + count - 1) % count; sfx('move'); }
    if (c.down) { this.sel = (this.sel + 1) % count; sfx('move'); }
    if (this.backHit) { this.backToMenu(); return; }
    if (this.pt < 0.25 || !c.pressed) return;
    if (this.sel >= this.targets.length) { this.backToMenu(); return; }
    this.applyItem(this.pending, { target: this.targets[this.sel] });
  },

  draw_itemTarget(g) {
    const rows = this.targets.map((i) => {
      const q = state.players[i];
      return { label: `${q.label} ${q.name}`, right: `${q.caps} caps · ${q.coins} coins · ${q.items.length} items` };
    });
    rows.push({ label: 'Back' });
    listBox(g, `${ITEMS[this.pending].name}: on whom?`, rows, this.sel, { note: ITEMS[this.pending].text });
  },

  do_itemLoaded() {
    const c = this.ctl(this.player);
    // 0 on the dial means "never mind".
    if (c.left) { this.loadedValue = (this.loadedValue + DIE_MAX) % (DIE_MAX + 1); sfx('move'); }
    if (c.right) { this.loadedValue = (this.loadedValue + 1) % (DIE_MAX + 1); sfx('move'); }
    if (this.backHit) { this.backToMenu(); return; }
    if (this.pt < 0.25 || !c.pressed) return;
    if (this.loadedValue === 0) { this.backToMenu(); return; }
    this.applyItem('loaded', { value: this.loadedValue });
  },

  draw_itemLoaded(g) {
    const d = stepsBetween(this.player.node, this.G.capNode);
    panel(g, PROMPT_X - 280, 96, 560, 190, { fill: 'rgba(20,15,31,.95)', line: COLORS.gold });
    text(g, 'Loaded Die: choose your roll', PROMPT_X, 128, { size: 24 });
    text(g, this.loadedValue ? `◄   ${this.loadedValue}   ►` : '◄   Cancel   ►', PROMPT_X, 186, { size: 48, weight: 900, color: COLORS.gold });
    text(g, `The bottle cap is ${d} space${d === 1 ? '' : 's'} away.  Left / Right to change, A to confirm`, PROMPT_X, 250, {
      size: 15, weight: 700, color: COLORS.dim,
    });
  },

  // Uses up an item and applies it. opts: { target, value }.
  applyItem(id, opts) {
    const p = this.player;
    const ps = state.players;
    takeItem(p, id);
    this.G.usedItem = true;
    this.itemNote = '';
    this.usedItemId = id;
    sfx('card');
    if (id === 'energy') { this.diceCount = 2; this.itemNote = 'Two dice this turn.'; }
    else if (id === 'espresso') { this.diceCount = 3; this.itemNote = 'Three dice this turn.'; }
    else if (id === 'loaded') { this.forced = opts.value; this.itemNote = `The die will land on ${opts.value}.`; }
    else if (id === 'heavy') {
      const q = ps[opts.target];
      q.cursed = true;
      this.pop(q, 'HEAVY POUR', COLORS.bad);
      this.itemNote = `${q.name}'s next roll will only be 1 to 3.`;
    } else if (id === 'uber') {
      const others = ps.filter((q) => q !== p);
      const q = others[Math.floor(Math.random() * others.length)];
      [p.node, q.node] = [q.node, p.node];
      this.itemNote = `${p.name} and ${q.name} swap places.`;
    } else if (id === 'fingers') {
      const q = ps[opts.target];
      if (blocksTheft(q)) {
        this.pop(q, 'BLOCKED!', COLORS.good);
        this.itemNote = `${q.name}'s Bouncer Buddy stops the theft.`;
      } else {
        const got = q.items[Math.floor(Math.random() * q.items.length)];
        takeItem(q, got);
        addItem(p, got);
        this.pop(q, `-${ITEMS[got].name}`, COLORS.bad);
        this.itemNote = `${p.name} takes ${q.name}'s ${ITEMS[got].name}.`;
      }
    } else if (id === 'bus') {
      p.node = this.G.capNode;
      this.back = 'turnIntro';
      this.sel = 0;
      this.set('cap');
      return;
    } else if (id === 'bet') {
      this.openDuel(p, ps[opts.target], 'same');
      return;
    }
    this.set('itemUsed');
  },

  do_itemUsed() {
    if (this.pt > (state.autoplay ? 0.2 : 1.8)) this.set('turnIntro');
  },

  draw_itemUsed(g) {
    const p = this.player;
    prompt(g, `${p.name} uses ${ITEMS[this.usedItemId].name}`, 110, COLORS.gold);
    if (this.itemNote) subPrompt(g, this.itemNote, 152);
  },

  // ---- map and rules ----

  do_mapView() {
    const c = this.ctl(this.player);
    if (c.left || c.right) { this.mapPage = 1 - this.mapPage; sfx('move'); }
    if (this.backHit || (this.pt > 0.25 && c.pressed)) this.backToMenu();
  },

  draw_mapView(g) {
    const p = this.player;
    if (this.mapPage === 0) {
      const d = stepsBetween(p.node, this.G.capNode);
      panel(g, PROMPT_X - 330, H - 104, 660, 88, { fill: 'rgba(20,15,31,.94)', line: COLORS.gold });
      bottleCap(g, PROMPT_X - 292, H - 72, 16);
      text(g, `The cap is in ${zoneInfo(MAP.nodes[this.G.capNode].zone).name}, ${d} spaces from ${p.name}`, PROMPT_X - 264, H - 72, {
        size: 19, align: 'left',
      });
      text(g, 'Left / Right: rules and space guide     A: back', PROMPT_X, H - 38, { size: 15, weight: 700, color: COLORS.dim });
      return;
    }
    const x = 40;
    const w = W - 80;
    panel(g, x, 12, w, H - 24, { fill: 'rgba(20,15,31,.97)', line: COLORS.gold });
    text(g, 'SPACES', x + 24, 40, { size: 22, align: 'left', color: COLORS.pink });
    const types = Object.keys(TILE).filter((k) => k !== 'start');
    types.forEach((k, i) => {
      const tile = TILE[k];
      const col = i % 2;
      const cx = x + 40 + col * (w / 2 - 10);
      const cy = 76 + Math.floor(i / 2) * 40;
      g.beginPath();
      if (tile.pass) g.roundRect(cx - 16, cy - 16, 32, 32, 7); else g.arc(cx, cy, 16, 0, Math.PI * 2);
      g.fillStyle = tile.color;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = COLORS.ink;
      g.stroke();
      text(g, tile.name, cx + 28, cy - 8, { size: 15, align: 'left', color: COLORS.ink });
      text(g, tile.text, cx + 28, cy + 10, { size: 12, weight: 600, align: 'left', color: COLORS.dim });
    });
    const y0 = 76 + Math.ceil(types.length / 2) * 40 + 14;
    text(g, 'RULES', x + 24, y0, { size: 22, align: 'left', color: COLORS.pink });
    const pro = isPro();
    const rules = [
      `Bottle caps cost ${CAP_COST} coins. Walk past the cap to buy it; it then moves to another bar. Most caps wins, coins break ties.`,
      'Square spaces work as you walk past. Round spaces only count when you stop on them.',
      `Shops sell items. Use one before you roll. You can hold three. The Hustler steals coins for ${STEAL_COINS_FEE} or a cap for ${STEAL_CAP_FEE}. Pass the tip jar and you tip ${TIP}; land on it and you take the jar.`,
      'Where you stop sets your colour for the minigame: all one colour is a free-for-all, 2 and 2 is teams, 3 and 1 is one against three (or, about half the time, a free-for-all).',
      `Happy Hour every ${HAPPY_HOUR_EVERY}th turn: caps and items are half price. Whoever is in last place always gets 5 off at shops.`,
      `Last Call (final ${LAST_CALL_TURNS} turns): coin spaces are doubled, and stopping on someone's space starts a duel for coins.`,
      pro
        ? 'Pro rules: one bonus cap at the end, for the most coins won in minigames.'
        : 'Bonus caps at the end: most coins won in minigames, highest coin total at any point, most card spaces, and most sips taken.',
    ];
    rules.forEach((line, i) => {
      text(g, '•', x + 30, y0 + 34 + i * 38, { size: 16, color: COLORS.gold });
      wrap(g, line, x + 46, y0 + 34 + i * 38, w - 80, 17, { size: 13, weight: 600, align: 'left', color: COLORS.ink }, 2);
    });
    text(g, 'Left / Right: map     A: back', x + w / 2, H - 30, { size: 15, weight: 700, color: COLORS.dim });
  },
};
