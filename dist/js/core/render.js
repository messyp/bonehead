import { Pix } from './pixel.js';
import { FONT, TINY, glyph } from './font.js';
import { P } from '../art/palette.js';

// Everything is laid out in virtual pixels. R.S converts to device pixels.
export const R = {
  scene: null, ctx: null, W: 1, H: 1, S: 1, vw: 480, vh: 300, k: 1, dpr: 1, land: true, t: 0,
  trauma: 0, shakeOn: true, shakeX: 0, shakeY: 0, shakeR: 0, punch: 0, quality: 1, soft: false, maxPixels: 9e6,

  // soft: a CPU-backed canvas. Firefox's GPU canvas can drop images drawn from
  // many small source canvases (our glyphs and sprites), so it renders in software.
  init(soft = false) {
    this.soft = soft;
    this.maxPixels = soft ? 3.2e6 : 9e6;
    this.scene = document.createElement('canvas');
    this.ctx = this.scene.getContext('2d', { alpha: true, willReadFrequently: soft });
  },

  resize(cssW, cssH, dpr) {
    const budget = Math.min(1, Math.sqrt(this.maxPixels / Math.max(1, cssW * cssH * dpr * dpr)));
    this.dpr = dpr * this.quality * budget;
    const W = Math.max(1, Math.round(cssW * this.dpr)), H = Math.max(1, Math.round(cssH * this.dpr));
    this.W = W; this.H = H;
    this.land = W / H >= 0.9;
    const base = this.land ? [480, 300] : [250, 440];
    let S = Math.min(W / base[0], H / base[1]);
    if (S >= 2 && S - Math.floor(S) < 0.25) S = Math.floor(S);
    S = Math.max(0.5, S);
    this.S = S; this.vw = W / S; this.vh = H / S;
    this.k = Math.max(1, Math.min(8, Math.ceil(S - 0.01)));
    this.scene.width = W; this.scene.height = H;
  },

  begin(dt) {
    this.t += dt;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.punch = Math.max(0, this.punch - dt * 3);
    const s = this.shakeOn ? this.trauma * this.trauma : 0, t = this.t * 60;
    this.shakeX = s * 7 * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 2.9 + 1) * 0.4);
    this.shakeY = s * 6 * (Math.sin(t * 1.7 + 3) * 0.6 + Math.sin(t * 3.3) * 0.4);
    this.shakeR = s * 0.02 * Math.sin(t * 1.1 + 5);
    this.base();
  },

  base() {
    const ctx = this.ctx, S = this.S, z = 1 + this.punch * 0.025;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.translate(this.vw / 2, this.vh / 2);
    ctx.rotate(this.shakeR);
    ctx.scale(z, z);
    ctx.translate(-this.vw / 2 + this.shakeX, -this.vh / 2 + this.shakeY);
  },
  screen() { this.ctx.setTransform(this.S, 0, 0, this.S, 0, 0); },

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); },

  // Draw a sprite. x/y is the anchor point (default centre).
  spr(s, x, y, o = {}) {
    if (!s) return;
    const ctx = this.ctx, k = this.k, img = s.up(k);
    const sx = (o.sx ?? o.sc ?? 1) * (o.flip ? -1 : 1), sy = o.sy ?? o.sc ?? 1;
    const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.comp) ctx.globalCompositeOperation = o.comp;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.skx || o.sky) ctx.transform(1, o.sky || 0, o.skx || 0, 1, 0, 0);
    ctx.scale(sx / k, sy / k);
    ctx.drawImage(img, -ax * s.w * k, -ay * s.h * k);
    ctx.restore();
  },

  rect(x, y, w, h, c, a = 1) {
    const ctx = this.ctx;
    if (a !== 1) { const g = ctx.globalAlpha; ctx.globalAlpha = g * a; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.globalAlpha = g; }
    else { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  },

  // Chamfered pixel rectangle.
  box(x, y, w, h, c, r = 2, a = 1) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (r <= 0 || w < 5 || h < 5) return this.rect(x, y, w, h, c, a);
    if (r === 1) { this.rect(x + 1, y, w - 2, h, c, a); this.rect(x, y + 1, 1, h - 2, c, a); this.rect(x + w - 1, y + 1, 1, h - 2, c, a); return; }
    this.rect(x + 2, y, w - 4, h, c, a);
    this.rect(x, y + 2, 2, h - 4, c, a); this.rect(x + w - 2, y + 2, 2, h - 4, c, a);
    this.rect(x + 1, y + 1, 1, 1, c, a); this.rect(x + w - 2, y + 1, 1, 1, c, a);
    this.rect(x + 1, y + h - 2, 1, 1, c, a); this.rect(x + w - 2, y + h - 2, 1, 1, c, a);
  },

  // Balatro-ish chunky panel: drop shadow, dark rim, fill, inner highlight.
  panel(x, y, w, h, o = {}) {
    const fill = o.fill ?? P.ink2, rim = o.rim ?? P.ink0, hi = o.hi ?? P.ink3, a = o.alpha ?? 1;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (o.shadow !== false) this.box(x, y + (o.depth ?? 2), w, h, P.ink0, 2, 0.45 * a);
    this.box(x, y, w, h, rim, 2, a);
    this.box(x + 1, y + 1, w - 2, h - 2, fill, 2, a);
    if (hi) this.rect(x + 3, y + 1, w - 6, 1, hi, a);
    if (o.lo) this.rect(x + 3, y + h - 2, w - 6, 1, o.lo, a);
  },

  // ---------- Text ----------
  glyphs: new Map(),
  glyphSpr(font, ch, fill, out, shadow) {
    const key = (font === TINY ? 't' : 'f') + ch + fill + (out || '-') + (shadow || '-');
    let s = this.glyphs.get(key);
    if (s) return s;
    const g = glyph(font, ch), p = new Pix(g.w + 2, g.h + 3);
    const on = (x, y) => y >= 0 && y < g.rows.length && g.rows[y][x] === '#';
    if (shadow) {
      for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++) {
        const hit = on(x, y) || (out && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)));
        if (hit) p.set(x + 1, y + 2, shadow);
      }
    }
    if (out) for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++)
      if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1))) p.set(x + 1, y + 1, out);
    for (let y = 0; y < g.rows.length; y++) for (let x = 0; x < g.w; x++) if (on(x, y)) p.set(x + 1, y + 1, fill);
    s = p.spr(); s.adv = g.w; this.glyphs.set(key, s);
    return s;
  },

  codes: { w: P.bone0, g: P.gold1, r: P.red1, b: P.blue1, t: P.teal1, v: P.vio1, d: P.ink6, k: P.ink0, o: P.fire2, p: P.red0, y: P.bone2, l: P.grn1 },

  // Strip ^x colour codes and split into coloured runs.
  runs(str, base) {
    const out = []; let col = base, buf = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '^' && i + 1 < str.length) {
        const code = str[i + 1];
        if (buf) { out.push([buf, col]); buf = ''; }
        col = code === '0' ? base : (this.codes[code] || base);
        i++; continue;
      }
      buf += ch;
    }
    if (buf) out.push([buf, col]);
    return out;
  },

  measure(str, o = {}) {
    const font = o.font || FONT, size = o.size || 1, sp = (o.spacing ?? font.space);
    let w = 0, n = 0;
    for (const [s] of this.runs(String(str), '')) for (const ch of s) { w += glyph(font, ch).w + sp; n++; }
    return n ? (w - sp) * size : 0;
  },

  // Returns the drawn width. Options: size, color, outline, shadow, align, wave, alpha, reveal, fx(i, n) -> {dx, dy, sc, rot, a}
  text(str, x, y, o = {}) {
    str = String(str);
    const font = o.font || FONT, size = o.size || 1, base = o.color || P.bone0;
    const out = o.outline === undefined ? P.ink0 : o.outline, sh = o.shadow === undefined ? P.ink0 : o.shadow;
    const sp = o.spacing ?? font.space, w = this.measure(str, o);
    let cx = x - (o.align === 'center' ? w / 2 : o.align === 'right' ? w : 0);
    const cy = y - (o.valign === 'middle' ? font.cap * size / 2 : 0);
    const ctx = this.ctx, k = this.k, reveal = o.reveal ?? Infinity;
    const runs = this.runs(str, base), total = runs.reduce((a, r) => a + r[0].length, 0);
    let i = 0;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    for (const [s, col] of runs) {
      for (const ch of s) {
        if (i >= reveal) break;
        const g = this.glyphSpr(font, ch, col, out, sh);
        let dx = 0, dy = 0, sc = 1, rot = 0, a = 1;
        if (o.wave) dy += Math.sin(this.t * (o.waveSpeed ?? 5) + i * (o.waveFreq ?? 0.55)) * o.wave;
        if (o.fx) { const f = o.fx(i, total); if (f) { dx += f.dx || 0; dy += f.dy || 0; sc = f.sc ?? 1; rot = f.rot || 0; a = f.a ?? 1; } }
        if (ch !== ' ' && a > 0) {
          const gw = g.w * size, gh = g.h * size, px = cx + dx - size, py = cy + dy - size;
          if (sc === 1 && !rot && a === 1) {
            ctx.drawImage(g.up(k), px, py, gw, gh);
          } else {
            ctx.save();
            ctx.globalAlpha *= a;
            ctx.translate(px + gw / 2, py + gh / 2); ctx.rotate(rot); ctx.scale(sc, sc);
            ctx.drawImage(g.up(k), -gw / 2, -gh / 2, gw, gh);
            ctx.restore();
          }
        }
        cx += (g.adv + sp) * size; i++;
      }
    }
    ctx.restore();
    return w;
  },

  wrap(str, maxW, o = {}) {
    const lines = [];
    for (const para of String(str).split('\n')) {
      let line = '', carry = '';
      for (const word of para.split(' ')) {
        const test = line ? line + ' ' + word : carry + word;
        if (line && this.measure(test, o) > maxW) {
          lines.push(line);
          const codes = (line.match(/\^./g) || []);
          carry = codes.length ? codes[codes.length - 1] : '';
          line = carry + word;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  },

  // Wrapped paragraph; returns height used.
  para(str, x, y, maxW, o = {}) {
    const font = o.font || FONT, size = o.size || 1, lh = (o.lineH ?? font.line + 1) * size;
    const lines = this.wrap(str, maxW, o);
    lines.forEach((l, i) => this.text(l, o.align === 'center' ? x + maxW / 2 : o.align === 'right' ? x + maxW : x, y + i * lh, o));
    return lines.length * lh;
  },
};
export { FONT, TINY };
