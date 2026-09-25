import { Pix, Spr } from '../core/pixel.js';
import { P } from './palette.js';

// The BONEHEAD wordmark: chunky 6x8-cell letters with 2-cell strokes, a blocky
// skull for the O, a bevel, a plum 3D side and a heavy ink outline. Built per
// letter so each one can bob, drop in and flash on its own.
const GLYPHS = {
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '##..##', '#####.'],
  N: ['##..##', '###.##', '###.##', '######', '##.###', '##.###', '##..##', '##..##'],
  E: ['######', '##....', '##....', '#####.', '##....', '##....', '##....', '######'],
  H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##', '##..##'],
  A: ['.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
};
export const LOGO_Q = 3;
const BONE = { grad: ['#ffffff', '#fff8ea', '#fff8ea', '#fbf1dc', '#f4e8cd', '#ecdcb9', '#e2cea6'], hi: '#ffffff', lo: '#cdb88f' };
const GOLD = { grad: ['#fff3a6', '#ffe275', '#ffd45e', '#ffc446', '#ffb238', '#fb9f2c', '#f38a24'], hi: '#fff8cf', lo: '#c8601e' };
const SIDE = '#3d0f33', SIDE_LO = '#26091f', EXTRUDE = 5, M = 3;

// Bevel + vertical gradient over a filled body.
function shade(body, pal) {
  const src = body.clone();
  return body.each((x, y, c) => {
    if (c !== 'F') return;
    const up = src.get(x, y - 1) === 'F', dn = src.get(x, y + 1) === 'F', lf = src.get(x - 1, y) === 'F';
    if (!up) return pal.hi;
    if (!dn) return pal.lo;
    if (!lf) return pal.grad[1];
    return pal.grad[Math.min(pal.grad.length - 1, Math.floor(y / body.h * pal.grad.length))];
  });
}

// Wrap a shaded body in outline + extruded side. Returns the sprite and a white
// silhouette of the face only, used for the glint that sweeps across the logo.
function dress(body) {
  const W = body.w + M * 2, H = body.h + M * 2 + EXTRUDE;
  const p = new Pix(W, H), face = new Pix(W, H);
  p.paste(body, M, M);
  body.each((x, y, c) => { if (c && c !== P.ink0 && c !== P.red1 && c !== P.red0) face.set(x + M, y + M, '#ffffff'); });
  p.outline(P.ink0); p.outline(P.ink0, true);
  const filled = [];
  p.each((x, y) => { filled.push(x, y); });
  for (let d = 1; d <= EXTRUDE; d++) for (let i = 0; i < filled.length; i += 2) {
    const x = filled[i], y = filled[i + 1] + d;
    if (!p.get(x, y)) p.set(x, y, d === EXTRUDE ? SIDE_LO : SIDE);
  }
  p.outline(P.ink0);
  return { spr: p.spr(), flash: face.spr(), w: body.w, h: body.h, ox: M, oy: M };
}

function letter(ch, pal) {
  const rows = GLYPHS[ch], q = LOGO_Q, b = new Pix(rows[0].length * q, rows.length * q);
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') b.rect(i * q, j * q, q, q, 'F'); }));
  return dress(shade(b, pal));
}

// 24x25 skull, a little wider than the letters, jaw hanging just below the baseline.
function skullBody(jaw = 0) {
  const b = new Pix(24, 25 + 2), F = 'F';
  b.ell(11.5, 9.5, 11.6, 9.8, F);
  b.rect(2, 12, 20, 6, F);
  b.rect(4, 17, 16, 2, F);
  // Teeth and jaw drop together when it chomps
  b.rect(5, 19 + jaw, 14, 3, F);
  b.rect(6, 22 + jaw, 12, 2, F);
  shade(b, BONE);
  const K = P.ink0;
  // Square sockets with glowing red pupils, looking slightly inward
  for (const sx of [3, 14]) {
    b.rect(sx, 8, 7, 6, K); b.set(sx, 8, BONE.grad[2]); b.set(sx + 6, 8, BONE.grad[2]);
    const px = sx === 3 ? sx + 3 : sx + 2;
    b.rect(px, 10, 2, 2, P.red1); b.set(px, 10, P.red0);
  }
  b.set(11, 15, K); b.set(12, 15, K); b.hline(10, 13, 16, K);
  // Mouth: a dark seam, then gaps between the teeth
  b.hline(4, 19, 18 + jaw, K);
  if (jaw) b.hline(5, 18, 19, K);
  for (const x of [7, 10, 13, 16]) b.vline(x, 19 + jaw, 21 + jaw, K);
  // A hairline crack over the brow for character
  b.set(16, 2, P.bone3); b.set(17, 3, P.bone3); b.set(17, 4, P.bone3); b.set(18, 5, P.bone3);
  return b;
}

export function buildLogo() {
  const letters = [...'BONEHEAD'].map((ch, i) => ch === 'O' ? null : letter(ch, i < 4 ? BONE : GOLD));
  const skull = dress(skullBody(0)), chomp = dress(skullBody(2));
  letters[1] = skull;
  return { letters, skull, chomp, gap: LOGO_Q, h: 8 * LOGO_Q };
}

// The title wordmark flattened into one sprite (no animation), so the HUD shows the
// very same artwork, just smaller.
export function wordmark(L = buildLogo()) {
  const W = L.letters.reduce((a, l) => a + l.w, 0) + L.gap * (L.letters.length - 1) + M * 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = L.h + M * 2 + EXTRUDE;
  const ctx = cv.getContext('2d');
  let x = 0;
  for (const l of L.letters) { ctx.drawImage(l.spr.c, x, 0); x += l.w + L.gap; }
  return new Spr(cv);
}

// 9x9 icons for the title links, in a resting and a highlighted colour.
export function linkIcons() {
  const make = draw => {
    const out = {};
    for (const [k, c] of [['off', P.bone1], ['on', P.gold1]]) { const p = new Pix(11, 11); draw(p, c); p.outline(P.ink0); out[k] = p.spr(); }
    return out;
  };
  return {
    play: make((p, c) => { for (let x = 0; x < 6; x++) p.vline(2 + x, 1 + Math.floor(x * 0.8), 9 - Math.floor(x * 0.8), c); }),
    book: make((p, c) => {
      p.rect(1, 2, 4, 7, c); p.rect(6, 2, 4, 7, c); p.vline(5, 3, 9, c);
      for (const y of [4, 6]) { p.hline(2, 3, y, P.ink3); p.hline(7, 8, y, P.ink3); }
    }),
    trophy: make((p, c) => {
      p.rect(3, 1, 5, 4, c); p.hline(4, 6, 5, c); p.set(2, 2, c); p.set(8, 2, c); p.set(1, 2, c); p.set(9, 2, c); p.set(1, 3, c); p.set(9, 3, c);
      p.vline(5, 6, 7, c); p.rect(3, 8, 5, 2, c);
    }),
    gear: make((p, c) => {
      p.ell(5, 5, 3.4, 3.4, c);
      for (const [x, y] of [[5, 1], [5, 9], [1, 5], [9, 5], [2, 2], [8, 2], [2, 8], [8, 8]]) p.set(x, y, c);
      p.rect(4, 4, 3, 3, null); p.set(5, 5, null);
    }),
  };
}

// A soft, out-of-focus copy of a sprite for cards far away in the title's depth.
// Box-blurred (premultiplied) at 2x, then served with smooth scaling.
export function blurSprite(s, rad = 2) {
  const k0 = 2, src = s.up(k0), pad = rad * 3;
  const cv = document.createElement('canvas');
  cv.width = src.width + pad * 2; cv.height = src.height + pad * 2;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, pad, pad);
  const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, W = cv.width, H = cv.height;
  const buf = new Float32Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { const a = d[i * 4 + 3] / 255; buf[i * 4] = d[i * 4] * a; buf[i * 4 + 1] = d[i * 4 + 1] * a; buf[i * 4 + 2] = d[i * 4 + 2] * a; buf[i * 4 + 3] = d[i * 4 + 3]; }
  const pass = (horiz) => {
    const out = new Float32Array(buf.length), n = horiz ? W : H, m = horiz ? H : W;
    for (let j = 0; j < m; j++) for (let ch = 0; ch < 4; ch++) {
      let acc = 0;
      const at = i => (horiz ? j * W + i : i * W + j) * 4 + ch;
      for (let i = -rad; i <= rad; i++) acc += i >= 0 && i < n ? buf[at(i)] : 0;
      for (let i = 0; i < n; i++) {
        out[at(i)] = acc / (rad * 2 + 1);
        const add = i + rad + 1, sub = i - rad;
        if (add < n) acc += buf[at(add)];
        if (sub >= 0) acc -= buf[at(sub)];
      }
    }
    buf.set(out);
  };
  pass(true); pass(false); pass(true); pass(false);
  for (let i = 0; i < W * H; i++) { const a = buf[i * 4 + 3] / 255 || 1; d[i * 4] = buf[i * 4] / a; d[i * 4 + 1] = buf[i * 4 + 1] / a; d[i * 4 + 2] = buf[i * 4 + 2] / a; d[i * 4 + 3] = buf[i * 4 + 3]; }
  ctx.putImageData(img, 0, 0);
  const out = { w: cv.width / k0, h: cv.height / k0, cache: new Map() };
  out.up = k => {
    let u = out.cache.get(k);
    if (!u) {
      u = document.createElement('canvas'); u.width = Math.round(out.w * k); u.height = Math.round(out.h * k);
      const x = u.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, u.width, u.height);
      out.cache.clear(); out.cache.set(k, u);
    }
    return u;
  };
  return out;
}

