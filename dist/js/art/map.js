import { Pix, rng } from '../core/pixel.js';
import { P } from './palette.js';

// The Midnight Circuit, seen from above: a candle-lit crypt with a card table in
// the middle (in the spirit of The Binding of Isaac's rooms). Painted at half the
// virtual resolution for chunky pixels. Returns the art plus where the table and
// candles are, so the screen can place cards and flicker the flames.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y) => BAYER[y & 3][x & 3] / 16;

export function mapRoom(w, h, land) {
  const p = new Pix(w, h), r = rng(4242);
  const wallT = Math.round(h * (land ? 0.17 : 0.1)), wallB = Math.round(h * 0.06), wallS = Math.round(w * (land ? 0.06 : 0.08));
  // Floor: stone slabs with mortar, grime and cracks
  const tile = 14, slabs = ['#2c2219', '#271e16', '#31261b', '#2a2118'];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tx = Math.floor((x + (Math.floor(y / tile) % 2) * 7) / tile), ty = Math.floor(y / tile);
    const mortar = (x + (Math.floor(y / tile) % 2) * 7) % tile === 0 || y % tile === 0;
    p.set(x, y, mortar ? '#16100b' : slabs[(tx * 7 + ty * 13) % slabs.length]);
  }
  for (let i = 0; i < w * h / 90; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); p.set(x, y, r() < 0.5 ? '#3a2e22' : '#1c150f'); }
  for (let i = 0; i < 10; i++) { let x = Math.floor(r() * w), y = Math.floor(r() * h); for (let k = 0; k < 8; k++) { p.set(x, y, '#140e09'); x += Math.round(r() * 2 - 1); y += 1; } }
  for (let i = 0; i < 7; i++) { const cx = r() * w, cy = r() * h, rad = 4 + r() * 8; p.circ(cx, cy, rad, '#1d160f', (x, y) => dith(x, y) < 0.45); }
  // Card table: shadow, wooden rim, felt with a lamp-lit centre
  const cx = w / 2, cy = wallT + (h - wallT - wallB) * (land ? 0.55 : 0.52);
  const rx = land ? w * 0.29 : w * 0.34, ry = land ? (h - wallT - wallB) * 0.33 : (h - wallT - wallB) * 0.3;
  p.ell(cx + 3, cy + 4, rx + 4, ry + 4, '#0b0810');
  p.ell(cx, cy, rx + 4, ry + 4, '#4a2a18');
  p.ell(cx, cy, rx + 3, ry + 3, '#6a3d22', (x, y) => y < cy);
  p.ell(cx, cy, rx + 1, ry + 1, '#3b2214');
  p.ell(cx, cy, rx, ry, '#1d5238');
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    if (d < 0.55 && dith(x, y) < 0.55 - d * 0.6) p.set(x, y, '#27684a');
    else if (d > 0.82 && dith(x, y) < (d - 0.82) * 4) p.set(x, y, '#164430');
  }
  p.ell(cx, cy, rx - 5, ry - 5, '#2a7050', (x, y) => Math.abs(Math.hypot((x + 0.5 - cx) / (rx - 5), (y + 0.5 - cy) / (ry - 5)) - 1) < 0.02 && (x + y) % 3 === 0);
  // Poker chips and a stray card on the felt edge
  const chip = (x, y, c) => { p.circ(x, y, 2.6, c); p.set(Math.round(x), Math.round(y - 2), P.bone0); p.set(Math.round(x), Math.round(y + 1), P.bone0); };
  chip(cx - rx * 0.78, cy + ry * 0.35, P.red2); chip(cx - rx * 0.72, cy + ry * 0.48, P.blue2); chip(cx + rx * 0.8, cy - ry * 0.3, P.gold2);
  // Walls: bricks with a lit top edge, deeper at the top (looking down and in)
  const brick = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const row = Math.floor((y - y0) / 5), off = row % 2 ? 4 : 0, mortar = (y - y0) % 5 === 4 || (x + off) % 9 === 0;
      p.set(x, y, mortar ? '#1b1620' : ((Math.floor((x + off) / 9) + row) % 3 ? '#4d4456' : '#433b4c'));
    }
  };
  brick(0, 0, w, wallT); brick(0, h - wallB, w, h); brick(0, 0, wallS, h); brick(w - wallS, 0, w, h);
  p.hline(wallS, w - wallS - 1, wallT - 2, '#766a80'); p.hline(wallS, w - wallS - 1, wallT - 1, '#5c5166'); p.hline(wallS, w - wallS - 1, wallT, '#0c090e');
  for (let y = wallT; y < h - wallB; y++) { p.set(wallS - 1, y, '#6a5e74'); p.set(wallS - 2, y, '#5c5166'); p.set(w - wallS, y, '#2e2733'); }
  p.hline(wallS - 2, w - wallS + 1, h - wallB, '#5c5166');
  // Soft shadow the walls cast onto the floor
  for (let y = wallT; y < h - wallB; y++) for (let x = wallS; x < w - wallS; x++) {
    const d = Math.min(y - wallT, x - wallS, w - wallS - 1 - x) / 10;
    if (d < 1 && dith(x, y) > d) p.set(x, y, '#120c08');
  }
  // Arched doorway in the top wall with a faint red glow
  const dx = Math.round(w / 2), dw = Math.max(8, Math.round(w * 0.06)), dh = Math.round(wallT * 0.75);
  p.rect(dx - dw - 2, wallT - dh - 2, dw * 2 + 4, dh + 2, '#5a4866');
  p.ell(dx, wallT - dh, dw + 2, dw * 0.8 + 2, '#5a4866', (x, y) => y < wallT - dh);
  p.rect(dx - dw, wallT - dh, dw * 2, dh, '#07050a');
  p.ell(dx, wallT - dh, dw, dw * 0.8, '#07050a', (x, y) => y < wallT - dh);
  for (let y = wallT; y < wallT + 8; y++) for (let x = dx - dw; x < dx + dw; x++) if (dith(x, y) < 0.5 - (y - wallT) / 16) p.set(x, y, '#3a1420');
  // Props on the floor: skulls, bones, scattered cards, wax stains
  const floorY = () => wallT + 6 + r() * (h - wallT - wallB - 12), floorX = () => wallS + 6 + r() * (w - wallS * 2 - 12);
  const clearOfTable = (x, y) => Math.hypot((x - cx) / (rx + 8), (y - cy) / (ry + 8)) > 1;
  const skull = (x, y) => { p.ell(x, y, 3, 2.6, P.bone2); p.rect(x - 1.5, y + 1.5, 3, 2, P.bone2); p.set(x - 1, y, '#120d17'); p.set(x + 1, y, '#120d17'); p.set(Math.round(x - 1), Math.round(y - 1), P.bone1); };
  const bone = (x, y, a) => { const c = Math.cos(a) * 3, s = Math.sin(a) * 3; p.line(x - c, y - s, x + c, y + s, P.bone3); p.set(Math.round(x - c), Math.round(y - s - 1), P.bone3); p.set(Math.round(x + c), Math.round(y + s + 1), P.bone3); };
  const card = (x, y) => { p.rect(x, y, 4, 6, P.bone2); p.set(x + 1, y + 2, r() < 0.5 ? P.red2 : P.ink3); };
  for (let i = 0; i < 26; i++) {
    const x = floorX(), y = floorY();
    if (!clearOfTable(x, y)) continue;
    const k = r();
    if (k < 0.18) skull(x, y); else if (k < 0.55) bone(x, y, r() * Math.PI); else if (k < 0.75) card(Math.round(x), Math.round(y));
    else p.circ(x, y, 1.5 + r() * 2, '#4a1f1f', (xx, yy) => dith(xx, yy) < 0.6);
  }
  // Cobwebs in the top corners
  for (const [ox, dir] of [[wallS, 1], [w - wallS - 1, -1]]) for (let k = 0; k < 4; k++) {
    p.line(ox, wallT + 1, ox + dir * (6 + k * 3), wallT + 1 + (12 - k * 3), '#6a6078');
    p.line(ox + dir * (2 + k * 2), wallT + 1, ox, wallT + 3 + k * 2, '#524868');
  }
  // Candles in the four inner corners, each with a warm pool of light
  const candles = [[wallS + 7, wallT + 7], [w - wallS - 8, wallT + 7], [wallS + 7, h - wallB - 8], [w - wallS - 8, h - wallB - 8]].map(([x, y]) => ({ x, y }));
  for (const c of candles) {
    for (let y = c.y - 14; y <= c.y + 14; y++) for (let x = c.x - 14; x <= c.x + 14; x++) {
      const d = Math.hypot(x - c.x, y - c.y) / 14;
      if (d < 1 && x >= wallS && x < w - wallS && y > wallT && y < h - wallB && dith(x, y) < (1 - d) * 0.35) p.set(x, y, '#4a3522');
    }
    p.rect(c.x - 1, c.y - 1, 3, 4, P.bone1); p.set(c.x, c.y - 1, P.bone0); p.set(c.x + 2, c.y + 3, P.bone2);
  }
  // Vignette
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2));
    if (d > 0.75 && dith(x, y) < (d - 0.75) * 1.4) p.set(x, y, '#07050a');
  }
  return { pix: p, candles, table: { cx, cy, rx, ry } };
}

export function crownIcon() {
  const p = new Pix(11, 8);
  p.poly([[0, 7], [0, 1], [3, 4], [5.5, 0], [8, 4], [11, 1], [11, 7]], P.gold1);
  p.hline(0, 10, 6, P.gold2);
  p.set(5, 5, P.red1);
  p.outline(P.ink0);
  return p;
}
