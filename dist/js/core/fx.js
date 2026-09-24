import { R } from './render.js';
import { P } from '../art/palette.js';
import { ease, clamp } from './tween.js';
import { hash, rng } from './pixel.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export const FIRE = [P.fire0, P.fire1, P.fire2, P.fire3, P.fire4];
export const GOLD = [P.gold0, P.gold1, P.gold2, P.gold3];
export const CONFETTI = [P.red1, P.gold1, P.teal1, P.blue1, P.vio1, P.bone0, P.grn1];

// Pixel particles, popping numbers, shockwave rings, banners and bespoke effects.
export const FX = {
  parts: [], top: [], pops: [], fx: [], banners: [],
  reduced: false,

  clear() { this.parts = []; this.top = []; this.pops = []; this.fx = []; this.banners = []; },

  // Pixel squares. colors may be a gradient over life.
  burst(x, y, n, o = {}) {
    if (this.reduced) n = Math.ceil(n / 3);
    const list = o.top ? this.top : this.parts;
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + rand(-1, 1) * (o.spread ?? Math.PI);
      const sp = rand(o.speed?.[0] ?? 30, o.speed?.[1] ?? 120);
      const life = rand(o.life?.[0] ?? 0.4, o.life?.[1] ?? 0.9);
      list.push({
        x: x + rand(-1, 1) * (o.w ?? 0), y: y + rand(-1, 1) * (o.h ?? 0),
        vx: Math.cos(a) * sp + (o.vx ?? 0), vy: Math.sin(a) * sp + (o.vy ?? 0),
        life, max: life, size: o.size ? (Array.isArray(o.size) ? Math.round(rand(o.size[0], o.size[1])) : o.size) : 1,
        colors: o.colors || [P.bone0], grav: o.grav ?? 160, drag: o.drag ?? 1.5, shrink: o.shrink ?? true,
        glyph: o.glyphs ? pick(o.glyphs) : null, rot: rand(-3, 3), vr: rand(-8, 8), gcol: o.gcol,
      });
    }
  },

  ring(x, y, o = {}) { this.fx.push(new Ring(x, y, o)); },
  pop(text, x, y, o = {}) { this.pops.push({ text, x, y, t: 0, life: o.life ?? 1.1, color: o.color ?? P.bone0, box: o.box ?? null, size: o.size ?? 1, vy: o.vy ?? -26, delay: o.delay ?? 0, rot: rand(-0.12, 0.12) }); },
  banner(text, o = {}) { this.banners.push({ text, t: 0, life: o.life ?? 1.5, color: o.color ?? P.bone0, sub: o.sub, subColor: o.subColor ?? P.bone1, size: o.size ?? 4, y: o.y ?? 0.42, x: o.x ?? 0.5 }); },
  add(effect) { this.fx.push(effect); return effect; },

  update(dt) {
    for (const list of [this.parts, this.top]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy = p.vy * d + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t > p.life + p.delay) this.pops.splice(i, 1); }
    for (let i = this.banners.length - 1; i >= 0; i--) { const b = this.banners[i]; b.t += dt; if (b.t > b.life) this.banners.splice(i, 1); }
    for (let i = this.fx.length - 1; i >= 0; i--) if (!this.fx[i].update(dt)) this.fx.splice(i, 1);
  },

  drawParts(list) {
    const ctx = R.ctx;
    for (const p of list) {
      const f = 1 - p.life / p.max, c = p.colors[Math.min(p.colors.length - 1, Math.floor(f * p.colors.length))];
      if (p.glyph) {
        R.text(p.glyph, p.x, p.y, { size: p.size, color: p.gcol || c, align: 'center', valign: 'middle', fx: () => ({ rot: p.rot, a: clamp(p.life / p.max * 2) }) });
        continue;
      }
      const s = p.shrink ? Math.max(1, Math.round(p.size * (0.4 + 0.6 * (1 - f)))) : p.size;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  },

  draw() {
    for (const e of this.fx) if (!e.top) e.draw();
    this.drawParts(this.parts);
  },

  drawTop() {
    for (const e of this.fx) if (e.top) e.draw();
    this.drawParts(this.top);
    for (const p of this.pops) {
      const t = p.t - p.delay; if (t < 0) continue;
      const f = t / p.life, sc = t < 0.18 ? ease.outBack(t / 0.18, 3) : 1, a = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
      const y = p.y + p.vy * ease.outCubic(Math.min(1, f * 1.4));
      const w = R.measure(p.text, { size: p.size });
      R.ctx.save();
      R.ctx.globalAlpha = a;
      R.ctx.translate(p.x, y); R.ctx.rotate(p.rot * (1 - Math.min(1, t * 4))); R.ctx.scale(sc, sc);
      if (p.box) R.panel(-w / 2 - 4, -6 * p.size, w + 8, 7 * p.size + 5, { fill: p.box, rim: P.ink0, hi: null, depth: 2 });
      R.text(p.text, 0, -4 * p.size + (p.box ? 1 : 0), { size: p.size, color: p.color, align: 'center' });
      R.ctx.restore();
    }
    for (const b of this.banners) {
      const inT = clamp(b.t / 0.25), outT = clamp((b.t - (b.life - 0.3)) / 0.3);
      const sc = ease.outBack(inT, 2.4) * (1 - ease.inCubic(outT) * 0.4), a = 1 - outT;
      const x = R.vw * b.x, y = R.vh * b.y;
      R.ctx.save();
      R.ctx.globalAlpha = a;
      R.ctx.translate(x, y); R.ctx.scale(sc, sc);
      R.text(b.text, 0, 0, { size: b.size, color: b.color, align: 'center', valign: 'middle', wave: 1.2, waveSpeed: 9, fx: i => ({ dy: -Math.max(0, 1 - (b.t * 7 - i * 0.6)) * 8 }) });
      if (b.sub) R.text(b.sub, 0, b.size * 6 + 2, { size: 1, color: b.subColor, align: 'center' });
      R.ctx.restore();
    }
  },
};

class Ring {
  constructor(x, y, o) { Object.assign(this, { x, y, t: 0, life: o.life ?? 0.5, r0: o.r0 ?? 4, r1: o.r1 ?? 60, color: o.color ?? P.bone0, w: o.w ?? 2, top: o.top }); }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw() {
    const f = ease.outCubic(this.t / this.life), r = this.r0 + (this.r1 - this.r0) * f, w = Math.max(1, Math.round(this.w * (1 - f) + 0.5));
    const n = Math.max(12, Math.floor(r * 2.2)), ctx = R.ctx;
    ctx.fillStyle = this.color; ctx.globalAlpha = 1 - f * 0.6;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(this.x + Math.cos(a) * r), Math.round(this.y + Math.sin(a) * r * 0.8), w, w); }
    ctx.globalAlpha = 1;
  }
}

// Burn a sprite away from the bottom up with a glowing edge (pixel dissolve).
export class Dissolve {
  constructor(spr, x, y, rot, sc, o = {}) {
    Object.assign(this, { spr, x, y, rot, sc, t: -(o.delay ?? 0), life: o.life ?? 0.9, edge: o.edge ?? FIRE, dir: o.dir ?? 'up', vy: o.vy ?? -8 });
    const w = spr.w, h = spr.h, src = spr.c.getContext('2d').getImageData(0, 0, w, h);
    this.src = src; this.w = w; this.h = h;
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(w, h);
    const r = rng(hash(String(Math.random())));
    this.noise = new Float32Array(w * h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const base = this.dir === 'up' ? 1 - yy / h : this.dir === 'radial' ? Math.hypot(xx - w / 2, yy - h / 2) / Math.hypot(w / 2, h / 2) : yy / h;
      this.noise[yy * w + xx] = base * 0.72 + r() * 0.28;
    }
  }
  update(dt) {
    this.t += dt;
    if (this.t < 0) return true;
    this.y += this.vy * dt;
    const th = this.t / this.life, d = this.img.data, s = this.src.data, band = 0.08;
    let emitted = 0;
    for (let i = 0; i < this.noise.length; i++) {
      const n = this.noise[i], j = i * 4;
      if (s[j + 3] === 0 || n < th * 1.1 - 0.05) { d[j + 3] = 0; continue; }
      if (n < th * 1.1 - 0.05 + band) {
        const e = this.edge[Math.min(this.edge.length - 1, Math.floor((n - (th * 1.1 - 0.05)) / band * this.edge.length))];
        const hx = e.replace('#', '');
        d[j] = parseInt(hx.slice(0, 2), 16); d[j + 1] = parseInt(hx.slice(2, 4), 16); d[j + 2] = parseInt(hx.slice(4, 6), 16); d[j + 3] = 255;
        if (emitted < 3 && Math.random() < 0.02) {
          emitted++;
          const px = i % this.w, py = Math.floor(i / this.w), c = Math.cos(this.rot), sn = Math.sin(this.rot);
          const lx = (px - this.w / 2) * this.sc, ly = (py - this.h / 2) * this.sc;
          FX.burst(this.x + lx * c - ly * sn, this.y + lx * sn + ly * c, 1, { colors: this.edge, speed: [5, 25], life: [0.4, 0.9], grav: -60, spread: 0.8, size: 1 });
        }
      } else { d[j] = s[j]; d[j + 1] = s[j + 1]; d[j + 2] = s[j + 2]; d[j + 3] = s[j + 3]; }
    }
    this.cx.putImageData(this.img, 0, 0);
    return this.t < this.life;
  }
  draw() {
    if (this.t < 0) {
      R.spr(this.spr, this.x, this.y, { rot: this.rot, sc: this.sc });
      return;
    }
    const ctx = R.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.scale(this.sc, this.sc);
    ctx.drawImage(this.cv, -this.w / 2, -this.h / 2);
    ctx.restore();
  }
}

// A card sliced in two along a line; halves fly apart and crumble into pixels.
export class Sliced {
  constructor(spr, x, y, rot, sc, angle, o = {}) {
    Object.assign(this, { spr, x, y, rot, sc, angle, t: -(o.delay ?? 0), life: o.life ?? 1.1 });
    const n = [Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2)], push = o.push ?? 70;
    this.halves = [1, -1].map(side => ({ side, dx: 0, dy: 0, vx: n[0] * push * side + rand(-10, 10), vy: n[1] * push * side - rand(20, 50), r: 0, vr: side * rand(2, 5) }));
    this.dissolves = null;
  }
  update(dt) {
    this.t += dt;
    if (this.t < 0) return true;
    for (const h of this.halves) { h.vy += 240 * dt; h.dx += h.vx * dt; h.dy += h.vy * dt; h.r += h.vr * dt; }
    if (this.t > this.life * 0.45 && Math.random() < 0.5) {
      const h = this.halves[Math.random() < 0.5 ? 0 : 1];
      FX.burst(this.x + h.dx, this.y + h.dy, 2, { colors: [P.bone0, P.bone2, P.red1, P.ink4], speed: [10, 40], life: [0.3, 0.6], grav: 120, size: [1, 2] });
    }
    return this.t < this.life;
  }
  draw() {
    const ctx = R.ctx, w = this.spr.w, h = this.spr.h, a = this.t < 0 ? 1 : 1 - clamp((this.t - this.life * 0.55) / (this.life * 0.45));
    if (this.t < 0) { R.spr(this.spr, this.x, this.y, { rot: this.rot, sc: this.sc }); return; }
    for (const half of this.halves) {
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(this.x + half.dx, this.y + half.dy);
      ctx.rotate(this.rot + half.r);
      ctx.scale(this.sc, this.sc);
      // Clip to one side of the cut line (in card space).
      const la = this.angle - this.rot, L = 200, c = Math.cos(la), s = Math.sin(la), nx = -s * half.side, ny = c * half.side;
      ctx.beginPath();
      ctx.moveTo(-c * L, -s * L); ctx.lineTo(c * L, s * L); ctx.lineTo(c * L + nx * L, s * L + ny * L); ctx.lineTo(-c * L + nx * L, -s * L + ny * L);
      ctx.closePath(); ctx.clip();
      ctx.drawImage(this.spr.up(R.k), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
}

// The white slash streak itself, with a fading afterimage.
export class Slash {
  constructor(x, y, angle, len, o = {}) { Object.assign(this, { x, y, angle, len, t: 0, life: o.life ?? 0.45, color: o.color ?? P.white, top: true }); }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw() {
    const f = this.t / this.life, grow = ease.outQuint(Math.min(1, f * 4)), fade = 1 - ease.inCubic(f);
    const ctx = R.ctx, c = Math.cos(this.angle), s = Math.sin(this.angle), L = this.len * grow;
    ctx.save();
    ctx.translate(this.x, this.y);
    const layers = [[P.vio1, 7, 0.35], [P.teal0, 4, 0.7], [this.color, 2, 1]];
    for (const [col, w, a] of layers) {
      ctx.globalAlpha = fade * a;
      ctx.fillStyle = col;
      const n = Math.ceil(L / 1.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n - 0.5, px = c * t * L, py = s * t * L, taper = 1 - Math.abs(t) * 1.7, ww = Math.max(1, Math.round(w * taper * (1 - f * 0.8)));
        if (taper <= 0) continue;
        ctx.fillRect(Math.round(px - ww / 2), Math.round(py - ww / 2), ww, ww);
      }
    }
    ctx.restore();
  }
}

// Rising pixel flames from a rectangle. Stops emitting after `emit` seconds.
export class Flames {
  constructor(x, y, w, o = {}) { Object.assign(this, { x, y, w, t: 0, emit: o.emit ?? 0.9, life: (o.emit ?? 0.9) + 0.9, rate: o.rate ?? 90, acc: 0 }); }
  update(dt) {
    this.t += dt;
    if (this.t < this.emit) {
      this.acc += this.rate * dt * (FX.reduced ? 0.35 : 1);
      while (this.acc >= 1) {
        this.acc--;
        const x = this.x + rand(-this.w / 2, this.w / 2), edge = 1 - Math.abs(x - this.x) / (this.w / 2);
        FX.parts.push({ x, y: this.y + rand(-4, 4), vx: rand(-8, 8), vy: -rand(40, 110) * (0.5 + edge * 0.7), life: rand(0.35, 0.8), max: 0.8, size: Math.round(rand(2, 5)), colors: FIRE, grav: -30, drag: 1.2, shrink: true, rot: 0, vr: 0 });
      }
    }
    return this.t < this.life;
  }
  draw() {}
}
