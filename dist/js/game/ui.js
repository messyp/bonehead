import { R } from '../core/render.js';
import { Input } from '../core/input.js';
import { P } from '../art/palette.js';
import { Audio } from '../audio/sfx.js';
import { approach, ease, clamp } from '../core/tween.js';

export const COLORS = {
  gold: { face: P.gold2, hi: P.gold1, lip: P.gold3, text: P.white },
  red: { face: P.red2, hi: P.red1, lip: P.red3, text: P.white },
  teal: { face: P.teal2, hi: P.teal1, lip: P.teal3, text: P.white },
  blue: { face: P.blue2, hi: P.blue1, lip: P.blue3, text: P.white },
  violet: { face: P.vio2, hi: P.vio1, lip: P.vio3, text: P.white },
  ink: { face: P.ink4, hi: P.ink5, lip: P.ink3, text: P.bone0 },
  green: { face: P.grn2, hi: P.grn1, lip: P.grn3, text: P.white },
  off: { face: P.ink3, hi: P.ink3, lip: P.ink2, text: P.ink5 },
};

const anim = new Map();
const st = id => { let s = anim.get(id); if (!s) anim.set(id, s = { h: 0, p: 0, was: false, pop: 0 }); return s; };

export const UI = {
  blocked: false, tip: null, dt: 0.016, focus: null,

  frame(dt) { this.dt = dt; this.tip = null; },

  // Chunky 3D pixel button. Returns true when clicked.
  button(id, x, y, w, h, label, o = {}) {
    const enabled = o.enabled ?? true, blocked = o.ignoreBlock ? false : this.blocked;
    const clicked = Input.button(id, x, y, w, h, enabled && !blocked);
    const s = st(id), hot = Input.hot === id, down = Input.active === id && hot;
    if (hot && !s.was && enabled) Audio.play('hover', id.length);
    s.was = hot;
    s.h = approach(s.h, hot ? 1 : 0, 18, this.dt);
    s.p = approach(s.p, down ? 1 : 0, 30, this.dt);
    s.pop = Math.max(0, s.pop - this.dt * 4);
    const c = COLORS[enabled ? (o.color || 'gold') : 'off'];
    const pulse = o.pulse && enabled ? (Math.sin(R.t * 6) * 0.5 + 0.5) : 0;
    const lip = 3, press = Math.round(s.p * 2), lift = -Math.round(s.h * 1), top = lift + press, faceH = h - lip - lift;
    const sc = 1 + s.pop * 0.12 + pulse * 0.04;
    const ctx = R.ctx;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-(x + w / 2), -(y + h / 2));
    if (pulse || (o.pulse && enabled)) R.box(x - 3, y - 3 + top, w + 6, h + 6 - top, c.hi, 3, 0.2 + pulse * 0.4);
    R.box(x, y + 3, w, h, P.ink0, 2, 0.4);
    R.box(x - 1, y + top - 1, w + 2, h - top + 2, P.ink0, 2);
    R.box(x, y + top, w, h - top, c.lip, 2);
    R.box(x, y + top, w, faceH, s.h > 0.5 || pulse > 0.8 ? c.hi : c.face, 2);
    R.rect(x + 2, y + top + 1, w - 4, 1, s.h > 0.5 ? P.white : c.hi, 0.8);
    const size = o.size || 1, tw = R.measure(label, { size }), iw = o.icon ? o.icon.w * (o.iconScale ?? 1) + 3 : 0;
    const tx = x + w / 2 + iw / 2, ty = y + top + Math.round(faceH / 2 - 3.5 * size);
    if (o.icon) R.spr(o.icon, tx - tw / 2 - iw / 2 - 1, ty + 3.5 * size, { sc: o.iconScale ?? 1 });
    R.text(label, tx, ty, { size, color: c.text, align: 'center', wave: o.wave ? 0.8 : 0 });
    ctx.restore();
    if (clicked) { s.pop = 1; Audio.play(o.sound || 'ui'); }
    return clicked;
  },

  // Tiny icon button, e.g. menu burger.
  iconButton(id, x, y, w, h, draw, o = {}) {
    const clicked = Input.button(id, x, y, w, h, !(this.blocked && !o.ignoreBlock));
    const s = st(id), hot = Input.hot === id;
    if (hot && !s.was) Audio.play('hover', 3);
    s.was = hot; s.h = approach(s.h, hot ? 1 : 0, 18, this.dt);
    R.panel(x, y, w, h, { fill: hot ? P.ink4 : P.ink3, hi: P.ink5 });
    draw(x, y - Math.round(s.h), hot);
    if (clicked) Audio.play('ui');
    return clicked;
  },

  slider(id, x, y, w, value, label) {
    const h = 10, s = st(id);
    R.text(label, x, y - 11, { color: P.bone1 });
    R.text(Math.round(value * 100) + '%', x + w, y - 11, { color: P.gold1, align: 'right' });
    R.box(x, y + 1, w, h, P.ink0, 2);
    R.box(x + 1, y + 2, w - 2, h - 2, P.ink1, 1);
    R.rect(x + 2, y + 3, Math.round((w - 4) * value), h - 4, P.gold2);
    R.rect(x + 2, y + 3, Math.round((w - 4) * value), 1, P.gold1);
    const kx = x + 2 + (w - 4) * value;
    const hot = Input.over(x - 4, y - 3, w + 8, h + 6) && !this.blocked;
    if (hot) Input.cursor = 'pointer';
    if (hot && Input.pressed) { Input.active = id; Input.pressed = false; }
    if (Input.active === id && (Input.down || Input.released)) {
      const v = clamp((Input.x - x - 2) / (w - 4));
      if (Math.abs(v - value) > 0.02 || Input.released) { if (Math.round(v * 20) !== Math.round(value * 20)) Audio.play('tick', Math.round(v * 8)); value = v; }
    }
    s.h = approach(s.h, hot || Input.active === id ? 1 : 0, 18, this.dt);
    R.box(kx - 3, y - 1 - Math.round(s.h), 7, h + 4, P.ink0, 2);
    R.box(kx - 2, y - Math.round(s.h), 5, h + 2, s.h > 0.5 ? P.bone0 : P.bone1, 1);
    return value;
  },

  toggle(id, x, y, w, label, on) {
    const h = 14, clicked = Input.button(id, x, y, w, h, !this.blocked), s = st(id), hot = Input.hot === id;
    if (hot && !s.was) Audio.play('hover', 2);
    s.was = hot;
    s.h = approach(s.h, on ? 1 : 0, 16, this.dt);
    R.text(label, x, y + 3, { color: hot ? P.bone0 : P.bone1 });
    const sx = x + w - 26;
    R.box(sx, y + 1, 26, 12, P.ink0, 2);
    R.box(sx + 1, y + 2, 24, 10, on ? P.grn3 : P.ink2, 1);
    const kx = sx + 2 + Math.round(s.h * 12);
    R.box(kx, y + 3, 10, 8, on ? P.grn1 : P.ink5, 1);
    R.rect(kx + 1, y + 3, 8, 1, on ? P.grn0 : P.ink6);
    if (clicked) { Audio.play(on ? 'back' : 'ui'); return !on; }
    return on;
  },

  // Standard modal shell: dimmer + popping panel. Returns the inner content rect.
  modal(id, w, h, t, o = {}) {
    const a = ease.outCubic(clamp(t / 0.25));
    R.rect(-20, -20, R.vw + 40, R.vh + 40, P.ink0, 0.62 * a);
    const sc = ease.outBack(clamp(t / 0.32), 1.6);
    const x = Math.round(R.vw / 2 - w / 2), y = Math.round(R.vh / 2 - h / 2);
    const ctx = R.ctx;
    ctx.save();
    ctx.translate(R.vw / 2, R.vh / 2); ctx.scale(sc, sc); ctx.translate(-R.vw / 2, -R.vh / 2);
    R.panel(x, y, w, h, { fill: o.fill ?? P.ink2, rim: P.ink0, hi: P.ink4, depth: 4 });
    R.box(x + 3, y + 3, w - 6, h - 6, o.inner ?? P.ink1, 2, 0.6);
    return { x, y, w, h, restore: () => ctx.restore() };
  },

  title(text, x, y, o = {}) {
    return R.text(text, x, y, { size: o.size ?? 2, color: o.color ?? P.gold1, align: o.align ?? 'center', wave: o.wave ?? 1, waveSpeed: 4 });
  },

  tooltip(title, body, x, y, o = {}) { this.tip = { title, body, x, y, color: o.color ?? P.gold1, w: o.w ?? 120 }; },

  drawTip() {
    const t = this.tip;
    if (!t) return;
    const w = t.w, lines = R.wrap(t.body, w - 10), h = 16 + lines.length * 10 + 2;
    let x = Math.round(t.x - w / 2), y = Math.round(t.y - h - 6);
    x = clamp(x, 4, R.vw - w - 4); if (y < 4) y = Math.round(t.y + 12);
    R.panel(x, y, w, h, { fill: P.ink1, rim: P.ink0, hi: P.ink3, depth: 3 });
    R.text(t.title, x + w / 2, y + 4, { color: t.color, align: 'center' });
    lines.forEach((l, i) => R.text(l, x + w / 2, y + 15 + i * 10, { color: P.bone1, align: 'center' }));
  },
};
