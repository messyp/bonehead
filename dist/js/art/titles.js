import { Pix, rng } from '../core/pixel.js';
import { P } from './palette.js';

// Art for the title-screen concepts. One Bonehead skull design is painted at any
// size, so the logo's O and the hero skull are the same character.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y) => BAYER[y & 3][x & 3] / 16;

// ---------- the Bonehead skull ----------
// style 'crypt': shaded pixel bone. style 'sketch': ink lines and hatching on paper.
// candle: a lit candle stub melting on its head (the flame is drawn live).
// frame: sketch "boil" frame (jitters the ink), jaw: chatter offset, look: pupil shift.
export function skullFace(size, o = {}) {
  const style = o.style || 'crypt', s = size, candle = o.candle && s >= 24, jaw = o.jaw || 0, look = o.look || 0;
  const W = Math.round(s * 1.06), H = Math.round(s * (candle ? 1.34 : 1.02)) + jaw, top = candle ? Math.round(s * 0.3) : 0;
  const p = new Pix(W + 4, H + 4), cx = (W + 4) / 2, oy = 2 + top;
  const r = rng(1000 + (o.frame || 0) * 77), jit = () => (style === 'sketch' ? (r() - 0.5) * Math.max(0.6, s / 40) : 0);
  const bone = style === 'sketch' ? '#ddd0b0' : P.bone0, mark = '#b0a07f';
  // Cranium and jaw
  p.ell(cx + jit(), oy + s * 0.42 + jit(), s * 0.47, s * 0.42, bone);
  p.ell(cx + jit(), oy + s * 0.7 + jit(), s * 0.31, s * 0.2, bone);
  p.rect(Math.round(cx - s * 0.28), Math.round(oy + s * 0.78 + jaw), Math.round(s * 0.56), Math.round(s * 0.16), bone);
  if (jaw) p.rect(Math.round(cx - s * 0.26), Math.round(oy + s * 0.78), Math.round(s * 0.52), jaw, style === 'sketch' ? '#2a1d1a' : P.ink1);
  // Shading: pixel bands for crypt, hatching for sketch
  const shade = (x, y) => Math.hypot((x - cx + s * 0.14) / (s * 0.47), (y - oy - s * 0.34) / (s * 0.44)) > 0.86;
  if (style === 'crypt') {
    p.each((x, y, c) => (c === bone && shade(x, y) ? P.bone1 : undefined));
    p.each((x, y, c) => (c === P.bone1 && Math.hypot((x - cx + s * 0.22) / (s * 0.47), (y - oy - s * 0.3) / (s * 0.44)) > 1.02 ? P.bone2 : undefined));
    if (s >= 24) p.ell(cx - s * 0.2, oy + s * 0.16, s * 0.1, s * 0.05, P.white);
  } else {
    p.each((x, y, c) => (c === bone && shade(x, y) && (x + y + (o.frame || 0)) % 3 === 0 ? '#6b5a4a' : undefined));
  }
  const dark = style === 'sketch' ? '#2a1d1a' : P.ink0;
  // Big round sockets with a glint that looks around
  const er = Math.max(1.4, s * 0.13), ey = oy + s * 0.47;
  for (const ex of [cx - s * 0.18, cx + s * 0.18]) {
    p.ell(ex + jit(), ey + jit(), er, er * 1.08, dark);
    if (s >= 20) { p.rect(Math.round(ex - er * 0.45 + look), Math.round(ey - er * 0.5), Math.max(1, Math.round(er * 0.45)), Math.max(1, Math.round(er * 0.45)), style === 'sketch' ? '#f2e8d0' : P.white); }
    else p.set(Math.round(ex - 1 + look), Math.round(ey - 1), style === 'sketch' ? '#f2e8d0' : P.white);
  }
  // Nose and teeth
  if (s >= 20) p.map(['##.##', '#####', '.###.', '..#..'], Math.round(cx - 2.5), Math.round(oy + s * 0.61), { '#': dark });
  else p.set(Math.round(cx - 0.5), Math.round(oy + s * 0.64), dark);
  const ty = Math.round(oy + s * 0.8 + jaw), tx0 = Math.round(cx - s * 0.24), tx1 = Math.round(cx + s * 0.24);
  const step = Math.max(2, Math.round(s * 0.08));
  p.hline(tx0, tx1, ty - 1 - jaw, dark);
  for (let x = tx0; x <= tx1; x += step) p.vline(x, ty - Math.max(1, Math.round(s * 0.06)) - jaw, ty + Math.max(1, Math.round(s * 0.05)), dark);
  if (s >= 20) { const gx = Math.round(cx + step * 0.5); p.rect(gx, ty - Math.round(s * 0.05) - jaw, Math.max(1, step - 1), Math.max(1, Math.round(s * 0.05)), P.gold1); }
  // A crack across the crown
  if (s >= 16) { const x0 = cx + s * 0.16, y0 = oy + s * 0.04; p.line(x0, y0, x0 + s * 0.05, y0 + s * 0.12, style === 'sketch' ? dark : P.bone3); p.line(x0 + s * 0.05, y0 + s * 0.12, x0 - s * 0.02, y0 + s * 0.2, style === 'sketch' ? dark : P.bone3); }
  // Candle stub melting over the crown
  if (candle) {
    const cw = Math.round(s * 0.16), ch = Math.round(s * 0.3), cx0 = Math.round(cx - s * 0.12), cy0 = Math.round(oy + s * 0.02 - ch);
    const wax = style === 'sketch' ? '#f4ecd8' : '#f3e6c4', waxLo = style === 'sketch' ? '#cdbf9f' : '#d8c59c';
    p.rect(cx0, cy0, cw, ch, wax); p.vline(cx0 + cw - 1, cy0, cy0 + ch - 1, waxLo);
    for (let k = 0; k < 4; k++) { const dx = cx0 - 2 + k * Math.round(cw / 2), len = Math.round(s * (0.06 + (k % 2) * 0.1)); p.rect(dx, cy0 + ch - 1, 2, len, wax); }
    p.vline(Math.round(cx0 + cw / 2), cy0 - 3, cy0 - 1, dark);
  }
  p.outline(dark);
  if (style === 'crypt') p.outline(P.ink2);
  return p;
}
// Where the candle wick sits in a skullFace sprite (for the live flame).
export const wickOf = size => ({ x: (Math.round(size * 1.06) + 4) / 2 - size * 0.12 + size * 0.08, y: 2 + Math.round(size * 0.3) + size * 0.02 - Math.round(size * 0.3) - 4 });

// A bony pointing finger for menus.
export function boneFinger(style = 'crypt') {
  const p = new Pix(14, 7), c = style === 'sketch' ? '#eadfc4' : P.bone0, d = style === 'sketch' ? '#2a1d1a' : P.ink0;
  p.rect(0, 2, 5, 4, c); p.rect(5, 2, 7, 2, c); p.set(12, 2, c); p.rect(3, 5, 4, 1, c);
  p.set(4, 2, P.bone2); p.set(8, 3, P.bone2); p.set(11, 3, P.bone2);
  p.outline(d);
  return p;
}
export function spider() {
  const p = new Pix(9, 7), d = P.ink0;
  p.ell(4.5, 3.5, 2.5, 2.2, '#2a2230');
  for (const [x0, y0, x1, y1] of [[2, 2, 0, 0], [2, 4, 0, 6], [7, 2, 8, 0], [7, 4, 8, 6], [2, 3, 0, 3], [7, 3, 8, 3]]) p.line(x0, y0, x1, y1, d);
  p.set(3, 3, P.red1); p.set(5, 3, P.red1);
  return p;
}

// ---------- CRYPT: a crypt wall seen head-on ----------
export function cryptScene(w, h, land) {
  const p = new Pix(w, h), r = rng(9001);
  // Brick wall
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const row = Math.floor(y / 6), off = row % 2 ? 6 : 0, mortar = y % 6 === 5 || (x + off) % 12 === 0;
    const id = Math.floor((x + off) / 12) * 31 + row * 17;
    p.set(x, y, mortar ? '#16121b' : ['#3a3244', '#342d3e', '#3f3649', '#2f2939'][id % 4]);
  }
  for (let i = 0; i < w * h / 70; i++) p.set(Math.floor(r() * w), Math.floor(r() * h), r() < 0.5 ? '#4a4156' : '#231d2a');
  // Darkness toward the top and bottom
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(y / h - 0.5) * 2;
    if (dith(x, y) < (d - 0.35) * 0.9) p.set(x, y, '#0c0910');
  }
  // Layout anchors
  const plaque = land ? { w: Math.round(w * 0.58), h: Math.round(h * 0.2), y: Math.round(h * 0.07) } : { w: Math.round(w * 0.88), h: Math.round(h * 0.11), y: Math.round(h * 0.05) };
  plaque.x = Math.round(w / 2 - plaque.w / 2);
  const niche = land ? { w: Math.round(w * 0.24), h: Math.round(h * 0.4) } : { w: Math.round(w * 0.46), h: Math.round(h * 0.24) };
  niche.x = Math.round((land ? w * 0.34 : w * 0.5) - niche.w / 2); niche.y = land ? plaque.y + plaque.h + Math.round(h * 0.08) : plaque.y + plaque.h + Math.round(h * 0.06);
  const stone = land ? { w: Math.round(w * 0.3), h: Math.round(h * 0.6) } : { w: Math.round(w * 0.78), h: Math.round(h * 0.4) };
  stone.x = Math.round((land ? w * 0.74 : w * 0.5) - stone.w / 2); stone.y = land ? Math.round(h * 0.33) : niche.y + niche.h + Math.round(h * 0.07);
  const floorY = Math.round(h * 0.9);
  // Chains holding the plaque
  for (const cxx of [plaque.x + 8, plaque.x + plaque.w - 9]) for (let y = 0; y < plaque.y; y += 3) { p.rect(cxx - 1, y, 3, 2, '#5c5468'); p.set(cxx, y, '#16121b'); }
  // Stone plaque
  p.rect(plaque.x + 2, plaque.y + 3, plaque.w, plaque.h, '#0c0910');
  p.rect(plaque.x, plaque.y, plaque.w, plaque.h, '#5b5065');
  p.hline(plaque.x, plaque.x + plaque.w - 1, plaque.y, '#7c7088'); p.vline(plaque.x, plaque.y, plaque.y + plaque.h - 1, '#6d6179');
  p.hline(plaque.x, plaque.x + plaque.w - 1, plaque.y + plaque.h - 1, '#3a3243'); p.vline(plaque.x + plaque.w - 1, plaque.y, plaque.y + plaque.h - 1, '#433a4d');
  for (let i = 0; i < plaque.w * plaque.h / 30; i++) p.set(plaque.x + 1 + Math.floor(r() * (plaque.w - 2)), plaque.y + 1 + Math.floor(r() * (plaque.h - 2)), r() < 0.5 ? '#524859' : '#66596f');
  { let x = plaque.x + plaque.w * 0.8, y = plaque.y + 1; for (let k = 0; k < plaque.h * 0.7; k++) { p.set(Math.round(x), y + k, '#3a3243'); x += r() < 0.5 ? -1 : 1; } }
  // Arched niche with a shelf; dark inside
  const arch = (fill, grow) => {
    p.rect(niche.x - grow, niche.y + niche.w / 2, niche.w + grow * 2, niche.h - niche.w / 2 + grow, fill);
    p.ell(niche.x + niche.w / 2, niche.y + niche.w / 2, niche.w / 2 + grow, niche.w / 2 + grow, fill, (x, y) => y <= niche.y + niche.w / 2);
  };
  arch('#5a5064', 4); arch('#433a4d', 2); arch('#0a080d', 0);
  for (let y = niche.y; y < niche.y + niche.h; y++) for (let x = niche.x; x < niche.x + niche.w; x++) {
    const d = (y - niche.y) / niche.h;
    if (p.get(x, y) === '#0a080d' && dith(x, y) < d * 0.35) p.set(x, y, '#1c1418');
  }
  p.rect(niche.x - 6, niche.y + niche.h, niche.w + 12, 4, '#6b6076'); p.hline(niche.x - 6, niche.x + niche.w + 5, niche.y + niche.h, '#8a7f95');
  p.rect(niche.x - 5, niche.y + niche.h + 4, niche.w + 10, 2, '#2a2330');
  // Tombstone for the menu
  const tomb = (fill, g) => {
    p.rect(stone.x - g, stone.y + stone.w * 0.3, stone.w + g * 2, stone.h - stone.w * 0.3 + g, fill);
    p.ell(stone.x + stone.w / 2, stone.y + stone.w * 0.3, stone.w / 2 + g, stone.w * 0.3 + g, fill, (x, y) => y <= stone.y + stone.w * 0.3);
  };
  tomb('#0c0910', 3); tomb('#655b70', 0);
  for (let y = stone.y; y < stone.y + stone.h; y++) for (let x = stone.x; x < stone.x + stone.w; x++) {
    const c = p.get(x, y);
    if (c !== '#655b70') continue;
    if (x < stone.x + 3) p.set(x, y, '#837890');
    else if (x > stone.x + stone.w - 4) p.set(x, y, '#4b4256');
    else if (r() < 0.04) p.set(x, y, r() < 0.5 ? '#5a5065' : '#726780');
  }
  for (let x = stone.x; x < stone.x + stone.w; x++) for (let y = stone.y + stone.h - 6; y < stone.y + stone.h; y++) if (p.get(x, y) && dith(x, y) < (y - (stone.y + stone.h - 6)) / 8) p.set(x, y, '#3d5a3c');
  { let x = stone.x + stone.w * 0.25, y = stone.y + stone.w * 0.1; for (let k = 0; k < stone.h * 0.3; k++) { p.set(Math.round(x), Math.round(y + k), '#4b4256'); x += r() < 0.5 ? -0.6 : 0.6; } }
  // Floor with a bone pile under the niche
  for (let y = floorY; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, (Math.floor(x / 16) + Math.floor(y / 6)) % 2 ? '#1d1720' : '#221b26');
  p.hline(0, w - 1, floorY, '#3a3243');
  const pileX = land ? niche.x + niche.w / 2 : w * 0.18;
  for (let i = 0; i < 14; i++) {
    const x = pileX + (r() - 0.5) * 40, y = floorY + 2 + r() * (h - floorY - 4);
    if (r() < 0.3) { p.ell(x, y, 3, 2.5, P.bone2); p.set(Math.round(x - 1), Math.round(y), P.ink0); p.set(Math.round(x + 1), Math.round(y), P.ink0); }
    else { const a = r() * Math.PI, c = Math.cos(a) * 3, sn = Math.sin(a) * 1.5; p.line(x - c, y - sn, x + c, y + sn, P.bone3); }
  }
  // Moss drips and cobwebs
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * w), len = 2 + Math.floor(r() * 6); for (let y = 0; y < len; y++) p.set(x, Math.round(h * 0.12) + y + Math.floor(r() * h * 0.5), '#2f4a36'); }
  for (const [ox, dir] of [[0, 1], [w - 1, -1]]) for (let k = 0; k < 5; k++) { p.line(ox, 0, ox + dir * (8 + k * 5), 18 - k * 3, '#665c74'); p.line(ox + dir * (3 + k * 3), 0, ox, 4 + k * 3, '#554b62'); }
  // Wall sconces for torches
  const torches = land ? [{ x: Math.round(w * 0.08), y: Math.round(h * 0.42) }, { x: Math.round(w * 0.55), y: Math.round(h * 0.42) }] : [{ x: Math.round(w * 0.1), y: niche.y + 10 }, { x: Math.round(w * 0.9), y: niche.y + 10 }];
  for (const t of torches) {
    for (let y = t.y - 22; y <= t.y + 22; y++) for (let x = t.x - 22; x <= t.x + 22; x++) {
      const d = Math.hypot(x - t.x, y - t.y) / 22;
      if (d < 1 && p.in(x, y) && dith(x, y) < (1 - d) * 0.4) p.set(x, y, '#5a3c2c');
    }
    p.rect(t.x - 2, t.y, 5, 3, '#6b5b4a'); p.rect(t.x - 1, t.y + 3, 3, 6, '#4a3c30'); p.rect(t.x - 3, t.y - 3, 7, 3, '#8a6a3a');
  }
  // Vignette
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)); if (d > 0.8 && dith(x, y) < (d - 0.8) * 1.6) p.set(x, y, '#07050a'); }
  return { pix: p, plaque, niche, stone, torches, floorY };
}

// ---------- SKETCHBOOK: a torn notebook page on a desk ----------
export function sketchScene(w, h, land) {
  const p = new Pix(w, h), r = rng(777);
  // Dark wooden desk with grain
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = Math.sin(y * 0.35 + Math.sin(x * 0.02) * 3) + Math.sin(y * 0.09 + x * 0.004) * 0.6;
    p.set(x, y, g > 1 ? '#3a2416' : g > 0 ? '#2f1d12' : '#26170e');
  }
  // The page, slightly skewed, with torn edges
  const m = land ? { x: Math.round(w * 0.05), y: Math.round(h * 0.05), w: Math.round(w * 0.9), h: Math.round(h * 0.9) } : { x: Math.round(w * 0.04), y: Math.round(h * 0.03), w: Math.round(w * 0.92), h: Math.round(h * 0.94) };
  const edge = [];
  for (let i = 0; i < 2 * (m.w + m.h); i++) edge.push(Math.round(r() * 2));
  for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) {
    const tl = y - m.y < edge[(x - m.x) % edge.length] || x - m.x < edge[(y - m.y + 37) % edge.length] || m.x + m.w - 1 - x < edge[(y - m.y + 71) % edge.length] || m.y + m.h - 1 - y < edge[(x - m.x + 13) % edge.length];
    if (!tl) p.set(x + Math.round((y - m.y) * -0.01), y, '#cbbb97');
  }
  // Drop shadow on the desk
  for (let y = m.y + 3; y < m.y + m.h + 3; y++) for (let x = m.x + 3; x < m.x + m.w + 3; x++) if (p.get(x, y) !== '#cbbb97' && dith(x, y) < 0.7) p.set(x, y, '#170d07');
  // Ruled lines and a red margin
  for (let y = m.y + 14; y < m.y + m.h - 4; y += 9) for (let x = m.x + 3; x < m.x + m.w - 3; x++) if (p.get(x, y) === '#cbbb97') p.set(x, y, '#aab3b8');
  for (let y = m.y + 3; y < m.y + m.h - 3; y++) { const x = m.x + Math.round(m.w * 0.12); if (p.get(x, y) === '#cbbb97' || p.get(x, y) === '#aab3b8') p.set(x, y, '#c98680'); }
  // Paper grain, a coffee ring and a blood splat
  for (let i = 0; i < m.w * m.h / 25; i++) { const x = m.x + Math.floor(r() * m.w), y = m.y + Math.floor(r() * m.h); if (p.get(x, y) === '#cbbb97') p.set(x, y, '#c0af8b'); }
  const ring = (cx0, cy0, rr) => { for (let a = 0; a < Math.PI * 2; a += 0.02) { const x = Math.round(cx0 + Math.cos(a) * rr), y = Math.round(cy0 + Math.sin(a) * rr * 0.92); if (p.get(x, y) && r() < 0.8) { p.set(x, y, '#b89a70'); if (r() < 0.4) p.set(x + 1, y, '#c9ad85'); } } };
  ring(m.x + m.w * (land ? 0.14 : 0.8), m.y + m.h * (land ? 0.8 : 0.9), Math.min(m.w, m.h) * 0.09);
  const splat = (cx0, cy0, rr) => { p.circ(cx0, cy0, rr, '#9e2330', (x, y) => p.get(x, y) && dith(x, y) < 0.85); for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, d = rr + 2 + r() * rr; p.circ(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, 0.8 + r() * 1.4, '#9e2330'); } };
  splat(m.x + m.w * (land ? 0.93 : 0.9), m.y + m.h * (land ? 0.1 : 0.08), 3);
  // Margin doodles: a card, a bone, a fly
  const ink = '#2a1d1a', dx = m.x + Math.min(6, Math.round(m.w * 0.12) - 10), dy = m.y + m.h * 0.45;
  p.rect(dx, dy, 7, 10, '#f4ecd8'); p.hline(dx, dx + 6, dy, ink); p.hline(dx, dx + 6, dy + 9, ink); p.vline(dx, dy, dy + 9, ink); p.vline(dx + 6, dy, dy + 9, ink); p.set(dx + 3, dy + 4, '#9e2330'); p.set(dx + 3, dy + 5, '#9e2330');
  p.line(dx, dy + 18, dx + 7, dy + 22, ink); p.set(dx - 1, dy + 17, ink); p.set(dx - 1, dy + 19, ink); p.set(dx + 8, dy + 21, ink); p.set(dx + 8, dy + 23, ink);
  p.set(dx + 3, dy + 30, ink); p.set(dx + 2, dy + 29, '#8fa4b4'); p.set(dx + 4, dy + 29, '#8fa4b4');
  return { pix: p, page: m };
}
