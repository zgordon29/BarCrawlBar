// The bar-crawl board in 3D: each bar is a room with a floor, a back wall with its sign, and
// furniture built from simple shapes. Spaces are raised discs, players walk between them, and
// the camera looks down from behind like a Mario Party board.
import { COLORS } from '../config.js';
import { text } from '../draw.js';
import { state } from '../state.js';
import { drunkLevel } from '../drunk.js';
import { MAP, TILE, ZONES, ALLEY } from '../board/map.js';
import { OVERVIEW, NEAR_ZOOM } from '../board/consts.js';

// Light on the board follows the state of the game, so a rule change is something you can see:
// warm and bright in Happy Hour, low and red for Last Call.
const MOODS = {
  normal: { sky: [1, 1, 1], sun: [1, 0.95, 0.87], level: 1 },
  happy: { sky: [1, 0.9, 0.62], sun: [1, 0.82, 0.45], level: 1.18 },
  last: { sky: [1, 0.62, 0.62], sun: [1, 0.55, 0.5], level: 0.82 },
};

// ---- textures ----

function labelTexture(s, label, ink) {
  return s.paint(128, 128, (g) => {
    text(g, label, 64, 68, { size: label.length > 4 ? 34 : label.length > 2 ? 42 : 64, weight: 900, color: ink || '#140f1f' });
  });
}

function signTexture(s, w, h, paint) {
  return s.paint(w * 2, h * 2, (g) => { g.scale(2, 2); paint(g, w, h); });
}

// Floor textures are painted at half size; they only need to carry colour and pattern.
function floorTexture(s, z, paint) {
  return s.paint(Math.round(z.w / 2), Math.round(z.h / 2), (g) => {
    g.scale(0.5, 0.5);
    paint(g, z.w, z.h);
  });
}

const FLOORS = {
  sports(g, w, h) {
    g.fillStyle = '#f3e7c9'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(153,0,0,.3)'; g.lineWidth = 10;
    g.beginPath(); g.arc(w / 2, 270, 120, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#990000'; g.lineWidth = 24; g.strokeRect(0, 0, w, h);
  },
  pub(g, w, h) {
    g.fillStyle = '#6b4423'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 4;
    for (let y = 40; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#2e1b0c'; g.lineWidth = 24; g.strokeRect(0, 0, w, h);
  },
  dive(g, w, h) {
    g.fillStyle = '#1f2a22'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 0; y < h; y += 60) for (let x = (y / 60) % 2 ? 60 : 0; x < w; x += 120) g.fillRect(x, y, 60, 60);
    g.fillStyle = 'rgba(180,140,40,.3)';
    for (const [px, py, pr] of [[150, 420, 46], [330, 720, 60], [560, 560, 40]]) { g.beginPath(); g.ellipse(px, py, pr, pr * 0.6, 0.3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#0c120e'; g.lineWidth = 24; g.strokeRect(0, 0, w, h);
  },
  // The two bars in the front row have their names painted on the floor, in the strip nearest
  // the camera: a standing sign there would block the view of the bars behind them.
  speak(g, w, h) {
    // Arcade carpet: dark blue with a scatter of small neon shapes.
    g.fillStyle = '#161a33'; g.fillRect(0, 0, w, h);
    const neon = ['#4fd8ff', '#ff4fa3', '#ffd23d', '#6ee27a'];
    g.lineWidth = 5; g.lineCap = 'round';
    for (let k = 0; k < 150; k++) {
      const x = (k * 197) % w;
      const y = (k * 331) % h;
      g.strokeStyle = neon[k % 4];
      g.globalAlpha = 0.3;
      g.beginPath();
      if (k % 3 === 0) { g.moveTo(x, y); g.lineTo(x + 12, y - 12); g.lineTo(x + 24, y); g.lineTo(x + 36, y - 12); }
      else if (k % 3 === 1) g.arc(x, y, 9, 0, Math.PI * 2);
      else { g.moveTo(x, y); g.lineTo(x + 18, y); g.lineTo(x + 9, y - 16); g.closePath(); }
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = '#4fd8ff'; g.lineWidth = 20; g.strokeRect(0, 0, w, h);
    text(g, 'VIDEO SALOON', w / 2, 352, { size: 76, weight: 900, color: '#fff', glow: '#4fd8ff', blur: 26 });
    text(g, 'POOL · DARTS · ARCADE', w / 2, 408, { size: 28, weight: 800, color: '#4fd8ff' });
  },
  club(g, w, h) {
    g.fillStyle = '#2a1038'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff4fa3'; g.lineWidth = 20; g.strokeRect(0, 0, w, h);
    text(g, 'NIGHT MOVES', w / 2 + 110, 772, { size: 76, weight: 900, color: '#fff', glow: '#ff4fa3', blur: 26 });
    text(g, state.settings.rating === 'r' ? 'GENTLEMEN\'S CLUB' : 'NIGHTCLUB', w / 2 + 110, 828, { size: 28, weight: 800, color: '#ff4fa3' });
  },
  // Kirkwood Avenue: the street the back ways cross, with a centre line and a crosswalk.
  alley(g, w, h) {
    g.fillStyle = '#23232a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,200,61,.5)'; g.lineWidth = 8; g.setLineDash([36, 30]);
    g.beginPath(); g.moveTo(30, 96); g.lineTo(w - 30, 96); g.stroke();
    g.beginPath(); g.moveTo(30, h - 70); g.lineTo(w - 30, h - 70); g.stroke();
    g.setLineDash([]);
    text(g, 'KIRKWOOD AVE', 180, 52, { size: 34, weight: 900, color: 'rgba(255,255,255,.4)' });
    text(g, 'BACK ALLEYS', w - 150, h - 34, { size: 24, weight: 900, color: 'rgba(255,255,255,.28)' });
  },
};

// ---- building the fixed scenery ----

function wallSign(s, z, w, h, zBase, y, colors, sub) {
  const tex = signTexture(s, w, h, (g) => {
    if (colors.bg) { g.fillStyle = colors.bg; g.fillRect(0, 0, w, h); }
    if (colors.stripes) {
      for (let x = 10; x < w - 10; x += 28) { g.fillStyle = (x / 28) % 2 < 1 ? '#990000' : '#ffffff'; g.fillRect(x, 6, 14, 22); }
    }
    text(g, z.name, w / 2, h * 0.46, { size: h * 0.36, weight: 900, color: colors.ink, glow: colors.glow, blur: 18, stroke: colors.stroke, strokeW: 8 });
    text(g, sub, w / 2, h * 0.8, { size: h * 0.15, weight: 800, color: colors.sub || colors.ink });
  });
  return s.fixedSign(z.x + z.w / 2 + (colors.dx || 0), y, zBase, w, h, tex);
}

// A dartboard hung on a wall, facing the camera.
function dartboard(s, x, y, z) {
  ['#111111', '#f3e7c9', '#2f8f4e', '#e2412f'].forEach((c, i) => {
    const m = s.fixed('cyl', c, { shadow: false });
    const r = 30 * (1 - i * 0.26);
    m.scale.set(r, 4 + i * 2, r);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, z, y);
  });
}

function poolTable(s, x, y, w, d) {
  s.fixedBox(x, y, w, d, 40, '#4a2a12');
  s.fixedBox(x, y, w - 16, d - 16, 5, '#1f7a45', { z: 40 });
  ['#ffffff', '#e2412f', '#ffc83d', '#4fa8ff'].forEach((c, i) => {
    s.fixedBall(x - w * 0.2 + i * w * 0.14, y - d * 0.15 + (i % 2) * d * 0.3, 51, 6, c, { shadow: false });
  });
}

function roundTable(s, x, y, color) {
  s.fixedCyl(x, y, 8, 40, '#1b1320');
  s.fixedCyl(x, y, 38, 6, color, { z: 40 });
}

// An arcade machine with a lit screen and marquee, facing the camera.
function arcade(s, x, y, color, k) {
  s.fixedBox(x, y, 58, 44, 104, '#16101f');
  s.fixedBox(x, y + 16, 58, 24, 8, color, { z: 40 });
  const screen = s.fixedSign(x, y + 23, 52, 44, 34, signTexture(s, 44, 34, (g) => {
    g.fillStyle = '#05060c'; g.fillRect(0, 0, 44, 34);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = ['#4fd8ff', '#ff4fa3', '#ffd23d', '#6ee27a'][(i + k) % 4];
      g.fillRect(4 + ((i * 7 + k * 5) % 34), 4 + ((i * 11 + k * 3) % 24), 4, 4);
    }
  }));
  s.fixedSign(x, y + 23, 90, 50, 12, signTexture(s, 50, 12, (g) => {
    g.fillStyle = color; g.fillRect(0, 0, 50, 12);
    text(g, ['ZAP', 'PONG', 'HOOPS'][k % 3], 25, 7, { size: 10, weight: 900, color: '#140f1f' });
  }));
  s.animate((t) => { screen.material.opacity = Math.sin(t * 11 + k * 2) > -0.9 ? 1 : 0.55; });
}

// A stylised pole dancer made of simple shapes (R-rated game only).
function dancer(s, x, y, color, phase) {
  const T = s.THREE;
  const group = new T.Group();
  const mat = new T.MeshStandardMaterial({ color, roughness: 0.5 });
  const part = (geo, px, py, pz, rz = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.z = rz;
    m.castShadow = true;
    group.add(m);
    return m;
  };
  part(new T.SphereGeometry(11, 16, 12), 22, 118, 0);                     // head
  part(new T.CapsuleGeometry(10, 34, 6, 12), 20, 82, 0, 0.12);            // body
  part(new T.CapsuleGeometry(6, 44, 6, 10), 12, 30, 5, 0.12);             // legs
  part(new T.CapsuleGeometry(6, 44, 6, 10), 30, 32, -5, -0.25);
  part(new T.CapsuleGeometry(4, 34, 6, 8), 8, 110, 0, 1.0);               // arm on the pole
  part(new T.CapsuleGeometry(4, 30, 6, 8), 40, 92, 0, -0.9);
  group.position.set(x, 30, y);
  s.view.fixed.add(group);
  s.animate((t) => {
    group.rotation.y = Math.sin(t * 1.3 + phase) * 1.2;
    group.position.y = 30 + Math.abs(Math.sin(t * 2.6 + phase)) * 8;
  });
}

function build(s, rating) {
  const T = s.THREE;
  s.fixedFlat(1300, 750, 9000, 8000, '#0d0a14', { z: -2 });

  for (const z of [...ZONES, ALLEY]) {
    s.fixedFlat(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, '#ffffff', { map: floorTexture(s, z, FLOORS[z.id]) });
  }
  const [sports, pub, dive] = ZONES;

  // The Upstairs Pub: cream and crimson, candy stripes, TVs, pool, an arcade hoop and free
  // popcorn. The east side is kept clear for the stairs down to Kirkwood.
  s.fixedBox(480, 58, 840, 16, 170, '#f3e7c9');
  wallSign(s, sports, 560, 120, 44, 67, { ink: '#990000', stroke: '#ffffff', stripes: true }, 'SPORTS BAR · GO HOOSIERS');
  for (const [x, c] of [[130, '#2f8f4e'], [830, '#c9853a']]) {
    s.fixedBox(x, 70, 110, 10, 74, '#0c0c10', { z: 62 });
    s.fixedBox(x, 77, 94, 4, 58, c, { z: 70, glow: 0.7, shadow: false });
  }
  poolTable(s, 420, 445, 180, 96);
  s.fixedCyl(620, 420, 5, 100, '#8a8a94');
  s.fixedBox(620, 424, 76, 6, 56, '#f2f2f2', { z: 96 });
  const rim = s.fixed('torus', '#e2412f', { shadow: false });
  rim.scale.setScalar(18);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(620, 108, 448);
  const ball = s.fixedBall(620, 448, 60, 13, '#e07b2a');
  s.animate((t) => { ball.position.y = 16 + Math.abs(Math.sin(t * 3)) * 84; });
  s.fixedBox(130, 430, 62, 52, 64, '#990000');
  s.fixedBox(130, 430, 54, 44, 46, '#fffbe0', { z: 64, opacity: 0.45, shadow: false });
  for (let i = 0; i < 6; i++) s.fixedBall(116 + (i % 3) * 14, 426 + Math.floor(i / 3) * 10, 74 + (i % 2) * 8, 7, '#ffc83d', { shadow: false });
  s.fixedBox(130, 430, 62, 52, 10, '#990000', { z: 110 });

  // Nick's English Hut: wood, a fireplace, barrels, a long table and the bucket game.
  s.fixedBox(1340, 58, 800, 16, 170, '#2e1b0c');
  wallSign(s, pub, 560, 110, 50, 67, { ink: '#ffffff', glow: '#ffc83d', sub: '#ffc83d', dx: 30 }, 'PUB · SINCE 1927');
  roundTable(s, 1490, 440, '#3d2410');
  s.fixedCyl(1490, 440, 17, 20, '#c9d2e0', { z: 46, metal: 0.6, rough: 0.3 });
  s.fixedCyl(1490, 440, 6, 9, '#fff7e6', { z: 60, opacity: 0.7, shadow: false });
  s.fixedBox(1022, 92, 150, 50, 130, '#3a3a40');
  s.fixedBox(1022, 118, 96, 6, 84, '#111111', { shadow: false });
  const flame = s.fixed('cone', '#ff8a2a', { glow: 1.2, shadow: false });
  flame.position.set(1022, 30, 126);
  s.animate((t) => { flame.scale.set(26 + Math.sin(t * 9) * 4, 56 + Math.sin(t * 13) * 10, 12); flame.position.y = flame.scale.y / 2; });
  for (const bx of [1600, 1676]) {
    s.fixedCyl(bx, 440, 32, 80, '#8a5a2b');
    s.fixedCyl(bx, 440, 33.5, 6, '#3a3a40', { z: 16 });
    s.fixedCyl(bx, 440, 33.5, 6, '#3a3a40', { z: 58 });
  }
  s.fixedBox(1150, 430, 220, 46, 8, '#3d2410', { z: 40 });
  for (const [dx, dy] of [[-100, -16], [100, -16], [-100, 16], [100, 16]]) s.fixedBox(1150 + dx, 430 + dy, 8, 8, 40, '#2a1a0c');
  s.fixedBox(1150, 478, 220, 18, 22, '#3d2410');
  dartboard(s, 1700, 70, 100);

  // Root Cellar: a basement dive, with the stairs down in the corner, pool, a jukebox and a
  // flickering beer sign. The middle is kept clear for the way west along Kirkwood.
  s.fixedBox(2160, 58, 760, 16, 170, '#0c120e');
  wallSign(s, dive, 520, 120, 44, 67, { ink: '#ffffff', glow: '#6ee27a', sub: '#6ee27a', dx: -90 }, 'BASEMENT BAR');
  const beer = s.fixedSign(2430, 68, 70, 150, 70, signTexture(s, 150, 70, (g) => {
    text(g, 'BEER', 75, 37, { size: 52, weight: 900, color: '#ff6b5e', glow: '#ff6b5e', blur: 16 });
  }));
  s.animate((t) => { beer.material.opacity = Math.sin(t * 9) > -0.7 ? 1 : 0.25; });
  for (let k = 0; k < 4; k++) s.fixedBox(1832, 96 + k * 26, 76, 26, 100 - k * 25, '#3a3a40');
  poolTable(s, 2130, 520, 210, 110);
  s.fixedBox(1880, 850, 84, 54, 124, '#7a2ea0');
  const juke = s.fixedBox(1880, 878, 58, 4, 44, '#ffffff', { z: 66, glow: 0.9, shadow: false });
  s.animate((t) => { juke.material.color.setHSL((t * 0.2) % 1, 0.9, 0.6); juke.material.emissive.copy(juke.material.color); });
  roundTable(s, 1900, 470, '#3a2a1a');
  roundTable(s, 1900, 590, '#3a2a1a');
  roundTable(s, 2110, 860, '#3a2a1a');

  // Video Saloon: pool tables, a row of dartboards on the back wall and arcade machines. The
  // wall has gaps where the back alley and the back door come through.
  for (const [x0, x1] of [[1000, 1322], [1472, 2130], [2250, 2305], [2455, 2540]]) {
    s.fixedBox((x0 + x1) / 2, 998, x1 - x0, 16, 70, '#0e1322');
    s.fixedBox((x0 + x1) / 2, 998, x1 - x0, 20, 6, '#4fd8ff', { z: 70, glow: 0.5 });
  }
  for (const dx of [1530, 1630, 1730, 1830, 1930, 2030]) {
    s.fixedBox(dx, 1008, 74, 6, 96, '#3d2410');
    dartboard(s, dx, 1014, 56);
  }
  poolTable(s, 1620, 1105, 200, 100);
  poolTable(s, 1850, 1105, 200, 100);
  poolTable(s, 1190, 1350, 200, 100);
  [[1065, '#e2412f'], [1150, '#ffd23d'], [1235, '#6ee27a']].forEach(([ax, color], k) => arcade(s, ax, 1042, color, k));
  for (const tx of [2290, 2430]) {
    roundTable(s, tx, 1350, '#1d2a4a');
    s.fixedCyl(tx, 1350, 7, 14, '#f2a51d', { z: 46, opacity: 0.85, shadow: false });
  }

  // Night Moves: a stage, a lit dance floor and a disco ball. Dancers only in the R-rated game.
  // The back wall has gaps for the crawl, the stairs down from the Upstairs Pub and the side street.
  for (const [x0, x1] of [[60, 150], [290, 725], [840, 886]]) {
    s.fixedBox((x0 + x1) / 2, 578, x1 - x0, 16, 70, '#3a0f3a');
    s.fixedBox((x0 + x1) / 2, 578, x1 - x0, 20, 6, '#ff4fa3', { z: 70, glow: 0.5 });
  }
  // The stage is kept low and well forward of the way in from Kirkwood, so nothing on it hides
  // a space behind it.
  s.fixedBox(600, 896, 440, 128, 30, '#4a1a5e');
  s.fixedBox(600, 961, 444, 6, 34, '#ffc83d');
  const bulbs = [];
  for (let k = 0; k < 9; k++) bulbs.push(s.fixedBall(392 + k * 52, 965, 36, 6, '#ffc83d', { glow: 1, shadow: false }));
  s.animate((t) => { bulbs.forEach((b, k) => { b.material.emissiveIntensity = Math.floor(t * 4 + k) % 2 ? 1.4 : 0.15; }); });
  if (rating === 'r') {
    [[470, '#ff7ac2'], [600, '#7fd6ff'], [730, '#ffc83d']].forEach(([px, color], k) => {
      s.fixedCyl(px, 916, 5, 160, '#d9d9e6', { z: 30, metal: 0.8, rough: 0.3 });
      dancer(s, px, 916, color, k * 1.9);
    });
  } else {
    s.fixedBox(600, 900, 210, 70, 56, '#16101f', { z: 30 });
    const decks = [550, 650].map((dx) => s.fixedCyl(dx, 900, 26, 5, '#0a0a0e', { z: 86 }));
    const dots = decks.map((d) => s.fixedBall(d.position.x, 900, 93, 4, '#ff4fa3', { glow: 1, shadow: false }));
    s.animate((t) => { dots.forEach((d, k) => { d.position.x = decks[k].position.x + Math.cos(t * 4) * 14; d.position.z = 900 + Math.sin(t * 4) * 14; }); });
  }
  const tiles = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) tiles.push({ m: s.fixedFlat(460 + c * 70, 1015 + r * 68, 64, 62, '#ffffff', { z: 1, glow: 0.5 }), r, c });
  s.animate((t) => {
    for (const { m, r, c } of tiles) {
      m.material.color.setHSL(((r * 70 + c * 50 + Math.floor(t * 2) * 40) % 360) / 360, 0.9, 0.5);
      m.material.emissive.copy(m.material.color);
    }
  });
  const disco = s.fixed('ball', '#d9d9e6', { geo: new T.IcosahedronGeometry(1, 1), metal: 0.9, rough: 0.2, flatShading: true });
  disco.scale.setScalar(34);
  disco.position.set(600, 300, 1083);
  s.animate((t) => { disco.rotation.y = t * 0.8; });
  s.fixedBox(330, 1000, 100, 80, 50, '#7a1f4a');
  s.fixedBox(330, 1090, 100, 80, 50, '#7a1f4a');

  // Kirkwood Avenue and the back alleys.
  s.fixedBox(1645, 630, 110, 56, 70, '#2f5a3a');
  s.fixedBox(1645, 630, 120, 62, 10, '#244a2e', { z: 70 });
  for (const [lx, ly] of [[1040, 600], [1710, 920], [1040, 920]]) {
    s.fixedCyl(lx, ly, 6, 210, '#33333a');
    s.fixedBall(lx, ly, 220, 14, '#ffe9a8', { glow: 1.6, shadow: false });
  }

  // The route: a wide cream road with a dark kerb, so it reads on every floor from the cream
  // sports bar to the near-black saloon. The spaces sit on it like stepping stones, and a
  // chevron on each stretch shows which way the crawl runs.
  const chevron = new T.Shape();
  chevron.moveTo(15, 0); chevron.lineTo(-9, 14); chevron.lineTo(-2, 0); chevron.lineTo(-9, -14); chevron.closePath();
  const chevronGeo = new T.ShapeGeometry(chevron).rotateX(-Math.PI / 2);
  for (const n of MAP.nodes) {
    for (const id of n.next) {
      const m = MAP.nodes[id];
      const len = Math.hypot(m.x - n.x, m.y - n.y);
      const turn = -Math.atan2(m.y - n.y, m.x - n.x);
      const mx = (n.x + m.x) / 2;
      const my = (n.y + m.y) / 2;
      // Back ways are a little narrower and greyer than the main crawl.
      const side = n.spur || m.spur;
      [['#140f1f', side ? 52 : 62, 1.2], [side ? '#d9d2c2' : '#f6e7b8', side ? 42 : 50, 1.8]].forEach(([color, width, y]) => {
        const strip = s.fixed('flat', color);
        strip.scale.set(len, 1, width);
        strip.position.set(mx, y, my);
        strip.rotation.y = turn;
      });
      const arrow = s.fixed('flat', side ? '#6f6488' : '#c9741e', { geo: chevronGeo, shadow: false });
      arrow.position.set(mx, 2.4, my);
      arrow.rotation.y = turn;
    }
  }

  // Forks get a bright ring: decision points should stand out from everything around them.
  for (const id of Object.keys(MAP.forks)) {
    const fork = MAP.nodes[id];
    const forkRing = s.fixed('torus', '#ffd23d', { geo: new T.TorusGeometry(46, 4, 8, 40), glow: 0.9, shadow: false });
    forkRing.rotation.x = Math.PI / 2;
    forkRing.position.set(fork.x, 5, fork.y);
  }

  // Every place the bottle cap can turn up is marked, so players can plan for where it goes next.
  for (const id of MAP.capSpots) {
    const n = MAP.nodes[id];
    const ring = s.fixed('torus', '#ffd23d', { geo: new T.TorusGeometry(42, 2.5, 6, 36), opacity: 0.45, shadow: false });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(n.x, 4, n.y);
  }

  // Landmarks for the pass-by services, set just behind the route so they never hide a space.
  for (const n of MAP.nodes) {
    if (n.type === 'shop') {
      // A stall with a striped awning.
      s.fixedBox(n.x, n.y - 74, 96, 40, 52, '#8a5a2b');
      s.fixedBox(n.x, n.y - 62, 110, 60, 8, '#e2412f', { z: 84 });
      for (let k = -2; k <= 2; k += 2) s.fixedBox(n.x + k * 22, n.y - 62, 20, 61, 9, '#fff7e6', { z: 84 });
      s.fixedCyl(n.x - 48, n.y - 44, 3, 84, '#5e3a18');
      s.fixedCyl(n.x + 48, n.y - 44, 3, 84, '#5e3a18');
      s.fixedSign(n.x, n.y - 53, 56, 80, 26, signTexture(s, 80, 26, (g) => {
        text(g, 'SHOP', 40, 14, { size: 22, weight: 900, color: '#fff7e6', stroke: '#140f1f', strokeW: 5 });
      }));
    } else if (n.type === 'hustler') {
      // The Hustler: long coat, hat pulled down, waiting on the corner where the back ways cross.
      // He stands in a pool of lamplight, so he can be found on the dark street.
      const hx = n.x + 82;
      const hy = n.y - 92;
      s.fixedCyl(hx, hy, 62, 2, '#ffe9a8', { glow: 0.55, opacity: 0.5, shadow: false });
      s.fixedCyl(hx + 44, hy - 30, 5, 190, '#33333a');
      s.fixedBall(hx + 44, hy - 30, 198, 13, '#ffe9a8', { glow: 1.6, shadow: false });
      s.fixedCyl(hx, hy, 20, 66, '#5a4691');
      s.fixedBall(hx, hy, 80, 15, '#e8b98a');
      s.fixedCyl(hx, hy, 25, 4, '#140f1f', { z: 88 });
      s.fixedCyl(hx, hy, 15, 16, '#140f1f', { z: 90 });
      s.fixedSign(hx, hy + 22, 108, 150, 32, signTexture(s, 150, 32, (g) => {
        text(g, 'THE HUSTLER', 75, 17, { size: 20, weight: 900, color: '#ffd23d', stroke: '#140f1f', strokeW: 6 });
      }));
    } else if (n.type === 'bank') {
      // The tip jar itself is drawn each frame, because it fills up.
      s.fixedCyl(n.x + 74, n.y, 34, 30, '#5e3a18');
    }
  }

  // The spaces themselves: a raised disc (or a square for pass-by services) with its label on top.
  const labels = new Map();
  const labelFor = (label, ink) => {
    const key = label + (ink || '');
    if (!labels.has(key)) labels.set(key, labelTexture(s, label, ink));
    return labels.get(key);
  };
  s.view.data.swap = [];
  for (const n of MAP.nodes) {
    const tile = TILE[n.type];
    // A pale rim (gold on the dark special spaces) and a slight glow keep every space bright,
    // even in the dim bars: the route must always be the easiest thing on screen to read.
    const rimColor = tile.ink ? '#ffd23d' : '#fff7e6';
    if (tile.pass) {
      s.fixedBox(n.x, n.y, 74, 74, 6, rimColor, { glow: 0.25 });
      s.fixedBox(n.x, n.y, 62, 62, 12, tile.color, { glow: 0.3 });
    } else {
      s.fixedCyl(n.x, n.y, 36, 6, rimColor, { glow: 0.25 });
      s.fixedCyl(n.x, n.y, 30, 12, tile.color, { glow: 0.3 });
    }
    const top = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: labelFor(tile.label, tile.ink), transparent: true }));
    top.scale.set(50, 1, 50);
    top.position.set(n.x, 12.6, n.y);
    s.view.fixed.add(top);
    // Coin spaces show +6 / -6 during Last Call.
    if (n.type === 'coin') s.view.data.swap.push({ top, normal: labelFor('+3'), late: labelFor('+6') });
    if (n.type === 'bad') s.view.data.swap.push({ top, normal: labelFor('-3'), late: labelFor('-6') });
  }

  // The bottle cap: a crimped gold disc with a red centre, standing on edge and spinning.
  const cap = new T.Group();
  const gold = new T.Mesh(new T.CylinderGeometry(30, 26, 9, 18).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: '#ffd23d', metalness: 0.6, roughness: 0.3, flatShading: true }));
  gold.castShadow = true;
  cap.add(gold);
  for (const dz of [-5, 5]) {
    const face = new T.Mesh(new T.CircleGeometry(19, 24), new T.MeshStandardMaterial({ color: '#e2412f', roughness: 0.4 }));
    face.position.z = dz;
    if (dz < 0) face.rotation.y = Math.PI;
    cap.add(face);
  }
  s.view.fixed.add(cap);
  s.view.data.cap = cap;
}

// ---- drawing a frame ----

// b is the BoardScene. Draws the world in 3D, and the few labels that float over it in 2D.
export function drawBoard3D(s, b, g) {
  const rating = state.settings.rating;
  if (s.use('board:' + rating)) build(s, rating);
  const data = s.view.data;
  if (data.late !== b.lastCall) {
    data.late = b.lastCall;
    for (const sw of data.swap) { sw.top.material.map = b.lastCall ? sw.late : sw.normal; sw.top.material.needsUpdate = true; }
  }

  // The 2D camera's centre and zoom become a 3D camera that pulls back and tips up for the overview.
  const k = Math.max(0, Math.min(1, (b.cam.s - OVERVIEW) / (NEAR_ZOOM - OVERVIEW)));
  s.cam(b.cam.x, b.cam.y + (1 - k) * 130, 2700 - k * 1600, 64 - k * 14);

  // Ease the lighting towards the mood of the moment.
  const mood = MOODS[b.happyHour ? 'happy' : b.lastCall ? 'last' : 'normal'];
  const now = data.mood || (data.mood = { sky: [...mood.sky], sun: [...mood.sun], level: mood.level });
  for (let c = 0; c < 3; c++) {
    now.sky[c] += (mood.sky[c] - now.sky[c]) * 0.04;
    now.sun[c] += (mood.sun[c] - now.sun[c]) * 0.04;
  }
  now.level += (mood.level - now.level) * 0.04;
  s.view.hemi.color.setRGB(now.sky[0], now.sky[1], now.sky[2]);
  s.view.hemi.intensity = 1.5 * now.level;
  s.view.sun.color.setRGB(now.sun[0], now.sun[1], now.sun[2]);
  s.view.sun.intensity = 2.2 * now.level;

  // Labels that float over the world.
  const label = (str, x, y, z, color, size = 18) => {
    const at = s.project(x, y, z);
    if (!at.behind) text(g, str, at.x, at.y, { size, weight: 900, color, stroke: '#140f1f', strokeW: 5 });
  };

  const ps = state.players;
  ps.forEach((p, i) => {
    const v = b.vis[i];
    const node = MAP.nodes[p.node];
    // Fan out players who share a space.
    const mates = ps.filter((q) => q.node === p.node);
    const shared = mates.length > 1 && !v.moving;
    const ox = shared ? (mates.indexOf(p) - (mates.length - 1) / 2) * 44 : 0;
    const oy = shared ? 8 : 0;
    const active = i === b.turn;
    // Each player is picked out three ways at once: their character's shape, a ring in their
    // colour at their feet, and their label overhead.
    s.torus(v.x + ox, v.y + oy, 15, active ? 40 : 33, p.color, { tube: active ? 5 : 3.5, glow: active ? 0.9 : 0.4 });
    s.char('token' + i, p.char, v.x + ox, v.y + oy, {
      r: active ? 34 : 28, z: 12, t: b.t, drunk: drunkLevel(p.sips), phase: i, moving: v.moving, walk: v.walk,
      hop: v.moving ? Math.abs(Math.sin(v.walk * 14)) * 16 : 0,
      face: v.moving ? Math.atan2(node.y - v.y, node.x - v.x) : undefined,
    });
    if (active) {
      s.cone(v.x + ox, v.y + oy, 13, 26, p.color, { z: 122 + Math.sin(b.t * 6) * 6, flip: true, glow: 0.7, shadow: false });
    } else if (k > 0.5) {
      label(p.label, v.x + ox, v.y + oy, 96, p.color, 14);
    }
  });

  // At the fork, an arrow on the ground for each way; the one currently chosen lights up.
  if (b.phase === 'branch') {
    const at = MAP.nodes[b.player.node];
    at.next.forEach((id, n) => {
      const to = MAP.nodes[id];
      const a = Math.atan2(to.y - at.y, to.x - at.x);
      const on = b.sel === n;
      const color = on ? '#ffd23d' : '#8a8494';
      const reach = 96 + (on ? Math.sin(b.t * 8) * 8 : 0);
      const tx = at.x + Math.cos(a) * reach;
      const ty = at.y + Math.sin(a) * reach;
      const o = { glow: on ? 1 : 0.2, shadow: false };
      s.beam(at.x + Math.cos(a) * 44, at.y + Math.sin(a) * 44, 22, tx, ty, 22, 9, color, o);
      for (const side of [-1, 1]) {
        const h = a + Math.PI + side * 0.6;
        s.beam(tx, ty, 22, tx + Math.cos(h) * 30, ty + Math.sin(h) * 30, 22, 9, color, o);
      }
    });
  }

  // The bottle cap hovers over its space; when it has just moved it drops in from above.
  const capNode = MAP.nodes[b.G.capNode];
  const drop = (1 - b.capDrop) * (1 - b.capDrop) * 700;
  const capY = 118 + Math.sin(b.t * 4) * 8 + drop;
  data.cap.position.set(capNode.x, capY, capNode.y);
  data.cap.rotation.y = b.t * 2.4;
  s.torus(capNode.x, capNode.y, 14, 44, '#ffd23d', { glow: 0.8, tube: 4 });
  label(b.happyHour ? `${b.capCost()} coins · HALF PRICE` : `${b.capCost()} coins`, capNode.x, capNode.y, capY + 50, COLORS.gold);

  for (const n of MAP.nodes) {
    if (n.type === 'bank') {
      // The tip jar fills as players tip into it, so the size of the prize is visible from afar.
      const fill = Math.min(1, b.G.pot / 60);
      if (fill > 0) s.cyl(n.x + 74, n.y, 20, 4 + fill * 44, '#ffd23d', { z: 30, glow: 0.4 });
      s.cyl(n.x + 74, n.y, 24, 54, '#d6f1ff', { z: 30, opacity: 0.3 });
      label(`${b.G.pot} in the jar`, n.x + 74, n.y, 104, COLORS.gold, 15);
    } else if (n.type === 'shop' && b.happyHour) {
      label('HALF PRICE', n.x, n.y - 62, 124 + Math.sin(b.t * 5) * 5, COLORS.gold, 16);
    }
  }
  for (const q of b.pops) {
    g.globalAlpha = Math.max(0, 1 - q.t / 1.8);
    label(q.s, q.gx, q.gy, 120 + q.stack * 40 + q.t * 40, q.color, 26);
    g.globalAlpha = 1;
  }
}
