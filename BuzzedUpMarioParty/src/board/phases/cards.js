// Event cards: drawn on "?" spaces, then worked through one effect at a time.
import { COLORS } from '../../config.js';
import { text, panel } from '../../draw.js';
import { state, scaledSips } from '../../state.js';
import { sfx } from '../../audio.js';
import { MAP, otherCapSpot, zoneInfo } from '../map.js';
import { drawCard } from '../../content/cards.js';
import { PROMPT_X } from '../consts.js';
import { wrap } from '../ui.js';

const CARD_W = 520;

export const cardPhases = {
  openCard() {
    const p = this.player;
    const zone = MAP.nodes[p.node].zone;
    this.card = drawCard(zone, state.settings.rating, this.G.recentCards);
    this.G.recentCards.push(this.card);
    if (this.G.recentCards.length > 14) this.G.recentCards.shift();
    this.fxQueue = [...this.card.fx];
    this.cardNote = '';
    this.sel = 0;
    p.stats.cards++;
    this.say('card', p.name);
    sfx('card');
    this.set('card');
  },

  do_card() {
    const c = this.ctl(this.player);
    const dare = this.fxQueue[0] && this.fxQueue[0].k === 'dare';
    if (dare && (c.left || c.right)) { this.sel = 1 - this.sel; sfx('move'); }
    if (this.pt < 0.5 || !c.pressed) return;
    if (dare && c.auto) this.sel = Math.random() < 0.5 ? 0 : 1;
    this.set('fx');
  },

  // Works through the card's effects one at a time; some need a player to choose something.
  do_fx() {
    const p = this.player;
    const fx = this.fxQueue.shift();
    if (!fx) { this.set('cardDone'); return; }
    const S = scaledSips;
    const others = state.players.filter((q) => q !== p);
    const by = (score) => [...state.players].sort((a, b) => score(b) - score(a) || Math.random() - 0.5)[0];
    switch (fx.k) {
      case 'sip': this.sip(p, S(fx.n)); break;
      case 'all': for (const q of state.players) this.sip(q, S(fx.n)); break;
      case 'others': for (const q of others) this.sip(q, S(fx.n)); break;
      case 'coins': this.coins(p, fx.n); break;
      case 'allCoins': for (const q of state.players) this.coins(q, fx.n); break;
      case 'steal': {
        const victim = [...others].sort((a, b) => b.coins - a.coins)[0];
        const got = Math.min(victim.coins, fx.n);
        this.coins(victim, -got);
        this.coins(p, got);
        this.cardNote = `${p.name} takes ${got} coins from ${victim.name}.`;
        break;
      }
      case 'flip': {
        const win = Math.random() < 0.5;
        this.coins(p, win ? fx.win : -fx.lose);
        this.cardNote = win ? `Heads! ${p.name} wins ${fx.win} coins.` : `Tails. ${p.name} loses ${fx.lose} coins.`;
        break;
      }
      case 'move': {
        for (let i = 0; i < Math.abs(fx.n); i++) p.node = fx.n > 0 ? MAP.nodes[p.node].next[0] : MAP.nodes[p.node].prev;
        break;
      }
      case 'swap': {
        const q = others[Math.floor(Math.random() * others.length)];
        [p.node, q.node] = [q.node, p.node];
        this.cardNote = `${p.name} swaps places with ${q.name}.`;
        break;
      }
      case 'soberest': { const q = by((x) => -x.sips); this.sip(q, S(fx.n)); this.cardNote = `${q.name} is the soberest.`; break; }
      case 'richest': { const q = by((x) => x.coins); this.sip(q, S(fx.n)); this.cardNote = `${q.name} is the richest.`; break; }
      case 'lastPlace': { const q = by((x) => -(x.caps * 1000 + x.coins)); this.coins(q, fx.n); this.cardNote = `${q.name} is in last place.`; break; }
      case 'drunkestCoins': { const q = by((x) => x.sips); this.coins(q, fx.n); this.cardNote = `${q.name} is the drunkest.`; break; }
      case 'capMove':
        [this.G.capNode, this.G.prevCap] = [otherCapSpot(this.G.capNode, this.G.prevCap), this.G.capNode];
        this.cardNote = `The cap is now in ${zoneInfo(MAP.nodes[this.G.capNode].zone).name}.`;
        break;
      case 'rule': this.G.rule = { title: this.card.t.replace('House Rule: ', ''), text: this.card.x.replaceAll('{me}', p.name) }; break;
      case 'dare':
        if (this.sel === 0) { this.coins(p, fx.coins); this.cardNote = `${p.name} did it.`; }
        else { this.sip(p, S(fx.n)); this.cardNote = `${p.name} drinks instead.`; }
        break;
      case 'give': this.startGive(S(fx.n), 'fx'); return;
      case 'pick': this.pick = fx; this.sel = p.index; this.set('pick'); return;
      default: break;
    }
  },

  do_pick() {
    const c = this.ctl(this.player);
    const n = state.players.length;
    if (c.left) this.sel = (this.sel + n - 1) % n;
    if (c.right) this.sel = (this.sel + 1) % n;
    if (c.left || c.right) sfx('move');
    if (this.pt < 0.4 || !c.pressed) return;
    if (c.auto) this.sel = Math.floor(Math.random() * n);
    this.sip(state.players[this.sel], scaledSips(this.pick.n));
    this.set('fx');
  },

  do_cardDone() {
    if (this.pt > (state.autoplay ? 0.2 : 1.8)) { this.card = null; this.finishTurn(); }
  },

  drawCardPanel(g) {
    const p = this.player;
    const x = PROMPT_X - CARD_W / 2;
    panel(g, x, 110, CARD_W, 400, { fill: '#fff7e6', line: '#a66bff', lineW: 8, r: 22 });
    text(g, this.card.r ? 'R-RATED' : zoneInfo(MAP.nodes[p.node].zone).sub.toUpperCase(), PROMPT_X, 140, {
      size: 14, weight: 900, color: this.card.r ? '#c2185b' : '#7a5cc0',
    });
    text(g, this.card.t, PROMPT_X, 182, { size: 34, weight: 900, color: '#140f1f' });
    wrap(g, this.card.x.replaceAll('{me}', p.name), PROMPT_X, 250, 450, 32, { size: 23, weight: 700, color: '#2a2136' }, 5);
  },

  draw_card(g) {
    this.drawCardPanel(g);
    const fx = this.fxQueue[0];
    if (fx && fx.k === 'dare') {
      const n = scaledSips(fx.n);
      [`Did it (+${fx.coins} coins)`, `Drink ${n} instead`].forEach((o, i) => {
        const bx = PROMPT_X - 125 + i * 250;
        const on = this.sel === i;
        panel(g, bx - 115, 430, 230, 56, { r: 12, fill: on ? '#3b2d5c' : '#d9cfe8', line: on ? COLORS.gold : '#a99cc2' });
        text(g, o, bx, 459, { size: 18, color: on ? COLORS.ink : '#2a2136' });
      });
    } else {
      text(g, this.player.cpu ? '…' : 'Press A', PROMPT_X, 468, { size: 22, weight: 900, color: '#7a5cc0' });
    }
  },

  draw_fx(g) { this.drawCardPanel(g); },

  draw_pick(g) {
    this.drawCardPanel(g);
    text(g, this.pick.ask, PROMPT_X, 440, { size: 24, weight: 900, color: '#c2185b' });
    const q = state.players[this.sel];
    text(g, `◄  ${q.label} ${q.name}  ►`, PROMPT_X, 478, { size: 24, weight: 900, color: '#140f1f' });
  },

  draw_cardDone(g) {
    this.drawCardPanel(g);
    if (this.cardNote) text(g, this.cardNote, PROMPT_X, 458, { size: 21, weight: 900, color: '#c2185b' });
  },
};
