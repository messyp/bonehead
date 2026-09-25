import { R } from '../core/render.js';
import { Input } from '../core/input.js';
import { Post } from '../core/post.js';
import { ease, clamp } from '../core/tween.js';
import { P, THEMES } from '../art/palette.js';
import { Cards } from '../art/cards.js';
import { Sprites } from '../art/sprites.js';
import { crownIcon } from '../art/map.js';
import { buildLogo, linkIcons, blurSprite } from '../art/logo.js';
import { Audio } from '../audio/sfx.js';
import { Music } from '../audio/music.js';
import { trophies } from '../../progression.js';
import { UI } from './ui.js';

// Title screen: the wordmark centre stage in a magenta void, cards drifting past at
// different depths (the far ones out of focus), one big CTA and a row of quiet links.

let art = null;
const getArt = () => (art ??= { logo: buildLogo(), icons: linkIcons(), crown: crownIcon().spr(), blur: new Map() });

// x, y roughly -1..1 around the centre, z depth (1 = nearest). Near cards keep to the
// flanks so nothing crosses the logo or the button.
const FIELD = [
  { x: -0.2, y: -0.9, z: 0.18, back: true }, { x: 0.12, y: 0.75, z: 0.2, back: true },
  { x: 0.32, y: -0.45, z: 0.26, c: { r: 6, s: 3 } }, { x: -0.68, y: -0.1, z: 0.28, c: { r: 14, s: 0 } },
  { x: 0.58, y: 0.28, z: 0.32, back: true }, { x: -0.52, y: 0.52, z: 0.34, c: { r: 9, s: 2 } },
  { x: -0.38, y: -0.6, z: 0.44, c: { r: 10, s: 0 } }, { x: 0.46, y: -0.84, z: 0.5, c: { r: 12, s: 2 } },
  { x: 0.74, y: 0.74, z: 0.52, c: { r: 2, s: 0 } }, { x: -0.94, y: 0.1, z: 0.6, c: { r: 11, s: 1 } },
  { x: 0.66, y: -0.66, z: 0.68, back: true }, { x: -0.78, y: 0.88, z: 0.66, back: true },
  // The near four are placed like a poster and only bob, turn and flip
  // (pt: where they sit on a tall phone screen instead: above the logo and below the links)
  { x: -0.88, y: -0.6, z: 0.8, back: true, flip: 1, pt: [-0.66, -0.66] }, { x: 0.86, y: -0.14, z: 0.86, c: { r: 13, s: 3 }, pt: [0.7, -0.6] },
  { x: 0.8, y: 0.56, z: 0.92, back: true, flip: 1, pt: [0.66, 0.78] }, { x: -0.8, y: 0.34, z: 0.96, c: { r: 8, s: 1 }, pt: [-0.64, 0.74] },
];
FIELD.forEach((f, i) => { f.i = i; f.rot = ((i * 37) % 11 - 5) * 0.09; f.sp = 0.012 + (i % 4) * 0.004; });

const SPARKS = Array.from({ length: 34 }, (_, i) => ({
  a: (i / 34) * Math.PI * 2 + Math.sin(i * 7.3) * 0.3, T: 2.2 + (i % 5) * 0.45, ph: (i * 0.618) % 1,
  sz: [1, 2, 2, 3][i % 4], col: [P.red1, '#ff4f8b', P.gold2, P.gold1, P.fire2][i % 5], rr: 0.9 + ((i * 13) % 7) * 0.05,
}));

const state = { enter: 0, px: 0, py: 0, landed: 0, mouse: null, kbd: false, hot: new Set() };
let devTaps = 0, devTapT = 0;

function cardSprite(f, far) {
  const a = getArt();
  if (!far) return f.back ? Cards.back : Cards.face(f.c, Math.floor(R.t * 8));
  const key = (f.back ? 'back' : `${f.c.r}-${f.c.s}`) + ':' + far;
  let s = a.blur.get(key);
  if (!s) a.blur.set(key, s = blurSprite(f.back ? Cards.back : Cards.face(f.c, 0), far));
  return s;
}

function drawField(t, front) {
  const vw = R.vw, vh = R.vh, mx = state.px, my = state.py;
  const base = R.land ? 1 : 0.85;
  for (const f of FIELD) {
    if ((f.z >= 0.75) !== front) continue;
    // Drift slowly upwards (faster when nearer), wrap round, sway and turn
    const [fx, fy] = !R.land && f.pt ? f.pt : [f.x, f.y], span = 2.8;
    const y = f.z >= 0.75 ? fy + Math.sin(t * 0.9 + f.i) * 0.035 : ((fy + 1.4 - t * f.sp * (0.5 + f.z)) % span + span) % span - 1.4;
    const x = fx + Math.sin(t * 0.21 + f.i * 1.3) * 0.03;
    // Parallax: the nearer the card, the further it swings against the pointer
    const X = vw / 2 + x * vw * 0.52 - mx * (6 + f.z * f.z * 90), Y = vh / 2 + y * vh * 0.55 - my * (4 + f.z * f.z * 50);
    const sc = base * (0.3 + f.z * 0.85), rot = f.rot + Math.sin(t * 0.33 + f.i) * 0.22 - mx * f.z * 0.12;
    const far = f.z < 0.4 ? 3 : f.z < 0.6 ? 2 : f.z < 0.75 ? 1 : 0;
    const alpha = f.z < 0.4 ? 0.45 : f.z < 0.6 ? 0.7 : 0.9;
    if (!far) {
      // Near cards: crisp, shadowed, some slowly turning over to show their backs
      const turn = f.flip ? Math.cos(t * 0.45 + f.i) : 1, back = f.back ? turn > 0 : turn < 0;
      const sx = sc * Math.max(0.06, Math.abs(turn));
      R.spr(Cards.shadow, X + 5, Y + 8, { sx, sy: sc, rot, alpha: 0.35 });
      const spr = back ? Cards.back : Cards.face(f.c || { r: 14, s: 1 }, Math.floor(t * 8));
      R.spr(spr, X, Y, { sx, sy: sc, rot });
    } else R.spr(cardSprite(f, far), X, Y, { sc, rot, alpha });
  }
}

function drawLogo(game, cx, cy, sc, tt) {
  const a = getArt(), L = a.logo, t = R.t, ctx = R.ctx;
  const adv = L.letters.map(l => l.w * sc), gap = L.gap * sc, total = adv.reduce((s, w) => s + w, 0) + gap * (adv.length - 1);
  const top = cy - (L.h * sc) / 2;
  // Warm magenta bloom behind the wordmark
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, total * 0.75);
  g.addColorStop(0, 'rgba(255,80,140,0.3)'); g.addColorStop(0.5, 'rgba(210,40,120,0.14)'); g.addColorStop(1, 'rgba(120,10,80,0)');
  ctx.fillStyle = g; ctx.fillRect(-total, -total, total * 2, total * 2); ctx.restore();
  // Pixel sparks orbiting outwards from the logo
  const rx = total / 2 + 10 * sc, ry = (L.h * sc) / 2 + 12 * sc, show = clamp((tt - 0.9) / 0.6);
  for (const s of SPARKS) {
    const u = ((t / s.T + s.ph) % 1), r = s.rr + u * 0.32, al = Math.sin(u * Math.PI) * show;
    if (al <= 0.02) continue;
    const sz = Math.max(1, Math.round(s.sz * sc * 0.6));
    R.rect(Math.round(cx + Math.cos(s.a) * rx * r - sz / 2), Math.round(cy + Math.sin(s.a) * ry * r - sz / 2), sz, sz, s.col, al);
  }
  // Letters drop in one after another, then bob; a glint sweeps across every few seconds
  const glint = ((t % 5.5) - 0.4) / 0.7 * (L.letters.length + 2) - 1;
  let x = cx - total / 2, landed = 0;
  L.letters.forEach((l, i) => {
    const lt = clamp((tt - 0.12 - i * 0.07) / 0.5);
    if (lt >= 0.5) landed++;
    if (lt <= 0) { x += adv[i] + gap; return; }
    const drop = (1 - ease.outBack(lt, 1.6)) * -R.vh * 0.45, bob = Math.sin(t * 2.2 + i * 0.65) * sc * 0.45 * clamp(tt - 1);
    const isSkull = i === 1, chomp = isSkull && (t % 2.8) > 2.62;
    const spr = isSkull && chomp ? L.chomp.spr : l.spr, y = top + drop + bob;
    ctx.save();
    ctx.globalAlpha = clamp(lt * 4);
    if (isSkull) { ctx.translate(x + adv[i] / 2, y + (L.h * sc) / 2); ctx.rotate(Math.sin(t * 1.6) * 0.05); ctx.translate(-(x + adv[i] / 2), -(y + (L.h * sc) / 2)); }
    R.spr(spr, x - l.ox * sc, y - l.oy * sc, { sc, ax: 0, ay: 0 });
    const fl = Math.max(0, 1 - Math.abs(glint - i) * 0.9) * 0.55;
    if (fl > 0) R.spr(l.flash, x - l.ox * sc, y - l.oy * sc, { sc, ax: 0, ay: 0, alpha: fl });
    if (isSkull) {
      // Eyes smoulder
      const glow = 0.25 + (Math.sin(t * 3.1) * 0.5 + 0.5) * 0.35;
      for (const ex of [7, 17]) R.box(x + (ex - 2) * sc, y + 8.5 * sc, 4 * sc, 4 * sc, P.red1, 2, glow * 0.6);
    }
    ctx.restore();
    x += adv[i] + gap;
  });
  if (landed > state.landed) { Audio.play('land', landed); if (landed === L.letters.length) { R.shake(0.12); Audio.play('stamp'); } state.landed = landed; }
  return { w: total, h: L.h * sc, top };
}

// Small link: icon + label, underline on hover. Returns true when clicked.
function link(id, x, y, label, icon, focus) {
  const tw = R.measure(label), w = 15 + tw, clicked = Input.button(id, x - 5, y - 4, w + 10, 16, !UI.blocked);
  const mouse = Input.hot === id, hot = mouse || focus;
  if (mouse && !state.hot.has(id)) Audio.play('hover', id.length);
  if (mouse) state.hot.add(id); else state.hot.delete(id);
  R.spr(icon[hot ? 'on' : 'off'], x + 5, y + 3 + (hot ? Math.round(Math.sin(R.t * 12)) : 0));
  R.text(label, x + 15, y, { color: hot ? P.gold1 : P.bone1, alpha: hot ? 1 : 0.88 });
  if (hot) R.rect(x + 15, y + 9, tw, 1, P.gold1, 0.9);
  if (clicked) Audio.play('ui');
  return clicked;
}
const linkW = label => 15 + R.measure(label);

function items(game) {
  const hasSave = game.hasSave();
  return [
    [hasSave ? 'continue' : 'play', hasSave ? 'CONTINUE' : 'PLAY'],
    ...(hasSave ? [['new', 'NEW RUN', 'play']] : []),
    ['rules', 'HOW TO PLAY', 'book'], ['trophies', 'TROPHIES', 'trophy'], ['options', 'OPTIONS', 'gear'],
  ];
}

export function drawTitle(game, act) {
  const vw = R.vw, vh = R.vh, land = R.land, t = R.t, a = getArt();
  // Entry comes from the scene change, not a time gap: the first click unlocks audio,
  // which can stall a frame, and must not restart the intro under the pointer.
  if (game.titleEntered) { game.titleEntered = false; state.enter = t; state.landed = 0; Post.theme(THEMES[3]); }
  // Any press or key during the intro finishes it, so an eager first click still lands on PLAY
  if (t - state.enter < 1.6 && (Input.pressed || Input.keys.length) && !game.modal) { state.enter = t - 1.6; state.landed = 8; }
  const tt = t - state.enter;
  Music.set(0, 0);
  // Mouse movement hands focus back from the keyboard
  if (!state.mouse || state.mouse.x !== Input.x || state.mouse.y !== Input.y) { if (state.mouse) state.kbd = false; state.mouse = { x: Input.x, y: Input.y }; }
  const menu = items(game), sel = game.titleSel ?? 0, focus = i => state.kbd && sel === i;

  // Smoothed pointer offset from the centre (-0.5..0.5) for parallax; eases home when the pointer leaves
  const inside = Input.x > -900, dt = Math.min(0.05, UI.dt);
  state.px += ((inside ? clamp(Input.x / vw, 0, 1) - 0.5 : 0) - state.px) * (1 - Math.exp(-dt * 5));
  state.py += ((inside ? clamp(Input.y / vh, 0, 1) - 0.5 : 0) - state.py) * (1 - Math.exp(-dt * 5));
  drawField(t, false);
  const L = a.logo, raw = L.letters.reduce((s, l) => s + l.w, 0) + L.gap * 7;
  const sc = Math.min(land ? Math.min(vw * 0.66, 400) : vw * 0.92, raw * 3) / raw;
  const logoCY = land ? vh * 0.39 : vh * 0.31;
  const lg = drawLogo(game, vw / 2 + state.px * 8, logoCY + state.py * 5, sc, tt);
  // Five quick taps on the logo open the dev panel (Ctrl+Shift+D on keyboards)
  if (Input.released && !game.modal && Math.abs(Input.x - vw / 2) < lg.w / 2 && Math.abs(Input.y - logoCY) < lg.h / 2 + 6) {
    const now = performance.now();
    devTaps = now - devTapT < 600 ? devTaps + 1 : 1; devTapT = now;
    if (devTaps >= 5) { devTaps = 0; game.openModal('dev'); }
  }
  const intro = k => clamp((tt - k) / 0.45);
  R.text('Lose your cards.  ^gDon\'t be the Bonehead.', vw / 2, lg.top + lg.h + 8 * sc + 6, { align: 'center', color: P.bone0, alpha: intro(0.95) });
  drawField(t, true);

  // The one big button
  const [ctaId, ctaLabel] = menu[0], bw = land ? 164 : 176, bh = 34;
  const ci = ease.outBack(intro(1.1), 1.4), by = (land ? vh * 0.69 : vh * 0.6) - bh / 2 + (1 - ci) * 40;
  R.ctx.save(); R.ctx.globalAlpha = intro(1.1);
  if (UI.cta('t-cta', vw / 2 - bw / 2, by, bw, bh, ctaLabel, { focus: focus(0) })) act(ctaId);
  R.ctx.restore();

  // Quiet links underneath, split by thin rules; two rows when the screen is narrow
  const links = menu.slice(1), sep = 18, rowW = links.reduce((s, [, l]) => s + linkW(l), 0) + sep * (links.length - 1);
  const oneRow = rowW <= vw - 24, ly = land ? vh * 0.87 : vh * 0.74;
  R.ctx.save(); R.ctx.globalAlpha = intro(1.3);
  if (oneRow) {
    let x = vw / 2 - rowW / 2;
    links.forEach(([id, label, icon], k) => {
      if (link('t-' + id, x, ly, label, a.icons[icon], focus(k + 1))) act(id);
      x += linkW(label) + sep;
      if (k < links.length - 1) R.rect(Math.round(x - sep / 2), ly - 1, 1, 10, P.bone2, 0.3);
    });
  } else {
    const colW = Math.floor((vw - 24) / 2);
    links.forEach(([id, label, icon], k) => {
      const col = k % 2, row = Math.floor(k / 2), cx = 12 + col * colW + colW / 2;
      if (link('t-' + id, cx - linkW(label) / 2, ly + row * 22, label, a.icons[icon], focus(k + 1))) act(id);
    });
  }
  R.ctx.restore();

  // Best run and trophies, centred along the top
  const got = Object.keys(trophies).filter(id => game.unlocked[id]).length, total = Object.keys(trophies).length;
  const best = `BEST RUN ${game.best.toLocaleString()}`, tro = `${got}/${total}`;
  const pw = 11 + 4 + R.measure(best) + 14 + 11 + 4 + R.measure(tro) + 16, px = vw / 2 - pw / 2, py = 6;
  R.ctx.save(); R.ctx.globalAlpha = intro(0.6);
  R.box(px, py, pw, 17, P.ink0, 3, 0.55);
  R.rect(px + 3, py + 1, pw - 6, 1, '#ff6fa8', 0.25);
  let x = px + 8;
  R.spr(a.crown, x + 5, py + 8); x += 15;
  R.text(best, x, py + 5, { color: P.gold1 }); x += R.measure(best) + 8;
  R.rect(x, py + 4, 1, 9, P.bone2, 0.3); x += 7;
  R.spr(Sprites.trophy, x + 5, py + 8, { sc: 0.75 }); x += 15;
  R.text(tro, x, py + 5, { color: P.bone1 });
  R.ctx.restore();
}

// Arrow keys move between the button (0) and the links (1..n); Enter picks.
export function titleKey(game, k, act) {
  const menu = items(game), n = menu.length, sel = game.titleSel ?? 0;
  let next = sel;
  if (k.key === 'ArrowDown') next = sel === 0 ? 1 : sel;
  if (k.key === 'ArrowUp') next = 0;
  if (k.key === 'ArrowRight') next = sel === 0 ? 1 : Math.min(n - 1, sel + 1);
  if (k.key === 'ArrowLeft') next = sel <= 1 ? 0 : sel - 1;
  if (next !== sel || (!state.kbd && k.key.startsWith('Arrow'))) { game.titleSel = next; state.kbd = true; Audio.play('hover', next + 2); }
  if (k.key === 'Enter' || k.key === ' ') { Audio.play('ui'); act(menu[state.kbd ? sel : 0][0]); }
}
