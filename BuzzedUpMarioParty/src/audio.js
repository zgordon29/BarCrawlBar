// All sound is synthesised in the browser, so there are no audio files to load.

let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let nextNote = 0;
let step = 0;

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only allow sound after a key press or click on the page.
for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, ensure);

function tone(freq, dur, o = {}) {
  const t0 = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * o.slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(o.vol || 0.18, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(o.dest || master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  move: () => tone(520, 0.05, { vol: 0.08 }),
  select: () => { tone(660, 0.07); tone(990, 0.1, { delay: 0.06 }); },
  back: () => tone(330, 0.1, { slide: 0.6 }),
  tick: () => tone(440, 0.12, { type: 'triangle', vol: 0.25 }),
  go: () => tone(880, 0.35, { type: 'triangle', vol: 0.3 }),
  start: () => { tone(392, 0.1); tone(523, 0.1, { delay: 0.1 }); tone(659, 0.2, { delay: 0.2 }); },
  finish: () => { tone(784, 0.12); tone(784, 0.12, { delay: 0.14 }); tone(1047, 0.4, { delay: 0.28 }); },
  dice: () => tone(300 + Math.random() * 500, 0.04, { vol: 0.1 }),
  step: () => tone(260, 0.05, { type: 'triangle', vol: 0.15 }),
  coin: () => { tone(988, 0.06, { vol: 0.14 }); tone(1319, 0.14, { delay: 0.06, vol: 0.14 }); },
  bad: () => tone(196, 0.3, { type: 'sawtooth', slide: 0.5, vol: 0.14 }),
  drink: () => { tone(300, 0.09, { type: 'sine', slide: 0.6, vol: 0.3 }); tone(260, 0.09, { type: 'sine', slide: 0.6, vol: 0.3, delay: 0.13 }); },
  card: () => { tone(523, 0.08, { type: 'triangle' }); tone(784, 0.16, { type: 'triangle', delay: 0.08 }); },
  cap: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle', vol: 0.25 })),
  fanfare: () => [523, 523, 523, 698, 880, 1047].forEach((f, i) => tone(f, i === 5 ? 0.6 : 0.14, { delay: i * 0.15, vol: 0.22 })),
  // Minigame feedback: each kind of event has a sound of its own, so ears can follow the action.
  whoosh: () => tone(520, 0.12, { type: 'sawtooth', slide: 0.35, vol: 0.06 }),
  thump: () => { tone(150, 0.14, { type: 'sine', slide: 0.4, vol: 0.4 }); tone(90, 0.1, { slide: 0.5, vol: 0.08 }); },
  ouch: () => { tone(300, 0.16, { type: 'sawtooth', slide: 0.5, vol: 0.14 }); tone(140, 0.12, { type: 'sine', slide: 0.5, vol: 0.3 }); },
  ko: () => { tone(440, 0.5, { type: 'sawtooth', slide: 0.2, vol: 0.14 }); tone(110, 0.25, { type: 'sine', slide: 0.5, vol: 0.35 }); },
  ding: () => { tone(1319, 0.08, { type: 'triangle', vol: 0.22 }); tone(1760, 0.22, { type: 'triangle', delay: 0.07, vol: 0.22 }); },
  oops: () => { tone(330, 0.1, { type: 'triangle', vol: 0.2 }); tone(233, 0.22, { type: 'triangle', delay: 0.09, slide: 0.8, vol: 0.2 }); },
  hurry: () => tone(880, 0.06, { vol: 0.1 }),
};

export function sfx(name) {
  if (muted || !ensure() || ctx.state !== 'running') return;
  if (SOUNDS[name]) SOUNDS[name]();
}

// A quiet walking-bass shuffle that loops under the whole game.
const BASS = [110, 0, 131, 147, 165, 0, 147, 131, 98, 0, 117, 131, 147, 165, 131, 117];
const STAB = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];

function schedule() {
  if (!ctx || ctx.state !== 'running' || muted) return;
  if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.05;
  while (nextNote < ctx.currentTime + 0.25) {
    const i = step % 16;
    const delay = nextNote - ctx.currentTime;
    if (BASS[i]) tone(BASS[i], 0.2, { type: 'triangle', vol: 0.11, delay });
    if (STAB[i]) for (const f of [330, 392, 494]) tone(f, 0.16, { type: 'sine', vol: 0.035, delay });
    // Swing: long step, short step.
    nextNote += i % 2 ? 0.11 : 0.19;
    step++;
  }
}

export function startMusic() {
  if (!musicTimer) musicTimer = setInterval(schedule, 80);
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() { return muted; }

// True when the browser is still waiting for a key press or click before allowing sound.
export function audioLocked() { return !ctx || ctx.state !== 'running'; }
