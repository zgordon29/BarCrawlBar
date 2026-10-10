// Scenery for the board: each bar is drawn as a themed room under its stretch of spaces.
import { WORLD, ZONES, ALLEY } from './map.js';
import { text } from '../draw.js';

function room(g, z, floorColor, wallColor) {
  g.beginPath();
  g.roundRect(z.x, z.y, z.w, z.h, 28);
  g.fillStyle = floorColor;
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = wallColor;
  g.stroke();
}

function sign(g, z, color, y = z.y + 62) {
  text(g, z.name, z.x + z.w / 2, y, { size: 46, weight: 900, color: '#fff', glow: color, blur: 26 });
  text(g, z.sub, z.x + z.w / 2, y + 40, { size: 20, weight: 700, color });
}

function table(g, x, y, r, top = '#5e3a18') {
  g.beginPath();
  g.arc(x, y + 6, r, 0, Math.PI * 2);
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = top;
  g.fill();
}

function poolTable(g, x, y, w, h) {
  g.fillStyle = '#4a2a12';
  g.beginPath(); g.roundRect(x - 10, y - 10, w + 20, h + 20, 12); g.fill();
  g.fillStyle = '#1f7a45';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#111';
  for (const [px, py] of [[0, 0], [w / 2, 0], [w, 0], [0, h], [w / 2, h], [w, h]]) {
    g.beginPath(); g.arc(x + px, y + py, 8, 0, Math.PI * 2); g.fill();
  }
  const balls = ['#fff', '#e2412f', '#ffc83d', '#4fa8ff'];
  balls.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(x + w * (0.3 + i * 0.14), y + h * (0.35 + (i % 2) * 0.3), 6, 0, Math.PI * 2); g.fill(); });
}

function dartboard(g, x, y, r) {
  ['#111', '#f3e7c9', '#2f8f4e', '#e2412f'].forEach((c, i) => {
    g.beginPath(); g.arc(x, y, r * (1 - i * 0.26), 0, Math.PI * 2); g.fillStyle = c; g.fill();
  });
}

function tv(g, x, y, w, h, t, kind) {
  g.fillStyle = '#0c0c10';
  g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
  g.fillStyle = kind ? '#c9853a' : '#2f8f4e';
  g.fillRect(x + 5, y + 5, w - 10, h - 10);
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x + w / 2 + Math.sin(t * 2 + x) * w * 0.3, y + h / 2 + Math.cos(t * 3 + x) * h * 0.2, 4, 0, Math.PI * 2);
  g.fill();
}

function sports(g, z, t) {
  const crimson = '#990000';
  const cream = '#f3e7c9';
  room(g, z, cream, crimson);
  // Candy stripes along the top wall.
  for (let x = z.x + 20; x < z.x + z.w - 20; x += 28) {
    g.fillStyle = ((x - z.x) / 28) % 2 < 1 ? crimson : '#fff';
    g.fillRect(x, z.y + 12, 14, 24);
  }
  // Centre-court circle on the floor.
  g.strokeStyle = 'rgba(153,0,0,.25)';
  g.lineWidth = 8;
  g.beginPath(); g.arc(z.x + z.w / 2, z.y + 320, 110, 0, Math.PI * 2); g.stroke();
  text(g, z.name, z.x + z.w / 2, z.y + 88, { size: 46, weight: 900, color: crimson, stroke: '#fff', strokeW: 8 });
  text(g, 'Sports Bar · above the sandwich shop on Kirkwood', z.x + z.w / 2, z.y + 128, { size: 17, weight: 700, color: crimson });
  tv(g, z.x + 60, z.y + 150, 110, 64, t, 0);
  tv(g, z.x + z.w - 170, z.y + 150, 110, 64, t, 1);
  // Banner.
  g.fillStyle = crimson;
  g.fillRect(z.x + 300, z.y + 160, 240, 44);
  text(g, 'GO HOOSIERS', z.x + 420, z.y + 183, { size: 24, weight: 900, color: cream });
  // Arcade basketball hoop. (The east side stays clear for the stairs down to Kirkwood.)
  g.fillStyle = '#fff';
  g.fillRect(z.x + 525, z.y + 350, 70, 50);
  g.strokeStyle = '#e2412f';
  g.lineWidth = 5;
  g.strokeRect(z.x + 545, z.y + 362, 30, 22);
  g.beginPath(); g.ellipse(z.x + 560, z.y + 404, 22, 7, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(z.x + 560, z.y + 430 + Math.abs(Math.sin(t * 3)) * -22, 13, 0, Math.PI * 2);
  g.fillStyle = '#e07b2a'; g.fill();
  poolTable(g, z.x + 280, z.y + 350, 170, 90);
  // Popcorn machine.
  g.fillStyle = crimson;
  g.fillRect(z.x + 80, z.y + 350, 60, 90);
  g.fillStyle = '#fffbe0';
  g.fillRect(z.x + 86, z.y + 356, 48, 44);
  g.fillStyle = '#ffc83d';
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(z.x + 94 + (i % 3) * 16, z.y + 390 - Math.floor(i / 3) * 10, 6, 0, Math.PI * 2); g.fill(); }
  text(g, 'FREE POPCORN', z.x + 110, z.y + 454, { size: 11, weight: 800, color: crimson });
}

function pub(g, z) {
  room(g, z, '#6b4423', '#2e1b0c');
  g.strokeStyle = 'rgba(0,0,0,.18)';
  g.lineWidth = 3;
  for (let y = z.y + 40; y < z.y + z.h - 10; y += 40) { g.beginPath(); g.moveTo(z.x + 14, y); g.lineTo(z.x + z.w - 14, y); g.stroke(); }
  sign(g, z, '#ffc83d', z.y + 88);
  // Fireplace.
  g.fillStyle = '#3a3a40';
  g.fillRect(z.x + 60, z.y + 330, 130, 120);
  g.fillStyle = '#111';
  g.fillRect(z.x + 80, z.y + 370, 90, 80);
  g.fillStyle = '#ff8a2a';
  g.beginPath(); g.moveTo(z.x + 95, z.y + 450); g.quadraticCurveTo(z.x + 125, z.y + 370, z.x + 155, z.y + 450); g.fill();
  g.fillStyle = '#ffd23d';
  g.beginPath(); g.moveTo(z.x + 110, z.y + 450); g.quadraticCurveTo(z.x + 125, z.y + 400, z.x + 140, z.y + 450); g.fill();
  // Barrels.
  for (const bx of [z.x + z.w - 150, z.x + z.w - 80]) {
    g.fillStyle = '#8a5a2b';
    g.beginPath(); g.ellipse(bx, z.y + 400, 30, 40, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3a40'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(bx - 29, z.y + 385); g.lineTo(bx + 29, z.y + 385); g.moveTo(bx - 29, z.y + 415); g.lineTo(bx + 29, z.y + 415); g.stroke();
  }
  // Long tables.
  g.fillStyle = '#3d2410';
  g.fillRect(z.x + 280, z.y + 370, 220, 34);
  g.fillRect(z.x + 280, z.y + 420, 220, 12);
  dartboard(g, z.x + 590, z.y + 180, 28);
}

function dive(g, z, t) {
  room(g, z, '#1f2a22', '#0c120e');
  // Grimy checkerboard floor.
  for (let y = z.y + 20; y < z.y + z.h - 30; y += 60) {
    for (let x = z.x + 20; x < z.x + z.w - 30; x += 60) {
      if (((x - z.x - 20) / 60 + (y - z.y - 20) / 60) % 2 < 1) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, y, 60, 60); }
    }
  }
  // Sticky puddles.
  g.fillStyle = 'rgba(180,140,40,.25)';
  for (const [px, py, pr] of [[150, 420, 46], [330, 640, 60], [200, 760, 36]]) {
    g.beginPath(); g.ellipse(z.x + px, z.y + py, pr, pr * 0.55, 0.3, 0, Math.PI * 2); g.fill();
  }
  sign(g, z, '#6ee27a', z.y + 100);
  // Flickering neon beer sign.
  const on = Math.sin(t * 9) > -0.7;
  text(g, 'BEER', z.x + 660, z.y + 140, { size: 44, weight: 900, color: on ? '#ff6b5e' : '#5a2a26', glow: on ? '#ff6b5e' : null });
  // The middle of the room stays clear for the way west along Kirkwood.
  poolTable(g, z.x + 250, z.y + 420, 200, 100);
  // Jukebox.
  g.fillStyle = '#7a2ea0';
  g.beginPath(); g.roundRect(z.x + 60, z.y + 740, 80, 120, [36, 36, 6, 6]); g.fill();
  g.fillStyle = `hsl(${(t * 80) % 360} 90% 60%)`;
  g.beginPath(); g.roundRect(z.x + 72, z.y + 754, 56, 40, [24, 24, 4, 4]); g.fill();
  table(g, z.x + 120, z.y + 420, 34, '#3a2a1a');
  table(g, z.x + 120, z.y + 540, 34, '#3a2a1a');
}

// Video Saloon: pool tables, a row of dartboards and arcade machines.
function speak(g, z, t) {
  room(g, z, '#161a33', '#4fd8ff');
  sign(g, z, '#4fd8ff', z.y + 340);
  for (const dx of [530, 630, 730, 830, 930, 1030]) {
    g.fillStyle = '#3d2410';
    g.fillRect(z.x + dx - 34, z.y + 14, 68, 68);
    dartboard(g, z.x + dx, z.y + 48, 28);
  }
  poolTable(g, z.x + 520, z.y + 100, 200, 80);
  poolTable(g, z.x + 750, z.y + 100, 200, 80);
  poolTable(g, z.x + 90, z.y + 310, 200, 90);
  // Arcade machines, screens flickering.
  ['#e2412f', '#ffd23d', '#6ee27a'].forEach((c, k) => {
    const ax = z.x + 40 + k * 85;
    g.fillStyle = '#16101f';
    g.beginPath(); g.roundRect(ax, z.y + 24, 56, 70, 8); g.fill();
    g.fillStyle = c;
    g.fillRect(ax, z.y + 24, 56, 12);
    g.fillStyle = Math.sin(t * 11 + k * 2) > -0.9 ? '#4fd8ff' : '#27506a';
    g.fillRect(ax + 8, z.y + 42, 40, 30);
  });
  table(g, z.x + 1290, z.y + 360, 34, '#1d2a4a');
  table(g, z.x + 1430, z.y + 360, 34, '#1d2a4a');
}

// A dancer silhouette on a pole (R-rated game only).
function dancer(g, x, y, t, flip, color) {
  g.save();
  g.translate(x, y);
  g.scale(flip, 1);
  g.strokeStyle = '#d9d9e6';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, -120); g.lineTo(0, 46); g.stroke();
  const sway = Math.sin(t * 2.4 + x) * 0.22;
  g.rotate(sway);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath(); g.arc(22, -66, 10, 0, Math.PI * 2); g.fill();          // head
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(22, -70); g.quadraticCurveTo(44, -62, 38, -40); g.stroke();   // hair
  g.lineWidth = 12;
  g.beginPath(); g.moveTo(20, -52); g.quadraticCurveTo(30, -30, 16, -8); g.stroke();    // body
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(20, -48); g.lineTo(2, -78); g.stroke();                       // arm on the pole
  g.beginPath(); g.moveTo(22, -44); g.lineTo(44, -34 + Math.sin(t * 3 + x) * 8); g.stroke();
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(16, -8); g.lineTo(6, 20); g.lineTo(2, 44); g.stroke();        // legs
  g.beginPath(); g.moveTo(16, -8); g.quadraticCurveTo(40, 6, 30, 40); g.stroke();
  g.restore();
}

function club(g, z, t, rating) {
  room(g, z, '#2a1038', '#ff4fa3');
  const adult = rating === 'r';
  // Lit dance-floor tiles.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const hue = (r * 70 + c * 50 + Math.floor(t * 2) * 40) % 360;
      g.fillStyle = `hsla(${hue} 90% 60% / .16)`;
      g.fillRect(z.x + 368 + c * 70, z.y + 414 + r * 68, 64, 62);
    }
  }
  // The name sits at the front of the room; the back is crossed by the ways in from Kirkwood.
  text(g, z.name, z.x + z.w / 2 + 110, z.y + 772, { size: 46, weight: 900, color: '#fff', glow: '#ff4fa3', blur: 26 });
  text(g, adult ? 'Gentlemen\'s Club' : 'Nightclub', z.x + z.w / 2 + 110, z.y + 812, { size: 20, weight: 700, color: '#ff4fa3' });
  // Stage.
  g.fillStyle = '#4a1a5e';
  g.beginPath(); g.roundRect(z.x + 320, z.y + 237, 440, 150, 30); g.fill();
  g.strokeStyle = '#ffc83d';
  g.lineWidth = 4;
  g.stroke();
  for (let k = 0; k < 9; k++) {
    g.beginPath(); g.arc(z.x + 332 + k * 52, z.y + 380, 5, 0, Math.PI * 2);
    g.fillStyle = Math.floor(t * 4 + k) % 2 ? '#ffc83d' : '#7a5a10'; g.fill();
  }
  if (adult) {
    dancer(g, z.x + 410, z.y + 336, t, 1, '#ff7ac2');
    dancer(g, z.x + 540, z.y + 336, t + 1.3, -1, '#7fd6ff');
    dancer(g, z.x + 670, z.y + 336, t + 2.1, 1, '#ffc83d');
  } else {
    // DJ booth.
    g.fillStyle = '#16101f';
    g.fillRect(z.x + 450, z.y + 290, 180, 70);
    for (const dx of [490, 590]) {
      g.beginPath(); g.arc(z.x + dx, z.y + 325, 24, 0, Math.PI * 2); g.fillStyle = '#0a0a0e'; g.fill();
      g.beginPath(); g.arc(z.x + dx + Math.cos(t * 4) * 12, z.y + 325 + Math.sin(t * 4) * 12, 4, 0, Math.PI * 2); g.fillStyle = '#ff4fa3'; g.fill();
    }
    text(g, 'DJ', z.x + 540, z.y + 266, { size: 26, weight: 900, color: '#4fd8ff', glow: '#4fd8ff' });
  }
  // Disco ball.
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
  for (let a = 0; a < 6; a++) {
    const ang = t * 0.8 + (a / 6) * Math.PI * 2;
    g.beginPath(); g.moveTo(z.x + 540, z.y + 513); g.lineTo(z.x + 540 + Math.cos(ang) * 110, z.y + 513 + Math.sin(ang) * 110); g.stroke();
  }
  g.beginPath(); g.arc(z.x + 540, z.y + 513, 26, 0, Math.PI * 2);
  g.fillStyle = '#c9c2d6'; g.fill();
  // Booths.
  g.fillStyle = '#7a1f4a';
  for (const by of [z.y + 390, z.y + 480]) { g.beginPath(); g.roundRect(z.x + 220, by, 100, 80, 24); g.fill(); }
}

// Kirkwood Avenue, the street the back ways cross.
function alley(g, z) {
  g.fillStyle = '#23232a';
  g.fillRect(z.x, z.y - 40, z.w, z.h + 80);
  g.strokeStyle = 'rgba(255,200,61,.5)';
  g.setLineDash([30, 26]);
  g.lineWidth = 6;
  for (const ly of [z.y + 96, z.y + z.h - 70]) { g.beginPath(); g.moveTo(z.x + 30, ly); g.lineTo(z.x + z.w - 30, ly); g.stroke(); }
  g.setLineDash([]);
  text(g, z.name, z.x + 180, z.y + 52, { size: 26, weight: 900, color: 'rgba(255,255,255,.4)' });
  text(g, 'Back alleys', z.x + z.w - 150, z.y + z.h - 34, { size: 18, weight: 700, color: 'rgba(255,255,255,.3)' });
  // Dumpster.
  g.fillStyle = '#2f5a3a';
  g.fillRect(z.x + z.w - 150, z.y + 36, 110, 56);
  g.fillStyle = '#244a2e';
  g.fillRect(z.x + z.w - 156, z.y + 26, 122, 14);
}

const PAINT = { sports, pub, dive, speak, club };

export function drawWorld(g, t, rating) {
  g.fillStyle = '#0d0a14';
  g.fillRect(-400, -400, WORLD.w + 800, WORLD.h + 800);
  alley(g, ALLEY);
  for (const z of ZONES) PAINT[z.id](g, z, t, rating);
}
