import { Pix } from '../core/pixel.js';
import { P } from './palette.js';

// ---------- Opponent portraits (44x44), each with idle / blink / talk frames ----------
function skull(p, cx, cy, rx, ry, o = {}) {
  const bone = o.bone ?? P.bone0, lo = o.lo ?? P.bone2, dark = P.ink0, jaw = o.jaw ?? 0;
  p.ell(cx, cy, rx, ry, bone);
  p.rect(Math.round(cx - rx * 0.62), Math.round(cy + ry * 0.45), Math.round(rx * 1.24), Math.round(ry * 0.45), bone);
  // Jaw, dropped when talking.
  const jx = Math.round(cx - rx * 0.58), jw = Math.round(rx * 1.16), jy = Math.round(cy + ry * 0.86) + jaw;
  p.rect(jx, jy, jw, Math.round(ry * 0.32), bone);
  if (jaw) p.rect(jx + 1, jy - jaw, jw - 2, jaw, P.ink1);
  // Side shading
  p.each((x, y, c) => (c === bone && (x > cx + rx * 0.45 || (y > cy + ry * 0.55 && x > cx + rx * 0.1)) ? lo : undefined));
  // Cheek hollows
  p.set(Math.round(cx - rx * 0.62), Math.round(cy + ry * 0.4), lo); p.set(Math.round(cx + rx * 0.58), Math.round(cy + ry * 0.4), lo);
  // Nose
  const nx = Math.round(cx) - 1, ny = Math.round(cy + ry * 0.38);
  p.rect(nx, ny, 3, 2, dark); p.set(nx + 1, ny + 2, dark);
  // Teeth rows
  for (let x = jx + 1; x < jx + jw - 1; x++) {
    p.set(x, jy - 1 - jaw, (x - jx) % 2 ? dark : bone);
    p.set(x, jy, (x - jx) % 2 ? dark : P.bone1);
  }
  if (o.goldTooth) p.set(Math.round(cx + 2) + ((Math.round(cx + 2) - jx) % 2 ? 1 : 0), jy - 1 - jaw, P.gold1);
  return { jx, jy, jw };
}
function eyes(p, cx, cy, sep, o = {}) {
  const w = o.w ?? 4, h = o.h ?? 4, glow = o.glow ?? P.teal1, blink = o.blink;
  for (const side of [-1, 1]) {
    const ex = Math.round(cx + side * sep - w / 2), ey = Math.round(cy - h / 2);
    p.rect(ex, ey, w, h, P.ink0);
    p.set(ex, ey, o.rim ?? P.ink2); p.set(ex + w - 1, ey, o.rim ?? P.ink2);
    if (blink) p.hline(ex, ex + w - 1, ey + Math.floor(h / 2), o.lid ?? P.bone2);
    else if (glow) { p.set(ex + Math.floor(w / 2) - (side < 0 ? 0 : 1), ey + 1, glow); p.set(ex + Math.floor(w / 2) - (side < 0 ? 0 : 1), ey + 2, o.glow2 ?? glow); }
  }
}

function luckyBones(state = 'idle') {
  const p = new Pix(44, 44);
  p.rect(0, 0, 44, 44, P.teal4);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) if ((x * 7 + y * 3) % 13 === 0) p.set(x, y, P.teal3);
  p.circ(22, 4, 14, '#12505a');
  // Shoulders: vest over shirt, bow tie.
  p.poly([[2, 44], [6, 35], [15, 32], [29, 32], [38, 35], [42, 44]], P.ink3);
  p.poly([[16, 32], [28, 32], [25, 44], [19, 44]], P.bone1);
  p.poly([[16, 32], [22, 40], [13, 44], [8, 44], [10, 36]], P.ink2);
  p.poly([[28, 32], [22, 40], [31, 44], [36, 44], [34, 36]], P.ink2);
  p.poly([[17, 33], [21, 35], [17, 37]], P.red2); p.poly([[27, 33], [23, 35], [27, 37]], P.red2); p.rect(21, 34, 2, 2, P.red1);
  p.set(22, 39, P.gold1); p.set(22, 42, P.gold1);
  // Tiny fan of cards in hand
  p.poly([[33, 37], [38, 35], [40, 42], [35, 44]], P.bone0); p.poly([[36, 36], [41, 36], [41, 43], [36, 43]], P.bone1);
  p.set(38, 38, P.red2); p.set(39, 39, P.red2);
  const s = skull(p, 22, 20, 11, 11, { jaw: state === 'talk' ? 2 : 0, goldTooth: true });
  eyes(p, 22, 20, 5, { w: 5, h: 5, glow: P.teal1, glow2: P.teal0, blink: state === 'blink' });
  // Green dealer visor
  p.hline(11, 33, 11, P.grn3); p.hline(10, 34, 12, P.grn2);
  p.ell(22, 13.5, 14, 3.2, '#3fae48cc');
  p.hline(9, 35, 13, P.grn1); p.hline(12, 32, 15, P.grn3);
  p.outline(P.ink0);
  void s;
  return p;
}

function velvetReaper(state = 'idle') {
  const p = new Pix(44, 44);
  p.rect(0, 0, 44, 44, P.vio4);
  for (let x = 0; x < 44; x += 6) { p.rect(x, 0, 2, 44, '#3a1d6e'); p.rect(x + 2, 0, 1, 44, '#321866'); }
  // Scythe behind
  p.line(38, 2, 30, 44, P.bone4); p.line(39, 2, 31, 44, P.bone3);
  for (let i = 0; i < 16; i++) { const a = i / 15 * 1.5; p.set(Math.round(38 - Math.cos(a) * 16), Math.round(3 + Math.sin(a) * 7), P.ink6); p.set(Math.round(38 - Math.cos(a) * 16), Math.round(4 + Math.sin(a) * 7), P.bone1); }
  // Hood and robe
  p.poly([[4, 44], [6, 22], [10, 9], [22, 3], [34, 9], [38, 22], [40, 44]], P.vio3);
  p.poly([[6, 44], [8, 22], [12, 10], [18, 6], [13, 20], [12, 44]], P.vio2);
  p.ell(22, 22, 11.5, 13, P.ink1);
  const glow = state === 'blink' ? null : P.vio0;
  skull(p, 22, 22, 8.5, 9, { bone: P.bone1, lo: P.ink5, jaw: state === 'talk' ? 2 : 0 });
  // Shadow of the hood across the upper face
  p.each((x, y, c) => (y < 18 && (c === P.bone1 || c === P.ink5) ? P.ink4 : undefined));
  eyes(p, 22, 20, 4, { w: 4, h: 3, glow, glow2: P.vio1, blink: state === 'blink', lid: P.ink5, rim: P.ink1 });
  // Velvet rose at the collar
  p.circ(29, 38, 2.6, P.red2); p.set(29, 37, P.red0); p.set(28, 38, P.red1); p.line(29, 40, 27, 43, P.grn2);
  p.poly([[14, 36], [22, 42], [30, 36], [30, 44], [14, 44]], P.vio3);
  p.hline(15, 29, 36, P.gold2);
  p.outline(P.ink0);
  return p;
}

function pitBoss(state = 'idle', frame = 0) {
  const p = new Pix(44, 44);
  p.rect(0, 0, 44, 44, P.red4);
  for (let y = 0; y < 44; y++) for (let x = 0; x < 44; x++) if (((x + y) % 8 === 0 && (x - y + 64) % 8 === 4)) p.set(x, y, P.gold4);
  p.circ(22, 30, 20, '#6b1830');
  // Broad pinstripe suit, red tie
  p.poly([[0, 44], [3, 34], [14, 31], [30, 31], [41, 34], [44, 44]], P.ink1);
  for (let x = 2; x < 42; x += 3) p.line(x, 34, x - 1, 44, P.ink3);
  p.poly([[16, 31], [28, 31], [22, 39]], P.bone0);
  p.poly([[21, 33], [23, 33], [24, 42], [22, 44], [20, 42]], P.red2);
  // Big skull
  skull(p, 22, 20, 12.5, 11, { jaw: state === 'talk' ? 2 : 0 });
  eyes(p, 22, 19, 5.5, { w: 5, h: 4, glow: state === 'blink' ? null : P.red1, glow2: P.fire2, blink: state === 'blink' });
  // Monocle
  for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; p.set(Math.round(27.5 + Math.cos(t) * 3.8), Math.round(19 + Math.sin(t) * 3.4), P.gold1); }
  p.line(31, 21, 33, 31, P.gold2);
  // Gold teeth
  for (let x = 16; x <= 28; x += 4) if (p.get(x, 26 + (state === 'talk' ? 0 : 0)) === P.bone0) p.set(x, 26, P.gold1);
  // Top hat
  p.rect(12, 0, 20, 9, P.ink1); p.rect(12, 6, 20, 2, P.red2); p.rect(7, 9, 30, 2, P.ink1); p.hline(13, 30, 1, P.ink3);
  // Cigar with ember and smoke
  const cy = state === 'talk' ? 30 : 28;
  p.rect(28, cy, 7, 2, P.gold3); p.hline(28, 34, cy, P.gold2); p.set(35, cy, P.fire1); p.set(35, cy + 1, P.fire2);
  p.outline(P.ink0);
  const smoke = [[36, cy - 3], [37, cy - 6], [36, cy - 9], [38, cy - 12]];
  smoke.forEach(([x, y], i) => { const dx = Math.round(Math.sin(frame * 0.9 + i) * 1); p.set(x + dx, y, i % 2 ? P.bone3 : P.bone2); if (i < 2) p.set(x + dx + 1, y, P.bone3); });
  return p;
}

export const OPPONENTS = [
  {
    id: 'lucky', name: 'Lucky Bones', venue: 'THE BACK ROOM', stake: 'A friendly game. Allegedly.', voice: 190, color: P.teal1,
    paint: luckyBones,
    lines: {
      intro: ['Pull up a chair, friend. Bones don\'t bite.', 'New blood! Well... new something.'],
      think: ['Hmm...', 'Lemme see here...', 'Eeny, meeny...'],
      houseBurn: ['Heh. Toasty!', 'Up in smoke, pal.'],
      playerBurn: ['Hey! That was my pile!', 'Easy with the matches!'],
      playerPickup: ['Oof. Heavy hand, pal.', 'Take your time. Take ALL of it.'],
      housePickup: ['Rattled me there.', 'I meant to do that.'],
      magic: ['Ooh, fancy.', 'Where\'d you learn that?'],
      houseWin: ['Better luck next life!'],
      playerWin: ['Ahh, you cleaned me out!'],
      low: ['Almost out, and I\'ve got a bone to pick.'],
    },
  },
  {
    id: 'velvet', name: 'The Velvet Reaper', venue: 'THE VELVET FLOOR', stake: 'The house is learning your tricks.', voice: 150, color: P.vio1,
    paint: velvetReaper,
    lines: {
      intro: ['Your time is borrowed, darling.', 'Shall we dance? I always lead.'],
      think: ['Mmm...', 'Patience...', 'Decisions, decisions.'],
      houseBurn: ['Ashes suit you.', 'How warm.'],
      playerBurn: ['Rude. Delightful, but rude.', 'Oh, you wicked thing.'],
      playerPickup: ['Keep them close, darling.', 'Heavier than it looks, hm?'],
      housePickup: ['A small setback.', 'How... tedious.'],
      magic: ['Cute trick.', 'I taught that one.'],
      houseWin: ['Sweet dreams, Bonehead.'],
      playerWin: ['Well played. I shall remember you.'],
      low: ['The end draws near, darling.'],
    },
  },
  {
    id: 'boss', name: 'The Pit Boss', venue: 'THE LAST CHANCE', stake: 'One final seat. Make it count.', voice: 110, color: P.red1,
    paint: pitBoss,
    lines: {
      intro: ['House always wins, kid. Always.', 'Sit. Nobody leaves my table smiling.'],
      think: ['...', 'Heh.', 'Let\'s see ya sweat.'],
      houseBurn: ['Burn it down!', 'Fire sale!'],
      playerBurn: ['You\'ll pay for that.', 'That was a mistake, kid.'],
      playerPickup: ['Pick it up. ALL of it.', 'The house thanks you.'],
      housePickup: ['...Noted.', 'You\'re gonna regret that.'],
      magic: ['Cheap trick.', 'Cute.'],
      houseWin: ['Told ya. House always wins.'],
      playerWin: ['Impossible... Get outta my casino.'],
      low: ['Last hand, kid. Say your prayers.'],
    },
  },
];

const portraitCache = new Map();
export function portrait(i, state = 'idle', frame = 0) {
  const key = `${i}-${state}-${i === 2 ? frame % 6 : 0}`;
  let s = portraitCache.get(key);
  if (!s) { s = OPPONENTS[i].paint(state, frame % 6).spr(); portraitCache.set(key, s); }
  return s;
}

// ---------- Title mascot: a grinning skull chomping an Ace of Spades ----------
export function mascot(wink = false, chomp = 0) {
  const p = new Pix(64, 60);
  // Cranium
  const bone = P.bone0, lo = P.bone2, dark = P.ink0;
  p.ell(30, 24, 22, 20, bone);
  p.rect(14, 30, 32, 14, bone);
  p.ell(15, 38, 5, 5, bone); p.ell(45, 38, 5, 5, bone);
  p.each((x, y, c) => (c === bone && (x > 42 || (y > 36 && x > 34)) ? P.bone1 : undefined));
  p.each((x, y, c) => (c === P.bone1 && x > 47 ? lo : undefined));
  // Crack
  p.line(24, 5, 27, 10, lo); p.line(27, 10, 25, 14, lo); p.line(27, 10, 31, 12, lo);
  // Eyes
  p.ell(20, 26, 6.5, 6, dark); p.ell(40, 26, 6.5, 6, dark);
  p.rect(17, 23, 3, 3, P.white); p.set(22, 28, P.teal1); p.set(21, 28, P.teal2);
  if (wink) { p.ell(40, 26, 6.5, 6, bone); p.line(34, 27, 40, 24, dark); p.line(40, 24, 46, 27, dark); p.line(34, 28, 40, 25, dark); p.line(40, 25, 46, 28, dark); }
  else { p.rect(37, 23, 3, 3, P.white); p.set(42, 28, P.teal1); p.set(41, 28, P.teal2); }
  // Nose
  p.poly([[28, 33], [33, 33], [30.5, 38]], dark);
  // Grin with teeth; jaw drops when chomping
  const jy = 42 + chomp;
  p.rect(16, jy, 28, 8, bone);
  p.each((x, y, c) => (c === bone && y >= jy && x > 38 ? P.bone1 : undefined));
  for (let x = 17; x <= 42; x++) { p.set(x, jy - 1, dark); p.set(x, jy + 3, x % 3 === 0 ? dark : undefined); }
  for (let x = 17; x <= 42; x += 3) { p.vline(x, jy, jy + 2, dark); p.vline(x, jy - 4, jy - 2, dark); }
  p.hline(17, 42, jy - 4, dark);
  p.set(26, jy - 3, P.gold1); p.set(27, jy - 3, P.gold1); p.set(26, jy - 2, P.gold2); p.set(27, jy - 2, P.gold2);
  p.outline(dark);
  p.outline(P.ink2);
  return p;
}

// ---------- Icons ----------
export function flameIcon(f = 0) {
  const p = new Pix(11, 13), layers = [[P.fire3, 5, 1], [P.fire2, 3.8, 4], [P.fire1, 2.4, 7], [P.fire0, 1.2, 9]];
  for (const [c, w, y0] of layers) for (let y = y0; y < 13; y++) {
    const k = (y - y0) / (13 - y0), sway = Math.sin(y * 0.8 + f * 2.2) * (1 - k) * 1.2;
    const hw = w * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.6) * (y > 10 ? 0.8 : 1);
    for (let x = 0; x < 11; x++) if (Math.abs(x + 0.5 - 5.5 - sway) <= hw) p.set(x, y, c);
  }
  p.outline(P.ink0);
  return p;
}
export function trophyIcon(c = P.gold1) {
  const p = new Pix(13, 13);
  p.rect(3, 1, 7, 5, c); p.ell(6.5, 5, 3.5, 3, c); p.rect(5, 8, 3, 2, c); p.rect(3, 10, 7, 2, c);
  p.set(1, 2, c); p.set(1, 3, c); p.set(2, 4, c); p.set(11, 2, c); p.set(11, 3, c); p.set(10, 4, c);
  p.vline(4, 2, 5, P.gold0);
  p.outline(P.ink0);
  return p;
}
export function lockIcon() {
  const p = new Pix(9, 11);
  p.rect(1, 4, 7, 6, P.gold2); p.hline(1, 7, 4, P.gold1); p.rect(2, 1, 1, 3, P.bone2); p.rect(6, 1, 1, 3, P.bone2); p.hline(3, 5, 0, P.bone2);
  p.set(4, 6, P.ink0); p.set(4, 7, P.ink0);
  p.outline(P.ink0);
  return p;
}
export function checkIcon(on = true) {
  const p = new Pix(9, 9);
  p.rect(0, 0, 9, 9, P.ink0); p.rect(1, 1, 7, 7, on ? P.grn2 : P.ink3);
  if (on) { p.set(2, 4, P.white); p.set(3, 5, P.white); p.set(4, 6, P.white); p.set(5, 5, P.white); p.set(6, 4, P.white); p.set(7, 3, P.white); p.set(3, 4, P.grn0); }
  else p.hline(2, 6, 1, P.ink4);
  return p;
}

export function trickIcon(id) {
  const p = new Pix(17, 17);
  if (id === 'reshuffle') {
    const bone = (x0, y0, x1, y1) => { p.line(x0, y0, x1, y1, P.bone0); p.line(x0 + 1, y0, x1 + 1, y1, P.bone1); [[x0, y0], [x1, y1]].forEach(([x, y]) => { p.circ(x - 0.5, y, 1.8, P.bone0); p.circ(x + 1.5, y, 1.8, P.bone0); }); };
    bone(3, 3, 13, 13); bone(3, 13, 13, 3);
  }
  if (id === 'swap') {
    for (let i = 0; i < 10; i++) { const a = Math.PI + i / 9 * Math.PI; p.set(Math.round(8.5 + Math.cos(a) * 6), Math.round(8 + Math.sin(a) * 5), P.teal1); p.set(Math.round(8.5 + Math.cos(a) * 6), Math.round(9 + Math.sin(a) * 5), P.teal2); }
    p.poly([[13, 5], [16, 9], [11, 9]], P.teal1);
    for (let i = 0; i < 10; i++) { const a = i / 9 * Math.PI; p.set(Math.round(8.5 + Math.cos(a) * 6), Math.round(8 + Math.sin(a) * 5), P.red1); p.set(Math.round(8.5 + Math.cos(a) * 6), Math.round(9 + Math.sin(a) * 5), P.red2); }
    p.poly([[4, 12], [1, 8], [6, 8]], P.red1);
  }
  if (id === 'wild') {
    p.poly([[1, 16], [3, 6], [13, 6], [15, 16]], P.vio2); p.rect(2, 5, 13, 3, P.gold1); p.hline(2, 14, 7, P.gold3);
    p.poly([[6, 7], [8, 0], [14, 2], [11, 8]], P.bone0); p.set(10, 3, P.red2); p.set(11, 4, P.red2);
  }
  if (id === 'chain') {
    for (const [cx, cy, c] of [[4.5, 12, P.gold2], [8.5, 8.5, P.gold1], [12.5, 5, P.gold2]])
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; p.set(Math.round(cx + Math.cos(a) * 3.2), Math.round(cy + Math.sin(a) * 2.4), c); }
    p.set(8, 8, P.gold0);
  }
  if (id === 'insurance') {
    p.circ(5.5, 8, 3.5, P.red1); p.circ(11.5, 8, 3.5, P.red1); p.poly([[2, 9], [15, 9], [8.5, 16]], P.red1); p.set(5, 7, P.red0); p.set(6, 7, P.white);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; p.set(Math.round(8.5 + Math.cos(a) * 5), Math.round(2 + Math.sin(a) * 1.4), P.gold1); }
  }
  if (id === 'embers') {
    p.ell(8.5, 11, 6, 5, P.bone3); p.rect(5, 4, 7, 3, P.bone3); p.hline(4, 12, 4, P.bone2); p.hline(3, 13, 9, P.bone2);
    p.set(7, 1, P.fire1); p.set(10, 0, P.fire2); p.set(8, 3, P.fire0); p.set(12, 2, P.fire3);
  }
  p.outline(P.ink0);
  return p;
}

export const Sprites = {
  mascot: null, mascotWink: null, mascotChomp: null, flame: [], trophy: null, trophyDim: null, lock: null, check: null, uncheck: null, tricks: {}, skull: null,
  init(skullIconFn) {
    this.mascot = mascot(false, 0).spr(); this.mascotWink = mascot(true, 0).spr(); this.mascotChomp = mascot(false, 2).spr();
    this.flame = [0, 1, 2].map(f => flameIcon(f).spr());
    this.trophy = trophyIcon().spr(); this.trophyDim = trophyIcon(P.ink4).spr();
    this.lock = lockIcon().spr(); this.check = checkIcon(true).spr(); this.uncheck = checkIcon(false).spr();
    for (const id of ['reshuffle', 'swap', 'wild', 'chain', 'insurance', 'embers']) this.tricks[id] = trickIcon(id).spr();
    const sk = skullIconFn(); sk.outline(P.ink0); this.skull = sk.spr();
    for (let i = 0; i < 3; i++) for (const st of ['idle', 'blink', 'talk']) portrait(i, st, 0);
  },
};
