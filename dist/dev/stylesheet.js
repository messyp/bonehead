import { R } from '../js/core/render.js';
import { Input } from '../js/core/input.js';
import { TINY } from '../js/core/font.js';
import { P, THEMES } from '../js/art/palette.js';
import { Cards, skullIcon } from '../js/art/cards.js';
import { Sprites, OPPONENTS, portrait } from '../js/art/sprites.js';
import { buildLogo, wordmark, lightSkull, linkIcons, LOGO_COLORS } from '../js/art/logo.js';
import { crownIcon } from '../js/art/map.js';
import { UI } from '../js/game/ui.js';
import { pixCanvas } from './devlib.js';

R.init(false);
Cards.init();
Sprites.init(() => skullIcon());
const $ = id => document.getElementById(id);

// Render with the game's own renderer (R + UI) into a visible canvas, crisp at any DPR.
function sheet(el, vw, vh, draw) {
  // Fill the column (up to 3x); the renderer handles fractional scales like the game does
  const pad = 36, avail = Math.max(200, (el.parentElement.clientWidth || 640) - pad), css = Math.max(1.5, Math.min(3, avail / vw)), scale = css * (window.devicePixelRatio || 1);
  Object.assign(R, { S: scale, k: Math.max(1, Math.min(6, Math.ceil(scale - 0.01))), vw, vh, W: Math.round(vw * scale), H: Math.round(vh * scale), land: true, t: 0 });
  R.scene.width = R.W; R.scene.height = R.H;
  const ctx = R.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, R.W, R.H);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  Input.x = -999; Input.y = -999; UI.blocked = false; UI.dt = 0.016;
  draw();
  el.width = R.W; el.height = R.H; el.style.width = `${vw * css}px`;
  el.getContext('2d').drawImage(R.scene, 0, 0);
}
const label = (txt, x, y, o = {}) => R.text(txt, x, y, { font: TINY, color: P.ink6, align: 'center', outline: null, shadow: null, ...o });
const add = (id, node) => $(id).appendChild(node);
const figure = (node, cap) => { const f = document.createElement('figure'); f.appendChild(node); if (cap) { const c = document.createElement('figcaption'); c.innerHTML = cap; f.appendChild(c); } return f; };

// ---- Logo
const L = buildLogo(), wm = wordmark(L);
add('logo-big', pixCanvas(wm, 4));
add('logo-parts', figure(pixCanvas(L.skull.spr, 5), 'Logo skull'));
add('logo-parts', figure(pixCanvas(L.chomp.spr, 5), 'Chomp (title, result card)'));
add('logo-parts', figure(pixCanvas(lightSkull(0), 5), 'Light skull (the pour)'));
add('logo-parts', figure(pixCanvas(Sprites.skull, 7), 'Card-back emblem'));
const hud = document.createElement('canvas'); hud.className = 'px';
add('logo-hud', hud);
sheet(hud, 150, 30, () => { R.panel(6, 4, 138, 22, { fill: P.ink2, hi: P.ink4 }); R.spr(wm, 10, 15, { sc: 0.56, ax: 0, ay: 0.5 }); });
const lc = $('logo-colours');
const chip = (hex, name) => `<button class="sw" data-hex="${hex}" style="--c:${hex}"><i></i><b>${name}</b><code>${hex}</code></button>`;
lc.innerHTML = [
  ...LOGO_COLORS.bone.grad.map((h, i) => chip(h, `BONE ${i}`)),
  ...LOGO_COLORS.gold.grad.map((h, i) => chip(h, `HEAD ${i}`)),
  chip(LOGO_COLORS.side, '3D side'), chip(LOGO_COLORS.sideLo, 'side shadow'), chip(P.ink0, 'outline'), chip(P.red1, 'eyes'),
].join('');

// ---- Colour
const fams = {};
for (const [k, v] of Object.entries(P)) { const fam = k.replace(/\d+$/, ''); (fams[fam] ??= []).push([k, v]); }
const names = { ink: 'Ink · surfaces, outlines, UI', bone: 'Bone · cards, skulls, text', red: 'Blood · danger, losing, magic red', gold: 'Gold · score, CTAs, the HEAD', teal: 'Teal · your move, safe, info', blue: 'Blue · chips', vio: 'Violet · undercut, the Reaper', grn: 'Green · done, won', fire: 'Fire · burns, flames', white: 'White', black: 'Black' };
$('palette').innerHTML = Object.entries(fams).filter(([f]) => !['white', 'black'].includes(f)).map(([f, list]) =>
  `<div class="fam"><h3>${names[f] || f}</h3><div class="row">${list.map(([k, v]) => chip(v, k)).join('')}</div></div>`).join('');
$('themes').innerHTML = THEMES.map(t => `<div class="theme" style="background:radial-gradient(circle at 50% 45%, ${t.a}, ${t.b} 75%)"><span style="background:${t.c}"></span><b>${t.name}</b><code>${t.a} · ${t.b} · ${t.c}</code></div>`).join('');

// ---- Type
sheet($('type'), 300, 150, () => {
  let y = 6;
  R.text('FONT · 5×7 PIXEL, PROPORTIONAL', 8, y, { color: P.gold1 }); y += 14;
  R.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8, y, { color: P.bone0 }); y += 11;
  R.text('abcdefghijklmnopqrstuvwxyz', 8, y, { color: P.bone0 }); y += 11;
  R.text('0123456789 .,:;!?\'"-+×→←↑↓✦ ♠♥♣♦', 8, y, { color: P.bone0 }); y += 14;
  R.text('Size 2 for titles', 8, y, { size: 2, color: P.gold1 }); y += 22;
  R.text('TINY · 3×5 FOR LABELS AND SMALL PRINT', 8, y, { font: TINY, color: P.teal1 }); y += 9;
  R.text('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,:!?', 8, y, { font: TINY, color: P.bone1 }); y += 12;
  R.text('Colour codes: ^gGOLD^0 ^rRED^0 ^tTEAL^0 ^vVIOLET^0 ^oFIRE^0 ^bBLUE^0 ^lGREEN^0 ^dDIM', 8, y, { color: P.bone1 }); y += 12;
  R.text('Lose your cards.  ^gDon\'t be the Bonehead.', 8, y, { color: P.bone0 });
});

// ---- Buttons and badges
sheet($('ui'), 300, 176, () => {
  ['gold', 'red', 'teal', 'blue', 'violet', 'green', 'ink'].forEach((c, i) => { const x = 8 + (i % 4) * 72, y = 8 + Math.floor(i / 4) * 24; UI.button('s-' + c, x, y, 66, 18, c.toUpperCase(), { color: c }); });
  UI.button('s-off', 8 + 3 * 72, 32, 66, 18, 'DISABLED', { enabled: false });
  UI.cta('s-cta', 8, 62, 140, 32, 'PLAY');
  UI.toggle('s-t1', 160, 64, 130, 'CARD HINTS', true);
  UI.toggle('s-t2', 160, 82, 130, 'SAFE MODE', false);
  // Rule badges under the pile, two to a row
  const badge = (x, y, txt, fill, hi) => { const bw = R.measure(txt) + 14; R.panel(x, y, bw, 13, { fill, rim: P.ink0, hi }); R.text(txt, x + bw / 2, y + 3, { color: P.white, align: 'center' }); return bw; };
  badge(8 + badge(8, 108, 'ANY CARD', P.teal2, P.teal1) + 6, 108, '7 OR HIGHER ↑', P.gold3, P.gold2);
  badge(8 + badge(8, 125, '9 OR LOWER ↓', P.vio2, P.vio1) + 6, 125, 'WHAT WAS IT?', P.gold3, P.gold2);
  label('RULE BADGES UNDER THE PILE', 236, 120);
  R.panel(8, 156, 60, 12, { fill: P.blue2, rim: P.ink0, hi: P.blue1, lo: P.blue3 }); R.text('240', 38, 158, { color: P.white, align: 'center' });
  R.text('×', 74, 158, { color: P.red1, align: 'center' });
  R.panel(80, 156, 60, 12, { fill: P.red2, rim: P.ink0, hi: P.red1, lo: P.red3 }); R.text('2.5', 110, 158, { color: P.white, align: 'center' });
  label('CHIPS × MULT', 150, 159, { align: 'left' });
});

// ---- Cards
sheet($('cards'), 310, 150, () => {
  for (let r = 2; r <= 14; r++) { const i = r - 2, x = 22 + (i % 7) * 44, y = 32 + Math.floor(i / 7) * 62; R.spr(Cards.face({ r, s: 1 }), x, y); }
  label('HEARTS, 2 TO ACE. THE 2, 8, 9 AND 10 ARE MAGIC.', 155, 142);
});
sheet($('cards2'), 310, 84, () => {
  const row = [[{ r: 10, s: 3, plain: true }, 'DISARMED 10'], [{ r: 14, s: 0 }, 'SPADES'], [{ r: 14, s: 2 }, 'CLUBS'], [{ r: 14, s: 3 }, 'DIAMONDS'], [null, 'BACK']];
  row.forEach(([c, t], i) => { const x = 30 + i * 62; R.spr(c ? Cards.face(c) : Cards.back, x, 34); label(t, x, 70); });
});

// ---- Characters
const chars = $('chars');
OPPONENTS.forEach((o, i) => chars.appendChild(figure(pixCanvas(portrait(i, 'idle', 0), 2), `<span style="color:${o.color}">${o.name}</span>`)));

// ---- Icons
const icons = $('icons');
const trickNames = { reshuffle: 'Fresh Bones', swap: 'Switcheroo', wild: 'Loaded Sleeves', chain: 'Chain Reaction', insurance: 'Second Chance', embers: 'Ash Collector' };
for (const [id, spr] of Object.entries(Sprites.tricks)) icons.appendChild(figure(pixCanvas(spr, 4), trickNames[id] || id));
const li = linkIcons();
[[Sprites.trophy, 'Trophy'], [Sprites.trophyDim, 'Trophy (locked)'], [Sprites.lock, 'Lock'], [Sprites.check, 'Checked'], [Sprites.uncheck, 'Unchecked'], [crownIcon().spr(), 'Crown'],
 [li.play.off, 'Link: play'], [li.book.off, 'Link: rules'], [li.trophy.off, 'Link: trophies'], [li.gear.on, 'Link: options (hover)'], ...Sprites.flame.map((f, i) => [f, `Flame ${i + 1}`])]
  .forEach(([spr, cap]) => icons.appendChild(figure(pixCanvas(spr, 4), cap)));

// Tap a swatch to copy its hex
document.addEventListener('click', e => {
  const b = e.target.closest('.sw'); if (!b) return;
  const hex = b.dataset.hex;
  const done = () => { b.classList.add('copied'); setTimeout(() => b.classList.remove('copied'), 900); };
  navigator.clipboard?.writeText(hex).then(done, () => {});
});
