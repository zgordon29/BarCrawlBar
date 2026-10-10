// Things that happen as a player walks past: buying the bottle cap, shops, the Hustler and the tip jar.
import { COLORS } from '../../config.js';
import { text, panel } from '../../draw.js';
import { state, standings } from '../../state.js';
import { sfx } from '../../audio.js';
import { MAP, otherCapSpot, zoneInfo, stepsBetween } from '../map.js';
import { ITEMS, addItem, hasRoom, shopStock, blocksTheft, drawItemIcon } from '../items.js';
import { cpuShop, cpuHustle } from '../cpu.js';
import { STEAL_COINS_FEE, STEAL_CAP_FEE, TIP, STEP_TIME, PROMPT_X } from '../consts.js';
import { prompt, subPrompt, bigNote, choiceBox, listBox } from '../ui.js';

export const servicePhases = {
  // Goes back to whatever the player was doing before a pass-by service interrupted.
  resumeBack() {
    const back = this.back;
    this.back = 'moving';
    this.focus = null;
    if (back === 'turnIntro') { this.set('turnIntro'); return; }
    this.set('moving');
    this.pt = STEP_TIME;
  },

  // Called for every space a player steps onto. Returns true if a service took over.
  passService(node) {
    const p = this.player;
    if (node.id === this.G.capNode) { this.sel = 0; this.capNoted = false; this.set('cap'); return true; }
    if (node.type === 'shop') { this.openShop(); return true; }
    if (node.type === 'hustler') { this.openHustler(); return true; }
    if (node.type === 'bank' && this.steps > 0) {
      const tip = Math.min(TIP, p.coins);
      if (tip) {
        p.coins -= tip;
        this.G.pot += tip;
        this.pop(p, `-${tip} tip`, COLORS.dim);
        sfx('coin');
      }
    }
    return false;
  },

  // ---- the bottle cap ----

  do_cap() {
    const p = this.player;
    if (p.coins < this.capCost()) {
      if (!this.capNoted) { this.say('capBroke', p.name); this.capNoted = true; sfx('bad'); }
      if (this.pt > (state.autoplay ? 0.2 : 1.8)) { this.capNoted = false; this.resumeBack(); }
      return;
    }
    const c = this.ctl(p);
    if (c.left || c.right) { this.sel = 1 - this.sel; sfx('move'); }
    if (this.pt < 0.3 || !c.pressed) return;
    if (c.auto) this.sel = 0;
    if (this.sel === 0) {
      p.coins -= this.capCost();
      p.caps++;
      sfx('cap');
      this.pop(p, '+1 BOTTLE CAP', COLORS.gold);
      this.say('capBuy', p.name);
      this.set('capGot');
    } else {
      this.say('capSkip', p.name);
      this.resumeBack();
    }
  },

  draw_cap(g) {
    const p = this.player;
    if (p.coins < this.capCost()) {
      prompt(g, `${p.name} can't afford the cap (${this.capCost()} coins)`);
      return;
    }
    choiceBox(g, `Buy the bottle cap for ${this.capCost()} coins?`, ['Buy it', 'Walk past'], this.sel, 'Left / Right to choose, A to confirm');
  },

  // The purchase gets a moment of its own, then the camera flies to where the next cap lands.
  do_capGot() {
    if (this.pt < (state.autoplay ? 0.1 : 1.6)) return;
    const was = this.G.capNode;
    this.G.capNode = otherCapSpot(was, this.G.prevCap);
    this.G.prevCap = was;
    const cap = MAP.nodes[this.G.capNode];
    this.focus = { x: cap.x, y: cap.y - 40 };
    this.capDrop = 0;
    sfx('select');
    this.set('capMoved');
  },

  draw_capGot(g) {
    prompt(g, `${this.player.name} got a bottle cap!`, 110, COLORS.gold);
  },

  do_capMoved(dt) {
    this.capDrop = Math.min(1, (this.capDrop || 0) + dt * 1.6);
    if (this.pt > (state.autoplay ? 0.1 : 2.6)) { this.capDrop = 1; this.resumeBack(); }
  },

  // When the cap moves, everyone's plan changes, so the new race is shown straight away:
  // who is now closest, and by how much.
  draw_capMoved(g) {
    prompt(g, `The next bottle cap is in ${zoneInfo(MAP.nodes[this.G.capNode].zone).name}`, 110, COLORS.gold);
    const rows = state.players
      .map((p) => ({ p, d: stepsBetween(p.node, this.G.capNode) }))
      .sort((a, b) => a.d - b.d);
    panel(g, PROMPT_X - 170, 140, 340, 44 + rows.length * 28, { fill: 'rgba(20,15,31,.92)', line: COLORS.gold });
    text(g, 'Spaces to the new cap', PROMPT_X, 160, { size: 15, color: COLORS.dim });
    rows.forEach(({ p, d }, i) => {
      const y = 190 + i * 28;
      text(g, `${p.label} ${p.name}`, PROMPT_X - 150, y, { size: 19, align: 'left', color: p.color });
      text(g, String(d), PROMPT_X + 150, y, { size: 19, align: 'right', color: i === 0 ? COLORS.gold : COLORS.ink });
    });
  },

  // ---- shop ----

  // Today's price for this player: half price in Happy Hour, 5 off for whoever is in last place.
  price(id) {
    let cost = ITEMS[id].cost;
    if (this.lastPlaceDiscount()) cost = Math.max(1, cost - 5);
    if (this.happyHour) cost = Math.ceil(cost / 2);
    return cost;
  },

  lastPlaceDiscount() {
    const order = standings();
    const last = order[order.length - 1];
    const first = order[0];
    return order.length > 1 && last === this.player && (last.caps !== first.caps || last.coins !== first.coins);
  },

  openShop() {
    this.stock = shopStock();
    this.sel = 0;
    this.shopNote = '';
    this.say('shop', this.player.name);
    this.set('shop');
  },

  do_shop() {
    const p = this.player;
    const c = this.ctl(p);
    const count = this.stock.length + 1;
    if (c.auto) {
      if (!c.pressed) return;
      const pick = cpuShop(p, this.stock, (id) => this.price(id), this.capCost());
      if (pick) this.buy(pick); else this.resumeBack();
      return;
    }
    if (c.up) { this.sel = (this.sel + count - 1) % count; sfx('move'); }
    if (c.down) { this.sel = (this.sel + 1) % count; sfx('move'); }
    if (this.backHit) { this.resumeBack(); return; }
    if (this.pt < 0.3 || !c.pressed) return;
    if (this.sel >= this.stock.length) { sfx('back'); this.resumeBack(); return; }
    const id = this.stock[this.sel];
    if (!hasRoom(p)) { this.shopNote = 'Your pockets are full: three items is the limit.'; sfx('bad'); return; }
    if (p.coins < this.price(id)) { this.shopNote = 'You cannot afford that.'; sfx('bad'); return; }
    this.buy(id);
  },

  buy(id) {
    const p = this.player;
    p.coins -= this.price(id);
    addItem(p, id);
    this.bought = id;
    sfx('coin');
    this.pop(p, `+${ITEMS[id].name}`, COLORS.good);
    this.set('shopDone');
  },

  draw_shop(g) {
    const p = this.player;
    const rows = this.stock.map((id) => ({
      label: ITEMS[id].name, icon: (gg, x, y) => drawItemIcon(gg, id, x, y, 15),
      right: `${this.price(id)} coins`, dim: p.coins < this.price(id) || !hasRoom(p),
    }));
    rows.push({ label: 'Leave' });
    const id = this.stock[this.sel];
    let title = `Shop  ·  ${p.name} has ${p.coins} coins`;
    if (this.happyHour) title = `HAPPY HOUR: half price  ·  ${p.coins} coins`;
    else if (this.lastPlaceDiscount()) title = `Last-place discount: 5 off  ·  ${p.coins} coins`;
    listBox(g, title, rows, p.cpu ? -1 : this.sel, { note: this.shopNote || (id ? ITEMS[id].text : 'Keep walking.') });
  },

  do_shopDone() {
    if (this.pt > (state.autoplay ? 0.1 : 1.3)) this.resumeBack();
  },

  draw_shopDone(g) {
    prompt(g, `${this.player.name} buys ${ITEMS[this.bought].name}`, 110, COLORS.good);
    subPrompt(g, ITEMS[this.bought].text, 152);
  },

  // ---- the Hustler: pay to steal from someone ----

  hustleOptions() {
    const p = this.player;
    const others = state.players.filter((q) => q !== p);
    return [
      { id: 'coins', label: `Steal coins (${STEAL_COINS_FEE})`, ok: p.coins >= STEAL_COINS_FEE && others.some((q) => q.coins > 0) },
      { id: 'cap', label: `Steal a cap (${STEAL_CAP_FEE})`, ok: p.coins >= STEAL_CAP_FEE && others.some((q) => q.caps > 0) },
      { id: 'leave', label: 'Walk on', ok: true },
    ];
  },

  openHustler() {
    this.sel = 2;
    this.say('hustler', this.player.name);
    this.set('hustler');
  },

  do_hustler() {
    const p = this.player;
    const c = this.ctl(p);
    const options = this.hustleOptions();
    if (c.auto) {
      if (!c.pressed) return;
      const plan = cpuHustle(p);
      if (plan) this.hustle(plan.what, state.players[plan.target]); else this.resumeBack();
      return;
    }
    if (c.left) { this.sel = (this.sel + 2) % 3; sfx('move'); }
    if (c.right) { this.sel = (this.sel + 1) % 3; sfx('move'); }
    if (this.backHit) { this.resumeBack(); return; }
    if (this.pt < 0.3 || !c.pressed) return;
    const pick = options[this.sel];
    if (!pick.ok) { sfx('bad'); return; }
    if (pick.id === 'leave') { sfx('back'); this.resumeBack(); return; }
    this.hustleWhat = pick.id;
    this.targets = state.players
      .filter((q) => q !== p && (pick.id === 'cap' ? q.caps > 0 : q.coins > 0))
      .map((q) => q.index);
    this.sel = 0;
    this.set('hustleTarget');
  },

  draw_hustler(g) {
    const options = this.hustleOptions();
    choiceBox(g, `The Hustler: "Who are we robbing, ${this.player.name}?"`, options.map((o) => (o.ok ? o.label : `${o.label} ✕`)),
      this.player.cpu ? -1 : this.sel, 'Left / Right to choose, A to confirm');
  },

  do_hustleTarget() {
    const c = this.ctl(this.player);
    const count = this.targets.length + 1;
    if (c.up) { this.sel = (this.sel + count - 1) % count; sfx('move'); }
    if (c.down) { this.sel = (this.sel + 1) % count; sfx('move'); }
    if (this.backHit) { this.sel = 2; this.set('hustler'); return; }
    if (this.pt < 0.3 || !c.pressed) return;
    if (this.sel >= this.targets.length) { this.sel = 2; this.set('hustler'); return; }
    this.hustle(this.hustleWhat, state.players[this.targets[this.sel]]);
  },

  draw_hustleTarget(g) {
    const rows = this.targets.map((i) => {
      const q = state.players[i];
      return { label: `${q.label} ${q.name}`, right: `${q.caps} caps · ${q.coins} coins` };
    });
    rows.push({ label: 'Back' });
    listBox(g, this.hustleWhat === 'cap' ? 'Steal a bottle cap from…' : 'Steal coins from…', rows, this.sel);
  },

  hustle(what, victim) {
    const p = this.player;
    p.coins -= what === 'cap' ? STEAL_CAP_FEE : STEAL_COINS_FEE;
    if (blocksTheft(victim)) {
      this.pop(victim, 'BLOCKED!', COLORS.good);
      this.hustleNote = `${victim.name}'s Bouncer Buddy throws the Hustler out. ${p.name} still pays.`;
      sfx('bad');
    } else if (what === 'cap') {
      victim.caps--;
      p.caps++;
      this.pop(victim, '-1 BOTTLE CAP', COLORS.bad);
      this.pop(p, '+1 BOTTLE CAP', COLORS.gold);
      this.hustleNote = `${p.name} steals a bottle cap from ${victim.name}!`;
      sfx('cap');
    } else {
      const amount = Math.min(victim.coins, 6 + Math.floor(Math.random() * 13));
      victim.coins -= amount;
      p.coins += amount;
      this.pop(victim, `-${amount}`, COLORS.bad);
      this.pop(p, `+${amount}`, COLORS.gold);
      this.hustleNote = `${p.name} steals ${amount} coins from ${victim.name}.`;
      sfx('coin');
    }
    this.say('steal', victim.name);
    this.set('hustleDone');
  },

  do_hustleDone() {
    if (this.pt > (state.autoplay ? 0.1 : 2.2)) this.resumeBack();
  },

  draw_hustleDone(g) {
    bigNote(g, this.hustleNote);
  },
};
