import { W, H } from './config.js';
import { Input } from './input.js';
import { TitleScene } from './scenes/title.js';
import { toggleMute } from './audio.js';
import { stage } from './gl/stage.js';

const canvas = document.getElementById('game');
const glCanvas = document.getElementById('gl');
const g = canvas.getContext('2d');
let scale = 1;

const game = {
  input: new Input(),
  scene: null,
  time: 0,
  paused: false,
  go(scene) {
    this.scene = scene;
    scene.game = this;
    if (scene.enter) scene.enter();
  },
  // Return to a scene that was left open, without restarting it.
  resume(scene) {
    this.scene = scene;
  },
  // Advance a fixed number of frames by hand (used for testing with paused = true).
  step(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) tick(dt);
    render();
  },
};
window.__game = game;
window.__stage = stage;

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const css = Math.min(window.innerWidth / W, window.innerHeight / H);
  for (const el of [canvas, glCanvas]) {
    el.style.width = W * css + 'px';
    el.style.height = H * css + 'px';
    el.style.left = (window.innerWidth - W * css) / 2 + 'px';
    el.style.top = (window.innerHeight - H * css) / 2 + 'px';
  }
  canvas.width = Math.round(W * css * dpr);
  canvas.height = Math.round(H * css * dpr);
  scale = canvas.width / W;
  stage.resize(W * css, H * css, dpr);
}

function tick(dt) {
  game.input.poll();
  if (game.input.keyPressed('KeyM')) toggleMute();
  // V switches between the 3D view and the original flat one.
  if (game.input.keyPressed('KeyV')) stage.enabled = !stage.enabled;
  game.time += dt;
  game.scene.update(dt);
}

// Scenes draw their menus and labels on the 2D canvas, and may also put things in the 3D
// world through `stage`; whatever they put there is rendered underneath.
function render() {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, W, H);
  stage.begin();
  game.scene.draw(g);
  stage.end(game.time);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.paused) tick(dt);
  render();
  requestAnimationFrame(frame);
}

stage.init(glCanvas);
window.addEventListener('resize', fit);
fit();
game.go(new TitleScene());
requestAnimationFrame(frame);
