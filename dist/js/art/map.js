import { Pix, rng } from '../core/pixel.js';
import { P } from './palette.js';

// The Midnight Circuit backdrop: a dithered night sky, a moon, a casino skyline
// with neon suit signs, rolling fog and a graveyard. Painted at half the virtual
// resolution for chunky pixels, sized to the screen's aspect.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const SKY = ['#0a0a1e', '#121232', '#1e1846', '#321d56', '#512252', '#76294a'];
const PIPS = [
  ['..#..', '.###.', '#####', '..#..', '.###.'],
  ['##.##', '#####', '#####', '.###.', '..#..'],
  ['.###.', '.###.', '#####', '..#..', '.###.'],
  ['..#..', '.###.', '#####', '.###.', '..#..'],
];

export function mapBackdrop(w, h, land) {
  const p = new Pix(w, h), r = rng(1337), hz = Math.round(h * (land ? 0.5 : 0.36));
  // Sky gradient with ordered dithering
  for (let y = 0; y < hz; y++) for (let x = 0; x < w; x++) {
    const t = y / hz * (SKY.length - 1) + (BAYER[y % 4][x % 4] / 16 - 0.5);
    p.set(x, y, SKY[Math.max(0, Math.min(SKY.length - 1, Math.round(t)))]);
  }
  for (let i = 0; i < w * hz / 55; i++) p.set(Math.floor(r() * w), Math.floor(r() * hz * 0.75), r() < 0.25 ? P.bone0 : '#6c63a8');
  // Moon with a dithered halo
  const mx = Math.round(w * (land ? 0.8 : 0.72)), my = Math.round(hz * 0.3), mr = Math.max(6, Math.round(Math.min(w, h) * 0.07));
  p.circ(mx, my, mr + 5, '#2e2560', (x, y) => (x + y) % 2 === 0);
  p.circ(mx, my, mr, P.bone0);
  p.circ(mx - mr * 0.3, my - mr * 0.2, mr * 0.25, P.bone2);
  p.circ(mx + mr * 0.35, my + mr * 0.35, mr * 0.18, P.bone2);
  p.each((x, y, c) => (c === P.bone0 && Math.hypot(x - mx, y - my) <= mr && x > mx + mr * 0.35 ? P.bone1 : undefined));
  // Casino skyline: windows, antennas and neon suit signs
  let x = -2;
  while (x < w) {
    const bw = 8 + Math.floor(r() * 16), bh = Math.round(hz * (0.14 + r() * 0.3)), top = hz - bh, body = r() < 0.5 ? '#1c1638' : '#211a42';
    p.rect(x, top, bw, bh + 2, body);
    for (let yy = top + 3; yy < hz - 2; yy += 4) for (let xx = x + 2; xx < x + bw - 1; xx += 3) if (r() < 0.32) p.set(xx, yy, r() < 0.5 ? P.gold1 : P.gold2);
    if (r() < 0.4) p.vline(x + (bw >> 1), top - 5, top, body);
    if (r() < 0.35 && bw >= 9) {
      const neon = [P.red1, P.teal1, P.vio1, P.gold1][Math.floor(r() * 4)], sx = x + (bw >> 1) - 2, sy = top + 3;
      p.rect(sx - 1, sy - 1, 7, 7, '#2b2150');
      p.map(PIPS[Math.floor(r() * 4)], sx, sy, { '#': neon });
    }
    x += bw + Math.floor(r() * 3);
  }
  // Rolling hills and a band of fog
  for (let xx = 0; xx < w; xx++) {
    const top = hz + Math.round(Math.sin(xx * 0.05) * 3 + Math.sin(xx * 0.013 + 1) * 5) + 5;
    for (let y = top; y < h; y++) p.set(xx, y, y < top + 2 ? '#241b44' : '#16112c');
  }
  for (let y = hz - 3; y < hz + 12; y++) for (let xx = 0; xx < w; xx++) if (BAYER[y % 4][xx % 4] < 6 - Math.abs(y - (hz + 4)) * 0.7) p.set(xx, y, '#3b3066');
  // Graveyard: tombstones and crosses scattered over the ground
  for (let i = 0; i < w / 10; i++) {
    const tx = Math.floor(r() * w), ty = hz + 14 + Math.floor(r() * (h - hz - 16)), stone = '#2a2350', hi = '#3b3470';
    if (r() < 0.7) { const tw = 4 + Math.floor(r() * 3), th = 4 + Math.floor(r() * 4); p.rect(tx, ty - th, tw, th, stone); p.ell(tx + tw / 2, ty - th, tw / 2, 2, stone); p.set(tx + 1, ty - th + 1, hi); }
    else { p.vline(tx + 1, ty - 7, ty, stone); p.hline(tx, tx + 2, ty - 5, stone); }
  }
  for (let i = 0; i < w / 4; i++) p.set(Math.floor(r() * w), hz + 10 + Math.floor(r() * (h - hz - 10)), '#1f1a3c');
  // Dead trees framing the edges
  const tree = (bx, dir) => {
    for (let y = hz - 6; y < h; y++) { p.set(bx, y, '#0b0917'); p.set(bx + 1, y, '#0b0917'); }
    for (let k = 0; k < 4; k++) { const by = hz - 4 + k * 7, len = 6 + Math.floor(r() * 6); p.line(bx, by, bx + dir * len, by - 4 - Math.floor(r() * 4), '#0b0917'); }
  };
  tree(3, 1); tree(w - 5, -1);
  return p;
}

export function crownIcon() {
  const p = new Pix(11, 8);
  p.poly([[0, 7], [0, 1], [3, 4], [5.5, 0], [8, 4], [11, 1], [11, 7]], P.gold1);
  p.hline(0, 10, 6, P.gold2);
  p.set(5, 5, P.red1);
  p.outline(P.ink0);
  return p;
}
