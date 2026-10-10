// The cast, drawn as vector shapes. Each body fits roughly inside a circle of radius r.

export const CHARACTERS = [
  { id: 'pint', name: 'Pint', color: '#f2a51d' },
  { id: 'shot', name: 'Shot', color: '#7fd6ff' },
  { id: 'lime', name: 'Lime', color: '#7ed63c' },
  { id: 'olive', name: 'Olive', color: '#b5c23a' },
  { id: 'tini', name: 'Tini', color: '#ff7ac2' },
  { id: 'cherry', name: 'Cherry', color: '#ff5460' },
];

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id);
}

function ellipse(g, x, y, rx, ry) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

const BODIES = {
  pint(g, r) {
    g.strokeStyle = '#ffe9b0';
    g.lineWidth = r * 0.16;
    g.beginPath();
    g.arc(r * 0.74, r * 0.08, r * 0.36, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.fillStyle = '#f2a51d';
    g.strokeStyle = '#7a4a00';
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.roundRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.56, r * 0.18);
    g.fill();
    g.stroke();
    g.fillStyle = '#fffaf0';
    for (const [x, y, s] of [[-0.48, -0.78, 0.3], [0, -0.9, 0.36], [0.48, -0.78, 0.3]]) {
      g.beginPath();
      g.arc(r * x, r * y, r * s, 0, Math.PI * 2);
      g.fill();
    }
  },
  shot(g, r) {
    g.beginPath();
    g.moveTo(-r * 0.72, -r * 0.82);
    g.lineTo(r * 0.72, -r * 0.82);
    g.lineTo(r * 0.52, r * 0.84);
    g.lineTo(-r * 0.52, r * 0.84);
    g.closePath();
    g.fillStyle = '#d6f1ff';
    g.fill();
    g.beginPath();
    g.moveTo(-r * 0.67, -r * 0.42);
    g.lineTo(r * 0.67, -r * 0.42);
    g.lineTo(r * 0.55, r * 0.6);
    g.lineTo(-r * 0.55, r * 0.6);
    g.closePath();
    g.fillStyle = '#ffcf5a';
    g.fill();
    g.beginPath();
    g.moveTo(-r * 0.72, -r * 0.82);
    g.lineTo(r * 0.72, -r * 0.82);
    g.lineTo(r * 0.52, r * 0.84);
    g.lineTo(-r * 0.52, r * 0.84);
    g.closePath();
    g.strokeStyle = '#3b7d9c';
    g.lineWidth = r * 0.08;
    g.stroke();
  },
  lime(g, r) {
    g.fillStyle = '#3f9a22';
    g.beginPath();
    g.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b8ee6b';
    g.beginPath();
    g.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8fd24a';
    g.lineWidth = r * 0.06;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74);
      g.stroke();
    }
  },
  olive(g, r) {
    g.strokeStyle = '#e8d2a0';
    g.lineWidth = r * 0.09;
    g.beginPath();
    g.moveTo(-r * 0.25, -r * 1.45);
    g.lineTo(r * 0.05, -r * 0.6);
    g.stroke();
    g.fillStyle = '#8a9a2b';
    g.strokeStyle = '#4d5714';
    g.lineWidth = r * 0.08;
    ellipse(g, 0, 0, r * 0.8, r * 0.92);
    g.fill();
    g.stroke();
    g.fillStyle = '#e2412f';
    g.beginPath();
    g.arc(0, -r * 0.68, r * 0.2, 0, Math.PI * 2);
    g.fill();
  },
  tini(g, r) {
    g.strokeStyle = '#ffd3ea';
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.moveTo(0, r * 0.3);
    g.lineTo(0, r * 0.8);
    g.stroke();
    g.fillStyle = '#ffd3ea';
    ellipse(g, 0, r * 0.84, r * 0.5, r * 0.1);
    g.fill();
    g.beginPath();
    g.moveTo(-r * 1.0, -r * 0.85);
    g.lineTo(r * 1.0, -r * 0.85);
    g.lineTo(0, r * 0.38);
    g.closePath();
    g.fillStyle = '#ff9ed2';
    g.strokeStyle = '#b0457e';
    g.lineWidth = r * 0.08;
    g.lineJoin = 'round';
    g.fill();
    g.stroke();
  },
  cherry(g, r) {
    g.strokeStyle = '#4a8f2a';
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.moveTo(0, -r * 0.82);
    g.quadraticCurveTo(r * 0.05, -r * 1.35, r * 0.45, -r * 1.5);
    g.stroke();
    g.fillStyle = '#5fb234';
    ellipse(g, r * 0.62, -r * 1.42, r * 0.26, r * 0.12);
    g.fill();
    g.fillStyle = '#e8323c';
    g.strokeStyle = '#8f1620';
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)';
    ellipse(g, -r * 0.38, -r * 0.45, r * 0.2, r * 0.12);
    g.fill();
  },
};

const FACE_Y = { tini: -0.42, pint: 0, shot: -0.02, lime: 0, olive: 0.05, cherry: 0.05 };
const FACE_SCALE = { tini: 0.8 };

function face(g, id, r, d, o) {
  const fy = (FACE_Y[id] || 0) * r;
  const s = (FACE_SCALE[id] || 1) * r;
  const lookX = (o.lookX || 0) * s * 0.07;
  const lookY = (o.lookY || 0) * s * 0.07;
  // Flushed cheeks as the character gets drunker.
  if (d > 0.1) {
    g.fillStyle = `rgba(255,90,120,${0.55 * d})`;
    ellipse(g, -s * 0.5, fy + s * 0.12, s * 0.16, s * 0.1); g.fill();
    ellipse(g, s * 0.5, fy + s * 0.12, s * 0.16, s * 0.1); g.fill();
  }
  for (const ex of [-0.28, 0.28]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ex * s, fy - s * 0.12, s * 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1320';
    g.beginPath();
    g.arc(ex * s + lookX, fy - s * 0.1 + lookY, s * 0.1, 0, Math.PI * 2);
    g.fill();
    if (d > 0.4) {
      // Heavy eyelids.
      g.fillStyle = 'rgba(40,20,40,.55)';
      g.beginPath();
      g.arc(ex * s, fy - s * 0.12, s * 0.2, Math.PI, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = '#1b1320';
  g.lineWidth = s * 0.07;
  g.lineCap = 'round';
  g.beginPath();
  if (o.sad) {
    g.arc(0, fy + s * 0.42, s * 0.18, Math.PI * 1.15, Math.PI * 1.85);
  } else if (d > 0.4) {
    g.moveTo(-s * 0.2, fy + s * 0.26);
    g.quadraticCurveTo(-s * 0.1, fy + s * 0.36, 0, fy + s * 0.26);
    g.quadraticCurveTo(s * 0.1, fy + s * 0.16, s * 0.2, fy + s * 0.26);
  } else {
    g.arc(0, fy + s * 0.16, s * 0.2, Math.PI * 0.15, Math.PI * 0.85);
  }
  g.stroke();
}

// Draws a character centred at (x, y).
// o: { t, drunk (0..1), moving, walk, phase, tilt, lookX, lookY, sad, shadow, alpha }
export function drawCharacter(g, id, x, y, r, o = {}) {
  const t = o.t || 0;
  const d = o.drunk || 0;
  g.save();
  g.translate(x, y);
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  if (o.shadow !== false) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    ellipse(g, 0, r * 0.98, r * 0.8, r * 0.2);
    g.fill();
  }
  g.rotate(Math.sin(t * 2.6 + (o.phase || 0)) * 0.26 * d + (o.tilt || 0));
  const step = o.moving ? Math.sin((o.walk || 0) * 14) * r * 0.16 : 0;
  g.fillStyle = '#2a1d1d';
  ellipse(g, -r * 0.34, r * 0.92 + step, r * 0.24, r * 0.13); g.fill();
  ellipse(g, r * 0.34, r * 0.92 - step, r * 0.24, r * 0.13); g.fill();
  BODIES[id](g, r);
  face(g, id, r, d, o);
  g.restore();
}
