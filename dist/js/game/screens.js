import { R } from '../core/render.js';
import { TINY } from '../core/font.js';
import { Input } from '../core/input.js';
import { FX, CONFETTI } from '../core/fx.js';
import { Post } from '../core/post.js';
import { ease, clamp } from '../core/tween.js';
import { P, THEMES } from '../art/palette.js';
import { Cards } from '../art/cards.js';
import { Sprites, OPPONENTS, portrait, oppIndex } from '../art/sprites.js';
import { Audio } from '../audio/sfx.js';
import { Music } from '../audio/music.js';
import { roundGoals } from '../../scoring.js';
import { trophies } from '../../progression.js';
import { UI } from './ui.js';
import { UPGRADES, fmtTime, store } from './game.js';
import { ROUNDS, RULES, ROUND_LOCKS } from './rounds.js';
import { crownIcon } from '../art/map.js';
import { mapRoomHD } from '../art/mapHD.js';
import { drawTitle, titleKey } from './title.js';
import { cardsLeft } from '../../engine.js';

const T = { font: TINY };
const card = (r, s) => Cards.face({ r, s }, Math.floor(R.t * 8));


// Progression map state that only matters for drawing.
const mapCache = { key: '', room: null, spr: null, crown: null };
const motes = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), ph: Math.random() * 6, sp: 0.15 + Math.random() * 0.3 }));

// The four opponent cards sit on the table in a gentle zig-zag.
function mapCards(t, land) {
  const n = ROUNDS.length;
  if (land) return ROUNDS.map((_, i) => ({ x: t.cx + (i - (n - 1) / 2) * 62, y: t.cy + (i % 2 ? -1 : 1) * 15 }));
  return ROUNDS.map((_, i) => ({ x: t.cx + (i % 2 ? 1 : -1) * 24, y: t.cy + ((n - 1) / 2 - i) * 60 }));
}
// A snaking chalk line through the cards (Catmull-Rom through their centres).
function snake(pts) {
  const out = [], ext = [pts[0], ...pts, pts.at(-1)];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      out.push({ seg: i - 1, x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3) + Math.sin(k / 24 * Math.PI) * 7 * (i % 2 ? 1 : -1) });
    }
  }
  return out;
}


export const Screens = {
  title(game) { drawTitle(game, id => titleAct(game, id)); },

  // Between rounds: the Midnight Circuit, seen from above: four opponent cards on a
  // crypt card table (after The Binding of Isaac's rooms). Pick a table, then GO.
  map(game) {
    const vw = R.vw, vh = R.vh, land = R.land, mp = game.map, t = mp.t, cleared = game.cleared || [];
    const key = `${Math.ceil(vw)}x${Math.ceil(vh)}`;
    if (mapCache.key !== key) { mapCache.key = key; mapCache.room = mapRoomHD(Math.ceil(vw), Math.ceil(vh), land); mapCache.crown ??= crownIcon().spr(); }
    const room = mapCache.room, tb = room.table, rug = room.rug;
    R.spr(room.spr, 0, 0, { ax: 0, ay: 0 });
    // Candle flames and a flickering glow
    room.candles.forEach((c, i) => {
      const fl = Sprites.flame[Math.floor(R.t * 8 + i) % 3], x = c.x + 0.5, y = c.y;
      R.box(x - 5, y - 4, 10, 10, P.fire2, 3, 0.05 + Math.sin(R.t * 9 + i * 2) * 0.03);
      R.spr(fl, x, y, { sc: 0.32 + Math.sin(R.t * 11 + i) * 0.03 });
    });
    // Wall torches
    room.torches.forEach((tc, i) => {
      const fl = Sprites.flame[Math.floor(R.t * 9 + i * 2) % 3];
      R.box(tc.x - 10, tc.y - 12, 20, 20, P.fire2, 6, 0.06 + Math.sin(R.t * 7 + i * 3) * 0.04);
      R.spr(fl, tc.x, tc.y - 4, { sc: 0.75 + Math.sin(R.t * 10 + i) * 0.06 });
    });
    // Dust motes drifting in the lamp light over the table
    for (const m of motes) {
      const x = tb.cx + (m.x - 0.5) * tb.rx * 2, y = tb.cy + (m.y - 0.5) * tb.ry * 2 + Math.sin(R.t * m.sp + m.ph) * 5;
      R.rect(Math.round(x), Math.round(y), 1, 1, P.bone1, 0.15 + 0.35 * Math.max(0, Math.sin(R.t * 1.5 + m.ph)));
    }
    const cards = mapCards(tb, land), sel = mp.sel;
    // Chalk path: dotted, solid gold through cleared tables
    const path = snake(cards);
    path.forEach((pt, i) => {
      if (i % 2) return;
      const done = cleared.includes(pt.seg + 1) && cleared.includes(pt.seg + 2);
      R.rect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 3, 3, P.ink0, 0.35); R.rect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2, done ? P.gold1 : '#eef6e6', done ? 1 : 0.8);
    });
    // Opponent cards
    const cw = 41, ch = 57;
    let hover = null;
    const order = ROUNDS.map((_, i) => i).sort((a, b) => (a === sel - 1) - (b === sel - 1));
    for (const i of order) {
      const rd = ROUNDS[i], round = i + 1, n = cards[i], done = cleared.includes(round), picked = round === sel;
      const locked = ROUND_LOCKS && !done && round !== mp.next;
      const hot = Input.over(n.x - cw / 2, n.y - ch / 2, cw, ch) && !UI.blocked && !locked;
      const lift = picked ? 7 + Math.sin(R.t * 3) * 1.5 : hot ? 3 : 0, sc = picked ? 1.12 : 1;
      const x = n.x, y = n.y - lift;
      R.ctx.save(); R.ctx.translate(x, y); R.ctx.scale(sc, sc); R.ctx.rotate(picked ? 0 : (i % 2 ? 0.04 : -0.04));
      R.box(-cw / 2 + 2, -ch / 2 + 3 + lift * 0.6, cw, ch, P.ink0, 3, 0.45);
      if (picked) R.box(-cw / 2 - 3, -ch / 2 - 3, cw + 6, ch + 6, P.gold1, 3, 0.55 + Math.sin(R.t * 6) * 0.35);
      R.box(-cw / 2, -ch / 2, cw, ch, P.ink1, 3);
      R.box(-cw / 2 + 1, -ch / 2 + 1, cw - 2, ch - 2, done ? '#d8cfb4' : P.bone0, 3);
      const lead = OPPONENTS[oppIndex(rd.opps[0])], col = rd.name ? P.teal2 : lead.color;
      R.box(-cw / 2 + 4, -ch / 2 + 9, cw - 8, 30, col, 1);
      R.box(-cw / 2 + 5, -ch / 2 + 10, cw - 10, 28, P.ink1, 1);
      const pscale = rd.opps.length > 1 ? 0.34 : 0.6;
      rd.opps.forEach((id, k) => R.spr(portrait(oppIndex(id), picked && (R.t + k) % 3.5 < 0.12 ? 'blink' : 'idle', Math.floor(R.t * 6)), (rd.opps.length > 1 ? (k - 0.5) * 15 : 0), -ch / 2 + 24, { sc: pscale }));
      R.text(String(round), -cw / 2 + 3, -ch / 2 + 2, { font: TINY, color: P.ink1, outline: null, shadow: null });
      if (rd.rule) R.text('!', cw / 2 - 5, -ch / 2 + 2, { font: TINY, color: P.red2, outline: null, shadow: null });
      const full = (rd.name || lead.name).replace('The ', '').toUpperCase(), name = R.measure(full, { font: TINY }) > cw - 5 ? full.split(' ')[0] : full;
      R.text(name, 0, ch / 2 - 12, { font: TINY, color: P.ink2, align: 'center', outline: null, shadow: null });
      if (done) {
        R.ctx.rotate(-0.3);
        R.box(-21, -4, 42, 9, P.red2, 1, 0.92); R.text('BONEHEAD', 0, -2, { font: TINY, color: P.white, align: 'center', outline: null, shadow: null });
        R.ctx.rotate(0.3);
        R.spr(Sprites.check, cw / 2 - 3, -ch / 2 + 3);
      }
      if (locked) { R.box(-cw / 2 + 1, -ch / 2 + 1, cw - 2, ch - 2, P.ink0, 3, 0.55); R.spr(Sprites.lock, 0, 0); }
      R.ctx.restore();
      // Bouncing arrow over the selected table
      if (picked) R.text('↓', x, y - ch * sc / 2 - 13 - Math.abs(Math.sin(R.t * 4)) * 4, { size: 2, color: P.gold1, align: 'center' });
      if (hot) hover = { rd, round, x, y: y - ch / 2, done, lead };
      if (!locked && Input.button('map-card-' + round, n.x - cw / 2, n.y - ch / 2, cw, ch, !UI.blocked)) {
        if (sel === round) game.startMapRound(); else { mp.sel = round; Audio.play('select', round * 2); }
      }
    }
    // Selected table: who, where, what changes
    const nr = ROUNDS[sel - 1], nlead = OPPONENTS[oppIndex(nr.opps[0])];
    const label = `ROUND ${sel} · ${(nr.name || nlead.name).toUpperCase()} · ${nr.venue || nlead.venue}`;
    // Across the top edge of the rug, above the four tables
    const sw = Math.min(vw - 8, R.measure(label) + 30), sy = rug.y - 2;
    R.rect(vw / 2 - sw / 2, sy, sw, 13, P.ink0, 0.9);
    R.text(label, vw / 2, sy + 3, { color: P.gold2, align: 'center', outline: null, ...(R.measure(label) > vw - 20 ? { font: TINY } : {}) });
    const note = nr.rule ? `RULE CHANGE: ${RULES[nr.rule].title}` : cleared.includes(sel) ? 'ALREADY BEATEN · PLAY IT AGAIN' : 'CLASSIC RULES';
    R.text(note, vw / 2, sy + 16, { font: TINY, color: nr.rule ? RULES[nr.rule].color : P.bone2, align: 'center', alpha: 0.75 + Math.sin(R.t * 5) * 0.25 });
    // Progress and run stats, top right
    const pct = `${Math.round(cleared.length / ROUNDS.length * 100)}%`, stats = `${pct} · SCORE ${game.score.toLocaleString()} · ${fmtTime(game.elapsed)} · BEST ${game.best.toLocaleString()}`;
    const stw = R.measure(stats, { font: TINY }) + 22;
    R.box(vw - 6 - stw, 5, stw, 13, P.ink0, 2, 0.7);
    R.spr(mapCache.crown, vw - stw + 3, 11, { sc: 0.8 });
    R.text(stats, vw - 11, 9, { font: TINY, color: P.bone1, align: 'right' });
    // Tricks in your bag
    const items = Object.entries(mp.items || {}).filter(([, n]) => n > 0).map(([id]) => id), owned = [...game.tricks, ...items];
    owned.forEach((id, i) => R.spr(Sprites.tricks[id], vw - 14 - i * 16, vh - 18, { sc: 0.7 }));
    // Back to the title: a plain link, top left
    const bl = '← TITLE', blw = R.measure(bl), blHot = Input.over(4, 3, blw + 12, 17) && !UI.blocked;
    R.box(6, 5, blw + 10, 13, P.ink0, 2, 0.7);
    R.text(bl, 11, 8, { color: blHot ? P.gold1 : P.bone1 });
    if (blHot) R.rect(11, 16, blw, 1, P.gold1);
    if (Input.button('map-title', 4, 3, blw + 12, 17, !UI.blocked)) { Audio.play('back'); game.transition(() => { game.scene = 'title'; }); }
    // GO sits on the rug's bottom edge
    const go = { x: vw / 2 - 48, y: rug.y + rug.h - 14, w: 96, h: 28 };
    if (UI.button('map-go', go.x, go.y, go.w, go.h, 'GO!', { size: 2, pulse: t > 0.8, color: 'gold' })) game.startMapRound();
    // First run: point at GO so a new player knows how to take their seat
    if (game.onboardMap && t > 0.6) {
      const tip = land ? 'Beat all four tables. Start here!' : 'Start here!', tw = R.measure(tip) + 12, bob = Math.round(Math.sin(R.t * 5) * 2);
      const tx = go.x - 8 - tw + bob, ty = go.y + go.h / 2 - 7;
      R.box(tx - 1, ty - 1, tw + 2, 15, P.ink0, 3);
      R.box(tx, ty, tw, 13, P.gold1, 3);
      R.text(tip, tx + tw / 2, ty + 3, { color: P.ink0, align: 'center', outline: null, shadow: null });
      for (let i = 0; i < 4; i++) R.rect(tx + tw + i, ty + 3 + i, 1, 7 - i * 2, P.gold1);
    }
    if (hover) {
      const st = hover.done ? '^lBeaten. Officially a Bonehead.' : hover.round === sel ? '^gSelected. Tap again or GO to play.' : '^dTap to select.';
      const who = hover.rd.opps.map(id => OPPONENTS[oppIndex(id)].name).join(' & ');
      UI.tooltip(who, `${hover.rd.venue || hover.lead.venue}${hover.rd.rule ? `\n^o${RULES[hover.rd.rule].title}` : ''}\n${st}`, hover.x, hover.y - 10, { color: hover.rd.name ? P.teal1 : hover.lead.color, w: 150 });
    }
  },

  modal(game) {
    const m = game.modal, fn = this[m.kind];
    if (fn) fn.call(this, game, m);
  },

  titleKey(game, k) { titleKey(game, k, id => titleAct(game, id)); },

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
    const items = [['RESUME', 'gold', () => game.closeModal()], ['HOW TO PLAY', 'ink', () => game.openModal('rules', { page: 0 })], ['SCORING', 'ink', () => game.openModal('scoring')], ['OPTIONS', 'ink', () => game.openModal('options')], ['TROPHIES', 'ink', () => game.openModal('trophies')], ['NEW RUN', 'red', () => game.openModal('confirm')], ['TITLE SCREEN', 'ink', () => { game.save(); game.modal = null; Audio.muffle(false); game.transition(() => { game.token++; game.scene = 'title'; Post.theme(THEMES[3]); }); }]];
    items.forEach(([label, color, act], i) => { if (UI.button('p-' + label, b.x + 20, b.y + 46 + i * 22, w - 40, 17, label, { color, ignoreBlock: true })) act(); });
    b.restore();
  },

  options(game, m) {
    const w = 210, h = 268, b = UI.modal('opts', w, h, m.t), s = game.settings;
    UI.title('OPTIONS', b.x + w / 2, b.y + 12, { size: 2 });
    UI.blocked = false;
    const x = b.x + 16, iw = w - 32;
    const mv = UI.slider('o-music', x, b.y + 50, iw, s.music, 'MUSIC');
    const sv = UI.slider('o-sfx', x, b.y + 76, iw, s.sfx, 'SOUND FX');
    if (mv !== s.music) { s.music = mv; game.applySettings(); }
    if (sv !== s.sfx) { s.sfx = sv; game.applySettings(); }
    const toggles = [['hints', 'CARD HINTS'], ['crt', 'CRT & GLOW'], ['shake', 'SCREEN SHAKE'], ['reduced', 'REDUCED MOTION'], ['fast', 'FAST ANIMATIONS']];
    toggles.forEach(([key, label], i) => { const v = UI.toggle('o-' + key, x, b.y + 94 + i * 17, iw, label, s[key]); if (v !== s[key]) { s[key] = v; game.applySettings(); } });
    // Switching renderer needs a fresh canvas, so it reloads the page (the run is saved).
    const safe = UI.toggle('o-safe', x, b.y + 94 + 5 * 17, iw, 'SAFE RENDERING', !!s.safe);
    if (safe !== !!s.safe) { s.safe = safe; game.applySettings(); game.save(); setTimeout(() => location.reload(), 250); }
    R.text('Turn off CRT and Glow for a crisp, clean picture.', b.x + w / 2, b.y + h - 62, { color: P.ink6, align: 'center', outline: null, ...T });
    R.text('Try Safe Rendering if graphics glitch.', b.x + w / 2, b.y + h - 52, { color: P.ink6, align: 'center', outline: null, ...T });
    R.text('All music and sound is synthesised live.', b.x + w / 2, b.y + h - 42, { color: P.ink6, align: 'center', outline: null, ...T });
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
    const w = Math.min(R.vw - 12, 300), h = Math.min(R.vh - 10, 320), b = UI.modal('dev', w, h, m.t, { fill: P.ink1 });
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
    R.text('MASCOT (LOSS SCREEN)', b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    const styles = ['classic', 'brand'], tw = Math.floor((w - 24 - 8) / 2), th = 64;
    styles.forEach((st, i) => {
      const x = b.x + 12 + i * (tw + 8), wink = (R.t + i) % 4 > 3.7;
      const spr = Sprites.mascots[st][wink ? 'wink' : 'idle'];
      if (tile('m-' + st, x, y, tw, th, game.dev.mascot === st, (cx, cy) => R.spr(spr, cx, cy + Math.sin(R.t * 2 + i) * 1.5, { sc: Math.min((tw - 8) / 64, (th - 14) / 60) }), st.toUpperCase())) game.setDev('mascot', st);
    });
    y += th + 10;
    R.text('MAP', b.x + 12, y, { color: P.ink6, font: TINY }); y += 8;
    const mw = Math.floor((w - 24 - 8) / 3);
    if (UI.button('dm-open', b.x + 12, y, mw, 18, 'OPEN MAP', { color: 'teal', ignoreBlock: true })) {
      game.modal = null; Audio.muffle(false);
      game.transition(() => { if (game.started && game.g) game.showMap(game.nextUncleared(), 0, {}); else game.newRun(); });
    }
    y += 26;
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
      // Last word of the name (LUCKY BONES -> BONES) so four buttons fit; drop to the number if still too wide
      const name = (rd.name || OPPONENTS[oppIndex(rd.opps[0])].name).toUpperCase().split(' ').pop();
      const label = R.measure(`${i + 1} ${name}`) <= rw - 6 ? `${i + 1} ${name}` : `${i + 1}`;
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
    if (UI.button('r-back', b.x + 12, b.y + h - 30, 60, 20, d.page ? 'BACK' : d.startsRun ? 'SKIP' : 'CLOSE', { color: 'ink', ignoreBlock: true })) { if (d.page) { d.page--; d.pt = 0; } else finishRules(game); }
    if (UI.button('r-next', b.x + w - 72, b.y + h - 30, 60, 20, d.page < 4 ? 'NEXT' : d.startsRun ? "LET'S GO" : 'GOT IT', { ignoreBlock: true, pulse: d.page === 4 })) { if (d.page < 4) { d.page++; d.pt = 0; } else finishRules(game); }
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
    const g = game.g, win = g.winner === 'player', last = game.allCleared(), advance = win && !last;
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


function resultAction(game) {
  const g = game.g, win = g.winner === 'player';
  if (win && !game.allCleared()) { game.modal = null; game.claimTrick(); }
  else { store.set('bh2-save', null); startFresh(game); }
}

function titleAct(game, id) {
  if (id === 'continue') game.transition(() => game.continueRun());
  if (id === 'play') startFresh(game);
  if (id === 'new') game.openModal('confirm');
  if (id === 'rules') game.openModal('rules', { page: 0 });
  if (id === 'options') game.openModal('options');
  if (id === 'trophies') game.openModal('trophies');
}

function startFresh(game) {
  game.modal = null; Audio.muffle(false);
  if (!store.get('bh2-onboarded', false)) { game.openModal('rules', { page: 0, startsRun: true }); return; }
  game.transition(() => game.newRun());
}

function finishRules(game) {
  const starts = game.modal?.data?.startsRun;
  store.set('bh2-onboarded', true);
  game.modal = null; Audio.muffle(false);
  // Onboarding: rules, then the map (with a pointer to GO), then the first deal
  if (starts) { game.onboardMap = true; game.transition(() => game.newRun()); }
}
