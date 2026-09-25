import { Pix } from '../core/pixel.js';
import { FONT, TINY, glyph } from '../core/font.js';
import { P } from './palette.js';

export const CW = 41, CH = 57;
const RANK = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankLabel = r => RANK[r] || String(r);
export const MAGIC = {
  2: { name: 'RESET', color: P.teal2, light: P.teal0, dark: P.teal4, tint: '#e3fff6', desc: 'Plays on anything. Resets the pile, so any card can follow.' },
  8: { name: 'GHOST', color: P.vio1, light: P.vio0, dark: P.vio4, tint: '#f4ebff', desc: 'See-through! Plays on anything, and the card beneath it still sets the rule.' },
  9: { name: 'UNDERCUT', color: P.vio2, light: P.vio1, dark: P.vio4, tint: '#efe6ff', desc: 'Plays on anything. Flips the rule: the next card must be 9 or LOWER.' },
  10: { name: 'INFERNO', color: P.fire3, light: P.fire1, dark: P.fire4, tint: '#fff0dc', desc: 'Plays on anything. Burns the pile. You go again.' },
};
const red = s => s % 2 === 1;
export const suitCol = s => (red(s) ? P.red2 : P.ink3);
const suitHi = s => (red(s) ? P.red1 : P.ink5);

// Card silhouette with softly rounded corners.
const CUT = new Set(['0,0', '1,0', '2,0', '0,1', '0,2']);
export function inCard(x, y, w = CW, h = CH) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const cx = x < 3 ? x : x > w - 4 ? w - 1 - x : 9, cy = y < 3 ? y : y > h - 4 ? h - 1 - y : 9;
  return !CUT.has(cx + ',' + cy);
}

function base(fill, rim = P.ink1, hi = P.white, lo = P.bone2) {
  const p = new Pix(CW, CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (!inCard(x, y)) continue;
    const edge = !inCard(x - 1, y) || !inCard(x + 1, y) || !inCard(x, y - 1) || !inCard(x, y + 1);
    p.set(x, y, edge ? rim : fill);
  }
  // Bevel: a lit top-left edge and a shaded bottom-right edge.
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (p.get(x, y) !== fill) continue;
    if (p.get(x - 1, y) === rim || p.get(x, y - 1) === rim) p.set(x, y, hi);
    else if (p.get(x + 1, y) === rim || p.get(x, y + 1) === rim) p.set(x, y, lo);
  }
  return p;
}

function stampGlyph(p, font, ch, x, y, c) {
  const g = glyph(font, ch);
  g.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') p.set(x + i, y + j, c); });
  return g.w;
}
function stampText(p, font, str, x, y, c) { for (const ch of str) x += stampGlyph(p, font, ch, x, y, c) + 1; }
const textW = (font, str) => [...str].reduce((a, ch) => a + glyph(font, ch).w + 1, -1);

// ---------- Suit pips ----------
const PIP7 = {
  0: ['...#...', '..###..', '.#+###.', '#+#####', '#######', '.#.#.#.', '..###..'],
  1: ['.##.##.', '#+##+##', '#######', '#######', '.#####.', '..###..', '...#...'],
  2: ['..###..', '..#+#..', '##.#.##', '#+#####', '##.#.##', '...#...', '..###..'],
  3: ['...#...', '..#+#..', '.#+###.', '#######', '.#####.', '..###..', '...#...'],
};
const PIP5 = {
  0: ['..#..', '.###.', '#####', '..#..', '.###.'],
  1: ['##.##', '#####', '#####', '.###.', '..#..'],
  2: ['.###.', '.###.', '#####', '..#..', '.###.'],
  3: ['..#..', '.###.', '#####', '.###.', '..#..'],
};
function pip(s, big = true, flip = false) {
  const rows = (big ? PIP7 : PIP5)[s], n = rows.length, p = new Pix(n, n);
  p.map(rows, 0, 0, { '#': suitCol(s), '+': suitHi(s) });
  return flip ? p.rot180() : p;
}

export function bigPip(s, size = 17, rim = true) {
  const p = new Pix(size, size), c = suitCol(s), m = size / 17;
  if (s === 1) { p.circ(5.2 * m, 5.6 * m, 4.6 * m, c); p.circ(11.8 * m, 5.6 * m, 4.6 * m, c); p.poly([[0.9 * m, 7 * m], [16.1 * m, 7 * m], [8.5 * m, 16.2 * m]], c); }
  if (s === 3) p.poly([[8.5 * m, 0], [16.4 * m, 8.5 * m], [8.5 * m, 17 * m], [0.6 * m, 8.5 * m]], c);
  if (s === 0) { p.circ(5.2 * m, 10 * m, 4.3 * m, c); p.circ(11.8 * m, 10 * m, 4.3 * m, c); p.poly([[1 * m, 9.4 * m], [16 * m, 9.4 * m], [8.5 * m, 0.3 * m]], c); p.poly([[8.5 * m, 10 * m], [12 * m, 16.8 * m], [5 * m, 16.8 * m]], c); }
  if (s === 2) { p.circ(8.5 * m, 4.6 * m, 4.1 * m, c); p.circ(4.3 * m, 10.4 * m, 4.1 * m, c); p.circ(12.7 * m, 10.4 * m, 4.1 * m, c); p.poly([[8.5 * m, 7 * m], [12 * m, 16.8 * m], [5 * m, 16.8 * m]], c); }
  const hi = suitHi(s), lo = red(s) ? P.red3 : P.ink2;
  const q = p.clone();
  q.each((x, y) => (!p.get(x - 1, y) || !p.get(x, y - 1) ? hi : !p.get(x + 1, y) || !p.get(x, y + 1) ? lo : undefined));
  if (rim) q.outline(red(s) ? P.red4 : P.ink0);
  return q;
}

// ---------- Corners ----------
function corner(r, s, col) {
  const p = new Pix(12, 18), label = rankLabel(r), w = textW(FONT, label);
  stampText(p, FONT, label, 0, 0, col);
  const sp = pip(s, false), px = Math.max(0, Math.round(w / 2 - 2.5));
  p.paste(sp, px, 9);
  return p;
}

// ---------- Number pips ----------
const COLS = { L: 14, C: 20, R: 26 }, ROWS = { T: 13, U: 20, M: 28, D: 36, B: 43 };
const LAYOUT = {
  3: ['CT', 'CM', 'CB'],
  4: ['LT', 'RT', 'LB', 'RB'],
  5: ['LT', 'RT', 'CM', 'LB', 'RB'],
  6: ['LT', 'RT', 'LM', 'RM', 'LB', 'RB'],
  7: ['LT', 'RT', 'CU', 'LM', 'RM', 'LB', 'RB'],
};

// ---------- Skeleton royalty (J, Q, K) ----------
function royal(r, s) {
  const W = 27, H = 39, p = new Pix(W, H), robe = red(s) ? P.red2 : P.blue3, robeHi = red(s) ? P.red1 : P.blue2, robeLo = red(s) ? P.red3 : P.blue4;
  const bone = P.bone0, boneLo = P.bone2, dark = P.ink0, gold = P.gold1, goldLo = P.gold3;
  // Shoulders and robe
  p.poly([[1, 39], [3, 28], [8, 25], [19, 25], [24, 28], [26, 39]], robe);
  p.poly([[3, 39], [5, 29], [8, 27], [8, 39]], robeHi);
  p.poly([[19, 27], [22, 29], [24, 39], [19, 39]], robeLo);
  // Collar per rank
  if (r === 13) { for (let x = 5; x <= 21; x++) p.set(x, 26, P.bone1), p.set(x, 27, (x % 2) ? P.bone1 : P.bone2); p.rect(12, 28, 3, 11, gold); p.set(13, 30, P.red1); p.set(13, 34, P.red1); }
  if (r === 12) { p.poly([[8, 26], [19, 26], [13.5, 33]], P.vio2); for (let x = 9; x <= 18; x++) p.set(x, 27 + Math.round(Math.abs(x - 13.5) * -0.4 + 2), gold); p.set(13, 31, P.teal1); p.set(14, 31, P.teal0); }
  if (r === 11) { for (let x = 6; x <= 20; x++) p.set(x, 26, P.bone0), p.set(x, 27, x % 2 ? P.bone0 : P.bone2), p.set(x, 28, x % 3 ? P.bone1 : null); p.rect(13, 29, 1, 10, gold); }
  // Neck
  p.rect(11, 22, 5, 3, boneLo);
  // Skull
  p.ell(13.5, 13, 7, 7.2, bone);
  p.rect(9, 17, 9, 5, bone);
  p.each((x, y, c) => (c === bone && (x > 17 || y > 19) ? P.bone1 : undefined));
  // Eyes, nose, teeth
  p.rect(9, 12, 3, 3, dark); p.rect(15, 12, 3, 3, dark);
  p.set(9, 12, P.ink3); p.set(15, 12, P.ink3);
  const glow = r === 12 ? P.vio1 : r === 13 ? P.red1 : P.teal1;
  p.set(10, 13, glow); p.set(16, 13, glow);
  p.set(13, 16, dark); p.set(14, 16, dark); p.set(13, 17, dark);
  for (let x = 10; x <= 17; x++) p.set(x, 19, x % 2 ? dark : boneLo);
  p.hline(10, 17, 21, boneLo);
  // Headgear
  if (r === 13) {
    p.rect(6, 5, 16, 3, gold);
    p.poly([[6, 6], [6, 0], [9, 3], [11, 0], [13.5, 3], [16, 0], [18, 3], [21, 0], [21, 6]], gold);
    p.hline(6, 21, 7, goldLo);
    p.set(8, 6, P.red1); p.set(13, 6, P.teal1); p.set(14, 6, P.teal1); p.set(19, 6, P.red1);
    p.set(6, 0, P.gold0); p.set(11, 0, P.gold0); p.set(16, 0, P.gold0); p.set(21, 0, P.gold0);
  }
  if (r === 12) {
    p.poly([[4, 10], [6, 4], [13.5, 2], [21, 4], [23, 10], [24, 26], [20, 22], [20, 9], [7, 9], [7, 22], [3, 26]], P.vio2);
    p.poly([[4, 12], [6, 6], [7, 9], [7, 22], [3, 26]], P.vio1);
    p.hline(8, 19, 5, gold); p.poly([[11, 5], [13.5, 1], [16, 5]], gold);
    p.set(13, 3, P.teal0); p.set(14, 3, P.teal1);
  }
  if (r === 11) {
    p.ell(13.5, 5.5, 9, 3.6, P.teal2);
    p.hline(5, 22, 7, P.teal3); p.hline(6, 21, 8, P.teal3);
    p.hline(9, 18, 3, P.teal1);
    p.line(19, 4, 25, 0, P.red1); p.line(20, 5, 26, 2, P.red2); p.set(25, 1, P.red0);
    p.set(12, 5, gold); p.set(13, 5, gold); p.set(14, 5, gold);
  }
  // Rank prop
  if (r === 13) { p.vline(3, 14, 38, gold); p.circ(3.5, 13, 2, gold); p.set(3, 12, P.red1); }
  if (r === 12) { p.vline(23, 22, 32, P.grn2); p.circ(23.5, 20.5, 2.2, P.red1); p.set(23, 20, P.red0); p.set(22, 25, P.grn1); }
  if (r === 11) { p.vline(23, 26, 37, P.bone2); p.vline(24, 26, 36, P.white); p.hline(21, 26, 33, gold); p.rect(23, 34, 2, 3, P.gold3); }
  p.outline(dark);
  return p;
}

function magicArt(r, t = 0) {
  if (r === 2) {
    const p = new Pix(21, 21), c = P.teal2, hi = P.teal0, lo = P.teal3;
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const dx = x + 0.5 - 10.5, dy = y + 0.5 - 10.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d > 5.5 && d < 9.2 && !(a > -1.9 && a < -1.1) && !(a > 1.25 && a < 2.05)) p.set(x, y, d < 7 ? hi : d > 8.2 ? lo : c);
    }
    p.poly([[13, 1], [19, 3.5], [13, 8]], c); p.poly([[8, 13], [2, 17.5], [8, 20]], c);
    p.rect(9, 9, 3, 3, P.teal1); p.set(10, 10, P.white);
    p.outline(P.teal4);
    return p;
  }
  if (r === 8) {
    const p = new Pix(19, 21), body = P.white, sh = P.vio0;
    p.ell(9.5, 8, 7.5, 7.5, body); p.rect(2, 8, 15, 9, body);
    for (let x = 2; x < 17; x++) { const w = Math.round(Math.sin((x + t * 2) * 1.1) * 1.3 + 1.5); for (let y = 17; y < 17 + w; y++) p.set(x, y, body); }
    p.each((x, y, c) => (x > 12 ? sh : undefined));
    p.rect(5, 7, 3, 4, P.ink2); p.rect(11, 7, 3, 4, P.ink2); p.set(5, 7, P.vio2); p.set(11, 7, P.vio2);
    p.rect(8, 12, 3, 2, P.ink2);
    p.set(4, 12, P.red0); p.set(15, 12, P.red0);
    p.outline(P.vio3);
    return p;
  }
  if (r === 9) {
    const p = new Pix(17, 23);
    p.rect(3, 1, 11, 2, P.gold1); p.rect(7, 0, 3, 7, P.gold3); p.set(8, 1, P.gold0);
    p.rect(2, 6, 13, 2, P.gold1); p.hline(2, 14, 7, P.gold3);
    p.poly([[5.5, 8], [11.5, 8], [11.5, 17], [8.5, 23], [5.5, 17]], P.bone1);
    p.vline(8, 8, 21, P.white); p.poly([[9, 8], [11.5, 8], [11.5, 17], [9, 22]], P.bone3);
    p.outline(P.vio4);
    return p;
  }
  // 10: flame, three frames
  const p = new Pix(19, 23), f = t % 3;
  const layers = [[P.fire4, 9, 1], [P.fire3, 7.4, 3], [P.fire2, 5.6, 6], [P.fire1, 3.8, 9], [P.fire0, 2, 12]];
  for (const [c, w, y0] of layers) {
    for (let y = y0; y < 23; y++) {
      const k = (y - y0) / (23 - y0), sway = Math.sin(y * 0.55 + f * 2.1) * (1 - k) * 1.8;
      const hw = w * Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.62) * (y > 18 ? 1 - (y - 18) * 0.12 : 1);
      for (let x = 0; x < 19; x++) if (Math.abs(x + 0.5 - 9.5 - sway) <= hw) p.set(x, y, c);
    }
  }
  p.set(4 + f, 4 - (f % 2), P.fire2); p.set(14 - f, 6 + (f % 2), P.fire1);
  p.outline(P.fire4);
  return p;
}

// ---------- Faces ----------
function numberFace(r, s) {
  const p = base(P.bone0);
  const c = corner(r, s, suitCol(s));
  p.paste(c, 3, 3); p.paste(c.rot180(), CW - 3 - 12, CH - 3 - 18);
  if (r === 14) {
    // Ace: a big pip framed by a thin ornamental ring.
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; if (a % 2 === 0) p.set(Math.round(20 + Math.cos(t) * 13.4), Math.round(28 + Math.sin(t) * 13.4), P.bone2); }
    const big = bigPip(s, 17);
    p.paste(big, 12, 20);
    if (s === 0) { p.rect(18, 29, 2, 2, P.bone0); p.rect(22, 29, 2, 2, P.bone0); p.set(20, 32, P.bone0); p.set(21, 32, P.bone0); }
  } else if (LAYOUT[r]) {
    for (const code of LAYOUT[r]) {
      const cx = COLS[code[0]], cy = ROWS[code[1]], flip = cy > 28;
      p.paste(pip(s, true, flip), cx - 3, cy - 3);
    }
  } else if (r >= 11 && r <= 13) {
    // Framed portrait
    const fx = 7, fy = 9, fw = 27, fh = 39, bg = red(s) ? '#ffe6d6' : '#e3e6ff', pat = red(s) ? '#ffd2c2' : '#cfd4f7';
    p.rect(fx, fy, fw, fh, bg);
    for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if ((x + y) % 6 === 0) p.set(x, y, pat);
    p.paste(royal(r, s), fx, fy);
    for (let x = fx - 1; x <= fx + fw; x++) { p.set(x, fy - 1, P.gold2); p.set(x, fy + fh, P.gold2); }
    for (let y = fy - 1; y <= fy + fh; y++) { p.set(fx - 1, y, P.gold2); p.set(fx + fw, y, P.gold2); }
    // Index tabs cut into the frame so the rank stays readable.
    p.rect(2, 2, 9, 17, P.bone0); p.rect(CW - 11, CH - 19, 9, 17, P.bone0);
    for (let y = 2; y <= 18; y++) p.set(11, y, P.gold2); p.hline(2, 11, 19, P.gold2);
    for (let y = CH - 19; y <= CH - 3; y++) p.set(CW - 12, y, P.gold2); p.hline(CW - 12, CW - 3, CH - 20, P.gold2);
    p.paste(c, 3, 3); p.paste(c.rot180(), CW - 3 - 12, CH - 3 - 18);
  }
  return p;
}

function magicFace(r, s, frame = 0) {
  const m = MAGIC[r], p = base(m.tint, P.ink1, P.white, P.bone2);
  // Inset colour frame
  for (let y = 2; y < CH - 2; y++) for (let x = 2; x < CW - 2; x++) {
    const onFrame = (x === 2 || x === CW - 3 || y === 2 || y === CH - 3) && inCard(x - 1, y - 1) && inCard(x + 1, y + 1);
    if (onFrame) p.set(x, y, m.color);
  }
  // Art window with radial glow
  const wx = 8, wy = 12, ww = 25, wh = 30;
  for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
    const d = Math.hypot((x - 20) / ww, (y - 27) / wh);
    p.set(x, y, d < 0.22 ? m.light : d < 0.38 ? m.tint : '#ffffff');
  }
  for (let y = wy; y < wy + wh; y++) for (let x = wx; x < wx + ww; x++) {
    const d = Math.hypot((x - 20) / ww, (y - 27) / wh);
    if (d >= 0.38 && ((x * 3 + y * 5) % 11 === 0)) p.set(x, y, m.light);
  }
  const art = magicArt(r, frame), ax = Math.round(20.5 - art.w / 2), ay = Math.round(27.5 - art.h / 2);
  p.paste(art, ax, ay);
  if (r === 9) for (const x of [9, 28]) p.map(['..#..', '..#..', '#.#.#', '.###.', '..#..'], x, 31, { '#': P.vio2 });
  const c = corner(r, s, suitCol(s));
  p.paste(c, 4, 4);
  // Suit pip top-right keeps the suit readable for runs.
  p.paste(pip(s, false), CW - 10, 5);
  // Name plate
  const w = textW(TINY, m.name), px = Math.round(20.5 - w / 2) - 2;
  p.rect(px - 1, 45, w + 6, 8, P.ink1);
  p.rect(px, 46, w + 4, 6, m.color);
  p.hline(px, px + w + 3, 46, m.light);
  stampText(p, TINY, m.name, px + 2, 47, P.white);
  return p;
}

export function backPix(theme = 'crimson') {
  const t = theme === 'crimson'
    ? { fill: P.red3, line: P.red2, dot: P.red1, frame: P.gold2, frameHi: P.gold1, emblem: P.bone0 }
    : { fill: P.blue4, line: P.blue3, dot: P.blue2, frame: P.teal2, frameHi: P.teal1, emblem: P.bone0 };
  const p = base(t.fill, P.ink0, t.dot, P.red4);
  for (let y = 3; y < CH - 3; y++) for (let x = 3; x < CW - 3; x++) {
    if ((x + y) % 5 === 0 || (x - y + 100) % 5 === 0) p.set(x, y, t.line);
    if ((x + y) % 10 === 0 && (x - y + 100) % 10 === 0) p.set(x, y, t.dot);
  }
  for (let x = 3; x < CW - 3; x++) { p.set(x, 3, t.frame); p.set(x, CH - 4, t.frame); }
  for (let y = 3; y < CH - 3; y++) { p.set(3, y, t.frame); p.set(CW - 4, y, t.frame); }
  for (let x = 4; x < CW - 4; x++) p.set(x, 4, t.frameHi);
  // Diamond medallion with a skull.
  p.poly([[20.5, 13], [33, 28.5], [20.5, 44], [8, 28.5]], P.ink0);
  p.poly([[20.5, 15], [31, 28.5], [20.5, 42], [10, 28.5]], t.frame);
  p.poly([[20.5, 17], [29, 28.5], [20.5, 40], [12, 28.5]], P.ink1);
  const sk = skullIcon(t.emblem);
  p.paste(sk, 20 - 5, 23);
  return p;
}

export function skullIcon(c = P.bone0, eye = P.ink0) {
  const p = new Pix(11, 11);
  p.ell(5.5, 4.6, 5, 4.6, c); p.rect(3, 7, 5, 3, c);
  p.rect(2, 4, 3, 2, eye); p.rect(6, 4, 3, 2, eye); p.set(5, 7, eye);
  p.set(4, 9, eye); p.set(6, 9, eye);
  p.set(3, 4, P.red1); p.set(7, 4, P.red1);
  return p;
}

export function silhouette(c) { const p = new Pix(CW, CH); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (inCard(x, y)) p.set(x, y, c); return p; }

// Selection glow: a card-shaped ring 2px outside the card.
export function glowPix(c) {
  const p = new Pix(CW + 4, CH + 4);
  for (let y = 0; y < CH + 4; y++) for (let x = 0; x < CW + 4; x++) {
    const inside = inCard(x - 2, y - 2);
    if (inside) continue;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && inCard(x - 2 + dx, y - 2 + dy)) { near = true; break; }
    if (near) p.set(x, y, c);
  }
  return p;
}

// Foil shine frames: a pixel light band sweeping across the card.
export function shineFrames(n = 16) {
  const out = [];
  for (let f = 0; f < n; f++) {
    const p = new Pix(CW, CH), pos = -20 + f / (n - 1) * (CW + CH * 0.6 + 40);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!inCard(x, y)) continue;
      const d = Math.abs(x + y * 0.6 - pos);
      if (d < 1.5) p.set(x, y, '#ffffffaa');
      else if (d < 4) p.set(x, y, '#ffffff44');
      else if (Math.abs(x + y * 0.6 - pos + 9) < 1) p.set(x, y, '#ffffff33');
    }
    out.push(p.spr());
  }
  return out;
}

// ---------- Cache ----------
const cache = new Map();
export const Cards = {
  face(c, frame = 0) {
    const key = `${c.r}-${c.s}-${c.r === 10 ? frame % 3 : 0}`;
    let s = cache.get(key);
    if (!s) { s = (MAGIC[c.r] ? magicFace(c.r, c.s, frame % 3) : numberFace(c.r, c.s)).spr(); cache.set(key, s); }
    return s;
  },
  back: null, backBlue: null, shadow: null, dim: null, flash: null, glow: null, glowRed: null, glowTeal: null, shine: null,
  init() {
    this.back = backPix('crimson').spr();
    this.shadow = silhouette(P.ink0).spr();
    this.dim = silhouette(P.ink1).spr();
    this.flash = silhouette(P.white).spr();
    this.glow = glowPix(P.gold1).spr();
    this.glowRed = glowPix(P.red1).spr();
    this.glowTeal = glowPix(P.teal1).spr();
    this.shine = shineFrames();
    // Warm the cache so the first deal never hitches.
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) this.face({ r, s });
    for (let f = 1; f < 3; f++) for (let s = 0; s < 4; s++) this.face({ r: 10, s }, f);
  },
};
