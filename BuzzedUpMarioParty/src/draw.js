import { W, H, COLORS } from './config.js';
import { drunkLevel, drunkStage } from './drunk.js';

const FONT = '"Trebuchet MS","Segoe UI",sans-serif';

export function text(g, s, x, y, o = {}) {
  g.font = `${o.weight || 800} ${o.size || 28}px ${FONT}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = o.base || 'middle';
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 18; }
  if (o.stroke) {
    g.lineWidth = o.strokeW || 6;
    g.strokeStyle = o.stroke;
    g.lineJoin = 'round';
    g.strokeText(s, x, y);
  }
  g.fillStyle = o.color || COLORS.ink;
  g.fillText(s, x, y);
  g.shadowBlur = 0;
}

export function panel(g, x, y, w, h, o = {}) {
  g.beginPath();
  g.roundRect(x, y, w, h, o.r === undefined ? 18 : o.r);
  g.fillStyle = o.fill || COLORS.panel;
  g.fill();
  if (o.line !== null) {
    g.lineWidth = o.lineW || 3;
    g.strokeStyle = o.line || COLORS.panelLine;
    g.stroke();
  }
}

export function backdrop(g, t = 0) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1d1430');
  grad.addColorStop(1, '#0f0b18');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Soft out-of-focus bar lights.
  for (let i = 0; i < 14; i++) {
    const x = (i * 197 + 80) % W;
    const y = (i * 131 + 40) % H;
    const r = 30 + ((i * 37) % 50);
    const a = 0.05 + 0.03 * Math.sin(t * 0.8 + i);
    g.fillStyle = i % 2 ? `rgba(255,79,163,${a})` : `rgba(79,216,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

export function drunkMeter(g, x, y, w, player, o = {}) {
  const h = o.h || 14;
  const d = drunkLevel(player.sips);
  g.beginPath();
  g.roundRect(x, y, w, h, h / 2);
  g.fillStyle = '#120d1c';
  g.fill();
  if (d > 0) {
    g.beginPath();
    g.roundRect(x, y, Math.max(h, w * d), h, h / 2);
    g.fillStyle = d < 0.4 ? COLORS.good : d < 0.75 ? COLORS.gold : COLORS.bad;
    g.fill();
  }
  if (o.label !== false) {
    text(g, `${drunkStage(player.sips)} · ${player.sips} sips`, x + w / 2, y + h + 14, {
      size: 15, weight: 700, color: COLORS.dim,
    });
  }
}

// The bottle cap players collect to win.
export function bottleCap(g, x, y, r) {
  g.beginPath();
  const teeth = 18;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r : r * 0.86;
    if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + rr, y);
  }
  g.closePath();
  g.fillStyle = '#ffd23d';
  g.fill();
  g.lineWidth = Math.max(1.5, r * 0.1);
  g.strokeStyle = '#8f6200';
  g.stroke();
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.fillStyle = '#e2412f';
  g.fill();
  g.beginPath();
  g.arc(x - r * 0.2, y - r * 0.22, r * 0.16, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fill();
}

export function coin(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = COLORS.gold;
  g.fill();
  g.lineWidth = r * 0.22;
  g.strokeStyle = '#b07a00';
  g.stroke();
}
