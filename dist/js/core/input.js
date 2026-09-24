import { R } from './render.js';

// Pointer + keyboard state in virtual pixels. Widgets consume clicks so only one reacts.
export const Input = {
  x: -999, y: -999, down: false, pressed: false, released: false, active: null, hot: null, cursor: 'default',
  downX: 0, downY: 0, downT: 0, samples: [], keys: [], type: 'mouse', id: null, onFirst: null, moved: false,

  init(el) {
    const toV = e => {
      const r = el.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * R.vw, (e.clientY - r.top) / r.height * R.vh];
    };
    const first = () => { if (this.onFirst) { const f = this.onFirst; this.onFirst = null; f(); } };
    el.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button > 0) return;
      first();
      [this.x, this.y] = toV(e);
      this.down = true; this.pressed = true; this.moved = false; this.type = e.pointerType;
      this.downX = this.x; this.downY = this.y; this.downT = performance.now(); this.id = e.pointerId;
      this.samples = [{ x: this.x, y: this.y, t: this.downT }];
      try { el.setPointerCapture(e.pointerId); } catch { /* capture is best effort */ }
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!e.isPrimary) return;
      [this.x, this.y] = toV(e);
      this.type = e.pointerType; this.moved = true;
      if (this.down) {
        const t = performance.now();
        this.samples.push({ x: this.x, y: this.y, t });
        while (this.samples.length > 2 && t - this.samples[0].t > 110) this.samples.shift();
      }
    });
    const up = e => {
      if (!e.isPrimary || !this.down) return;
      [this.x, this.y] = toV(e);
      this.down = false; this.released = true;
      if (e.type === 'pointercancel') this.cancelled = true;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', e => { if (!this.down && e.pointerType === 'mouse') { this.x = -999; this.y = -999; } });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      first();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.push({ key: e.key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, repeat: e.repeat });
    });
    window.addEventListener('blur', () => { if (this.down) { this.down = false; this.released = true; this.cancelled = true; } });
  },

  vel() {
    const s = this.samples;
    if (s.length < 2) return { x: 0, y: 0 };
    const a = s[0], b = s[s.length - 1], dt = Math.max(1, b.t - a.t) / 1000;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  },

  over(x, y, w, h) { return this.x >= x && this.y >= y && this.x < x + w && this.y < y + h; },

  // Immediate-mode button behaviour. Returns true on click.
  button(id, x, y, w, h, enabled = true) {
    const hover = enabled && this.over(x, y, w, h);
    if (hover) { this.hot = id; this.cursor = 'pointer'; }
    const pressedHere = enabled && this.downX >= x && this.downY >= y && this.downX < x + w && this.downY < y + h;
    if (this.pressed && pressedHere) { this.active = id; this.pressed = false; }
    if (this.released && this.active === id) {
      this.active = null;
      if (hover && !this.cancelled) { this.released = false; return true; }
    }
    return false;
  },

  endFrame() {
    this.pressed = false;
    if (this.released) { this.released = false; this.active = null; this.cancelled = false; }
    this.keys.length = 0;
    this.hot = null;
  },
};
