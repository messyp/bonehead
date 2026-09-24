import { rgba } from '../art/palette.js';

// A sprite is a tiny pixel canvas plus lazily built integer upscales. Drawing an
// integer upscale with smoothing on gives crisp pixels at any fractional zoom.
export class Spr {
  constructor(canvas) { this.c = canvas; this.w = canvas.width; this.h = canvas.height; this.u = null; this.uk = 0; }
  up(k) {
    if (this.uk !== k) {
      const u = document.createElement('canvas');
      u.width = this.w * k; u.height = this.h * k;
      const x = u.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(this.c, 0, 0, u.width, u.height);
      this.u = u; this.uk = k;
    }
    return this.u;
  }
}

// Pixel painter: shapes are rasterised by pixel centre, so they never antialias.
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.d[y * this.w + x] : null; }
  set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (this.in(x, y)) this.d[y * this.w + x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); return this; }
  vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); return this; }
  ell(cx, cy, rx, ry, c, test) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!test || test(x, y))) this.set(x, y, c);
      }
    return this;
  }
  circ(cx, cy, r, c, test) { return this.ell(cx, cy, r, r, c, test); }
  poly(pts, c) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        const px = x + 0.5, py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  // Stamp rows of characters using a palette map. Unmapped characters are skipped.
  map(rows, x, y, pal) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) this.set(x + i, y + j, c); } });
    return this;
  }
  // Paint a colour onto every empty pixel touching a filled one.
  outline(c, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const n = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1) ||
        (diag && (this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1)));
      if (n) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }
  // Recolour filled pixels. fn(x, y, colour) returns a colour, null, or undefined to keep.
  each(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.d[y * this.w + x];
      if (!c) continue;
      const r = fn(x, y, c);
      if (r !== undefined) this.d[y * this.w + x] = r;
    }
    return this;
  }
  replace(a, b) { return this.each((x, y, c) => (c === a ? b : undefined)); }
  paste(o, ox, oy) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const c = o.get(x, y); if (c) this.set(ox + x, oy + y, c); } return this; }
  clone() { const p = new Pix(this.w, this.h); p.d = this.d.slice(); return p; }
  flipX() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)]; return p; }
  rot180() { const p = new Pix(this.w, this.h); for (let i = 0; i < this.d.length; i++) p.d[i] = this.d[this.d.length - 1 - i]; return p; }
  silhouette(c) { return this.clone().each(() => c); }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (!c) continue;
      const [r, g, b, a] = rgba(c);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  spr() { return new Spr(this.canvas()); }
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
