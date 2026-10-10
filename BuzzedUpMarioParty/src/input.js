// Unified input: every device (gamepad, keyboard scheme or phone) reports a stick and one button.

export const KEYSETS = {
  kb1: { label: 'WASD + Space', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', btn: 'Space' },
  kb2: { label: 'Arrows + Enter', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', btn: 'Enter' },
  kb3: { label: 'IJKL + U', up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', btn: 'KeyU' },
  kb4: { label: 'Numpad 8456 + 0', up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', btn: 'Numpad0' },
};

// Controller options, shared by every gamepad and saved in the browser.
export const DEADZONES = { small: 0.15, medium: 0.25, large: 0.4 };
export const ACTION_NAMES = ['A / Cross (bottom)', 'B / Circle (right)', 'X / Square (left)', 'Y / Triangle (top)'];
const SETTINGS_KEY = 'bcb-controls';
const DEFAULTS = { action: 0, deadzone: 'medium', rumble: true };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    const s = { ...DEFAULTS, ...saved };
    if (!(s.action >= 0 && s.action <= 3)) s.action = 0;
    if (!DEADZONES[s.deadzone]) s.deadzone = 'medium';
    s.rumble = !!s.rumble;
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

const BLOCKED = new Set(['Space', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const ZERO = Object.freeze({
  x: 0, y: 0, btn: false, back: false, start: false, pressed: false, backPressed: false, startPressed: false,
  left: false, right: false, up: false, down: false,
});

export class Input {
  constructor() {
    this.keys = new Set();
    this.keyEdges = new Set();
    this.frameKeys = new Set();
    this.devices = new Map();
    this.phones = new Map();
    this.socket = null;
    this.settings = loadSettings();
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.keyEdges.add(e.code);
      this.keys.add(e.code);
      if (BLOCKED.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.connectPhones();
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* private mode */ }
  }

  // Phones reach the game through the local server, which relays their input here.
  connectPhones() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try { ws = new WebSocket(`${proto}://${location.host}/ws/host`); } catch { return; }
    this.socket = ws;
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hello') {
        this.phones.clear();
        for (const id of m.phones) this.phones.set(id, { x: 0, y: 0, b: false, tap: false });
      } else if (m.t === 'join') {
        this.phones.set(m.id, { x: 0, y: 0, b: false, tap: false });
      } else if (m.t === 'leave') {
        this.phones.delete(m.id);
      } else if (m.t === 'in') {
        const p = this.phones.get(m.id);
        if (!p) return;
        p.x = m.x;
        p.y = m.y;
        if (m.b && !p.b) p.tap = true;
        p.b = m.b;
      }
    };
    ws.onclose = () => {
      this.phones.clear();
      setTimeout(() => this.connectPhones(), 2000);
    };
  }

  poll() {
    this.frameKeys = this.keyEdges;
    this.keyEdges = new Set();
    const next = new Map();
    const held = (code) => this.keys.has(code) || this.frameKeys.has(code);

    for (const [id, k] of Object.entries(KEYSETS)) {
      let x = (held(k.right) ? 1 : 0) - (held(k.left) ? 1 : 0);
      let y = (held(k.down) ? 1 : 0) - (held(k.up) ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      next.set(id, { x, y, btn: held(k.btn), back: false, start: false });
    }

    const dead = DEADZONES[this.settings.deadzone];
    const action = this.settings.action;
    const backBtn = action === 1 ? 0 : 1;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected || p.index > 3) continue;
      let x = p.axes[0] || 0;
      let y = p.axes[1] || 0;
      const mag = Math.hypot(x, y);
      if (mag < dead) {
        x = 0; y = 0;
      } else {
        // Rescale so movement starts from zero at the edge of the dead zone.
        const k = Math.min(1, (mag - dead) / (1 - dead)) / mag;
        x *= k; y *= k;
      }
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      if (b(14)) x = -1; if (b(15)) x = 1;
      if (b(12)) y = -1; if (b(13)) y = 1;
      next.set('pad' + p.index, { x, y, btn: b(action), back: b(backBtn), start: b(9) });
    }

    for (const [id, p] of this.phones) {
      // A quick tap can start and end between two frames; `tap` makes sure it still counts.
      next.set('phone' + id, { x: p.x, y: p.y, btn: p.b || p.tap, back: false, start: false });
      p.tap = false;
    }

    for (const [id, s] of next) {
      const prev = this.devices.get(id) || ZERO;
      s.pressed = s.btn && !prev.btn;
      s.backPressed = s.back && !prev.back;
      s.startPressed = s.start && !prev.start;
      s.left = s.x < -0.5 && !(prev.x < -0.5);
      s.right = s.x > 0.5 && !(prev.x > 0.5);
      s.up = s.y < -0.5 && !(prev.y < -0.5);
      s.down = s.y > 0.5 && !(prev.y > 0.5);
    }
    this.devices = next;
  }

  get(id) { return this.devices.get(id) || ZERO; }

  pressedDevices() {
    const out = [];
    for (const [id, s] of this.devices) if (s.pressed) out.push(id);
    return out;
  }

  // Menu input merged across several devices.
  merged(ids) {
    const o = { left: false, right: false, up: false, down: false, pressed: false };
    for (const id of ids) {
      const s = this.get(id);
      for (const k in o) o[k] = o[k] || s[k];
    }
    return o;
  }

  backPressed() {
    if (this.frameKeys.has('Escape')) return true;
    for (const s of this.devices.values()) if (s.backPressed) return true;
    return false;
  }

  // Opens the controller options: Tab on a keyboard, Start on a gamepad.
  startPressed() {
    if (this.frameKeys.has('Tab')) return true;
    for (const s of this.devices.values()) if (s.startPressed) return true;
    return false;
  }

  keyPressed(code) { return this.frameKeys.has(code); }

  label(id) {
    if (id === 'cpu') return 'Computer';
    if (KEYSETS[id]) return KEYSETS[id].label;
    if (id.startsWith('phone')) return 'Phone ' + id.slice(5);
    return 'Controller ' + (Number(id.slice(3)) + 1);
  }

  // Tells a phone which character it is playing, so its screen can show it.
  tell(id, name, color) {
    if (!id.startsWith('phone') || !this.socket || this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify({ t: 'who', id: Number(id.slice(5)), name, color }));
  }

  rumble(id, ms = 150, strength = 0.7) {
    if (!this.settings.rumble) return;
    if (id.startsWith('phone')) {
      if (this.socket && this.socket.readyState === 1) {
        this.socket.send(JSON.stringify({ t: 'buzz', id: Number(id.slice(5)), ms }));
      }
      return;
    }
    if (!id.startsWith('pad')) return;
    const pad = (navigator.getGamepads ? navigator.getGamepads() : [])[Number(id.slice(3))];
    const act = pad && pad.vibrationActuator;
    if (act && act.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength }).catch(() => {});
    }
  }
}
