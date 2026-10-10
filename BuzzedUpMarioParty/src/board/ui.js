// Small drawing helpers shared by the board's prompts and menus.
import { COLORS } from '../config.js';
import { text, panel } from '../draw.js';
import { PROMPT_X } from './consts.js';

const FONT = '"Trebuchet MS","Segoe UI",sans-serif';

// Draws text wrapped to a width, centred vertically around y.
export function wrap(g, s, x, y, maxW, lineH, o, maxLines = 4) {
  g.font = `${o.weight || 800} ${o.size || 28}px ${FONT}`;
  const lines = [];
  let line = '';
  for (const word of s.split(' ')) {
    const tryLine = line ? line + ' ' + word : word;
    if (g.measureText(tryLine).width > maxW && line) { lines.push(line); line = word; } else line = tryLine;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  shown.forEach((l, i) => text(g, l, x, y + (i - (shown.length - 1) / 2) * lineH, o));
}

// A one-line announcement over the board.
export function prompt(g, s, y = 120, color = COLORS.ink) {
  text(g, s, PROMPT_X, y, { size: 30, weight: 900, color, stroke: '#140f1f', strokeW: 8 });
}

// Like prompt, but wraps: for sentences that say what just happened.
export function bigNote(g, s, y = 120, color = COLORS.gold) {
  wrap(g, s, PROMPT_X, y, 880, 34, { size: 26, weight: 900, color, stroke: '#140f1f', strokeW: 8 }, 3);
}

export function subPrompt(g, s, y = 160) {
  text(g, s, PROMPT_X, y, { size: 18, weight: 700, color: COLORS.dim, stroke: '#140f1f', strokeW: 5 });
}

// A row of buttons to choose between, with a title above and an optional note below.
export function choiceBox(g, title, options, sel, note = '', maxW = 250) {
  const bw = Math.min(maxW, 760 / options.length - 16);
  const total = options.length * (bw + 16) - 16;
  const w = Math.max(620, total + 60);
  panel(g, PROMPT_X - w / 2, 96, w, note ? 170 : 140, { fill: 'rgba(20,15,31,.94)', line: COLORS.gold });
  text(g, title, PROMPT_X, 128, { size: 24 });
  options.forEach((o, i) => {
    const x = PROMPT_X - total / 2 + bw / 2 + i * (bw + 16);
    const on = sel === i;
    panel(g, x - bw / 2, 156, bw, 56, { r: 12, fill: on ? '#3b2d5c' : '#1b1429', line: on ? COLORS.gold : COLORS.panelLine });
    text(g, o, x, 185, { size: bw < 170 ? 16 : 19, color: on ? COLORS.ink : COLORS.dim });
  });
  if (note) text(g, note, PROMPT_X, 240, { size: 15, weight: 700, color: COLORS.dim });
}

// A vertical list menu. rows: [{ label, right, dim, icon(g, x, y) }]. Returns nothing; purely drawn.
export function listBox(g, title, rows, sel, o = {}) {
  const w = o.w || 560;
  const rowH = o.rowH || 46;
  const x = PROMPT_X - w / 2;
  const y = o.y || 96;
  const h = 62 + rows.length * rowH + (o.note ? 64 : 14);
  panel(g, x, y, w, h, { fill: 'rgba(20,15,31,.95)', line: o.line || COLORS.gold });
  text(g, title, PROMPT_X, y + 32, { size: 24 });
  rows.forEach((row, i) => {
    const ry = y + 62 + i * rowH;
    const on = sel === i;
    if (on) panel(g, x + 14, ry, w - 28, rowH - 6, { r: 10, fill: '#3b2d5c', line: COLORS.gold, lineW: 2 });
    const tx = x + (row.icon ? 70 : 34);
    if (row.icon) row.icon(g, x + 42, ry + (rowH - 6) / 2);
    text(g, row.label, tx, ry + (rowH - 6) / 2 + 1, { size: 20, align: 'left', color: row.dim ? '#6f6488' : on ? COLORS.ink : COLORS.dim });
    if (row.right) text(g, row.right, x + w - 34, ry + (rowH - 6) / 2 + 1, { size: 18, align: 'right', color: row.dim ? '#6f6488' : COLORS.gold });
  });
  if (o.note) wrap(g, o.note, PROMPT_X, y + h - 36, w - 60, 20, { size: 15, weight: 700, color: COLORS.ink }, 2);
}

// Sal the bartender, the host.
export function drawSal(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = '#e8b98a';
  g.fill();
  g.fillStyle = '#3a2a1a';
  g.beginPath();
  g.arc(x, y - r * 0.25, r, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1320';
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.05, r * 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + r * 0.35, y - r * 0.05, r * 0.1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = r * 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r * 0.5, y + r * 0.42);
  g.quadraticCurveTo(x, y + r * 0.2, x + r * 0.5, y + r * 0.42);
  g.stroke();
}
