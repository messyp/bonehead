import { deal, rule, legal, valid, source, options, play, pickup, SUITS } from '../../engine.js';
import { scorePlay, comboReward, cardPoints, roundGoals } from '../../scoring.js';
import { claimGoals, trophies, earnedTrophies, exchangeHand } from '../../progression.js';
import { guidance } from '../../guidance.js';
import { R } from '../core/render.js';
import { Input } from '../core/input.js';
import { FX, Dissolve, Sliced, Slash, Flames, FIRE, CONFETTI } from '../core/fx.js';
import { Post } from '../core/post.js';
import { Clock, wait, spring, ease, clamp } from '../core/tween.js';
import { hash } from '../core/pixel.js';
import { P, THEMES } from '../art/palette.js';
import { Cards, CW, CH, MAGIC, rankLabel } from '../art/cards.js';
import { Sprites, OPPONENTS, portrait } from '../art/sprites.js';
import { Audio } from '../audio/sfx.js';
import { Music } from '../audio/music.js';
import { UI } from './ui.js';
import { Screens } from './screens.js';

const DEG = Math.PI / 180;
const total = p => p.hand.length + p.face.length + p.blind.length;
const SUIT_NAMES = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
export const cardName = c => `${rankLabel(c.r)}${SUITS[c.s]}`;

export const store = {
  get(k, f) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage may be unavailable */ } },
};

export const UPGRADES = {
  reshuffle: { name: 'Fresh Bones', kind: 'ONE USE', desc: 'Swap your whole hand for random cards from the deck. Keeps your turn.', color: P.bone1 },
  swap: { name: 'Switcheroo', kind: 'ONE USE', desc: 'Trade one hand card for a random deck card. Keeps your turn.', color: P.teal1 },
  wild: { name: 'Loaded Sleeves', kind: 'REST OF RUN', desc: 'Start every remaining round holding a bonus 2 and 10.', color: P.vio1 },
  chain: { name: 'Chain Reaction', kind: 'REST OF RUN', desc: 'Every extra card in a play adds another ×0.25 mult.', color: P.gold1 },
  insurance: { name: 'Second Chance', kind: 'REST OF RUN', desc: 'Once per round, a failed blind flip is discarded instead of picking up.', color: P.red1 },
  embers: { name: 'Ash Collector', kind: 'REST OF RUN', desc: 'Each card in a pile you burn pays +35 chips.', color: P.fire2 },
};

// A card on the table. Springs chase targets set by the layout every frame.
class View {
  constructor(c, x, y) {
    this.c = c; this.id = c.id;
    this.x = x; this.y = y; this.r = 0; this.s = 1;
    this.vx = 0; this.vy = 0; this.vr = 0; this.vs = 0;
    this.tx = x; this.ty = y; this.tr = 0; this.ts = 1;
    this.flip = 0; this.face = false; this.z = 0; this.zone = 'deck'; this.fly = false;
    this.flash = 0; this.wig = 0; this.dim = 0; this.glow = 0; this.alpha = 1; this.stiff = false;
    this.phase = (hash(c.id) % 628) / 100; this.arrivals = []; this.hoverT = 0; this.interactive = false;
  }
  update(dt) {
    const k = this.stiff ? 900 : 200, d = this.stiff ? 60 : 23;
    // Sub-step so the springs stay stable on slow frames.
    for (let left = dt; left > 1e-6; left -= 1 / 120) {
      const h = Math.min(left, 1 / 120);
      [this.x, this.vx] = spring(this.x, this.vx, this.tx, k, d, h);
      [this.y, this.vy] = spring(this.y, this.vy, this.ty, k, d, h);
      [this.r, this.vr] = spring(this.r, this.vr, this.tr, 240, 22, h);
      [this.s, this.vs] = spring(this.s, this.vs, this.ts, 320, 18, h);
    }
    const ft = this.face ? 1 : 0;
    if (this.flip !== ft) this.flip = ft > this.flip ? Math.min(1, this.flip + dt * 4.2) : Math.max(0, this.flip - dt * 4.2);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.wig = Math.max(0, this.wig - dt * 2.5);
    const far = Math.hypot(this.tx - this.x, this.ty - this.y), speed = Math.hypot(this.vx, this.vy);
    if (far < 2 && speed < 40) {
      if (this.fly) this.fly = false;
      if (this.arrivals.length) { const a = this.arrivals; this.arrivals = []; a.forEach(f => f()); }
    }
  }
}

export const Game = {
  scene: 'title', modal: null, g: null, views: new Map(), L: {},
  selected: [], score: 0, shownScore: 0, best: 0, tricks: [], shields: 0, rewardChoices: [], pending: null, elapsed: 0,
  started: false, busy: false, moving: false, token: 0, hidden: new Set(), revealing: new Set(), slot: new Map(),
  config: { minHand: 3, aiDelay: 1.05, timeBonus: 8, extraMagic: 0, aiSkill: 0 },
  settings: { music: 0.55, sfx: 0.8, crt: true, shake: true, fast: false, reduced: false },
  unlocked: {}, sortSuit: false, hoverId: null, hoverT: 0, drag: null, focus: -1, swapMode: false,
  panel: { chips: 0, mult: 1, label: '', total: 0, showTotal: false, flame: 0, pop: 0, mpop: 0, bonus: [] },
  speech: null, cine: null, portraitState: 'idle', blinkT: 2, tellMsg: '', tellT: 0, tellBad: false,
  turnStart: 0, submittedAt: 0, ruleKey: '', rulePop: 0, turnPulse: 0, lastTurn: '', housePulse: 0, stats: {},

  init() {
    this.settings = { ...this.settings, ...store.get('bh2-settings', {}) };
    this.best = store.get('ll-best', 0);
    this.unlocked = store.get('bh-trophies', {});
    this.applySettings();
    Post.theme(THEMES[3], true);
    this.computeLayout();
  },

  applySettings() {
    const s = this.settings;
    Audio.setSfx(s.sfx); Audio.setMusic(s.music);
    R.shakeOn = s.shake && !s.reduced;
    Post.state.crt = s.crt ? 1 : 0;
    FX.reduced = s.reduced;
    Clock.speed = s.fast ? 1.6 : 1;
    store.set('bh2-settings', s);
  },

  // ---------- layout ----------
  computeLayout() {
    const vw = R.vw, vh = R.vh, L = this.L = { land: R.land };
    if (R.land) {
      const sw = Math.round(clamp(vw * 0.23, 112, 150));
      L.side = { x: 6, y: 6, w: sw, h: vh - 12 };
      const px = L.side.x + sw + 8, pw = vw - px - 6;
      L.play = { x: px, y: 6, w: pw, h: vh - 12 };
      const cx = L.cx = px + pw / 2;
      L.portrait = { x: px + 4, y: 8, w: 54, h: 70 };
      L.houseSc = 0.72;
      const hg = Math.round(CW * 0.72 + 5);
      L.houseTable = { x: px + pw - 8 - hg * 2 - Math.round(CW * 0.72 / 2), y: 46, gap: hg };
      const hx0 = L.portrait.x + L.portrait.w + 8, hx1 = L.houseTable.x - Math.round(CW * 0.36) - 8;
      L.houseHand = { x: (hx0 + hx1) / 2, y: 42, w: hx1 - hx0 };
      L.pile = { x: Math.round(cx), y: Math.round(clamp(vh * 0.44, 118, 200)) };
      L.deck = { x: Math.round(cx - clamp(pw * 0.24, 70, 120)), y: L.pile.y };
      L.ash = { x: Math.round(cx + clamp(pw * 0.24, 70, 120)), y: L.pile.y };
      L.handY = vh - 44;
      L.btn = { x: px + pw - 72, y: vh - 74, w: 68 };
      L.tableSc = 0.78;
      const tg = Math.round(CW * 0.78 + 4);
      L.playerTable = { x: px + 6 + Math.round(CW * 0.39), y: vh - 40, gap: tg };
      const x0 = L.playerTable.x + tg * 2 + Math.round(CW * 0.39) + 12, x1 = L.btn.x - 8;
      L.hand = { x0, x1, cx: (x0 + x1) / 2, w: x1 - x0 };
      L.slots = { cx: L.hand.cx, gap: 50 };
      L.houseSlots = { cx: L.houseHand.x, gap: 36 };
      L.guide = { x: L.hand.cx, y: L.handY - 50 };
      L.handSc = 1;
    } else {
      L.top = { x: 4, y: 4, w: vw - 8, h: 36 };
      const cx = L.cx = vw / 2;
      L.play = { x: 4, y: 44, w: vw - 8, h: vh - 48 };
      L.portrait = { x: 6, y: 46, w: 44, h: 58 };
      L.houseSc = 0.58;
      const hg = Math.round(CW * 0.58 + 3);
      L.houseTable = { x: vw - 6 - hg * 2 - Math.round(CW * 0.29), y: 72, gap: hg };
      const hx0 = L.portrait.x + L.portrait.w + 4, hx1 = L.houseTable.x - Math.round(CW * 0.29) - 4;
      L.houseHand = { x: (hx0 + hx1) / 2, y: 76, w: hx1 - hx0 };
      L.pile = { x: Math.round(cx), y: Math.round(clamp(vh * 0.34, 148, 230)) };
      L.deck = { x: Math.round(cx - 70), y: L.pile.y };
      L.ash = { x: Math.round(cx + 70), y: L.pile.y };
      L.hud = { x: 8, y: L.pile.y + 60, w: vw - 16, h: 30 };
      L.handY = vh - 94;
      L.btn = { x: vw / 2 - 50, y: vh - 34, w: 100 };
      L.tableSc = 0.7;
      const tg = Math.round(CW * 0.7 + 3);
      L.playerTable = { x: 8 + Math.round(CW * 0.35), y: L.handY - 64, gap: tg };
      L.hand = { x0: 8, x1: vw - 8, cx, w: vw - 16 };
      L.handSc = vh > 500 ? 1.22 : 1.1;
      L.slots = { cx, gap: Math.round(52 * L.handSc) };
      L.houseSlots = { cx: L.houseHand.x, gap: 26 };
      L.guide = { x: cx, y: Math.min(L.hud.y + L.hud.h + 4, L.playerTable.y - 32) };
    }
  },

  // ---------- helpers ----------
  opp() { return OPPONENTS[clamp((this.g?.round || 1) - 1, 0, 2)]; },
  playerPhase() { const g = this.g; return g.deck.length ? 'hand' : source(g.player); },
  housePhase() { const g = this.g; return g.deck.length ? 'hand' : source(g.house); },
  myTurn() { return this.started && this.g && this.g.turn === 'player' && !this.busy && !this.moving && !this.g.ended && !this.modal && !this.cine; },
  selCards() { const g = this.g, src = source(g.player); return this.selected.map(id => g.player[src].find(c => c.id === id)).filter(Boolean); },
  mustPickUp() { const g = this.g; return this.myTurn() && g.pile.length > 0 && source(g.player) !== 'blind' && !options(g, 'player').length; },
  canPlay(c) {
    const g = this.g, src = source(g.player);
    if (src === 'blind') return true;
    return valid([...this.selCards(), c], g.pile);
  },
  tell(msg, bad = false) { this.tellMsg = msg; this.tellT = 2.6; this.tellBad = bad; this.announce(msg); },
  announce(msg) { const el = document.getElementById('live'); if (el && el.textContent !== msg) el.textContent = msg; },

  // Pixel-dither iris wipe between scenes. cb runs while the screen is covered.
  transition(cb) {
    if (this.trans) return;
    this.trans = { t: 0, cb, fired: false };
    Audio.play('whoosh');
  },
  drawTransition() {
    const tr = this.trans;
    if (!tr) return;
    const t = tr.t, p = t < 0.3 ? ease.inCubic(t / 0.3) : t < 0.38 ? 1 : 1 - ease.outCubic(clamp((t - 0.38) / 0.32));
    const cell = 12, nx = Math.ceil(R.vw / cell) + 1, ny = Math.ceil(R.vh / cell) + 1, ctx = R.ctx;
    R.screen();
    ctx.fillStyle = P.ink0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = clamp(p * 2.2 - (i + j) / (nx + ny) * 1.2 - (t >= 0.38 ? 0 : 0), 0, 1), s = Math.ceil(cell * k);
      if (s > 0) ctx.fillRect(i * cell + (cell - s) / 2, j * cell + (cell - s) / 2, s, s);
    }
    R.base();
  },
  arrive(id, timeout = 0.8) {
    const v = this.views.get(id);
    if (!v) return Promise.resolve();
    return Promise.race([new Promise(r => v.arrivals.push(r)), wait(timeout)]);
  },
  save() {
    if (!this.started || this.moving || !this.g) return;
    store.set('bh2-save', { g: this.g, score: this.score, tricks: this.tricks, shields: this.shields, rewardChoices: this.rewardChoices, pending: this.pending, elapsed: this.elapsed, slot: [...this.slot] });
  },
  hasSave() { const s = store.get('bh2-save', null); return !!(s?.g && (!s.g.ended || ['upgrade', 'result'].includes(s.pending))); },

  say(kind, chance = 1) {
    if (Math.random() > chance) return;
    const lines = this.opp().lines[kind];
    if (!lines) return;
    const text = lines[Math.floor(Math.random() * lines.length)];
    this.speech = { text, t: 0, dur: 1.4 + text.length * 0.045, blip: 0 };
  },

  // ---------- run flow ----------
  newRun() {
    this.token++;
    Clock.clear();
    FX.clear();
    this.views.clear(); this.hidden.clear(); this.revealing.clear(); this.slot.clear();
    this.g = deal(1, this.config.extraMagic, this.config.minHand);
    this.score = 0; this.shownScore = 0; this.elapsed = 0; this.tricks = []; this.rewardChoices = []; this.shields = 0; this.pending = null;
    this.selected = []; this.started = true; this.busy = false; this.moving = false; this.swapMode = false; this.drag = null;
    this.stats = { maxBurn: 0 };
    this.resetPanel();
    this.modal = null; this.scene = 'table';
    this.startRound();
  },

  resetPanel() { Object.assign(this.panel, { chips: 0, mult: 1, label: '', total: 0, showTotal: false, flame: 0, bonus: [] }); },

  startRound() {
    const g = this.g;
    Post.theme(THEMES[g.round - 1]);
    Post.target.spin = 0.7 + g.round * 0.15;
    Music.set(1, [0, 3, -2][g.round - 1]);
    this.openingDeal();
  },

  async openingDeal() {
    const token = this.token, g = this.g;
    this.moving = true; this.busy = true;
    for (const who of ['player', 'house']) {
      g[who].face.forEach((c, i) => this.slot.set(c.id, i));
      g[who].blind.forEach((c, i) => this.slot.set(c.id, i));
    }
    const order = [];
    for (let i = 0; i < 3; i++) order.push(g.house.blind[i], g.player.blind[i], g.house.face[i], g.player.face[i]);
    for (let i = 0; i < Math.max(g.house.hand.length, g.player.hand.length); i++) order.push(g.house.hand[i], g.player.hand[i]);
    const ids = order.filter(Boolean).map(c => c.id);
    ids.forEach(id => this.hidden.add(id));
    await this.introOpponent();
    if (token !== this.token) return;
    Audio.play('shuffle');
    await wait(0.25);
    for (let i = 0; i < ids.length; i++) {
      if (token !== this.token) return;
      this.hidden.delete(ids[i]);
      Audio.play('deal', i);
      await wait(i < 12 ? 0.075 : 0.09);
    }
    await wait(0.5);
    if (token !== this.token) return;
    this.hidden.clear();
    this.tell('Select cards, then PLAY. Or drag one onto the pile.');
    this.endMove();
  },

  introOpponent() {
    const opp = this.opp();
    this.cine = { t: 0, opp, done: false, dock: 0, resolve: null };
    this.say('intro');
    Audio.play('whoosh');
    return new Promise(res => { this.cine.resolve = res; });
  },

  lock() { this.moving = true; this.busy = true; this.hoverId = null; },

  endMove() {
    this.moving = false; this.busy = false; this.selected = []; this.swapMode = false;
    this.save();
    const g = this.g;
    if (g.ended) { this.finish(); return; }
    if (g.turn === 'house') this.queueAI();
    else { this.turnStart = Clock.t; if (this.lastTurn !== 'player') { this.turnPulse = 1; Audio.play('turn'); } }
    this.lastTurn = g.turn;
    this.updateMusic();
  },

  updateMusic() {
    const g = this.g;
    if (!g) return;
    const tense = total(g.house) <= 3 || total(g.player) <= 3 || (!g.deck.length && (source(g.player) === 'blind' || source(g.house) === 'blind'));
    Music.set(tense ? 2 : 1);
    Post.target.speed = tense ? 1.6 : 1;
    if (tense && total(g.house) <= 3 && !this.saidLow) { this.saidLow = true; this.say('low', 0.8); }
  },

  playerPlay() {
    if (!this.myTurn() || this.drag?.active) return;
    if (this.mustPickUp()) { this.selected = []; this.animatePickup('player'); return; }
    if (!this.selected.length) { this.tell('Pick a card first.', true); Audio.play('bad'); return; }
    this.submittedAt = Clock.t;
    this.animatePlay('player', [...this.selected]);
  },

  async animatePlay(who, ids) {
    if (this.moving || this.g.ended) return;
    const token = this.token, g = this.g, you = who === 'player';
    const next = structuredClone(g), src = source(next[who]);
    const pileBefore = [...g.pile];
    const result = play(next, who, ids, this.config.minHand, you && this.shields > 0);
    if (result.error) { this.tell(result.error, true); Audio.play('bad'); ids.forEach(id => { const v = this.views.get(id); if (v) v.wig = 1; }); return; }
    this.lock();
    const cards = result.cards;
    try {
      let pileNow = [...pileBefore];
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        if (src === 'blind') this.revealing.add(c.id);
        g[who][src] = g[who][src].filter(x => x.id !== c.id);
        g.pile.push(c);
        this.selected = this.selected.filter(id => id !== c.id);
        const v = this.views.get(c.id);
        if (v) { v.fly = true; if (!you) Audio.play('swoosh'); }
        await this.arrive(c.id, 0.7);
        if (token !== this.token) return;
        this.landImpact(c, i, cards.length);
        if (src === 'blind') {
          Audio.play('riser');
          const bv = this.views.get(c.id); if (bv) bv.wig = 1.2;
          await wait(0.45);
          this.revealing.delete(c.id);
          Audio.play('flip');
          await wait(0.3);
          const ok = legal(c, pileNow);
          FX.pop(ok ? 'SAFE!' : 'BAD FLIP!', this.L.pile.x, this.L.pile.y - 40, { color: P.white, box: ok ? P.grn2 : P.red2, size: 1 });
          if (!ok) { Audio.play('bad'); R.shake(0.25); } else Audio.play('coin');
          await wait(0.35);
        }
        pileNow.push(c);
        if (cards.length > 1) await wait(0.07);
      }
      const scoring = you && !result.pickup && !result.protected;
      if (!result.burn && !result.pickup && !result.protected) this.magicCue(cards.at(-1));
      const award = scoring ? await this.tallyCards(cards, result) : null;
      if (token !== this.token) return;
      if (result.pickup) {
        await this.collectPile(who, 'BAD FLIP');
      } else if (result.protected) {
        const c = cards[0], v = this.views.get(c.id);
        FX.banner('SECOND CHANCE', { color: P.red1, sub: 'Bad flip discarded. Go again.', size: 3, x: this.bannerX() });
        Audio.play('ghost');
        if (v) { FX.add(new Dissolve(this.faceSpr(c), v.x, v.y, v.r, v.s, { life: 0.8, edge: [P.white, P.vio0, P.vio1, P.vio2], dir: 'radial' })); this.views.delete(c.id); }
        g.pile.pop(); this.shields--;
        await wait(0.9);
      } else if (result.burn) {
        await this.burnPile(who, cards);
        g.burns = next.burns; g.cardsBurned = next.cardsBurned;
      }
      if (award) await this.tallyFinish(award);
      if (token !== this.token) return;
      if (!result.pickup && !result.protected) {
        const drawn = next[who].hand.filter(c => !g[who].hand.some(x => x.id === c.id));
        for (let i = 0; i < drawn.length; i++) {
          const c = drawn[i];
          g.deck = g.deck.filter(x => x.id !== c.id);
          g[who].hand.push(c);
          Audio.play('deal', i);
          await wait(0.09);
        }
        if (drawn.length) await wait(0.2);
      }
      if (token !== this.token) return;
      this.g = next;
      this.afterMove(who, result);
      if (you) { this.checkTrophies(result); const earned = this.payGoals(); if (earned.length) await wait(0.9); }
    } catch (err) {
      console.error('Turn animation failed', err);
      this.g = next;
    }
    if (token !== this.token) return;
    this.endMove();
  },

  afterMove(who, result) {
    const you = who === 'player';
    if (!you && result.burn) this.housePulse = 1;
    if (you && result.burn) this.houseShake = 0.8;
    if (result.burn) this.say(you ? 'playerBurn' : 'houseBurn', 0.8);
    else if (result.pickup) this.say(you ? 'playerPickup' : 'housePickup', 0.9);
    else if (you && [2, 8, 9].includes(result.cards.at(-1)?.r)) this.say('magic', 0.3);
  },

  bannerX() { return this.L.land ? this.L.cx / R.vw : 0.5; },

  faceSpr(c) { return Cards.face(c, Math.floor(R.t * 8)); },

  landImpact(c, i, n) {
    const L = this.L, v = this.views.get(c.id), x = v ? v.x : L.pile.x, y = v ? v.y : L.pile.y;
    Audio.play('land', 0.7 + Math.min(0.5, i * 0.12));
    FX.burst(x, y + CH / 2 - 2, 8 + i * 3, { colors: [P.bone0, P.bone2, P.ink5], speed: [30, 90], angle: -Math.PI / 2, spread: 1.3, grav: 220, life: [0.25, 0.5], w: CW / 2 });
    R.shake(0.08 + i * 0.03);
    if (v) { v.s = 1.12; v.vs = 0; }
  },

  magicCue(c) {
    if (!c) return;
    const L = this.L, x = L.pile.x, y = L.pile.y;
    if (c.r === 2) { FX.ring(x, y, { color: P.teal1, r1: 80, life: 0.6, w: 3 }); FX.ring(x, y, { color: P.teal0, r1: 50, life: 0.45 }); FX.burst(x, y, 30, { colors: [P.teal0, P.teal1, P.teal2], speed: [40, 140], grav: 0, drag: 3, size: [1, 2] }); FX.pop('RESET', x, y - 42, { color: P.white, box: P.teal2, size: 2 }); Audio.play('reset'); Post.flash([0.4, 1, 0.85], 0.12); }
    if (c.r === 8) { FX.burst(x, y, 24, { colors: [P.white, P.vio0, P.vio1], speed: [10, 50], grav: -60, drag: 1, life: [0.6, 1.2], w: 16, h: 20, size: [1, 2] }); FX.pop('GHOST', x, y - 42, { color: P.white, box: P.vio2, size: 2 }); Audio.play('ghost'); }
    if (c.r === 9) { FX.burst(x, y - 20, 16, { glyphs: ['↓'], gcol: P.vio1, colors: [P.vio1], speed: [40, 90], angle: Math.PI / 2, spread: 0.6, grav: 120, life: [0.5, 0.9] }); FX.pop('UNDERCUT', x, y - 42, { color: P.white, box: P.vio3, size: 2 }); Audio.play('undercut'); R.shake(0.15); this.rulePop = 1; }
  },

  async burnPile(who, cards) {
    const L = this.L, g = this.g, x = L.pile.x, y = L.pile.y, inferno = cards.at(-1).r === 10, size = g.pile.length;
    const actor = who === 'player' ? 'YOU' : this.opp().name.toUpperCase();
    this.stats.maxBurn = Math.max(this.stats.maxBurn || 0, size);
    const pileViews = g.pile.map(c => this.views.get(c.id)).filter(Boolean);
    if (inferno) {
      Audio.play('riser');
      pileViews.forEach(v => { v.wig = 1.5; });
      await wait(0.4);
      Audio.play('burn');
      FX.banner('INFERNO!', { color: P.fire1, sub: `${actor} BURN${who === 'player' ? '' : 'S'} ${size} CARDS · GO AGAIN`, subColor: P.fire0, size: R.land ? 5 : 4, y: 0.3, x: this.bannerX() });
      Post.flash([1, 0.55, 0.15], 0.35); Post.impact(0.6); R.shake(0.55); R.punch = 1;
      FX.add(new Flames(x, y + 20, CW + 26, { emit: 1.1, rate: 110 }));
      pileViews.reverse().forEach((v, i) => { FX.add(new Dissolve(this.faceSpr(v.c), v.x, v.y, v.r, v.s, { delay: i * 0.03, life: 0.95 })); this.views.delete(v.id); });
      g.pile = [];
      FX.burst(x, y, 60, { colors: FIRE, speed: [60, 220], grav: -40, drag: 1.2, life: [0.5, 1.1], size: [1, 3] });
      await wait(1.25);
    } else {
      // Four of a kind: freeze-frame, then a blade cuts the pile in two.
      pileViews.forEach(v => { v.wig = 1; });
      await wait(0.25);
      this.hitstop = 0.14;
      const ang = -0.42;
      FX.add(new Slash(x, y, ang, 190));
      Audio.play('slash');
      Post.flash([1, 1, 1], 0.55); Post.impact(1); R.shake(0.7); R.punch = 1;
      pileViews.forEach((v, i) => { FX.add(new Sliced(this.faceSpr(v.c), v.x, v.y, v.r, v.s, ang, { delay: i * 0.01, push: 60 + Math.random() * 40, life: 1.2 })); this.views.delete(v.id); });
      g.pile = [];
      const word = 'FOUR OF A KIND';
      FX.burst(x, y, 14, { glyphs: [...'BURNED'], colors: [P.white], gcol: P.red1, speed: [80, 220], grav: 260, drag: 0.8, life: [0.8, 1.4], size: 2, top: true });
      FX.burst(x, y, 40, { colors: [P.white, P.teal0, P.vio1, P.red1], speed: [80, 260], grav: 150, drag: 1, size: [1, 2], life: [0.4, 0.9] });
      FX.banner('QUADS!', { color: P.white, sub: `${word} · ${actor} GO${who === 'player' ? '' : 'ES'} AGAIN`, subColor: P.bone0, size: R.land ? 5 : 4, y: 0.3, x: this.bannerX() });
      await wait(1.3);
    }
  },

  async collectPile(who, reason) {
    const g = this.g, count = g.pile.length;
    if (!count) return;
    const you = who === 'player';
    if (you) { Audio.play('pickup'); R.shake(0.2); FX.banner('PICK UP', { color: P.red1, sub: `${count} CARD${count > 1 ? 'S' : ''} · ${reason}`, size: 4, y: 0.3, life: 1.3, x: this.bannerX() }); }
    else { Audio.play('thud'); this.houseShake = 1; FX.pop(`+${count} CARDS`, this.L.portrait.x + this.L.portrait.w / 2, this.L.portrait.y + this.L.portrait.h + 6, { color: P.white, box: P.grn2 }); }
    await wait(0.55);
    while (g.pile.length) {
      const c = g.pile.pop();
      g[who].hand.push(c);
      Audio.play('deal', g.pile.length);
      await wait(Math.max(0.03, 0.1 - count * 0.004));
    }
    await wait(0.35);
  },

  async animatePickup(who) {
    if (this.moving || !this.g.pile.length) return;
    const token = this.token, next = structuredClone(this.g);
    if (!pickup(next, who)) return;
    this.lock();
    try { await this.collectPile(who, 'NO PLAYABLE CARD'); }
    finally {
      if (token === this.token) {
        this.g = next;
        this.afterMove(who, { pickup: true, cards: [] });
        this.endMove();
      }
    }
  },

  queueAI() {
    const token = this.token;
    if (this.g.ended || this.g.turn !== 'house') return;
    this.busy = true;
    this.thinking = true;
    this.say('think', 0.25);
    (async () => {
      await wait(this.config.aiDelay * (0.8 + Math.random() * 0.5));
      while (this.modal && token === this.token) await wait(0.2);
      if (token !== this.token) return;
      this.thinking = false;
      const g = this.g;
      if (g.ended || g.turn !== 'house' || this.moving) { this.busy = false; return; }
      this.busy = false;
      const opts = options(g, 'house');
      if (!opts.length) { this.animatePickup('house'); return; }
      const skill = this.config.aiSkill || g.round;
      opts.sort((a, b) => b.length - a.length || a[0].r - b[0].r);
      let choice = skill === 1 ? opts[Math.floor(Math.random() * Math.min(opts.length, 3))] : opts[0];
      if (source(g.house) === 'blind') choice = [g.house.blind[Math.floor(Math.random() * g.house.blind.length)]];
      this.animatePlay('house', choice.map(c => c.id));
    })();
  },

  // ---------- scoring ----------
  async tallyCards(cards, result) {
    const speedBonus = Math.max(0, 5 - Math.floor((this.submittedAt - this.turnStart))) * this.config.timeBonus;
    const award = scorePlay(cards, { burnedCards: result.burnedCards || [], chain: this.tricks.includes('chain'), embers: this.tricks.includes('embers'), speedBonus });
    const p = this.panel, L = this.L;
    Object.assign(p, { chips: 0, mult: 1, label: award.comboReason, total: 0, showTotal: false, bonus: [], scoring: true });
    await wait(0.12);
    const step = cards.length > 4 ? 0.11 : 0.17;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], pts = cardPoints(c), v = this.views.get(c.id);
      const x = v ? v.x : L.pile.x, y = (v ? v.y : L.pile.y) - CH * 0.62;
      if (v) { v.flash = 1; v.wig = 0.8; v.s = 1.15; }
      p.chips += pts; p.pop = 1;
      FX.pop(`+${pts}`, x + (i - (cards.length - 1) / 2) * 7, y - i * 5, { color: P.white, box: P.blue2 });
      Audio.play('chip', i * 2);
      await wait(step);
    }
    if (award.mult > 1) {
      p.mult = award.mult; p.mpop = 1;
      FX.pop(`×${Number(award.mult.toFixed(2))}`, L.pile.x + CW * 0.75, L.pile.y - 12, { color: P.white, box: P.red2, size: 2 });
      Audio.play('mult', Math.round((award.mult - 1) * 4));
      R.shake(0.1 + Math.min(0.2, (award.mult - 1) * 0.05));
      await wait(0.3);
    }
    return award;
  },

  async tallyFinish(award) {
    const p = this.panel, L = this.L;
    if (award.burnBonus) { p.bonus.push(['BURN', award.burnBonus, P.fire2]); FX.pop(`BURN +${award.burnBonus}`, L.pile.x, L.pile.y - 6, { color: P.white, box: P.fire3 }); Audio.play('coin'); await wait(0.28); }
    if (award.speedBonus) { p.bonus.push(['QUICK', award.speedBonus, P.teal1]); FX.pop(`QUICK +${award.speedBonus}`, L.pile.x, L.pile.y + 10, { color: P.white, box: P.teal3 }); Audio.play('coin'); await wait(0.22); }
    p.total = award.points; p.showTotal = true; p.pop = 1;
    const big = award.points >= 800 ? 2 : award.points >= 400 ? 1 : 0;
    p.flame = big ? 1.4 + big : 0;
    Audio.play('total', big);
    if (big === 2) { Post.flash([1, 0.8, 0.3], 0.18); R.shake(0.2); }
    this.score += award.points;
    this.g.lastHand = { ...award, label: award.comboReason };
    await wait(0.4);
    p.scoring = false;
  },

  payGoals() {
    const earned = claimGoals(this.g);
    for (const goal of earned) {
      this.score += goal.points;
      this.toast(goal.name, `BONUS GOAL · +${goal.points}`, P.grn1);
    }
    if (earned.length) Audio.play('coin');
    return earned;
  },

  toasts: [],
  toast(title, detail, color = P.gold1) { this.toasts.push({ title, detail, color, t: 0 }); Audio.play('trophy'); },

  checkTrophies(result) {
    for (const id of earnedTrophies(this.g, result)) {
      if (this.unlocked[id]) continue;
      this.unlocked[id] = new Date().toISOString();
      store.set('bh-trophies', this.unlocked);
      this.toast(trophies[id].name, `${trophies[id].rarity} TROPHY UNLOCKED`);
    }
  },

  finish() {
    const g = this.g, win = g.winner === 'player';
    this.busy = true;
    this.payGoals(); this.checkTrophies();
    this.best = Math.max(this.best, this.score); store.set('ll-best', this.best);
    this.pending = 'result'; this.save();
    this.say(win ? 'playerWin' : 'houseWin');
    if (win) {
      Audio.play('win');
      FX.banner('ROUND WON!', { color: P.gold1, sub: 'Not a card to your name.', size: R.land ? 5 : 4, x: this.bannerX() });
      for (let i = 0; i < 4; i++) FX.burst(R.vw * (0.2 + i * 0.2), R.vh * 0.3, 40, { colors: CONFETTI, speed: [60, 200], grav: 120, drag: 1.2, life: [1, 2], size: [1, 3], top: true });
      Post.flash([1, 0.9, 0.5], 0.2);
    } else {
      Audio.play('lose');
      FX.banner('BUSTED', { color: P.red1, sub: `${this.opp().name} ran out first.`, size: R.land ? 5 : 4, x: this.bannerX() });
      R.shake(0.3);
    }
    Music.set(0);
    const token = this.token;
    wait(1.8).then(() => { if (token === this.token) this.openModal('result'); });
  },

  claimTrick() {
    const eligible = Object.keys(UPGRADES).filter(id => !this.tricks.includes(id));
    if (this.pending !== 'upgrade' || this.rewardChoices.length !== 3 || this.rewardChoices.some(id => !eligible.includes(id))) {
      for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]]; }
      this.rewardChoices = eligible.slice(0, 3);
    }
    this.pending = 'upgrade'; this.save();
    this.openModal('reward');
  },

  chooseUpgrade(id) {
    if (!UPGRADES[id] || this.tricks.includes(id) || this.pending !== 'upgrade' || !this.rewardChoices.includes(id)) return;
    const items = { ...(this.g.items || {}) };
    if (['reshuffle', 'swap'].includes(id)) items[id] = (items[id] || 0) + 1; else this.tricks.push(id);
    const round = this.g.round + 1;
    this.token++;
    FX.clear(); this.views.clear(); this.hidden.clear(); this.revealing.clear(); this.slot.clear();
    this.g = deal(round, this.config.extraMagic, this.config.minHand);
    this.g.items = items;
    if (this.tricks.includes('wild')) this.g.player.hand.push({ r: 2, s: 1, id: `gift-${round}-2` }, { r: 10, s: 0, id: `gift-${round}-10` });
    this.shields = this.tricks.includes('insurance') ? 1 : 0;
    this.pending = null; this.rewardChoices = []; this.selected = []; this.busy = false; this.saidLow = false;
    this.resetPanel();
    this.modal = null;
    this.startRound();
  },

  continueRun() {
    const s = store.get('bh2-save', null);
    if (!s?.g) return this.newRun();
    this.token++;
    FX.clear(); this.views.clear(); this.hidden.clear(); this.revealing.clear();
    Object.assign(this, { g: s.g, score: s.score, shownScore: s.score, tricks: s.tricks || [], shields: s.shields || 0, rewardChoices: s.rewardChoices || [], pending: s.pending, elapsed: s.elapsed || 0 });
    this.slot = new Map(s.slot || []);
    this.started = true; this.selected = []; this.busy = false; this.moving = false; this.scene = 'table'; this.modal = null;
    this.resetPanel();
    Post.theme(THEMES[this.g.round - 1]);
    Music.set(1, [0, 3, -2][this.g.round - 1]);
    // Spawn the table where it was, without a deal animation.
    this.place(0, true);
    if (this.pending === 'upgrade') this.claimTrick();
    else if (this.g.ended) this.openModal('result');
    else this.endMove();
  },

  async useTrick(id, cardId) {
    if (!this.myTurn()) return;
    const next = structuredClone(this.g), result = exchangeHand(next, id, cardId);
    if (!result) { this.tell('Not enough cards in the deck for that trick.', true); Audio.play('bad'); return; }
    const token = this.token;
    this.lock();
    FX.banner(UPGRADES[id].name.toUpperCase(), { color: UPGRADES[id].color, sub: 'Your turn continues.', size: 3, y: 0.36, life: 1.2, x: this.bannerX() });
    Audio.play('shuffle');
    try {
      const g = this.g;
      for (const c of result.old) { g.player.hand = g.player.hand.filter(x => x.id !== c.id); g.deck.push(c); Audio.play('deal', 1); await wait(0.08); }
      await wait(0.35);
      for (const c of result.fresh) { g.deck = g.deck.filter(x => x.id !== c.id); g.player.hand.push(c); Audio.play('deal', 2); await wait(0.1); }
      await wait(0.3);
    } finally {
      if (token === this.token) { this.g = next; this.endMove(); }
    }
  },

  // ---------- per-frame layout ----------
  place(dt, snap = false) {
    const g = this.g, L = this.L;
    if (!g) return;
    const seen = new Set(), deckTop = this.deckTop();
    const put = (c, x, y, r, s, face, z, zone, interactive = false) => {
      let v = this.views.get(c.id);
      if (!v) { v = new View(c, deckTop.x, deckTop.y); v.r = -0.05; v.fly = true; this.views.set(c.id, v); if (snap) { v.x = x; v.y = y; v.r = r; v.s = s; v.flip = face ? 1 : 0; v.fly = false; } }
      if (v.zone !== zone) { v.zone = zone; v.fly = true; }
      v.c = c; v.tx = x; v.ty = y; v.tr = r; v.ts = s; v.face = face; v.z = z; v.interactive = interactive;
      seen.add(c.id);
      return v;
    };
    const vis = arr => arr.filter(c => !this.hidden.has(c.id));

    // Pile
    const n = g.pile.length;
    g.pile.forEach((c, i) => {
      const h = hash(c.id), top = i === n - 1, jit = top ? 0.35 : 1;
      const lift = -Math.min(i, 14) * 0.35;
      put(c, L.pile.x + ((h % 9) - 4) * jit, L.pile.y + (((h >> 4) % 7) - 3) * jit + lift, (((h >> 8) % 25) - 12) * DEG * jit, 1, !this.revealing.has(c.id), 100 + i, 'pile');
    });

    // Player
    const myTurn = this.myTurn(), pPhase = this.playerPhase(), hy = L.handY;
    const dragIds = this.drag?.active ? this.drag.ids : [];
    if (pPhase === 'hand') {
      const cards = vis([...g.player.hand]).sort(this.sortSuit ? (a, b) => a.s - b.s || a.r - b.r : (a, b) => a.r - b.r || a.s - b.s);
      this.handOrder = cards.map(c => c.id);
      const hs = L.handSc, cw = CW * hs, m = cards.length, sp = m > 1 ? Math.min(cw + 4, (L.hand.w - cw) / (m - 1)) : 0, k = sp / 40;
      cards.forEach((c, i) => {
        const t = i - (m - 1) / 2, sel = this.selected.includes(c.id), hov = this.hoverId === c.id && !this.drag?.active;
        let x = L.hand.cx + t * sp, y = hy + (t * k) * (t * k) * 0.9 - (sel ? 14 * hs : 0) - (hov ? 6 : 0);
        let r = t * k * 2.2 * DEG;
        if (this.focus === i && myTurn) y -= 3;
        const v = put(c, x, y, sel || hov ? r * 0.4 : r, (hov ? 1.1 : 1) * hs, true, 300 + i + (hov ? 60 : 0), 'hand', true);
        v.dim = myTurn && !sel && !this.swapMode && !this.canPlay(c) ? 1 : 0;
      });
      // Reserve cards on the table.
      for (const c of vis(g.player.blind)) { const i = this.slot.get(c.id) ?? 0; put(c, L.playerTable.x + i * L.playerTable.gap, L.playerTable.y, 0, L.tableSc, false, 200 + i * 2, 'ptable'); }
      for (const c of vis(g.player.face)) { const i = this.slot.get(c.id) ?? 0; put(c, L.playerTable.x + i * L.playerTable.gap + 2, L.playerTable.y - 6, -2 * DEG, L.tableSc, true, 201 + i * 2, 'ptable'); }
    } else {
      this.handOrder = [];
      const slotX = i => L.slots.cx + (i - 1) * L.slots.gap;
      for (const c of g.player.blind) {
        const i = this.slot.get(c.id) ?? 0, active = pPhase === 'blind', sel = this.selected.includes(c.id), hov = this.hoverId === c.id;
        const v = put(c, slotX(i), hy + 6 - (sel ? 14 : 0) - (hov && active ? 6 : 0), 0, (hov && active ? 1.08 : 1) * L.handSc, false, 300 + i * 2, 'pslot', active);
        v.dim = 0;
        if (active) this.handOrder.push(c.id);
      }
      for (const c of g.player.face) {
        const i = this.slot.get(c.id) ?? 0, sel = this.selected.includes(c.id), hov = this.hoverId === c.id;
        const v = put(c, slotX(i), hy - 6 - (sel ? 14 : 0) - (hov ? 6 : 0), (i - 1) * 2 * DEG, (hov ? 1.08 : 1) * L.handSc, true, 301 + i * 2 + (hov ? 60 : 0), 'pslot', true);
        v.dim = myTurn && !sel && !this.canPlay(c) ? 1 : 0;
        this.handOrder.push(c.id);
      }
    }
    // Dragged cards follow the pointer.
    if (dragIds.length) {
      const vel = Input.vel();
      dragIds.forEach((id, i) => {
        const v = this.views.get(id); if (!v) return;
        v.tx = Input.x - this.drag.ox + i * 5; v.ty = Input.y - this.drag.oy + i * 3;
        v.tr = clamp(vel.x * 0.0009, -0.35, 0.35) + i * 0.04; v.ts = 1.08 * (L.handSc || 1); v.z = 900 + i; v.stiff = true; v.dim = 0;
      });
    }
    for (const v of this.views.values()) if (!dragIds.includes(v.id)) v.stiff = false;

    // House
    const hPhase = this.housePhase(), hsc = L.houseSc;
    if (hPhase === 'hand') {
      const cards = vis(g.house.hand), m = cards.length, sp = m > 1 ? Math.min(CW * hsc * 0.72, (L.houseHand.w - CW * hsc) / (m - 1)) : 0, k = sp / 30;
      cards.forEach((c, i) => {
        const t = i - (m - 1) / 2;
        put(c, L.houseHand.x + t * sp, L.houseHand.y - (t * k) * (t * k) * 0.6 + (this.thinking && i % 2 ? Math.sin(R.t * 8 + i) : 0), -t * k * 1.8 * DEG, hsc, false, 20 + i, 'hhand');
      });
      for (const c of vis(g.house.blind)) { const i = this.slot.get(c.id) ?? 0; put(c, L.houseTable.x + i * L.houseTable.gap, L.houseTable.y, 0, hsc, false, 10 + i * 2, 'htable'); }
      for (const c of vis(g.house.face)) { const i = this.slot.get(c.id) ?? 0; put(c, L.houseTable.x + i * L.houseTable.gap - 2, L.houseTable.y + 5, 2 * DEG, hsc, true, 11 + i * 2, 'htable'); }
    } else {
      const slotX = i => L.houseSlots.cx + (i - 1) * L.houseSlots.gap;
      for (const c of g.house.blind) { const i = this.slot.get(c.id) ?? 0; put(c, slotX(i), L.houseHand.y - 4, 0, hsc, false, 20 + i * 2, 'hslot'); }
      for (const c of g.house.face) { const i = this.slot.get(c.id) ?? 0; put(c, slotX(i), L.houseHand.y + 4, (1 - i) * 2 * DEG, hsc, true, 21 + i * 2, 'hslot'); }
    }

    // Anything unplaced returns to the deck and disappears there.
    for (const v of this.views.values()) {
      if (seen.has(v.id)) continue;
      if (v.zone !== 'return') { v.zone = 'return'; v.fly = true; v.arrivals.push(() => { if (v.zone === 'return') this.views.delete(v.id); }); }
      v.tx = deckTop.x; v.ty = deckTop.y; v.tr = 0; v.ts = 1; v.face = false; v.z = 5;
    }
    if (dt) for (const v of this.views.values()) {
      v.update(dt);
      if (v.fly && v.flip > 0.5 && MAGIC[v.c.r] && Math.hypot(v.vx, v.vy) > 120 && Math.random() < 0.7)
        FX.burst(v.x, v.y, 1, { colors: [P.white, MAGIC[v.c.r].light, MAGIC[v.c.r].color], speed: [5, 20], grav: 0, drag: 2, life: [0.3, 0.6], w: CW * 0.4, h: CH * 0.4, size: [1, 2] });
    }
  },

  visiblePile() { return this.revealing.size ? this.g.pile.filter(c => !this.revealing.has(c.id)) : this.g.pile; },

  deckCount() { return this.g ? this.g.deck.length + this.hidden.size : 0; },
  deckTop() { const n = this.deckCount(), layers = Math.min(14, Math.ceil(n / 3)); return { x: this.L.deck.x - layers * 0.3, y: this.L.deck.y - layers * 0.7 }; },

  // ---------- input ----------
  hitCard(x, y) {
    let best = null;
    for (const v of this.views.values()) {
      if (!v.interactive) continue;
      const dx = x - v.x, dy = y - v.y, c = Math.cos(-v.r), s = Math.sin(-v.r);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= CW * v.s / 2 && Math.abs(ly) <= CH * v.s / 2 && (!best || v.z > best.z)) best = v;
    }
    return best;
  },

  overPile(x, y) { const L = this.L; return Math.abs(x - L.pile.x) < CW * 0.5 + 22 && Math.abs(y - L.pile.y) < CH * 0.5 + 22; },

  toggleSelect(id) {
    const g = this.g, src = source(g.player), c = g.player[src].find(x => x.id === id);
    if (!c) return;
    if (this.swapMode) { this.swapMode = false; this.useTrick('swap', id); return; }
    if (this.selected.includes(id)) { this.selected = this.selected.slice(0, this.selected.indexOf(id)); Audio.play('deselect'); return; }
    const next = src === 'blind' ? [id] : [...this.selected, id];
    if (src !== 'blind' && !valid(next.map(x => g.player[src].find(k => k.id === x)), g.pile)) {
      this.tell(this.selected.length ? 'Link equal ranks, or the next card of the same suit.' : 'Too low to beat the pile. Try a higher card, or a magic card.', true);
      Audio.play('bad');
      const v = this.views.get(id); if (v) v.wig = 1;
      return;
    }
    this.selected = next;
    Audio.play('select', next.length * 2);
    const v = this.views.get(id); if (v) { v.flash = 0.5; v.s = 1.14; }
  },

  handleInput(dt) {
    // Hover
    const canAct = this.myTurn() && !UI.blocked;
    const hit = canAct && !this.drag?.active ? this.hitCard(Input.x, Input.y) : null;
    const newHover = hit ? hit.id : null;
    if (newHover !== this.hoverId) { this.hoverId = newHover; this.hoverT = 0; if (newHover) Audio.play('hover', this.handOrder.indexOf(newHover) + 2); }
    else this.hoverT += dt;
    if (hit) Input.cursor = hit.dim ? 'not-allowed' : 'grab';

    // Press / drag / release. Hit-test where the pointer went down: a fast flick
    // can deliver down, move and up before the next frame.
    const pressHit = canAct && Input.pressed && !this.drag?.active ? this.hitCard(Input.downX, Input.downY) : null;
    if (pressHit) {
      Input.pressed = false;
      this.drag = { id: pressHit.id, ids: [], ox: Input.downX - pressHit.x, oy: Input.downY - pressHit.y, x0: Input.downX, y0: Input.downY, active: false };
      Input.active = 'card';
    }
    const d = this.drag;
    if (d && !d.active && Math.hypot(Input.x - d.x0, Input.y - d.y0) > 6 && this.myTurn()) {
      d.active = true;
      d.ids = this.selected.includes(d.id) ? [...this.selected] : [d.id];
      Audio.play('select', 3);
    }
    if (d?.active) Input.cursor = 'grabbing';
    if (d && Input.released) {
      Input.released = false; Input.active = null;
      this.drag = null;
      if (!d.active) { if (this.myTurn()) this.toggleSelect(d.id); }
      else if (this.myTurn()) {
        const vel = Input.vel(), flick = vel.y < -380 && Math.abs(vel.x) < Math.abs(vel.y) * 1.2 && Input.y < d.y0 - 12;
        if (this.overPile(Input.x, Input.y) || flick) {
          const src = source(this.g.player), cards = d.ids.map(id => this.g.player[src].find(c => c.id === id));
          const ok = cards.every(Boolean) && (src === 'blind' ? cards.length === 1 : valid(cards, this.g.pile));
          if (ok) { this.selected = d.ids; if (flick) Audio.play('swoosh'); this.submittedAt = Clock.t; this.animatePlay('player', d.ids); }
          else { this.tell('That card can\'t beat the pile.', true); Audio.play('bad'); d.ids.forEach(id => { const v = this.views.get(id); if (v) v.wig = 1; }); }
        } else Audio.play('deselect');
      }
    }
    if (d && !this.myTurn() && !this.moving) this.drag = null;
  },

  handleKeys() {
    for (const k of Input.keys) {
      if (k.ctrl && k.shift) { this.devKey(k.code); continue; }
      if (this.cine && (k.key === 'Enter' || k.key === ' ' || k.key === 'Escape')) { this.cine.skip = true; continue; }
      if (this.modal) { Screens.key?.(this, k); continue; }
      if (this.scene !== 'table') continue;
      if (k.key === 'Escape') { if (this.selected.length) { this.selected = []; Audio.play('deselect'); } else this.openModal('pause'); continue; }
      if (!this.myTurn()) continue;
      const order = this.handOrder || [];
      if (k.key === 'ArrowRight' || k.key === 'ArrowLeft') { this.focus = clamp((this.focus < 0 ? 0 : this.focus + (k.key === 'ArrowRight' ? 1 : -1)), 0, order.length - 1); Audio.play('hover', this.focus); }
      if ((k.key === ' ' || k.key === 'ArrowUp') && order[this.focus]) this.toggleSelect(order[this.focus]);
      if (k.key === 'Enter') this.playerPlay();
      if (k.key === 's' || k.key === 'S') { this.sortSuit = !this.sortSuit; Audio.play('shuffle'); }
    }
  },

  devKey(code) {
    if (!this.started || this.moving || !this.g) return;
    const g = this.g, c = (r, s, id) => ({ r, s, id });
    if (code === 'KeyB') { g.ended = false; g.turn = 'player'; g.pile = [c(7, 0, 't7a'), c(7, 1, 't7b'), c(7, 2, 't7c')]; g.player.hand = [c(7, 3, 't7d'), c(10, 1, 't10'), c(8, 0, 't8')]; }
    if (code === 'KeyQ') { g.ended = false; g.turn = 'player'; g.pile = [c(5, 0, 'q5'), c(9, 0, 'q9'), c(6, 1, 'q6')]; g.player.hand = [c(13, 0, 'qk0'), c(13, 1, 'qk1'), c(13, 2, 'qk2'), c(13, 3, 'qk3'), c(4, 1, 'q4')]; }
    if (code === 'KeyL') { g.ended = false; g.turn = 'player'; g.deck = []; g.pile = [c(12, 0, 'lq')]; g.player.hand = []; g.player.face = []; if (!g.player.blind.length) g.player.blind = [c(4, 1, 'tb')]; }
    if (code === 'KeyW') { g.ended = true; g.winner = 'player'; this.finish(); return; }
    if (code === 'KeyR') { g.player.hand.push(c(3, 1, 'r3'), c(4, 1, 'r4'), c(5, 1, 'r5'), c(6, 1, 'r6')); }
    this.selected = []; this.tell('Test table ready.');
  },

  openModal(kind, data = {}) {
    if (this.drag) this.drag = null;
    this.modal = { kind, t: 0, data, prev: this.modal };
    Audio.muffle(true);
    Audio.play('whoosh');
  },
  closeModal() {
    const prev = this.modal?.prev;
    this.modal = prev && prev.kind !== this.modal.kind ? { ...prev, t: 0.3 } : null;
    if (!this.modal) Audio.muffle(false);
    Audio.play('back');
  },

  // ---------- update ----------
  update(dt) {
    UI.blocked = !!this.modal || !!this.cine;
    if (this.scene === 'table' && this.g) {
      if (!this.modal && !this.g.ended && this.started && !this.cine) this.elapsed += dt;
      if (!this.modal) { this.handleInput(dt); }
      this.place(dt);
      // Rolling score counter
      if (this.shownScore < this.score) {
        const step = Math.max(1, Math.ceil((this.score - this.shownScore) * Math.min(1, dt * 5)));
        this.shownScore = Math.min(this.score, this.shownScore + step);
        this.tickAcc = (this.tickAcc || 0) + dt;
        if (this.tickAcc > 0.045) { this.tickAcc = 0; Audio.play('tick', Math.floor(this.shownScore / 37)); }
      } else if (this.shownScore > this.score) this.shownScore = this.score;
      const p = this.panel;
      p.pop = Math.max(0, p.pop - dt * 4); p.mpop = Math.max(0, p.mpop - dt * 4); p.flame = Math.max(0, p.flame - dt * 0.8);
      if (!p.scoring && !this.moving) {
        const cards = this.selCards();
        if (cards.length && source(this.g.player) === 'blind') { p.chips = '?'; p.mult = 1; p.label = 'BLIND FLIP'; p.showTotal = false; }
        else if (cards.length) { const cr = comboReward(cards, this.tricks.includes('chain')); p.chips = cards.reduce((a, c) => a + cardPoints(c), 0); p.mult = cr.mult; p.label = cr.reason; p.showTotal = false; }
        else if (!p.showTotal) { p.chips = 0; p.mult = 1; p.label = ''; }
      }
      // Rule badge pop when the rule changes
      const r = rule(this.visiblePile()), key = `${r.r}-${r.low}`;
      if (key !== this.ruleKey) { this.ruleKey = key; this.rulePop = 1; }
      this.rulePop = Math.max(0, this.rulePop - dt * 3);
      this.turnPulse = Math.max(0, this.turnPulse - dt * 1.2);
      this.tellT = Math.max(0, this.tellT - dt);
      if (this.hitstop === undefined) this.hitstop = 0;
    }
    // Opponent speech + portrait animation
    if (this.speech) {
      const s = this.speech; s.t += dt;
      const shown = Math.floor(s.t * 38);
      if (shown > s.blip && shown <= s.text.length) { s.blip = shown; if (s.text[shown - 1] && s.text[shown - 1] !== ' ' && shown % 2) Audio.play('blip', this.opp().voice * 2); }
      if (s.t > s.dur + s.text.length / 38) this.speech = null;
    }
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    const talking = this.speech && this.speech.t * 38 < this.speech.text.length;
    this.portraitState = talking ? (Math.floor(R.t * 12) % 2 ? 'talk' : 'idle') : this.blinkT < 0 ? 'blink' : 'idle';
    // Cinematic intro timing
    if (this.cine) {
      const c = this.cine; c.t += dt;
      if ((c.t > 2.6 || (c.skip && c.t > 0.3)) && !c.docking) { c.docking = true; c.dockT = 0; Audio.play('swoosh'); }
      if (c.docking) { c.dockT += dt; if (c.dockT > 0.45) { const r = c.resolve; this.cine = null; Audio.play('thud'); this.housePulse = 1; r?.(); } }
      if (Input.released && !this.modal) { Input.released = false; c.skip = true; }
    }
    this.housePulse = Math.max(0, this.housePulse - dt * 2);
    this.houseShake = Math.max(0, (this.houseShake || 0) - dt * 2.5);
    if (this.trans) { const tr = this.trans; tr.t += R.dt || dt; if (!tr.fired && tr.t >= 0.32) { tr.fired = true; tr.cb(); } if (tr.t > 0.72) this.trans = null; }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 3.2);
    if (this.modal) this.modal.t += dt;
    this.handleKeys();
  },

  // ---------- drawing ----------
  draw() {
    UI.frame(R.dt || 0.016);
    if (this.scene === 'title') { Screens.title(this); }
    else this.drawTable();
    FX.drawTop();
    if (this.cine) this.drawCine();
    this.drawToasts();
    if (this.modal) Screens.modal(this);
    UI.drawTip();
    this.drawTransition();
  },

  drawTable() {
    const L = this.L, g = this.g;
    if (!g) return;
    this.drawZones();
    this.drawOpponent();
    // Cards by z order
    const list = [...this.views.values()].sort((a, b) => (a.fly ? a.z + 500 : a.z) - (b.fly ? b.z + 500 : b.z));
    const under = list.filter(v => v.z < 100 && !v.fly), rest = list.filter(v => !(v.z < 100 && !v.fly));
    under.forEach(v => this.drawCard(v));
    this.drawDeck();
    FX.draw();
    rest.forEach(v => this.drawCard(v));
    this.drawSpeech();
    if (L.land) this.drawSidebar(); else this.drawTopBar();
    this.drawControls();
    this.drawGuide();
    // Tooltip for hovered card
    const hv = this.hoverId && this.views.get(this.hoverId);
    if (hv && this.hoverT > 0.45 && !this.drag?.active && hv.face) {
      const c = hv.c, m = MAGIC[c.r];
      UI.tooltip(`${rankLabel(c.r)} of ${SUIT_NAMES[c.s]}`, (m ? `^${c.r === 10 ? 'o' : c.r === 2 ? 't' : 'v'}${m.name}^0 · ${m.desc} ` : '') + `^b${cardPoints(c)} chips`, hv.x, hv.y - CH * 0.55, { color: m ? P.gold1 : P.bone0, w: m ? 140 : 100 });
    }
  },

  drawZones() {
    const L = this.L, g = this.g;
    // Soft felt behind the play area
    if (L.land) R.panel(L.play.x, L.play.y, L.play.w, L.play.h, { fill: P.ink1, rim: P.ink0, hi: null, alpha: 0.28, shadow: false });
    // Pile slot
    const px = L.pile.x, py = L.pile.y, pw = CW + 8, ph = CH + 8;
    const dragging = this.drag?.active, ok = dragging && (() => { const src = source(g.player), cards = this.drag.ids.map(id => g.player[src].find(c => c.id === id)); return cards.every(Boolean) && (src === 'blind' || valid(cards, g.pile)); })();
    const hot = dragging && this.overPile(Input.x, Input.y);
    const rimCol = dragging ? (ok ? (hot ? P.gold1 : P.grn1) : P.red1) : P.ink4;
    const pulse = dragging ? 0.5 + Math.sin(R.t * 10) * 0.5 : 0;
    R.box(px - pw / 2 - 1, py - ph / 2 - 1, pw + 2, ph + 2, rimCol, 3, dragging ? 0.6 + pulse * 0.4 : 0.5);
    R.box(px - pw / 2, py - ph / 2, pw, ph, P.ink0, 3, 0.55);
    if (!g.pile.length) {
      R.text('✦', px, py - 8, { color: P.ink5, align: 'center', outline: null, shadow: null, size: 2 });
      R.text('EMPTY', px, py + 10, { color: P.ink5, align: 'center', outline: null, shadow: null });
    }
    // Rule badge (face-down blind flips don't count until revealed)
    const r = rule(this.visiblePile()), low = r.low, any = !r.r;
    const txt = any ? 'ANY CARD' : low ? `${rankLabel(r.r)} OR LOWER` : `${rankLabel(r.r)} OR HIGHER`;
    const col = any ? P.teal2 : low ? P.vio2 : P.gold3, sc = 1 + this.rulePop * 0.25;
    const bw = R.measure(txt) + 14, by = py + ph / 2 + 5;
    R.ctx.save(); R.ctx.translate(px, by + 6); R.ctx.scale(sc, sc);
    R.panel(-bw / 2, -6, bw, 13, { fill: col, rim: P.ink0, hi: any ? P.teal1 : low ? P.vio1 : P.gold2 });
    R.text(txt, 0, -3, { color: P.white, align: 'center' });
    R.ctx.restore();
    if (g.pile.length) R.text(`${g.pile.length} IN PILE`, px, by + 16, { color: P.ink6, align: 'center', outline: null });
    // Deck & ash labels
    R.text(String(this.deckCount()), L.deck.x, L.deck.y + CH / 2 + 5, { color: P.bone1, align: 'center' });
    R.text('DECK', L.deck.x, L.deck.y + CH / 2 + 15, { color: P.ink6, align: 'center', outline: null });
    if (!this.deckCount()) R.box(L.deck.x - CW / 2, L.deck.y - CH / 2, CW, CH, P.ink0, 3, 0.4);
    // Ash heap
    const ax = L.ash.x, ay = L.ash.y, burned = g.cardsBurned || 0;
    R.box(ax - pw / 2, ay - ph / 2, pw, ph, P.ink0, 3, 0.35);
    const fl = Sprites.flame[Math.floor(R.t * 8) % 3];
    R.spr(fl, ax, ay - 6, { sc: 2 + Math.min(1.5, burned / 20) });
    for (let i = 0; i < Math.min(18, burned); i++) { const h = hash('ash' + i); R.rect(ax - 12 + (h % 24), ay + 12 + ((h >> 5) % 6), 2, 1, i % 2 ? P.ink5 : P.bone4); }
    R.text(String(burned), ax, ay + CH / 2 + 5, { color: P.fire1, align: 'center' });
    R.text('BURNED', ax, ay + CH / 2 + 15, { color: P.ink6, align: 'center', outline: null });
  },

  drawDeck() {
    const L = this.L, n = this.deckCount(), layers = Math.min(14, Math.ceil(n / 3));
    for (let i = 0; i < layers; i++) {
      const x = L.deck.x - i * 0.3, y = L.deck.y - i * 0.7;
      if (i === 0) R.spr(Cards.shadow, x + 2, y + 3, { alpha: 0.4 });
      R.spr(Cards.back, x, y);
    }
  },

  drawCard(v) {
    const t = R.t, inHand = v.zone === 'hand' || v.zone === 'pslot';
    let x = v.x, y = v.y, r = v.r + (v.fly ? clamp(v.vx * 0.0012, -0.4, 0.4) : 0);
    if (inHand && !v.fly && !this.drag?.ids?.includes(v.id)) { y += Math.sin(t * 1.6 + v.phase) * 0.7; r += Math.sin(t * 1.1 + v.phase) * 0.012; }
    if (v.wig) { r += Math.sin(t * 40) * 0.08 * v.wig; x += Math.sin(t * 33) * 1.2 * v.wig; }
    const flipS = Math.abs(Math.cos(v.flip * Math.PI)), lift = Math.sin(v.flip * Math.PI) * 0.12;
    const s = v.s * (1 + lift), sx = s * Math.max(0.04, flipS), showFace = v.flip > 0.5;
    const hover = this.hoverId === v.id, dragging = this.drag?.active && this.drag.ids.includes(v.id);
    let skx = 0;
    if (hover && !dragging) skx = clamp((Input.x - x) / CW, -0.5, 0.5) * -0.12;
    const elev = v.fly || dragging ? 6 : hover ? 4 : this.selected.includes(v.id) ? 3 : 1;
    // Shadow
    R.spr(Cards.shadow, x + 1 + elev * 0.5, y + 2 + elev * 0.8, { rot: r, sx, sy: s, alpha: 0.32 });
    // Selection glow
    if (this.selected.includes(v.id)) R.spr(Cards.glow, x, y, { rot: r, sx: sx * 1.0, sy: s, alpha: 0.7 + Math.sin(t * 8) * 0.3 });
    else if (this.swapMode && inHand) R.spr(Cards.glowTeal, x, y, { rot: r, sx, sy: s, alpha: 0.5 + Math.sin(t * 8) * 0.3 });
    const spr = showFace ? this.faceSpr(v.c) : Cards.back;
    const ghost = showFace && v.c.r === 8 && v.zone === 'pile';
    R.spr(spr, x, y, { rot: r, sx, sy: s, skx, alpha: ghost ? 0.62 + Math.sin(t * 3) * 0.1 : 1 });
    // Foil sweep on magic cards
    if (showFace && MAGIC[v.c.r] && flipS > 0.5) {
      const cyc = (t * 0.55 + v.phase * 0.3) % 2.2, f = Math.floor(cyc / 1.1 * Cards.shine.length);
      if (f < Cards.shine.length) R.spr(Cards.shine[f], x, y, { rot: r, sx, sy: s, skx });
    }
    if (v.dim) R.spr(Cards.dim, x, y, { rot: r, sx, sy: s, skx, alpha: 0.5 });
    if (v.flash > 0) R.spr(Cards.flash, x, y, { rot: r, sx, sy: s, skx, alpha: v.flash * 0.8 });
    // Run order badge
    const order = this.selected.indexOf(v.id);
    if (order >= 0 && this.selected.length > 1) {
      const bx = x + CW * 0.42 * v.s, by = y - CH * 0.5 * v.s;
      R.box(bx - 5, by - 5, 11, 11, P.ink0, 2); R.box(bx - 4, by - 4, 9, 9, P.gold2, 2);
      R.text(String(order + 1), bx + 0.5, by - 3, { color: P.white, align: 'center', outline: null });
    }
  },

  drawOpponent() {
    const L = this.L, opp = this.opp(), pr = L.portrait, g = this.g, idx = clamp(g.round - 1, 0, 2);
    const active = g.turn === 'house' && !g.ended && this.started;
    if (this.cine && !this.cine.docking) return;
    if (this.cine?.docking) return;
    const bob = active ? Math.sin(R.t * 5) * 1 : Math.sin(R.t * 1.5) * 0.5, pulse = this.housePulse, shake = (this.houseShake || 0) * Math.sin(R.t * 45) * 2.5;
    const sc = pr.w >= 50 ? 1 : 0.8, pw = Math.round(44 * sc);
    R.panel(pr.x, pr.y, pr.w, pr.h, { fill: active ? P.ink3 : P.ink2, rim: active ? opp.color : P.ink0, hi: P.ink4 });
    const spr = portrait(idx, this.portraitState, Math.floor(R.t * 6));
    R.spr(spr, pr.x + pr.w / 2 + shake, pr.y + 3 + pw / 2 + bob, { sc: sc * (1 + pulse * 0.1), rot: shake * 0.02 });
    const name = opp.name.replace('The ', '').toUpperCase();
    const nameSize = R.measure(name) > pr.w - 4 ? TINY_OPTS : {};
    R.text(name, pr.x + pr.w / 2, pr.y + pw + 6, { ...nameSize, color: opp.color, align: 'center' });
    // Card count chip
    const n = total(g.house);
    R.box(pr.x + pr.w - 12, pr.y - 4, 16, 11, P.ink0, 2); R.box(pr.x + pr.w - 11, pr.y - 3, 14, 9, n <= 3 ? P.red2 : P.ink4, 2);
    R.text(String(n), pr.x + pr.w - 4, pr.y - 2, { color: P.white, align: 'center', outline: null });
    if (active && this.thinking) { const dots = '.'.repeat(1 + Math.floor(R.t * 3) % 3); R.text(dots, pr.x + pr.w / 2, pr.y + pr.h + 2, { color: P.bone1, align: 'center' }); }
  },

  drawSpeech() {
    const s = this.speech, L = this.L;
    if (!s || this.cine) return;
    const shown = s.text.slice(0, Math.floor(s.t * 38));
    const maxW = L.land ? 150 : 140, lines = R.wrap(s.text, maxW - 12), w = Math.min(maxW, Math.max(...lines.map(l => R.measure(l))) + 12), h = lines.length * 10 + 8;
    const x = L.portrait.x + L.portrait.w + 6, y = L.portrait.y + (L.land ? 4 : 2);
    const pop = ease.outBack(clamp(s.t / 0.2), 2), fade = clamp((s.dur + s.text.length / 38 - s.t) / 0.3);
    R.ctx.save(); R.ctx.globalAlpha = fade; R.ctx.translate(x, y + h / 2); R.ctx.scale(pop, pop); R.ctx.translate(-x, -(y + h / 2));
    R.panel(x, y, w, h, { fill: P.bone0, rim: P.ink0, hi: P.white, depth: 2 });
    R.rect(x - 3, y + 6, 3, 3, P.bone0); R.rect(x - 4, y + 6, 1, 3, P.ink0); R.rect(x - 3, y + 5, 3, 1, P.ink0); R.rect(x - 3, y + 9, 3, 1, P.ink0);
    let left = shown.length;
    lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; R.text(part, x + 6, y + 5 + i * 10, { color: P.ink2, outline: null, shadow: null }); });
    R.ctx.restore();
  },

  drawSidebar() {
    const S = this.L.side, g = this.g, x = S.x, w = S.w;
    let y = S.y;
    // Logo + menu
    R.panel(x, y, w, 22, { fill: P.ink2, hi: P.ink4 });
    this.drawLogo(x + 6, y + 5, 1);
    if (UI.iconButton('menu', x + w - 20, y + 3, 17, 15, (bx, by) => { for (let i = 0; i < 3; i++) R.rect(bx + 4, by + 4 + i * 3, 9, 2, P.bone0); })) this.openModal('pause');
    y += 26;
    // Round block
    const opp = this.opp();
    R.panel(x, y, w, 40, { fill: P.ink2, hi: P.ink4 });
    R.text('ROUND', x + 6, y + 5, { color: P.ink6 });
    R.text(`${g.round}`, x + 6, y + 15, { size: 2, color: opp.color });
    R.text('/3', x + 6 + R.measure(`${g.round}`, { size: 2 }) + 2, y + 22, { color: P.ink6 });
    for (let i = 0; i < 3; i++) { const cx = x + w - 40 + i * 13; R.box(cx, y + 6, 9, 9, P.ink0, 2); R.box(cx + 1, y + 7, 7, 7, i < g.round - 1 ? P.grn2 : i === g.round - 1 ? opp.color : P.ink3, 1); }
    R.text(opp.venue, x + w - 6, y + 20, { font: undefined, color: P.bone1, align: 'right', ...(R.measure(opp.venue) > w - 40 ? TINY_OPTS : {}) });
    R.text(fmtTime(this.elapsed), x + w - 6, y + 29, { color: P.ink6, align: 'right', outline: null });
    y += 44;
    // Score
    R.panel(x, y, w, 34, { fill: P.ink2, hi: P.ink4 });
    R.text('SCORE', x + 6, y + 5, { color: P.ink6 });
    R.text(`BEST ${this.best.toLocaleString()}`, x + w - 6, y + 5, { font: undefined, color: P.ink6, align: 'right', outline: null, ...TINY_OPTS });
    const scoreStr = this.shownScore.toLocaleString(), rolling = this.shownScore < this.score;
    R.text(scoreStr, x + w / 2, y + 15, { size: 2, color: rolling ? P.gold0 : P.gold1, align: 'center', wave: rolling ? 1 : 0, waveSpeed: 14 });
    y += 38;
    y = this.drawHandPanel(x, y, w);
    // Goals
    const goals = roundGoals(g);
    R.panel(x, y, w, 16 + goals.length * 12, { fill: P.ink2, hi: P.ink4 });
    R.text('BONUS GOALS', x + 6, y + 4, { color: P.ink6 });
    goals.forEach((gl, i) => {
      const gy = y + 15 + i * 12;
      R.spr(gl.complete ? Sprites.check : Sprites.uncheck, x + 10, gy + 3);
      R.text(gl.name, x + 18, gy, { color: gl.complete ? P.grn1 : P.bone1, ...(R.measure(gl.name) > w - 50 ? TINY_OPTS : {}) });
      R.text(`+${gl.points}`, x + w - 6, gy, { color: gl.complete ? P.grn1 : P.gold2, align: 'right', outline: null });
    });
    y += 20 + goals.length * 12;
    this.drawTricks(x, y, w, S.y + S.h - y);
  },

  drawHandPanel(x, y, w) {
    const p = this.panel, h = 50;
    R.panel(x, y, w, h, { fill: P.ink2, hi: P.ink4 });
    const label = p.label || (this.myTurn() ? 'SELECT CARDS' : ' ');
    R.text(label, x + w / 2, y + 5, { color: p.label ? P.bone0 : P.ink6, align: 'center', ...(R.measure(label) > w - 8 ? TINY_OPTS : {}) });
    const bw = Math.floor((w - 24) / 2), by = y + 16;
    // Flames when the play is big
    if (p.flame > 0) {
      for (let i = 0; i < 3; i++) FX.burst(x + 8 + Math.random() * (w - 16), by + 2, 1, { colors: FIRE, speed: [10, 40], angle: -Math.PI / 2, spread: 0.4, grav: -50, life: [0.3, 0.6], size: [2, 3] });
    }
    const cs = 1 + p.pop * 0.15, ms = 1 + p.mpop * 0.2;
    R.ctx.save(); R.ctx.translate(x + 6 + bw / 2, by + 9); R.ctx.scale(cs, cs);
    R.panel(-bw / 2, -9, bw, 18, { fill: P.blue2, rim: P.ink0, hi: P.blue1, lo: P.blue3 });
    R.text(String(p.chips), 0, -4, { color: P.white, align: 'center', ...(R.measure(String(p.chips)) > bw - 4 ? TINY_OPTS : {}) });
    R.ctx.restore();
    R.text('×', x + w / 2, by + 5, { color: P.red1, align: 'center' });
    R.ctx.save(); R.ctx.translate(x + w - 6 - bw / 2, by + 9); R.ctx.scale(ms, ms);
    R.panel(-bw / 2, -9, bw, 18, { fill: P.red2, rim: P.ink0, hi: P.red1, lo: P.red3 });
    R.text(String(Number(p.mult.toFixed(2))), 0, -4, { color: P.white, align: 'center' });
    R.ctx.restore();
    if (p.showTotal) {
      R.text(`= +${p.total.toLocaleString()}`, x + w / 2, by + 22, { color: P.gold1, align: 'center', wave: p.pop > 0 ? 1 : 0 });
    } else if (p.bonus.length) {
      R.text(p.bonus.map(b => `${b[0]} +${b[1]}`).join(' '), x + w / 2, by + 22, { color: P.fire1, align: 'center', ...TINY_OPTS });
    } else if (this.g.lastHand && !this.selected.length) {
      R.text(`LAST +${this.g.lastHand.points.toLocaleString()}`, x + w / 2, by + 22, { color: P.ink6, align: 'center', outline: null });
    }
    return y + h + 4;
  },

  drawTricks(x, y, w, h) {
    if (h < 24) return;
    const g = this.g, items = g.items || {}, consum = Object.entries(items).filter(([id, n]) => n > 0 && UPGRADES[id]);
    const n = consum.length + this.tricks.length;
    R.panel(x, y, w, Math.max(26, Math.min(h, 16 + Math.max(1, n) * 17)), { fill: P.ink2, hi: P.ink4 });
    R.text('TRICKS', x + 6, y + 4, { color: P.ink6 });
    if (!n) { R.text('Win a round to earn one.', x + w / 2, y + 15, { color: P.ink5, align: 'center', outline: null, ...TINY_OPTS }); return; }
    let iy = y + 14;
    for (const [id, cnt] of consum) {
      if (iy + 16 > y + h) break;
      const u = UPGRADES[id], ok = this.myTurn() && g.player.hand.length && g.deck.length >= (id === 'reshuffle' ? g.player.hand.length : 1);
      if (UI.button('trick-' + id, x + 4, iy, w - 8, 15, `${u.name.toUpperCase()} ×${cnt}`, { color: ok ? 'teal' : 'ink', enabled: !!ok, icon: Sprites.tricks[id], iconScale: 0.6 })) {
        if (id === 'swap') { this.swapMode = !this.swapMode; this.tell(this.swapMode ? 'Pick a hand card to trade away.' : 'Switcheroo cancelled.'); }
        else this.useTrick(id);
      }
      if (Input.hot === 'trick-' + id) UI.tooltip(u.name, u.desc, x + w / 2 + 60, iy, { color: u.color, w: 130 });
      iy += 17;
    }
    for (const id of this.tricks) {
      if (iy + 14 > y + h) break;
      const u = UPGRADES[id];
      R.spr(Sprites.tricks[id], x + 12, iy + 6, { sc: 0.6 });
      const label = u.name.toUpperCase() + (id === 'insurance' ? ` ${this.shields}` : '');
      R.text(label, x + 22, iy + 3, { color: u.color, ...(R.measure(label) > w - 28 ? TINY_OPTS : {}) });
      if (Input.over(x, iy, w, 15)) UI.tooltip(u.name, u.desc, x + w / 2 + 60, iy, { color: u.color, w: 130 });
      iy += 15;
    }
  },

  drawTopBar() {
    const T = this.L.top, g = this.g, opp = this.opp();
    R.panel(T.x, T.y, T.w, T.h, { fill: P.ink2, hi: P.ink4 });
    R.text(`ROUND ${g.round}/3`, T.x + 6, T.y + 5, { color: opp.color });
    R.text(opp.venue, T.x + 6, T.y + 16, { color: P.ink6, outline: null, ...TINY_OPTS });
    R.text(fmtTime(this.elapsed), T.x + 6, T.y + 25, { color: P.ink6, outline: null, ...TINY_OPTS });
    const rolling = this.shownScore < this.score;
    R.text('SCORE', T.x + T.w / 2, T.y + 4, { color: P.ink6, align: 'center', ...TINY_OPTS });
    R.text(this.shownScore.toLocaleString(), T.x + T.w / 2, T.y + 13, { size: 2, color: rolling ? P.gold0 : P.gold1, align: 'center' });
    if (UI.iconButton('menu', T.x + T.w - 22, T.y + 4, 18, 16, (bx, by) => { for (let i = 0; i < 3; i++) R.rect(bx + 4, by + 4 + i * 3, 10, 2, P.bone0); })) this.openModal('pause');
    const goals = roundGoals(g);
    goals.forEach((gl, i) => R.spr(gl.complete ? Sprites.check : Sprites.uncheck, T.x + T.w - 50 + i * 11, T.y + 26));
    // Chips x mult strip under the pile
    const H = this.L.hud, p = this.panel, bw = 60;
    const label = p.label || '';
    if (label || p.showTotal || this.selected.length) {
      R.box(H.x + H.w / 2 - bw - 6, H.y + 2, bw, 16, P.ink0, 2); R.box(H.x + H.w / 2 - bw - 5, H.y + 3, bw - 2, 14, P.blue2, 2);
      R.text(String(p.chips), H.x + H.w / 2 - bw / 2 - 6, H.y + 6, { color: P.white, align: 'center' });
      R.text('×', H.x + H.w / 2, H.y + 6, { color: P.red1, align: 'center' });
      R.box(H.x + H.w / 2 + 6, H.y + 2, bw, 16, P.ink0, 2); R.box(H.x + H.w / 2 + 7, H.y + 3, bw - 2, 14, P.red2, 2);
      R.text(String(Number(p.mult.toFixed(2))), H.x + H.w / 2 + 6 + bw / 2, H.y + 6, { color: P.white, align: 'center' });
      R.text(p.showTotal ? `= +${p.total}` : label, H.x + H.w / 2, H.y + 21, { color: p.showTotal ? P.gold1 : P.bone1, align: 'center', ...TINY_OPTS });
    }
    // Consumable tricks as small buttons beside the player's table
    const items = g.items || {};
    let bx = this.L.playerTable.x + this.L.playerTable.gap * 2 + 26;
    for (const [id, n] of Object.entries(items)) {
      if (!(n > 0) || !UPGRADES[id]) continue;
      const ok = this.myTurn() && g.deck.length >= (id === 'reshuffle' ? g.player.hand.length : 1);
      if (UI.button('trick-' + id, bx, this.L.playerTable.y - 10, 24, 20, `×${n}`, { color: ok ? 'teal' : 'ink', enabled: !!ok, size: 1 })) {
        if (id === 'swap') { this.swapMode = !this.swapMode; this.tell(this.swapMode ? 'Pick a hand card to trade away.' : 'Switcheroo cancelled.'); } else this.useTrick(id);
      }
      R.spr(Sprites.tricks[id], bx + 12, this.L.playerTable.y - 16, { sc: 0.7 });
      bx += 28;
    }
  },

  drawControls() {
    const L = this.L, g = this.g, must = this.mustPickUp(), src = source(g.player), myTurn = this.myTurn();
    const label = must ? 'PICK UP' : src === 'blind' && !g.deck.length ? 'FLIP IT' : 'PLAY';
    const enabled = myTurn && (must || this.selected.length > 0);
    const bw = L.btn.w, bh = L.land ? 26 : 24;
    if (UI.button('play', L.btn.x, L.btn.y, bw, bh, label, { color: must ? 'red' : 'gold', enabled, pulse: enabled && (must || this.selected.length > 0), size: L.land ? 2 : 2, sound: 'ui' })) this.playerPlay();
    if (L.land) {
      if (UI.button('sort', L.btn.x, L.btn.y + bh + 6, bw, 16, this.sortSuit ? 'SORT: SUIT' : 'SORT: RANK', { color: 'ink', enabled: this.started && src === 'hand' })) { this.sortSuit = !this.sortSuit; Audio.play('shuffle'); }
    } else if (UI.button('sort', 8, L.btn.y + 4, 40, 18, 'SORT', { color: 'ink', enabled: this.started && src === 'hand' })) { this.sortSuit = !this.sortSuit; Audio.play('shuffle'); }
    // Turn lamp
    const yourTurn = g.turn === 'player' && !g.ended;
    const lampX = L.land ? L.btn.x + bw / 2 : L.cx, lampY = L.land ? L.btn.y - 12 : L.btn.y - 12;
    const tp = this.turnPulse, txt = g.ended ? 'ROUND OVER' : this.moving ? (g.turn === 'player' ? 'RESOLVING…' : 'HOUSE PLAYS…') : yourTurn ? 'YOUR MOVE' : 'HOUSE TURN';
    if (L.land || true) {
      R.ctx.save(); R.ctx.translate(lampX, lampY + 3); R.ctx.scale(1 + tp * 0.4, 1 + tp * 0.4);
      R.text(txt, 0, -3, { color: yourTurn ? P.teal1 : P.ink6, align: 'center', wave: tp > 0 ? 1.5 : 0, waveSpeed: 12 });
      R.ctx.restore();
    }
  },

  drawGuide() {
    const L = this.L, g = this.g;
    let msg = this.tellT > 0 ? this.tellMsg : '', bad = this.tellBad && this.tellT > 0;
    if (!msg && this.started && !g.ended && !this.cine) {
      if (this.swapMode) msg = 'SWITCHEROO: pick a hand card to trade.';
      else if (this.mustPickUp()) { msg = 'Nothing beats the pile. Pick it up.'; bad = true; }
      else if (this.myTurn()) msg = guidance(g, this.selected);
    }
    if (!msg) return;
    const a = this.tellT > 0 ? clamp(this.tellT / 0.3) : 1;
    const shake = bad && this.tellT > 2.3 ? Math.sin(R.t * 50) * 2 : 0;
    R.text(msg, L.guide.x + shake, L.guide.y, { color: bad ? P.red0 : P.bone1, align: 'center', alpha: a, ...(R.measure(msg) > (L.land ? L.hand.w + 60 : R.vw - 12) ? TINY_OPTS : {}) });
  },

  drawLogo(x, y, size = 1) {
    const letters = 'BONEHEAD';
    let cx = x;
    for (let i = 0; i < letters.length; i++) {
      const ch = letters[i], dy = Math.sin(R.t * 3 + i * 0.6) * 0.8 * size;
      if (ch === 'O') { R.spr(Sprites.skull, cx + 4 * size, y + 3.5 * size + dy, { sc: size * 0.72 }); cx += 9 * size; continue; }
      const col = i < 4 ? P.bone0 : P.gold1;
      R.text(ch, cx, y + dy, { size, color: col });
      cx += (R.measure(ch) + 1) * size;
    }
    return cx - x;
  },

  drawCine() {
    const c = this.cine, opp = c.opp, idx = clamp(this.g.round - 1, 0, 2), L = this.L;
    const inT = ease.outCubic(clamp(c.t / 0.35)), dock = c.docking ? ease.inOutCubic(clamp(c.dockT / 0.45)) : 0;
    const bar = Math.round(R.vh * 0.16 * inT * (1 - dock));
    R.rect(-10, -10, R.vw + 20, R.vh + 20, P.ink0, 0.55 * (1 - dock));
    R.rect(-10, -10, R.vw + 20, bar + 10, P.ink0); R.rect(-10, R.vh - bar, R.vw + 20, bar + 10, P.ink0);
    const big = R.land ? 3 : 2.6, bx = R.vw * (R.land ? 0.3 : 0.5), by = R.vh * (R.land ? 0.48 : 0.36);
    const tx = L.portrait.x + L.portrait.w / 2, ty = L.portrait.y + 3 + 22;
    const slide = ease.outBack(clamp(c.t / 0.5), 1.3);
    const px = bx + (1 - slide) * R.vw * 0.5, sx = px + (tx - px) * dock, sy = by + (ty - by) * dock, sc = big + (1 - big) * dock;
    const frameW = 44 * sc + 8;
    R.panel(sx - frameW / 2, sy - frameW / 2, frameW, frameW, { fill: P.ink2, rim: opp.color, hi: P.ink4, depth: 4 });
    R.spr(portrait(idx, this.portraitState, Math.floor(R.t * 6)), sx, sy, { sc });
    if (dock > 0) return;
    const nameW = Math.max(R.measure(opp.name.toUpperCase(), { size: 3 }), 200), frameRight = bx + (44 * big + 8) / 2;
    const txX = R.land ? Math.min(R.vw - nameW / 2 - 8, Math.max(R.vw * 0.64, frameRight + 10 + nameW / 2)) : R.vw / 2, txY = R.land ? R.vh * 0.36 : R.vh * 0.62;
    const al = R.land ? 'center' : 'center';
    R.text(`ROUND ${this.g.round} OF 3 · ${opp.venue}`, txX, txY, { color: P.ink6, align: al, reveal: Math.floor((c.t - 0.3) * 50) });
    R.text(opp.name.toUpperCase(), txX, txY + 14, { size: R.land ? 3 : 2, color: opp.color, align: al, wave: 1.2, reveal: Math.floor((c.t - 0.5) * 30), fx: i => ({ dy: -Math.max(0, 1 - ((c.t - 0.5) * 12 - i)) * 10 }) });
    const s = this.speech;
    if (s) {
      const lines = R.wrap(`"${s.text}"`, R.land ? 200 : R.vw - 30);
      let left = Math.floor(s.t * 38) + 1;
      lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, left)); left -= l.length + 1; R.text(part, txX, txY + 44 + i * 11, { color: P.bone0, align: al }); });
    }
    if (c.t > 0.9) R.text(Input.type === 'touch' ? 'TAP TO DEAL' : 'CLICK TO DEAL', txX, R.vh - bar - 14, { color: P.ink6, align: al, alpha: 0.6 + Math.sin(R.t * 5) * 0.4 });
  },

  drawToasts() {
    this.toasts.forEach((t, i) => {
      const inT = ease.outBack(clamp(t.t / 0.3), 1.8), out = clamp((t.t - 2.8) / 0.4), w = Math.max(120, R.measure(t.title) + 40), h = 26;
      const x = R.vw / 2 - w / 2, y = 6 + i * 30 - (1 - inT) * 40 - out * 40;
      R.ctx.save(); R.ctx.globalAlpha = 1 - out;
      R.panel(x, y, w, h, { fill: P.ink1, rim: t.color, hi: P.ink3, depth: 3 });
      R.spr(Sprites.trophy, x + 12, y + 13);
      R.text(t.detail, x + 24, y + 4, { color: P.ink6, ...TINY_OPTS });
      R.text(t.title, x + 24, y + 13, { color: t.color });
      R.ctx.restore();
    });
  },
};

import { TINY } from '../core/font.js';
const TINY_OPTS = { font: TINY };
export function fmtTime(t) { t = Math.floor(t); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
