import { R } from '../core/render.js';
import { TINY } from '../core/font.js';
import { Input } from '../core/input.js';
import { FX, CONFETTI } from '../core/fx.js';
import { Post } from '../core/post.js';
import { ease, clamp } from '../core/tween.js';
import { P } from '../art/palette.js';
import { Cards } from '../art/cards.js';
import { Sprites, OPPONENTS, portrait, oppIndex } from '../art/sprites.js';
import { Audio } from '../audio/sfx.js';
import { Music } from '../audio/music.js';
import { roundGoals } from '../../scoring.js';
import { trophies } from '../../progression.js';
import { UI } from './ui.js';
import { UPGRADES, fmtTime, store } from './game.js';
import { ROUNDS, RULES } from './rounds.js';
import { mapBackdrop, crownIcon } from '../art/map.js';
import { cardsLeft } from '../../engine.js';

const T = { font: TINY };
const card = (r, s) => Cards.face({ r, s }, Math.floor(R.t * 8));

function bigLogo(cx, cy, size, skull = Sprites.skull) {
  const letters = 'BONEHEAD', widths = [...letters].map(ch => (ch === 'O' ? 9 : R.measure(ch) + 1) * size);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  const ctx = R.ctx;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i], dy = Math.sin(R.t * 2.6 + i * 0.7) * size * 0.9, rot = Math.sin(R.t * 2 + i) * 0.03;
    const col = [P.bone0, P.bone0, P.bone0, P.bone0, P.gold1, P.gold1, P.gold2, P.gold2][i];
    ctx.save();
    ctx.translate(x + widths[i] / 2, cy + dy); ctx.rotate(rot);
    if (ch === 'O') {
      const chomp = Math.sin(R.t * 4) > 0.7;
      const sc = size * 8.6 / skull.h;
      for (let k = 3; k >= 1; k--) R.spr(skull, 0, 3.5 * size + k * size * 0.6, { sc, alpha: 0.35 });
      R.spr(skull, 0, 3.5 * size + (chomp ? -size * 0.3 : 0), { sc });
    } else {
      for (let k = 3; k >= 1; k--) R.text(ch, 0, k * size * 0.6, { size, color: k === 1 ? P.red3 : P.red4, align: 'center', outline: P.ink0, shadow: null });
      R.text(ch, 0, 0, { size, color: col, align: 'center' });
    }
    ctx.restore();
    x += widths[i];
  }
}

let devTaps = 0, devTapT = 0;

// Progression map state that only matters for drawing.
const mapCache = { key: '', spr: null, crown: null };
const fireflies = Array.from({ length: 26 }, () => ({ x: Math.random(), y: 0.35 + Math.random() * 0.6, ph: Math.random() * 6, sp: 0.2 + Math.random() * 0.5, c: Math.random() < 0.7 ? P.gold0 : P.teal0 }));

function mapNodes(vw, vh, land) {
  if (land) return ROUNDS.map((_, i) => ({ x: vw * (0.17 + i * 0.22), y: vh * (i % 2 ? 0.46 : 0.7) }));
  return ROUNDS.map((_, i) => ({ x: vw * (i % 2 ? 0.72 : 0.28), y: vh * (0.8 - i * 0.155) }));
}
// S-shaped path between two nodes: out of the side (landscape) or the top (portrait).
const elbow = (a, b, land) => {
  if (land) { const mx = (a.x + b.x) / 2; return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]; }
  const my = (a.y + b.y) / 2; return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
};
// Where the skull token stands: on the path just outside a table.
const spot = (n, land, tw, th) => (land ? { x: n.x - tw / 2 - 11, y: n.y + 2 } : { x: n.x - tw / 2 - 11, y: n.y + 6 });
function along(pts, t) {
  const segs = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); total += l; }
  let d = t * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) { const k = segs[i] ? Math.min(1, d / segs[i]) : 0; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; }
    d -= segs[i];
  }
  return pts.at(-1);
}

const floaters = Array.from({ length: 14 }, (_, i) => ({ x: Math.random(), y: Math.random(), sp: 0.015 + Math.random() * 0.03, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.6, c: { r: 2 + Math.floor(Math.random() * 13), s: i % 4 }, sc: 0.5 + Math.random() * 0.4, back: Math.random() < 0.35 }));

export const Screens = {
  title(game) {
    const vw = R.vw, vh = R.vh, land = R.land, dt = UI.dt;
    Music.set(0, 0);
    // Drifting cards in the background.
    for (const f of floaters) {
      f.y -= f.sp * dt; f.r += f.vr * dt;
      if (f.y < -0.2) { f.y = 1.2; f.x = Math.random(); }
      R.spr(f.back ? Cards.back : card(f.c.r, f.c.s), f.x * vw, f.y * vh, { rot: f.r, sc: f.sc, alpha: 0.28 });
    }
    const logoY = land ? vh * 0.2 : vh * 0.17, size = land ? Math.min(7, Math.floor(vw / 80)) : 4;
    bigLogo(vw / 2, logoY - 3.5 * size, size, game.logoSkull());
    // Five quick taps on the logo open the dev panel (Ctrl+Shift+D on keyboards).
    if (Input.released && !game.modal && Math.abs(Input.x - vw / 2) < 40 * size && Math.abs(Input.y - logoY) < 6 * size) {
      const now = performance.now();
      devTaps = now - devTapT < 600 ? devTaps + 1 : 1; devTapT = now;
      if (devTaps >= 5) { devTaps = 0; game.openModal('dev'); }
    }
    R.text('Lose your cards.  ^gDon\'t be the Bonehead.', vw / 2, logoY + 7 * size, { align: 'center', color: P.bone1 });
    // Mascot with orbiting cards.
    const tagBottom = logoY + 7 * size + 12, menuTop = land ? vh * 0.74 : vh * 0.66;
    const ms = clamp((menuTop - tagBottom - 8) / 62, 1, 2.2), mx = vw / 2, my = (tagBottom + menuTop) / 2;
    const orbit = [{ r: 14, s: 0 }, { r: 10, s: 1 }, { r: 8, s: 2 }, { r: 2, s: 3 }, { r: 13, s: 1 }];
    const drawOrbit = front => orbit.forEach((c, i) => {
      const a = R.t * 0.7 + i * Math.PI * 2 / orbit.length, depth = Math.sin(a);
      if ((depth > 0) !== front) return;
      const x = mx + Math.cos(a) * (land ? 110 : 90), y = my + depth * 10 - 2, sc = (0.6 + depth * 0.15) * clamp(ms / 1.6, 0.8, 1.25), sx = Math.cos(R.t * 1.3 + i);
      R.spr(Cards.shadow, x + 3, y + 5, { sx: sc * Math.abs(sx), sy: sc, alpha: 0.3 });
      R.spr(sx > 0 ? card(c.r, c.s) : Cards.back, x, y, { sx: sc * Math.max(0.05, Math.abs(sx)), sy: sc, rot: Math.sin(a) * 0.15, alpha: 0.75 + depth * 0.25 });
    });
    drawOrbit(false);
    const wink = (R.t % 4) > 3.75, chomp = Math.sin(R.t * 3) > 0.85;
    R.spr(Cards.shadow, mx, my + 34 * ms / 2 + 8, { sx: 1.1, sy: 0.18, alpha: 0.35 });
    R.spr(game.mascotSpr(wink ? 'wink' : chomp ? 'chomp' : 'idle'), mx, my + Math.sin(R.t * 2) * 3, { sc: ms, rot: Math.sin(R.t * 1.3) * 0.04 });
    drawOrbit(true);
    // Menu
    const hasSave = game.hasSave(), bw = land ? 118 : 150, bh = 28;
    let by = land ? vh * 0.74 : vh * 0.66;
    const bx = vw / 2 - bw / 2;
    if (UI.button('t-play', bx, by, bw, bh, hasSave ? 'CONTINUE' : 'PLAY', { size: 2, pulse: true, color: 'gold' })) { if (hasSave) game.transition(() => game.continueRun()); else startFresh(game); }
    by += bh + 8;
    const sw = land ? 76 : 72, row = land ? [['t-new', 'NEW RUN'], ['t-rules', 'HOW TO PLAY'], ['t-opts', 'OPTIONS'], ['t-troph', 'TROPHIES']] : [['t-new', 'NEW RUN'], ['t-rules', 'RULES'], ['t-opts', 'OPTIONS'], ['t-troph', 'TROPHIES']];
    const items = row.filter(([id]) => id !== 't-new' || hasSave);
    const cols = land ? items.length : Math.min(2, items.length), gap = 6;
    items.forEach(([id, label], i) => {
      const inRow = land ? items.length : Math.min(cols, items.length - Math.floor(i / cols) * cols), rowW = inRow * sw + (inRow - 1) * gap;
      const x = vw / 2 - rowW / 2 + (i % cols) * (sw + gap), y = by + Math.floor(i / cols) * 22;
      if (UI.button(id, x, y, sw, 17, label, { color: 'ink' })) {
        if (id === 't-new') game.openModal('confirm');
        if (id === 't-rules') game.openModal('rules', { page: 0 });
        if (id === 't-opts') game.openModal('options');
        if (id === 't-troph') game.openModal('trophies');
      }
    });
    R.text(`BEST RUN ${game.best.toLocaleString()}`, vw / 2, vh - 22, { color: P.gold2, align: 'center' });
    R.text('A SHEDDING ROGUELITE · SOUND ON', vw / 2, vh - 11, { color: P.ink6, align: 'center', outline: null, ...T });
  },

  // Between rounds: the Midnight Circuit map (after Super Meat Boy's world maps).
  map(game) {
    const vw = R.vw, vh = R.vh, land = R.land, mp = game.map, t = mp.t, next = mp.next;
    const key = `${Math.ceil(vw / 2)}x${Math.ceil(vh / 2)}`;
    if (mapCache.key !== key) { mapCache.key = key; mapCache.spr = mapBackdrop(Math.ceil(vw / 2), Math.ceil(vh / 2), land).spr(); mapCache.crown ??= crownIcon().spr(); }
    R.spr(mapCache.spr, 0, 0, { sc: 2, ax: 0, ay: 0 });
    // Fireflies
    for (const f of fireflies) {
      const x = ((f.x + Math.sin(R.t * f.sp + f.ph) * 0.02) % 1) * vw, y = f.y * vh + Math.cos(R.t * f.sp * 1.3 + f.ph) * 6, a = 0.3 + 0.7 * Math.max(0, Math.sin(R.t * 2 + f.ph));
      R.rect(Math.round(x), Math.round(y), 1, 1, f.c, a);
    }
    const nodes = mapNodes(vw, vh, land), pathW = land ? 9 : 8;
    // Path, cleared sections a little brighter
    for (let i = 1; i < nodes.length; i++) {
      const pts = elbow(nodes[i - 1], nodes[i], land), done = i < next;
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j - 1], b = pts[j], x0 = Math.min(a.x, b.x) - pathW / 2, y0 = Math.min(a.y, b.y) - pathW / 2;
        R.rect(x0 - 1, y0 - 1, Math.abs(b.x - a.x) + pathW + 2, Math.abs(b.y - a.y) + pathW + 2, P.ink0, 0.9);
      }
      for (let j = 1; j < pts.length; j++) {
        const a = pts[j - 1], b = pts[j], x0 = Math.min(a.x, b.x) - pathW / 2, y0 = Math.min(a.y, b.y) - pathW / 2;
        R.rect(x0, y0, Math.abs(b.x - a.x) + pathW, Math.abs(b.y - a.y) + pathW, done ? '#d8c79c' : '#8a7a5c');
      }
    }
    // Nodes
    const tw = land ? 58 : 56, th = land ? 70 : 66;
    let hover = null;
    ROUNDS.forEach((rd, i) => {
      const n = nodes[i], round = i + 1, beaten = round < next, current = round === next, locked = round > next;
      const bob = current ? Math.sin(R.t * 3) * 1.5 : 0, x = Math.round(n.x - tw / 2), y = Math.round(n.y - th / 2 + bob);
      const lead = OPPONENTS[oppIndex(rd.opps[0])];
      if (current) R.box(x - 3, y - 3, tw + 6, th + 6, P.gold1, 3, 0.5 + Math.sin(R.t * 6) * 0.35);
      R.panel(x, y, tw, th, { fill: beaten ? P.ink2 : current ? P.ink3 : P.ink1, rim: beaten ? P.grn2 : current ? P.gold1 : P.ink0, hi: P.ink4, depth: 3 });
      const ps = rd.opps.length > 1 ? 0.55 : 1;
      rd.opps.forEach((id, k) => {
        const px = x + tw / 2 + (rd.opps.length > 1 ? (k - 0.5) * 25 : 0), py = y + 4 + 22 * ps + (rd.opps.length > 1 ? 10 : 0);
        R.spr(portrait(oppIndex(id), current && (R.t + k) % 3.5 < 0.12 ? 'blink' : 'idle', Math.floor(R.t * 6)), px, py, { sc: ps, alpha: locked ? 0.5 : 1 });
      });
      if (locked) { R.box(x + 3, y + 3, tw - 6, th - 20, P.ink0, 2, 0.45); R.spr(Sprites.lock, x + tw / 2, y + 26); }
      const name = (rd.name || lead.name).replace('The ', '').toUpperCase();
      R.text(name, x + tw / 2, y + th - 13, { font: R.measure(name) > tw - 6 ? TINY : undefined, color: locked ? P.ink6 : rd.name ? P.teal1 : lead.color, align: 'center' });
      R.text(`ROUND ${round}`, x + tw / 2, y - 9, { font: TINY, color: current ? P.gold1 : P.ink6, align: 'center' });
      if (rd.rule) { const tag = 'NEW RULE'; const ww = R.measure(tag, { font: TINY }) + 6; R.box(x + tw - ww + 3, y + th - 4, ww, 8, P.ink0, 1); R.box(x + tw - ww + 4, y + th - 3, ww - 2, 6, RULES[rd.rule].color, 1); R.text(tag, x + tw - ww / 2 + 3, y + th - 2, { font: TINY, color: P.ink0, outline: null, shadow: null, align: 'center' }); }
      if (beaten) {
        R.ctx.save(); R.ctx.translate(x + tw / 2, y + 26); R.ctx.rotate(-0.25);
        R.box(-26, -5, 52, 11, P.red2, 1, 0.95); R.text('BONEHEAD', 0, -2, { font: TINY, color: P.white, align: 'center', outline: null });
        R.ctx.restore();
        R.spr(Sprites.check, x + tw - 6, y + 6);
      }
      if (current) {
        // A little flag, waving, planted above the next table.
        const fx = x + tw - 8, fy = y - 18;
        R.rect(fx, fy, 1, 18, P.bone2);
        for (let k = 0; k < 9; k++) R.rect(fx + 1 + k, fy + Math.round(Math.sin(R.t * 6 - k * 0.7) * 1), 1, 6, k < 8 ? P.bone0 : P.bone2);
      }
      if (Input.over(x, y, tw, th) && !UI.blocked) hover = { rd, round, x: x + tw / 2, y, beaten, locked, lead };
    });
    // Player token: hops along the path from the last table to the next.
    const to = nodes[next - 1], from = mp.from ? nodes[mp.from - 1] : null, hopT = clamp(t / 1.3), end = spot(to, land, tw, th);
    let tx = end.x, ty = end.y - 10;
    if (from && hopT < 1) {
      const route = elbow(from, to, land); route[0] = spot(from, land, tw, th); route[route.length - 1] = end;
      const pos = along(route, ease.inOutCubic(hopT));
      tx = pos.x; ty = pos.y - 10 - Math.abs(Math.sin(hopT * Math.PI * 4)) * 10;
      if (!mp.hops) mp.hops = 0;
      const hopIdx = Math.floor(hopT * 4);
      if (hopIdx > mp.hops) { mp.hops = hopIdx; Audio.play('land', 0.4); }
    } else if (!from && t < 0.6) ty -= (1 - ease.outCubic(t / 0.6)) * 60;
    if ((hopT >= 1 || !from) && !mp.landed && t > (from ? 1.3 : 0.6)) { mp.landed = true; Audio.play('thud'); FX.burst(tx, ty + 12, 10, { colors: [P.bone1, P.ink5], speed: [20, 60], angle: -Math.PI / 2, spread: 1.2, grav: 150, life: [0.3, 0.5], top: true }); }
    R.spr(Cards.shadow, tx, end.y + 2, { sx: 0.5, sy: 0.08, alpha: 0.4 });
    R.spr(game.mascotSpr((R.t % 4) > 3.8 ? 'wink' : 'idle'), tx, ty, { sc: land ? 0.42 : 0.38 });
    // Header banner
    const bw = Math.min(vw - 16, land ? 290 : 236), bx = vw / 2 - bw / 2, by = 6;
    R.box(bx - 2, by - 2, bw + 4, 37, P.ink0, 2);
    R.box(bx, by, bw, 33, P.bone0, 2);
    for (let k = 0; k < 3; k++) { R.rect(bx + 5, by + 8 + k * 6, 10 - k * 2, 2, P.ink0); R.rect(bx + bw - 15 + k * 2, by + 8 + k * 6, 10 - k * 2, 2, P.ink0); }
    const title = 'THE MIDNIGHT CIRCUIT', tsize = R.measure(title, { size: 2 }) < bw - 40 ? 2 : 1;
    R.text(title, vw / 2, by + (tsize === 2 ? 2 : 6), { size: tsize, color: P.ink0, align: 'center', outline: null, shadow: null });
    const pct = `${Math.round((next - 1) / ROUNDS.length * 100)}%`;
    R.spr(mapCache.crown, vw / 2 - R.measure(pct) / 2 - 7, by + 26);
    R.text(pct, vw / 2 + 3, by + 23, { color: P.ink0, align: 'center', outline: null, shadow: null });
    // Name strip: who's next, with a brushed black band
    const nr = ROUNDS[next - 1], nlead = OPPONENTS[oppIndex(nr.opps[0])], label = `${(nr.name || nlead.name).toUpperCase()} · ${nr.venue || nlead.venue}`;
    const sw = Math.min(vw - 8, R.measure(label) + 40), sy = by + 41;
    R.rect(vw / 2 - sw / 2, sy, sw, 13, P.ink0);
    for (let k = 0; k < 8; k++) { const jl = (k * 7) % 5 + 2; R.rect(vw / 2 - sw / 2 - jl, sy + k * 1.6, jl, 1.6, P.ink0); R.rect(vw / 2 + sw / 2, sy + k * 1.6, (k * 5) % 6 + 2, 1.6, P.ink0); }
    R.text(label, vw / 2, sy + 3, { color: P.gold2, align: 'center', outline: null, ...(R.measure(label) > vw - 20 ? { font: TINY } : {}) });
    const stats = `SCORE ${game.score.toLocaleString()} · ${fmtTime(game.elapsed)} · BEST ${game.best.toLocaleString()}`;
    const stw = R.measure(stats, { font: TINY }) + 12;
    R.box(vw / 2 - stw / 2, sy + 15, stw, 10, P.ink0, 1, 0.85);
    R.text(stats, vw / 2, sy + 17, { font: TINY, color: P.bone1, align: 'center', outline: null });
    if (nr.rule) R.text(`RULE CHANGE: ${RULES[nr.rule].title}`, vw / 2, sy + 29, { font: TINY, color: RULES[nr.rule].color, align: 'center', alpha: 0.7 + Math.sin(R.t * 5) * 0.3 });
    // Tricks in your bag
    const items = Object.entries(mp.items || {}).filter(([, n]) => n > 0).map(([id]) => id), owned = [...game.tricks, ...items];
    owned.forEach((id, i) => R.spr(Sprites.tricks[id], vw / 2 + (i - (owned.length - 1) / 2) * 16, vh - 16, { sc: 0.7 }));
    // Footer
    if (UI.button('map-title', 8, vh - 28, 56, 20, 'TITLE', { color: 'ink' })) game.transition(() => { game.scene = 'title'; });
    if (UI.button('map-go', vw - 78, vh - 30, 70, 24, 'GO!', { size: 2, pulse: t > 1.2, color: 'gold' })) game.startMapRound();
    if (hover) {
      const st = hover.beaten ? '^lBEATEN. Officially a Bonehead.' : hover.locked ? '^dLocked until you clear the tables before it.' : '^gUp next.';
      const who = hover.rd.opps.map(id => OPPONENTS[oppIndex(id)].name).join(' & ');
      UI.tooltip(who, `${hover.rd.venue || hover.lead.venue}${hover.rd.rule ? `\n^o${RULES[hover.rd.rule].title}` : ''}\n${st}`, hover.x, hover.y - 6, { color: hover.rd.name ? P.teal1 : hover.lead.color, w: 150 });
    }
  },

  modal(game) {
    const m = game.modal, fn = this[m.kind];
    if (fn) fn.call(this, game, m);
  },

  key(game, k) {
    const m = game.modal;
    if (!m) return;
    if (k.key === 'Escape' && !['reward', 'result', 'rule'].includes(m.kind)) { game.closeModal(); return; }
    if (m.kind === 'rules') {
      if (k.key === 'ArrowRight' || k.key === 'Enter') { if (m.data.page < 4) { m.data.page++; m.data.pt = 0; Audio.play('ui'); } else finishRules(game); }
      if (k.key === 'ArrowLeft' && m.data.page > 0) { m.data.page--; m.data.pt = 0; Audio.play('back'); }
    }
    if (m.kind === 'result' && k.key === 'Enter') resultAction(game);
    if (m.kind === 'rule' && (k.key === 'Enter' || k.key === ' ') && m.t > 0.6) { const r = m.data.resolve; game.modal = null; Audio.muffle(false); r?.(); }
    if (m.kind === 'confirm' && k.key === 'Enter') startFresh(game);
  },

  pause(game, m) {
    const w = 170, h = 206, b = UI.modal('pause', w, h, m.t);
    UI.title('PAUSED', b.x + w / 2, b.y + 12, { size: 2 });
    R.text('The house can wait.', b.x + w / 2, b.y + 32, { color: P.ink6, align: 'center' });
    const items = [['RESUME', 'gold', () => game.closeModal()], ['HOW TO PLAY', 'ink', () => game.openModal('rules', { page: 0 })], ['SCORING', 'ink', () => game.openModal('scoring')], ['OPTIONS', 'ink', () => game.openModal('options')], ['TROPHIES', 'ink', () => game.openModal('trophies')], ['NEW RUN', 'red', () => game.openModal('confirm')], ['TITLE SCREEN', 'ink', () => { game.save(); game.modal = null; Audio.muffle(false); game.transition(() => { game.token++; game.scene = 'title'; Post.theme(THEMES_TITLE()); }); }]];
    items.forEach(([label, color, act], i) => { if (UI.button('p-' + label, b.x + 20, b.y + 46 + i * 22, w - 40, 17, label, { color, ignoreBlock: true })) act(); });
    b.restore();
  },

  options(game, m) {
    const w = 210, h = 257, b = UI.modal('opts', w, h, m.t), s = game.settings;
    UI.title('OPTIONS', b.x + w / 2, b.y + 12, { size: 2 });
    UI.blocked = false;
    const x = b.x + 16, iw = w - 32;
    const mv = UI.slider('o-music', x, b.y + 50, iw, s.music, 'MUSIC');
    const sv = UI.slider('o-sfx', x, b.y + 76, iw, s.sfx, 'SOUND FX');
    if (mv !== s.music) { s.music = mv; game.applySettings(); }
    if (sv !== s.sfx) { s.sfx = sv; game.applySettings(); }
    const toggles = [['hints', 'CARD HINTS'], ['crt', 'CRT GLOW'], ['shake', 'SCREEN SHAKE'], ['reduced', 'REDUCED MOTION'], ['fast', 'FAST ANIMATIONS']];
    toggles.forEach(([key, label], i) => { const v = UI.toggle('o-' + key, x, b.y + 94 + i * 17, iw, label, s[key]); if (v !== s[key]) { s[key] = v; game.applySettings(); } });
    // Switching renderer needs a fresh canvas, so it reloads the page (the run is saved).
    const safe = UI.toggle('o-safe', x, b.y + 94 + 5 * 17, iw, 'SAFE RENDERING', !!s.safe);
    if (safe !== !!s.safe) { s.safe = safe; game.applySettings(); game.save(); setTimeout(() => location.reload(), 250); }
    R.text('Try Safe Rendering if graphics glitch.', b.x + w / 2, b.y + h - 52, { color: P.ink6, align: 'center', outline: null, ...T });
    R.text('All music & sound is synthesised live.', b.x + w / 2, b.y + h - 42, { color: P.ink6, align: 'center', outline: null, ...T });
    if (UI.button('o-back', b.x + w / 2 - 40, b.y + h - 30, 80, 20, 'BACK', { color: 'gold', ignoreBlock: true })) game.closeModal();
    UI.blocked = true;
    b.restore();
  },

  // Rule-change card shown before a round's deal.
  rule(game, m) {
    const rl = RULES[m.data.rule], w = Math.min(R.vw - 16, 250), h = Math.min(R.vh - 12, 214), b = UI.modal('rule', w, h, m.t, { fill: P.ink1 });
    const stamp = m.t < 0.25 ? 2.2 - 1.2 * ease.outCubic(m.t / 0.25) : 1;
    R.ctx.save(); R.ctx.translate(b.x + w / 2, b.y + 18); R.ctx.rotate(-0.05); R.ctx.scale(stamp, stamp);
    R.box(-54, -9, 108, 18, P.red2, 2); R.box(-52, -7, 104, 14, P.red4, 2);
    R.text('RULE CHANGE', 0, -4, { color: P.red1, align: 'center' });
    R.ctx.restore();
    UI.title(rl.title, b.x + w / 2, b.y + 36, { size: 2, color: rl.color });
    const ax = b.x + w / 2, ay = b.y + 82, t = m.t;
    if (m.data.rule === 'choose') {
      // Six cards; three hop up onto the table.
      [3, 10, 7, 2, 12, 5].forEach((r, i) => {
        const up = [1, 3, 4].includes(i), k = up ? ease.inOutCubic(clamp((t - 0.6 - i * 0.08) / 0.4)) : 0, x = ax + (i - 2.5) * 22;
        R.spr(Cards.face({ r, s: i % 4 }), x, ay + 8 - k * 26, { sc: 0.5, rot: (i - 2.5) * 0.05 * (1 - k) });
      });
      R.text('LATER', ax, ay - 44, { font: TINY, color: P.gold1, align: 'center', alpha: clamp((t - 1) * 3) });
    } else {
      game.cpuSeats().forEach((seat, i) => R.spr(portrait(game.oppIdx(seat), (R.t + i) % 3 < 0.15 ? 'blink' : 'idle', 0), ax + (i - 0.5) * 50, ay, { sc: 0.9 }));
    }
    rl.lines.forEach((l, i) => R.text(l, b.x + w / 2, b.y + 118 + i * 11, { color: P.bone1, align: 'center', reveal: Math.floor((t - 0.4 - i * 0.2) * 60) }));
    if (m.t > 0.6 && UI.button('rule-go', b.x + w / 2 - 50, b.y + h - 30, 100, 22, "LET'S GO", { ignoreBlock: true, pulse: true })) { const r = m.data.resolve; game.modal = null; Audio.muffle(false); r?.(); }
    b.restore();
  },

  // Hidden dev panel: compare art trials live and jump to test tables.
  dev(game, m) {
    const w = Math.min(R.vw - 12, 300), h = Math.min(R.vh - 10, 294), b = UI.modal('dev', w, h, m.t, { fill: P.ink1 });
    UI.title('DEV MODE', b.x + w / 2, b.y + 8, { size: 2, color: P.teal1, wave: 0.5 });
    const tile = (id, x, y, tw, th, selected, draw, label) => {
      const hot = Input.over(x, y, tw, th);
      if (selected || hot) R.box(x - 2, y - 2, tw + 4, th + 4, selected ? P.gold1 : P.ink5, 3);
      R.panel(x, y, tw, th, { fill: selected ? P.ink3 : P.ink2, hi: P.ink4 });
      draw(x + tw / 2, y + (th - 10) / 2);
      R.text(label, x + tw / 2, y + th - 9, { font: TINY, color: selected ? P.gold1 : P.bone1, align: 'center' });
      return Input.button('dv-' + id, x, y, tw, th, true);
    };
    let y = b.y + 30;
    R.text('TITLE MASCOT', b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    const styles = ['classic', 'brand'], tw = Math.floor((w - 24 - 8) / 2), th = 64;
    styles.forEach((st, i) => {
      const x = b.x + 12 + i * (tw + 8), wink = (R.t + i) % 4 > 3.7;
      const spr = Sprites.mascots[st][wink ? 'wink' : 'idle'];
      if (tile('m-' + st, x, y, tw, th, game.dev.mascot === st, (cx, cy) => R.spr(spr, cx, cy + Math.sin(R.t * 2 + i) * 1.5, { sc: Math.min((tw - 8) / 64, (th - 14) / 60) }), st.toUpperCase())) game.setDev('mascot', st);
    });
    y += th + 10;
    R.text('LOGO SKULL', b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    ['classic', 'brand'].forEach((st, i) => {
      const lw = Math.floor((w - 24 - 8) / 2), x = b.x + 12 + i * (lw + 8), sk = Sprites.logoSkulls[st];
      if (tile('l-' + st, x, y, lw, 40, game.dev.logo === st, (cx, cy) => {
        R.text('B', cx - 22, cy - 7, { size: 2, color: P.bone0 }); R.spr(sk, cx, cy, { sc: 17 / sk.h }); R.text('NE', cx + 10, cy - 7, { size: 2, color: P.bone0 });
      }, st.toUpperCase())) game.setDev('logo', st);
    });
    y += 50;
    R.text('TEST TABLES' + (game.started && game.scene === 'table' ? '' : ' · START A RUN FIRST'), b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    const tests = [['KeyB', 'BURN'], ['KeyQ', 'QUADS'], ['KeyR', 'RUN'], ['KeyL', 'BLIND'], ['KeyW', 'WIN']];
    const bw = Math.floor((w - 24 - 4 * 4) / 5), can = game.started && game.scene === 'table' && !game.moving;
    tests.forEach(([code, label], i) => {
      if (UI.button('dt-' + code, b.x + 12 + i * (bw + 4), y, bw, 16, label, { color: 'ink', enabled: can, ignoreBlock: true })) { game.modal = null; Audio.muffle(false); game.devKey(code); }
    });
    y += 22;
    R.text('JUMP TO ROUND', b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    const rw = Math.floor((w - 24 - (ROUNDS.length - 1) * 4) / ROUNDS.length);
    ROUNDS.forEach((rd, i) => {
      const label = `${i + 1} ${(rd.name || OPPONENTS[oppIndex(rd.opps[0])].name).replace('The ', '').toUpperCase()}`;
      if (UI.button('dr-' + i, b.x + 12 + i * (rw + 4), y, rw, 16, label, { color: game.started && game.g?.round === i + 1 ? 'teal' : 'ink', ignoreBlock: true, size: 1 })) { Audio.muffle(false); game.jumpToRound(i + 1); }
    });
    y += 24;
    R.text(`${R.soft ? 'SOFTWARE' : 'GPU'} CANVAS · WEBGL ${Post.ok ? 'ON' : 'OFF'} · ${R.W}×${R.H} · ×${R.S.toFixed(2)}`, b.x + w / 2, y, { font: TINY, color: P.ink6, align: 'center' });
    if (UI.button('dv-close', b.x + w / 2 - 40, b.y + h - 26, 80, 18, 'CLOSE', { ignoreBlock: true })) game.closeModal();
    b.restore();
  },

  confirm(game, m) {
    const w = 190, h = 110, b = UI.modal('confirm', w, h, m.t);
    UI.title('NEW RUN?', b.x + w / 2, b.y + 12, { size: 2, color: P.red1 });
    R.para('Your current run will be lost. Best score and trophies stay.', b.x + 14, b.y + 36, w - 28, { align: 'center', color: P.bone1 });
    if (UI.button('c-no', b.x + 14, b.y + h - 32, 76, 20, 'KEEP GOING', { color: 'ink', ignoreBlock: true })) game.closeModal();
    if (UI.button('c-yes', b.x + w - 90, b.y + h - 32, 76, 20, 'DEAL ME IN', { color: 'red', ignoreBlock: true })) startFresh(game);
    b.restore();
  },

  scoring(game, m) {
    const w = Math.min(R.vw - 16, 280), h = Math.min(R.vh - 16, 250), b = UI.modal('scoring', w, h, m.t);
    UI.title('SCORING', b.x + w / 2, b.y + 10, { size: 2 });
    const x = b.x + 14, iw = w - 28;
    let y = b.y + 34;
    y += R.para('^bCHIPS^0 × ^rMULT^0 + bonuses, every time you play.', x, y, iw, { color: P.bone0 }) + 4;
    y += R.para('^bChips:^0 number cards are rank × 10. J 110 · Q 120 · K 130 · A 150. Magic: 2 = 200, 8 = 240, 9 = 260, 10 = 300.', x, y, iw, { color: P.bone1 }) + 4;
    y += R.para('^rMult:^0 ×1 for one card, +0.5 per extra card in a run. Three of a kind +0.5, four of a kind +1.5.', x, y, iw, { color: P.bone1 }) + 4;
    y += R.para('^oBurns^0 pay 100 + 25% of the pile\'s chips, boosted every 5 cards. ^tQuick^0 plays add a little extra. Picking up scores nothing.', x, y, iw, { color: P.bone1 }) + 4;
    R.para('^gBonus goals^0 pay out the moment you hit them.', x, y, iw, { color: P.bone1 });
    if (UI.button('s-back', b.x + w / 2 - 40, b.y + h - 28, 80, 20, 'GOT IT', { ignoreBlock: true })) game.closeModal();
    b.restore();
  },

  trophies(game, m) {
    const list = Object.entries(trophies), cols = 2, rowH = 21, rows = Math.ceil(list.length / cols);
    const w = Math.min(R.vw - 12, 300), h = Math.min(R.vh - 8, 66 + rows * rowH + 50), b = UI.modal('trophies', w, h, m.t);
    const rarityCol = { BRONZE: P.gold3, SILVER: P.bone2, GOLD: P.gold1, RARE: P.vio1 };
    UI.title('TROPHIES', b.x + w / 2, b.y + 8, { size: 2 });
    const got = list.filter(([id]) => game.unlocked[id]).length;
    R.text(`${got} / ${list.length} UNLOCKED`, b.x + w / 2, b.y + 27, { color: P.ink6, align: 'center' });
    const cw = Math.floor((w - 24 - 6) / cols);
    let pick = m.data.pick ?? null;
    list.forEach(([id, t], i) => {
      const x = b.x + 12 + (i % cols) * (cw + 6), y = b.y + 40 + Math.floor(i / cols) * rowH, on = !!game.unlocked[id];
      const hot = Input.over(x, y, cw, rowH - 3) || pick === id;
      if (Input.over(x, y, cw, rowH - 3)) pick = id;
      R.panel(x, y, cw, rowH - 3, { fill: hot ? P.ink4 : on ? P.ink3 : P.ink1, hi: on ? P.ink4 : null, rim: on ? rarityCol[t.rarity] : P.ink0, shadow: false });
      R.spr(on ? Sprites.trophy : Sprites.trophyDim, x + 10, y + (rowH - 3) / 2, { sc: on ? 0.9 + Math.sin(R.t * 4 + i) * 0.05 : 0.9 });
      R.text(on ? t.name : '???', x + 19, y + 5, { color: on ? P.bone0 : P.ink5, ...(R.measure(t.name) > cw - 24 ? { font: TINY } : {}) });
      if (Input.button('tr-' + id, x, y, cw, rowH - 3, true)) { m.data.pick = id; Audio.play('ui'); }
    });
    const dy = b.y + 44 + rows * rowH;
    const sel = pick && trophies[pick];
    if (sel) {
      const on = !!game.unlocked[pick];
      R.text(`${sel.rarity}${on ? ' · UNLOCKED' : ''}`, b.x + w / 2, dy, { font: TINY, color: rarityCol[sel.rarity], align: 'center' });
      R.text(on ? sel.name : 'LOCKED TROPHY', b.x + w / 2, dy + 8, { color: on ? P.gold1 : P.ink6, align: 'center' });
      R.text(sel.detail, b.x + w / 2, dy + 19, { color: P.bone1, align: 'center', ...(R.measure(sel.detail) > w - 20 ? { font: TINY } : {}) });
    } else R.text('Hover or tap a trophy to see how to earn it.', b.x + w / 2, dy + 10, { color: P.ink6, align: 'center', font: TINY });
    if (UI.button('tr-back', b.x + w / 2 - 40, b.y + h - 24, 80, 18, 'BACK', { ignoreBlock: true })) game.closeModal();
    b.restore();
  },

  rules(game, m) {
    const w = Math.min(R.vw - 12, 300), h = Math.min(R.vh - 12, 240), b = UI.modal('rules', w, h, m.t), d = m.data;
    d.pt = (d.pt ?? 0) + UI.dt;
    const pages = [
      { title: 'Lose every card.', body: 'Take turns playing onto the pile. Match or beat the top card. First to run out wins.', art: 'run', cards: [[4, 1], [7, 0], [11, 2]] },
      { title: `Keep ${game.config.minHand} in hand.`, body: 'After you play, you draw back up while the deck lasts. Can\'t beat the pile? You pick the whole thing up.', art: 'draw' },
      { title: 'Four magic cards.', body: 'All four play on anything. The ghost 8 is see-through, so the card under it still sets the rule. Four of a kind in a row burns the pile too.', art: 'magic' },
      { title: 'Make a run.', body: 'Play equal ranks, or climbing cards of one suit, together. Pick them in any order, or double-tap a card and the game builds the run.', art: 'combo' },
      { title: 'The last six.', body: 'Deck and hand gone? Play your face-up table cards, then flip the blind ones. A bad flip picks up the pile.', art: 'blind' },
    ];
    const p = pages[d.page];
    R.text(`HOW TO PLAY · ${d.page + 1}/5`, b.x + w / 2, b.y + 8, { color: P.ink6, align: 'center' });
    UI.title(p.title, b.x + w / 2, b.y + 20, { size: 2, color: P.gold1 });
    const ax = b.x + w / 2, ay = b.y + 90, pt = d.pt;
    const deal = (i, x, y, spr, o = {}) => { const k = ease.outBack(clamp((pt - i * 0.12) / 0.35), 1.6); if (k <= 0) return; R.spr(Cards.shadow, x + 2, y + 3, { sc: k * (o.sc ?? 1), alpha: 0.3 }); R.spr(spr, x, y - (1 - k) * 20, { sc: k * (o.sc ?? 1), rot: (o.rot ?? 0) * k }); };
    if (p.art === 'run') p.cards.forEach(([r, s], i) => { deal(i, ax + (i - 1) * 56, ay, card(r, s), { rot: (i - 1) * 0.06 }); if (i < 2) R.text('→', ax + (i - 0.5) * 56, ay - 3, { color: P.ink6, align: 'center' }); });
    if (p.art === 'draw') { deal(0, ax - 70, ay, Cards.back); R.text('→', ax - 38, ay - 3, { color: P.ink6, align: 'center' }); [[3, 1], [6, 0], [12, 3]].forEach(([r, s], i) => deal(i + 1, ax + (i - 0.2) * 30, ay, card(r, s), { rot: (i - 1) * 0.08 })); }
    if (p.art === 'magic') [[2, 'ANYTHING', 'NEXT', P.teal1], [8, 'SEE-THROUGH', 'RULE BELOW', P.vio1], [9, 'NEXT CARD', '9 OR LOWER', P.vio1], [10, 'BURNS PILE', 'GO AGAIN', P.fire2]].forEach(([r, a, b2, col], i) => {
      const cx = ax + (i - 1.5) * 50;
      deal(i, cx, ay - 8, card(r, i % 4), { sc: 0.9 });
      if (pt > 0.3 + i * 0.12) { R.text(a, cx, ay + 20, { font: TINY, color: col, align: 'center' }); R.text(b2, cx, ay + 27, { font: TINY, color: P.bone1, align: 'center' }); }
    });
    if (p.art === 'combo') { [[3, 1], [4, 1], [5, 1]].forEach(([r, s], i) => deal(i, ax + (i - 1) * 46, ay - 6, card(r, s))); if (pt > 0.6) R.text('^b120^0 × ^r2^0 = ^g240', ax, ay + 32, { align: 'center', size: 1 }); }
    if (p.art === 'blind') [4, 7, 12].forEach((r, i) => { deal(i, ax + (i - 1) * 52, ay + 4, Cards.back, { sc: 0.9 }); deal(i + 0.5, ax + (i - 1) * 52 + 2, ay - 4, card(r, i), { sc: 0.9 }); });
    R.para(p.body, b.x + 16, b.y + h - 76, w - 32, { align: 'center', color: P.bone1 });
    for (let i = 0; i < 5; i++) R.box(b.x + w / 2 - 22 + i * 10, b.y + h - 38, 6, 6, i === d.page ? P.gold1 : P.ink4, 1);
    if (UI.button('r-back', b.x + 12, b.y + h - 30, 60, 20, d.page ? 'BACK' : 'CLOSE', { color: 'ink', ignoreBlock: true })) { if (d.page) { d.page--; d.pt = 0; } else finishRules(game); }
    if (UI.button('r-next', b.x + w - 72, b.y + h - 30, 60, 20, d.page < 4 ? 'NEXT' : 'DEAL!', { ignoreBlock: true })) { if (d.page < 4) { d.page++; d.pt = 0; } else finishRules(game); }
    b.restore();
  },

  reward(game, m) {
    const land = R.land, w = Math.min(R.vw - 12, land ? 330 : 240), h = land ? 200 : 330, b = UI.modal('reward', w, h, m.t, { fill: P.ink2 });
    UI.title('THE HOUSE OWES YOU', b.x + w / 2, b.y + 12, { size: land ? 2 : 1, color: P.gold1 });
    R.text('Claim one trick for the next table.', b.x + w / 2, b.y + (land ? 32 : 26), { color: P.bone1, align: 'center' });
    const choices = game.rewardChoices, cw = land ? 92 : 200, ch = land ? 132 : 84;
    choices.forEach((id, i) => {
      const u = UPGRADES[id];
      const x = land ? b.x + w / 2 + (i - 1) * (cw + 8) - cw / 2 : b.x + w / 2 - cw / 2, y = land ? b.y + 48 : b.y + 42 + i * (ch + 8);
      const inT = ease.outBack(clamp((m.t - 0.2 - i * 0.12) / 0.4), 1.5);
      if (inT <= 0) return;
      const hot = Input.over(x, y, cw, ch) && m.t > 0.6;
      const lift = hot ? -4 : Math.sin(R.t * 2 + i) * 1.5;
      R.ctx.save(); R.ctx.translate(x + cw / 2, y + ch / 2 + lift); R.ctx.scale(inT * (hot ? 1.04 : 1), inT); R.ctx.rotate(hot ? Math.sin(R.t * 10) * 0.01 : 0); R.ctx.translate(-(x + cw / 2), -(y + ch / 2));
      if (hot) R.box(x - 3, y - 3, cw + 6, ch + 6, u.color, 3, 0.6 + Math.sin(R.t * 8) * 0.3);
      R.panel(x, y, cw, ch, { fill: P.ink1, rim: P.ink0, hi: P.ink3, depth: 3 });
      R.box(x + 3, y + 3, cw - 6, ch - 6, u.color, 2, 0.12);
      if (land) {
        R.spr(Sprites.tricks[id], x + cw / 2, y + 22, { sc: 2 + (hot ? Math.sin(R.t * 6) * 0.1 : 0) });
        R.text(u.kind, x + cw / 2, y + 42, { color: P.ink6, align: 'center', ...T });
        R.para(u.name.toUpperCase(), x + 4, y + 51, cw - 8, { align: 'center', color: u.color, lineH: 9 });
        R.para(u.desc, x + 6, y + 72, cw - 12, { align: 'center', color: P.bone1, ...T, lineH: 7 });
      } else {
        R.spr(Sprites.tricks[id], x + 22, y + 24, { sc: 2 });
        R.text(u.name.toUpperCase(), x + 44, y + 8, { color: u.color });
        R.text(u.kind, x + 44, y + 19, { color: P.ink6, ...T });
        R.para(u.desc, x + 44, y + 29, cw - 50, { color: P.bone1, ...T, lineH: 7 });
      }
      R.ctx.restore();
      if (Input.button('rw-' + id, x, y, cw, ch, m.t > 0.6 && !m.data.picked)) {
        Audio.play('trophy'); Post.flash([1, 0.9, 0.6], 0.3);
        FX.burst(x + cw / 2, y + ch / 2, 50, { colors: CONFETTI, speed: [60, 200], grav: 140, size: [1, 3], life: [0.6, 1.4], top: true });
        game.modal.data.picked = id;
        game.transition(() => game.chooseUpgrade(id));
      }
      if (hot && Input.hot !== 'rw-' + id) Input.cursor = 'pointer';
    });
    b.restore();
  },

  result(game, m) {
    // With two opponents, the one left holding the most cards takes the title.
    const g = game.g, win = g.winner === 'player', last = g.round >= ROUNDS.length, advance = win && !last;
    const seats = game.cpuSeats(), loserSeat = seats.reduce((a, s2) => (cardsLeft(g[s2]) > cardsLeft(g[a]) ? s2 : a), seats[0]);
    const idx = game.oppIdx(loserSeat), opp = OPPONENTS[idx];
    const w = Math.min(R.vw - 12, 250), h = Math.min(R.vh - 10, 232), b = UI.modal('result', w, h, m.t, { fill: win ? P.ink2 : '#2a0f1f' });
    const head = win ? (last ? 'YOU BEAT THE HOUSE' : 'ROUND CLEARED') : seats.length > 1 ? 'LAST ONE HOLDING CARDS' : 'THE HOUSE WINS';
    R.text(head, b.x + w / 2, b.y + 10, { color: win ? P.grn1 : P.red1, align: 'center' });
    // The loser gets the title. Stamp slams in.
    const px = b.x + w / 2, py = b.y + 62;
    if (win) { R.panel(px - 28, py - 28, 56, 56, { fill: P.ink3, rim: opp.color }); R.spr(portrait(idx, m.t > 0.9 ? 'talk' : 'idle', Math.floor(R.t * 6)), px, py); }
    else R.spr(game.mascotSpr(), px, py, { sc: 0.9 });
    R.text(win ? opp.name.toUpperCase() : 'YOU', px, py + 32, { color: P.bone0, align: 'center' });
    R.text('IS OFFICIALLY A', px, py + 42, { color: P.ink6, align: 'center', ...T });
    const st = m.t - 0.55;
    if (st > 0) {
      if (!m.data.stamped) { m.data.stamped = true; Audio.play('stamp'); R.shake(0.45); Post.impact(0.5); FX.burst(px, py + 66, 30, { colors: [P.red1, P.red2, P.bone0], speed: [60, 160], grav: 200, size: [1, 2], top: true }); }
      const k = st < 0.18 ? 3 - 2 * ease.outCubic(st / 0.18) : 1;
      R.ctx.save(); R.ctx.translate(px, py + 66); R.ctx.rotate(-0.08); R.ctx.scale(k, k);
      R.box(-78, -13, 156, 26, P.red2, 2, 0.95); R.box(-76, -11, 152, 22, win ? P.ink2 : P.red4, 2);
      R.text('BONEHEAD', 0, -7, { size: 2, color: P.red1, align: 'center' });
      R.ctx.restore();
    }
    const goals = roundGoals(g).filter(x => x.complete);
    let y = py + 88;
    R.text(`RUN SCORE ^g${game.score.toLocaleString()}`, px, y, { align: 'center', color: P.bone1 }); y += 11;
    R.text(`${g.playerBurns || 0} BURNS · ${fmtTime(game.elapsed)} · BEST ${game.best.toLocaleString()}`, px, y, { align: 'center', color: P.ink6, ...T }); y += 9;
    if (goals.length) R.text(goals.map(x => `✓ ${x.name}`).join('  '), px, y, { align: 'center', color: P.grn1, ...T });
    if (m.t > 0.8 && UI.button('res-go', b.x + 20, b.y + h - 30, w - 40, 22, advance ? 'CLAIM A TRICK' : win ? 'VICTORY LAP · NEW RUN' : 'ONE MORE RUN', { color: advance ? 'gold' : win ? 'green' : 'red', ignoreBlock: true, pulse: true })) resultAction(game);
    if (win && last && m.t > 0.6 && Math.random() < 0.15) FX.burst(Math.random() * R.vw, -5, 3, { colors: CONFETTI, speed: [10, 40], angle: Math.PI / 2, spread: 0.5, grav: 60, life: [2, 3], size: [1, 2], top: true });
    b.restore();
  },
};

function THEMES_TITLE() { return { a: '#43195c', b: '#0e1230', c: '#b0305a' }; }

function resultAction(game) {
  const g = game.g, win = g.winner === 'player';
  if (win && g.round < ROUNDS.length) { game.modal = null; game.claimTrick(); }
  else { store.set('bh2-save', null); startFresh(game); }
}

function startFresh(game) {
  game.modal = null; Audio.muffle(false);
  if (!store.get('bh-tutorial-seen', false)) { game.openModal('rules', { page: 0, startsRun: true }); return; }
  game.transition(() => game.newRun());
}

function finishRules(game) {
  const starts = game.modal?.data?.startsRun;
  store.set('bh-tutorial-seen', true);
  game.modal = null; Audio.muffle(false);
  if (starts) game.transition(() => game.newRun());
}
