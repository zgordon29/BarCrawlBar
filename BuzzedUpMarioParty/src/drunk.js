// Drunkenness: driven by a player's sip count, never goes down during a game.
// Modeled on Sea of Thieves: input sways, lags and occasionally stumbles.

// Sips it takes to be as drunk as the game gets. A long crawl raises this so that
// players are not all maxed out halfway through.
let sipsForMax = 24;

export function setDrunkScale(sips) {
  sipsForMax = Math.max(8, sips);
}

export function drunkLevel(sips) {
  return Math.min(1, sips / sipsForMax);
}

export function drunkStage(sips) {
  const d = sips / sipsForMax;
  if (d < 0.15) return 'Sober';
  if (d < 0.4) return 'Buzzed';
  if (d < 0.75) return 'Tipsy';
  return 'Hammered';
}

export class DrunkFilter {
  constructor(seed = 0) {
    this.t = seed * 7.3;
    this.phase = [seed * 1.7, seed * 2.9 + 1, seed * 0.6 + 2, seed * 3.1 + 4];
    this.sx = 0;
    this.sy = 0;
    this.stumbleT = 0;
    this.stx = 0;
    this.sty = 0;
  }

  // raw: {x, y, btn, pressed}; level: 0..1. Returns the input the character actually gets.
  apply(raw, level, dt) {
    this.t += dt;
    const d = level;

    // Lag: the character is slow to respond and overshoots.
    const tau = 0.25 * d;
    const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
    this.sx += (raw.x - this.sx) * k;
    this.sy += (raw.y - this.sy) * k;

    // Sway: a slow drift, stronger while moving.
    const mag = Math.min(1, Math.hypot(raw.x, raw.y));
    const amp = d * (0.15 + 0.3 * mag);
    const [a, b, c, e] = this.phase;
    const swx = amp * (0.6 * Math.sin(this.t * 1.3 + a) + 0.4 * Math.sin(this.t * 2.9 + b));
    const swy = amp * (0.6 * Math.cos(this.t * 1.1 + c) + 0.4 * Math.sin(this.t * 2.3 + e));

    // Stumble: a short lurch in a random direction.
    if (this.stumbleT > 0) {
      this.stumbleT -= dt;
    } else if (d > 0.3 && Math.random() < dt * 0.5 * d * d) {
      const ang = Math.random() * Math.PI * 2;
      this.stumbleT = 0.4;
      this.stx = Math.cos(ang) * 0.9 * d;
      this.sty = Math.sin(ang) * 0.9 * d;
    }
    const stumbling = this.stumbleT > 0;

    let x = this.sx + swx + (stumbling ? this.stx : 0);
    let y = this.sy + swy + (stumbling ? this.sty : 0);
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, btn: raw.btn, pressed: raw.pressed, stumbling };
  }
}
