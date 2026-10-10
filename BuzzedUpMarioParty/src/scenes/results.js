import { W, COLORS } from '../config.js';
import { text, panel, backdrop, drunkMeter, coin } from '../draw.js';
import { drawCharacter } from '../characters.js';
import { drunkLevel } from '../drunk.js';
import {
  state, addSips, scaledSips, sipRoom, humanDevices, trackPeaks, NON_DRINKER_COINS_PER_SIP,
} from '../state.js';
import { sfx } from '../audio.js';

const FFA_COINS = [10, 5, 3, 0];
const PLACE_NAMES = ['1st', '2nd', '3rd', '4th'];
const TITLES = { round: 'RESULTS', duel: 'DUEL', battle: 'BAR FIGHT' };

// Shows placements, pays out coins, makes the losers drink, then lets the winners hand sips out.
//
// ranking: groups of player indices, best first. teams: team number per player (-1 = not playing).
// settle: { kind: 'round' } for the usual end-of-round game, { kind: 'duel', wager } or
// { kind: 'battle', pot }.
export class ResultsScene {
  constructor(def, ranking, teams, onDone, settle = { kind: 'round' }) {
    this.def = def;
    this.ranking = ranking;
    this.teams = teams;
    this.onDone = onDone;
    this.settle = settle;
  }

  enter() {
    const ps = state.players;
    const n = ps.length;
    this.involved = this.ranking.flat().sort((a, b) => a - b);
    const teamGame = new Set(this.involved.map((i) => this.teams[i])).size < this.involved.length;
    this.teamGame = teamGame;
    this.t = 0;
    this.rank = new Array(n).fill(0);
    this.coinGain = new Array(n).fill(0);
    this.drank = new Array(n).fill(0);
    this.coinLoss = new Array(n).fill(0);
    this.capped = new Array(n).fill(false);
    this.flash = new Array(n).fill(0);
    this.gives = [];
    this.sel = -1;
    this.cpuT = 0;

    const groups = this.ranking;
    let ahead = 0;
    groups.forEach((group, gi) => {
      for (const i of group) this.rank[i] = teamGame ? gi : ahead;
      ahead += group.length;
    });
    const decided = groups.length > 1;
    if (decided) for (const i of groups[0]) ps[i].wins++;

    if (this.settle.kind === 'duel') this.payDuel(groups, decided);
    else if (this.settle.kind === 'battle') this.payBattle(groups);
    else this.payRound(groups, teamGame);

    for (const i of this.involved) {
      ps[i].coins += this.coinGain[i];
      if (this.coinGain[i] > 0) ps[i].stats.mgCoins += this.coinGain[i];
    }
    trackPeaks();

    if (decided) {
      const last = groups[groups.length - 1];
      if (this.settle.kind === 'round') {
        for (const i of last) this.drink(i, scaledSips(2));
        if (!teamGame && groups.length >= 3 && this.involved.length >= 4) {
          for (const i of groups[groups.length - 2]) this.drink(i, scaledSips(1));
        }
        const winners = groups[0];
        let each = winners.length === 1 ? 2 : 1;
        if (this.def.type === '1v3' && winners.length === 1) each = 3;
        for (const i of winners) this.gives.push({ giver: i, left: scaledSips(each) });
      } else {
        // Duels and bar fights: the loser just takes a sip.
        for (const i of last) this.drink(i, scaledSips(1));
      }
    }
    this.phase = 'reveal';
  }

  payRound(groups, teamGame) {
    let ahead = 0;
    groups.forEach((group, gi) => {
      for (const i of group) {
        this.coinGain[i] = teamGame ? (gi === 0 && groups.length > 1 ? 10 : 0) : FFA_COINS[Math.min(3, ahead)];
      }
      ahead += group.length;
    });
  }

  payDuel(groups, decided) {
    if (!decided) return;
    const ps = state.players;
    const winner = groups[0][0];
    const loser = groups[1][0];
    const amount = Math.min(this.settle.wager, ps[loser].coins);
    this.coinGain[winner] = amount;
    this.coinGain[loser] = -amount;
  }

  // First place shares 70% of the pot, second place 30%. A complete tie splits it evenly.
  payBattle(groups) {
    const pot = this.settle.pot;
    if (groups.length === 1) {
      for (const i of groups[0]) this.coinGain[i] = Math.floor(pot / groups[0].length);
      return;
    }
    const second = Math.floor(pot * 0.3);
    const first = pot - second;
    for (const i of groups[0]) this.coinGain[i] = Math.floor(first / groups[0].length);
    for (const i of groups[1]) this.coinGain[i] = Math.floor(second / groups[1].length);
  }

  drink(i, n) {
    const p = state.players[i];
    const got = addSips(p, n);
    if (got < n) this.capped[i] = true;
    if (!got) return 0;
    this.drank[i] += got;
    this.flash[i] = 1;
    sfx('drink');
    if (p.nonDrinker) {
      const loss = Math.min(p.coins, NON_DRINKER_COINS_PER_SIP * got);
      p.coins -= loss;
      this.coinLoss[i] += loss;
    }
    return got;
  }

  // Who the current giver may hand a sip to: opponents who are still under the round cap.
  targets(giver) {
    return this.involved.filter((i) => i !== giver && this.teams[i] !== this.teams[giver] && sipRoom(state.players[i]) > 0);
  }

  update(dt) {
    this.t += dt;
    for (let i = 0; i < this.flash.length; i++) this.flash[i] = Math.max(0, this.flash[i] - dt * 1.5);
    const input = this.game.input;

    if (this.phase === 'reveal') {
      if (this.t > 1.6) this.phase = 'give';
      return;
    }
    if (this.phase === 'give') {
      const cur = this.gives[0];
      if (!cur) { this.phase = 'done'; this.t = 0; return; }
      const targets = this.targets(cur.giver);
      if (!targets.length || cur.left <= 0) { this.gives.shift(); this.sel = -1; this.cpuT = 0; return; }
      if (!targets.includes(this.sel)) this.sel = targets[0];
      const giver = state.players[cur.giver];
      let confirm = false;
      if (giver.cpu || state.autoplay) {
        // Computer players pile sips on whoever is doing best.
        this.cpuT += dt;
        if (this.cpuT > (state.autoplay ? 0.1 : 0.9)) {
          const best = [...targets].sort((a, b) => {
            const pa = state.players[a];
            const pb = state.players[b];
            return pb.caps - pa.caps || pb.coins - pa.coins || Math.random() - 0.5;
          });
          this.sel = best[0];
          confirm = true;
          this.cpuT = 0;
        }
      } else {
        const d = input.get(giver.device);
        const at = targets.indexOf(this.sel);
        if (d.left) this.sel = targets[(at + targets.length - 1) % targets.length];
        if (d.right) this.sel = targets[(at + 1) % targets.length];
        confirm = d.pressed;
      }
      if (confirm) {
        this.drink(this.sel, 1);
        cur.left--;
      }
      return;
    }
    const go = state.autoplay ? this.t > 0.3 : this.t > 0.4 && input.merged(humanDevices()).pressed;
    if (go) this.onDone();
  }

  draw(g) {
    backdrop(g, this.t);
    text(g, this.def.name, W / 2, 50, { size: 30, color: COLORS.dim });
    const ps = state.players;
    const cur = this.phase === 'give' ? this.gives[0] : null;

    if (cur) {
      const giver = ps[cur.giver];
      text(g, `${giver.label} ${giver.name}: hand out ${cur.left} sip${cur.left === 1 ? '' : 's'}`, W / 2, 105, {
        size: 40, weight: 900, color: giver.color,
      });
      text(g, giver.cpu ? 'Choosing…' : 'Left / Right to choose, A to give', W / 2, 146, {
        size: 20, weight: 600, color: COLORS.dim,
      });
    } else {
      text(g, TITLES[this.settle.kind], W / 2, 115, { size: 64, weight: 900, glow: COLORS.gold });
    }

    const n = this.involved.length;
    const cw = 280;
    const x0 = (W - (n * cw + (n - 1) * 20)) / 2;
    const draw = this.ranking.length === 1 && n > 1;
    this.involved.forEach((i, slot) => {
      const p = ps[i];
      const x = x0 + slot * (cw + 20);
      const y = 190;
      const isSel = cur && this.sel === i;
      const isGiver = cur && cur.giver === i;
      panel(g, x, y, cw, 400, {
        line: isSel ? COLORS.bad : isGiver ? COLORS.good : p.color,
        lineW: isSel || isGiver ? 6 : 3,
        fill: this.flash[i] > 0 ? `rgba(120,40,60,${0.4 + this.flash[i] * 0.5})` : COLORS.panel,
      });
      if (isSel) text(g, '▼', x + cw / 2, y - 16, { size: 30, color: COLORS.bad });

      let placeText = PLACE_NAMES[this.rank[i]];
      if (draw) placeText = 'DRAW';
      else if (this.teamGame || n === 2) placeText = this.rank[i] === 0 ? 'WIN' : 'LOSE';
      text(g, placeText, x + cw / 2, y + 40, {
        size: 40, weight: 900, color: this.rank[i] === 0 && !draw ? COLORS.gold : COLORS.ink,
      });
      drawCharacter(g, p.char, x + cw / 2, y + 130, 52, {
        t: this.t, drunk: drunkLevel(p.sips), phase: i, sad: this.drank[i] > 0,
      });
      text(g, `${p.label} ${p.name}`, x + cw / 2, y + 222, { size: 24, color: p.color });

      coin(g, x + cw / 2 - 40, y + 258, 11);
      text(g, `${p.coins}`, x + cw / 2 - 20, y + 259, { size: 22, align: 'left' });
      const gain = this.coinGain[i];
      if (gain) {
        text(g, `${gain > 0 ? '+' : ''}${gain}`, x + cw / 2 + 30, y + 259, {
          size: 18, align: 'left', color: gain > 0 ? COLORS.good : COLORS.bad,
        });
      }

      if (this.drank[i]) {
        const s = this.drank[i];
        const line = p.nonDrinker ? `${s} sip${s === 1 ? '' : 's'}: lose ${this.coinLoss[i]} coins` : `DRINK ${s}`;
        text(g, line, x + cw / 2, y + 302, { size: p.nonDrinker ? 20 : 32, weight: 900, color: COLORS.bad });
      } else {
        text(g, 'Safe', x + cw / 2, y + 302, { size: 22, color: COLORS.dim });
      }
      if (this.capped[i]) {
        text(g, 'at the round limit', x + cw / 2, y + 330, { size: 14, weight: 600, color: COLORS.dim });
      }
      drunkMeter(g, x + 30, y + 348, cw - 60, p);
    });

    if (this.phase === 'done' && Math.sin(this.t * 4) > -0.3) {
      text(g, 'Press A to continue', W / 2, 650, { size: 28, color: COLORS.gold });
    }
  }
}
