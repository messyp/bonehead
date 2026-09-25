import { R } from '../core/render.js';
import { TINY } from '../core/font.js';
import { Input } from '../core/input.js';
import { clamp } from '../core/tween.js';
import { P } from '../art/palette.js';
import { Sprites } from '../art/sprites.js';
import { Audio } from '../audio/sfx.js';
import { skullFace, wickOf, boneFinger, spider, cryptScene, sketchScene } from '../art/titles.js';

// Reimagined title screens. Both use one vertical menu with a single pointer and
// the same Bonehead skull for the logo's O and the hero.
export function menuItems(game) {
  const has = game.hasSave();
  return [
    ...(has ? [['continue', 'CONTINUE']] : [['play', 'PLAY']]),
    ...(has ? [['new', 'NEW RUN']] : []),
    ['rules', 'RULES'], ['options', 'OPTIONS'], ['trophies', 'TROPHIES'],
  ];
}

const cache = new Map();
const memo = (key, make) => { let v = cache.get(key); if (!v) cache.set(key, (v = make())); return v; };
const skullSpr = (size, o) => memo(`skull-${size}-${o.style}-${o.candle ? 1 : 0}-${o.jaw || 0}-${o.look || 0}-${o.frame || 0}`, () => skullFace(size, o).spr());

// Shared menu behaviour: hovering selects, clicking or Enter activates.
function menu(game, items, rects, act) {
  game.titleSel = clamp(game.titleSel ?? 0, 0, items.length - 1);
  const moved = game.titleMouse?.x !== Input.x || game.titleMouse?.y !== Input.y;
  game.titleMouse = { x: Input.x, y: Input.y };
  items.forEach((it, i) => {
    const r = rects[i];
    if (moved && Input.over(r.x, r.y, r.w, r.h) && !game.modal && game.titleSel !== i) { game.titleSel = i; Audio.play('hover', i + 2); }
    if (Input.button('tm-' + it[0], r.x, r.y, r.w, r.h, !game.modal)) { game.titleSel = i; Audio.play('ui'); act(it[0]); }
  });
}

// Skull animation shared by both styles: glints look around, the jaw chatters now and then.
function skullState(t) {
  const look = Math.round(Math.sin(t * 0.7) * 1.2);
  const jaw = (t % 5) > 4.4 && Math.floor(t * 10) % 2 ? 1 : 0;
  return { look, jaw };
}

// ---------- CRYPT ----------
export function crypt(game, act) {
  const vw = R.vw, vh = R.vh, land = R.land, t = R.t;
  const key = `crypt-${Math.ceil(vw / 2)}x${Math.ceil(vh / 2)}`;
  const scene = memo(key, () => { const s = cryptScene(Math.ceil(vw / 2), Math.ceil(vh / 2), land); s.spr = s.pix.spr(); return s; });
  const A = r => ({ x: r.x * 2, y: r.y * 2, w: r.w * 2, h: r.h * 2 });
  const plaque = A(scene.plaque), niche = A(scene.niche), stone = A(scene.stone);
  R.spr(scene.spr, 0, 0, { sc: 2, ax: 0, ay: 0 });
  // Torches
  scene.torches.forEach((tc, i) => {
    const x = tc.x * 2 + 1, y = tc.y * 2 - 10, fl = 0.5 + Math.sin(t * 13 + i * 3) * 0.25 + Math.sin(t * 7.3 + i) * 0.25;
    R.box(x - 16, y - 14, 32, 32, P.fire2, 8, 0.05 + fl * 0.05);
    R.spr(Sprites.flame[Math.floor(t * 9 + i) % 3], x, y, { sc: 1.3 + fl * 0.15 });
  });
  // Logo carved into the plaque; the O is the Bonehead skull
  const word = 'BONEHEAD', base = [...word].reduce((a, ch) => a + (ch === 'O' ? 10 : R.measure(ch) + 1), 0);
  const size = Math.max(1, Math.min(6, Math.floor((plaque.w - 20) / base)));
  let lx = plaque.x + plaque.w / 2 - (base * size) / 2;
  const ly = plaque.y + plaque.h / 2 - 3.5 * size;
  for (const ch of word) {
    if (ch === 'O') {
      const sk = skullSpr(Math.round(9 * size), { style: 'crypt' });
      R.spr(sk, lx + 5 * size, ly + 3.5 * size);
      lx += 10 * size; continue;
    }
    R.text(ch, lx, ly + size * 0.6, { size, color: '#2a2230', outline: null, shadow: null });
    R.text(ch, lx, ly, { size, color: P.bone1, outline: '#3a3243', shadow: null });
    lx += (R.measure(ch) + 1) * size;
  }
  // Hero: the Bonehead skull in its niche, a candle melting on its head
  const hs = Math.round(Math.min(niche.w * 0.6, niche.h * 0.5)), st = skullState(t);
  const hero = skullSpr(hs, { style: 'crypt', candle: true, jaw: st.jaw, look: st.look });
  const hx = niche.x + niche.w / 2, hy = niche.y + niche.h - hero.h / 2;
  const fl = 0.5 + Math.sin(t * 11) * 0.3 + Math.sin(t * 6.1) * 0.2;
  R.box(hx - hs * 0.7, niche.y + niche.h * 0.2, hs * 1.4, niche.h * 0.8, P.fire2, 10, 0.04 + fl * 0.04);
  R.spr(hero, hx, hy);
  const wk = wickOf(hs);
  R.spr(Sprites.flame[Math.floor(t * 10) % 3], hx - hero.w / 2 + wk.x, hy - hero.h / 2 + wk.y - 3, { sc: 0.6 + fl * 0.1 });
  // A water drip from the arch every couple of seconds
  const dt = (t % 2.4) / 2.4, dripX = niche.x + niche.w * 0.72;
  if (dt < 0.6) R.rect(dripX, niche.y + 6 + dt / 0.6 * (niche.h - 20), 1, 2, '#8fb4c8', 0.8);
  // A spider on a thread, bobbing
  const spX = plaque.x + plaque.w + (land ? 18 : -14), spY = plaque.y + plaque.h * 0.4 + Math.sin(t * 1.3) * 10 + 20;
  R.rect(spX + 4, 0, 1, spY - 2, '#8a8098', 0.6);
  R.spr(memo('spider', () => spider().spr()), spX + 4.5, spY + 2);
  // Menu engraved on the tombstone
  const items = menuItems(game), top = stone.y + stone.w * 0.3 + 8, widest = Math.max(...items.map(([, l]) => R.measure(l, { size: 2 })));
  const ms = widest < stone.w - 36 && top + items.length * 20 + 22 < stone.y + stone.h ? 2 : 1, rowH = ms === 2 ? 20 : land ? 18 : 20;
  R.text('R.I.P.', stone.x + stone.w / 2, stone.y + stone.w * 0.14, { color: '#3a3243', align: 'center', outline: null, shadow: null, size: land ? 1 : 2 });
  const rects = items.map((it, i) => ({ x: stone.x + 6, y: top + i * rowH - 3, w: stone.w - 12, h: rowH - 1 }));
  menu(game, items, rects, act);
  items.forEach(([, label], i) => {
    const sel = game.titleSel === i, y = top + i * rowH;
    const size = ms, tw = R.measure(label, { size });
    if (sel) {
      R.text(label, stone.x + stone.w / 2 + 6, y, { size, color: P.bone0, align: 'center', outline: '#2a2230', shadow: null });
      R.spr(memo('finger', () => boneFinger('crypt').spr()), stone.x + stone.w / 2 - tw / 2 - 4 + Math.sin(t * 8) * 2, y + 3.5 * size, { sc: size === 2 ? 1.3 : 1 });
    } else {
      R.text(label, stone.x + stone.w / 2 + 6, y + 1, { size, color: '#8a8098', align: 'center', outline: null, shadow: null });
      R.text(label, stone.x + stone.w / 2 + 6, y, { size, color: '#2e2736', align: 'center', outline: null, shadow: null });
    }
  });
  // Brass nameplate under the skull's shelf: the best run
  const best = `HERE LIES ${game.best.toLocaleString()}`, bw = R.measure(best) + 14, bx = niche.x + niche.w / 2 - bw / 2, by = niche.y + niche.h + 16;
  R.box(bx - 1, by - 1, bw + 2, 14, P.ink0, 2);
  R.box(bx, by, bw, 12, P.gold3, 2); R.rect(bx + 2, by + 1, bw - 4, 1, P.gold1);
  R.rect(bx + 3, by + 5, 1, 1, P.gold4); R.rect(bx + bw - 4, by + 5, 1, 1, P.gold4);
  R.text(best, bx + bw / 2, by + 3, { color: P.gold0, align: 'center', outline: P.gold4, shadow: null });
}

// ---------- SKETCHBOOK ----------
const INK = '#2a1d1a', RED = '#9e2330';
function inked(str, x, y, o = {}) {
  // Hand-lettered: each glyph wobbles per "boil" frame and gets a second marker stroke.
  const size = o.size || 1, frame = o.frame || 0, col = o.color || INK;
  let cx = x - (o.align === 'center' ? R.measure(str, { size }) / 2 : 0), i = 0;
  for (const ch of str) {
    const h = Math.sin((i + 1) * 12.9898 + frame * 78.233) * 43758.5453, j = h - Math.floor(h);
    const dx = (j - 0.5) * size * 0.5, dy = (((j * 7) % 1) - 0.5) * size * 0.6, rot = (j - 0.5) * 0.12;
    R.text(ch, cx + dx + size * 0.35, y + dy, { size, color: col, outline: null, shadow: null, alpha: 0.45, fx: () => ({ rot }) });
    R.text(ch, cx + dx, y + dy, { size, color: col, outline: null, shadow: null, fx: () => ({ rot }) });
    cx += (R.measure(ch) + 1) * size; i++;
  }
}
function scribbleRing(cx, cy, rx, ry, frame) {
  for (let pass = 0; pass < 2; pass++) for (let a = 0; a < Math.PI * 2.15; a += 0.08) {
    const wob = Math.sin(a * 5 + frame * 2 + pass) * 1.4;
    R.rect(Math.round(cx + Math.cos(a) * (rx + wob + pass)), Math.round(cy + Math.sin(a) * (ry + wob * 0.6)), 1, 1, RED);
  }
}

export function sketch(game, act) {
  const vw = R.vw, vh = R.vh, land = R.land, t = R.t, frame = Math.floor(t * 6) % 3;
  const key = `sketch-${Math.ceil(vw / 2)}x${Math.ceil(vh / 2)}`;
  const scene = memo(key, () => { const s = sketchScene(Math.ceil(vw / 2), Math.ceil(vh / 2), land); s.spr = s.pix.spr(); return s; });
  const pg = { x: scene.page.x * 2, y: scene.page.y * 2, w: scene.page.w * 2, h: scene.page.h * 2 };
  R.spr(scene.spr, 0, 0, { sc: 2, ax: 0, ay: 0 });
  // Hand-inked logo with dripping red; the O is the sketched Bonehead skull
  const word = 'BONEHEAD', base = [...word].reduce((a, ch) => a + (ch === 'O' ? 10 : R.measure(ch) + 1), 0);
  const size = Math.max(2, Math.min(6, Math.floor((pg.w * (land ? 0.62 : 0.86)) / base)));
  let lx = pg.x + pg.w / 2 - (base * size) / 2;
  const ly = pg.y + (land ? pg.h * 0.1 : pg.h * 0.06);
  [...word].forEach((ch, i) => {
    if (ch === 'O') {
      R.spr(skullSpr(Math.round(9 * size), { style: 'sketch', frame }), lx + 5 * size, ly + 3.5 * size);
      lx += 10 * size; return;
    }
    inked(ch, lx, ly, { size, frame: frame + i * 3, color: i >= 4 ? RED : INK });
    if (i === 1 || i === 5 || i === 7) {
      const len = 4 + ((t * 2 + i) % 6) * 2;
      R.rect(Math.round(lx + size * 2), ly + size * 7, Math.max(1, size - 1), len, RED);
      R.rect(Math.round(lx + size * 2) - 1, ly + size * 7 + len, Math.max(2, size), 2, RED);
    }
    lx += (R.measure(ch) + 1) * size;
  });
  // Scrawled under the logo, right-aligned to its end so it never runs off the page
  const note = "don't be the bonehead!!", nx = Math.min(lx, pg.x + pg.w - 8) - R.measure(note);
  R.ctx.save(); R.ctx.translate(nx, ly + size * 9 + 6); R.ctx.rotate(-0.06);
  inked(note, 0, 0, { frame, color: RED });
  R.ctx.restore();
  // Hero doodle: the skull with its candle, hatched in ink
  const hs = Math.round(land ? Math.min(pg.h * 0.32, pg.w * 0.19) : pg.w * 0.34), st = skullState(t);
  const hero = skullSpr(hs, { style: 'sketch', candle: true, jaw: st.jaw, look: st.look, frame });
  const hx = land ? pg.x + pg.w * 0.7 : pg.x + pg.w / 2, hy = land ? pg.y + pg.h * 0.6 : pg.y + pg.h * 0.4;
  R.spr(hero, hx, hy);
  const wk = wickOf(hs);
  R.spr(Sprites.flame[Math.floor(t * 10) % 3], hx - hero.w / 2 + wk.x, hy - hero.h / 2 + wk.y - 3, { sc: 0.7 });
  // Handwritten menu with a scribbled circle round the choice
  const items = menuItems(game), msz = pg.h > 250 ? 2 : 1, rowH = msz === 2 ? 26 : land ? 20 : 22, mx = land ? pg.x + pg.w * 0.3 : pg.x + pg.w / 2, my = land ? pg.y + pg.h * 0.38 : pg.y + pg.h * 0.6;
  const rects = items.map(([, label], i) => { const w = R.measure(label, { size: msz }) + 30; return { x: mx - w / 2, y: my + i * rowH - 5, w, h: rowH - 2 }; });
  menu(game, items, rects, act);
  items.forEach(([, label], i) => {
    const sel = game.titleSel === i, y = my + i * rowH;
    R.ctx.save(); R.ctx.translate(mx, y + 3); R.ctx.rotate((i % 2 ? 1 : -1) * 0.02);
    const lw = R.measure(label, { size: msz });
    inked(label, 0, -3.5 * msz + 0.5, { frame: frame + i * 5, align: 'center', size: msz });
    if (sel) { scribbleRing(0, 0, lw / 2 + 9, 5 + 3.5 * msz, frame); inked('→', -lw / 2 - 26 + Math.sin(t * 8) * 2, -3.5 * msz + 0.5, { frame, color: RED, size: msz }); }
    R.ctx.restore();
  });
  // Best score scrawled in the corner with a doodled crown
  const bx = land ? pg.x + pg.w * 0.83 : pg.x + pg.w * 0.72, byy = pg.y + pg.h - 26;
  R.ctx.save(); R.ctx.translate(bx, byy); R.ctx.rotate(0.05);
  inked(`best: ${game.best.toLocaleString()}`, 0, 0, { frame, align: 'center' });
  R.ctx.restore();
  for (let k = 0; k < 7; k++) R.rect(Math.round(bx - 9 + k * 3), Math.round(byy - 8 - (k % 2 ? 4 : 0) + (frame === 1 ? 1 : 0)), 1, 4, INK);
}

