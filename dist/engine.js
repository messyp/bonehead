export const SUITS = ['♠', '♥', '♣', '♦'];
export const label = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
export const magic = { 2: ['RESET', 'A fresh start. Anything goes.'], 8: ['GHOST', 'See-through. The previous rule stays.'], 9: ['UNDERCUT', 'Play on anything. Next non-8 card: 9 or lower.'], 10: ['INFERNO', 'Burn the pile. Take another turn.'] };

export function deck(extra = 0) {
  const d = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s, id: `${s}-${r}` });
  for (let i = 0; i < extra; i++) d.push({ r: [2, 8, 9, 10][i % 4], s: i % 4, id: `extra-${i}` });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

export function rule(pile) {
  for (let i = pile.length - 1; i >= 0; i--) {
    const r = pile[i].r;
    if (r === 8) continue;
    if (r === 2 || r === 10) return { r: 0, low: false };
    return { r, low: r === 9 };
  }
  return { r: 0, low: false };
}

export function legal(c, pile) {
  if ([2, 8, 9, 10].includes(c.r)) return true;
  const t = rule(pile);
  return !t.r || (t.low ? c.r <= 9 : c.r >= t.r);
}

export function source(p) { return p.hand.length ? 'hand' : p.face.length ? 'face' : 'blind'; }
export const cardsLeft = p => p.hand.length + p.face.length + p.blind.length;

export function burned(pile) {
  if (!pile.length) return false;
  if (pile.at(-1).r === 10) return true;
  return pile.length >= 4 && pile.slice(-4).every(c => c.r === pile.at(-1).r);
}

export function valid(cards, pile) {
  const p = [...pile];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i], prev = cards[i - 1];
    if (i) {
      if (burned(p)) return false;
      if (!(c.r === prev.r || (c.s === prev.s && c.r === prev.r + 1))) return false;
    }
    if (!legal(c, p) && !(i && c.s === prev.s && c.r === prev.r + 1)) return false;
    p.push(c);
  }
  return cards.length > 0;
}

// Seats play in order. 'player' is always first; CPU seats are 'house', 'house2', ...
export const seatsOf = g => g.order || ['player', 'house'];
export function nextSeat(g, who) {
  const order = seatsOf(g), out = g.out || [];
  for (let i = 1; i <= order.length; i++) {
    const s = order[(order.indexOf(who) + i) % order.length];
    if (s !== who && !out.includes(s)) return s;
  }
  return who;
}

// choose: deal 6 to hand and no face-up cards; each seat then picks its own table cards.
export function deal(round = 1, extra = 0, min = 3, opts = {}) {
  const d = deck(extra), order = opts.seats || ['player', 'house'], g = { round };
  for (const seat of order) {
    const p = { hand: [], face: [], blind: [] };
    p.blind = d.splice(0, 3);
    if (opts.choose) p.hand = d.splice(0, 3 + min);
    else { p.face = d.splice(0, 3); p.hand = d.splice(0, min); }
    g[seat] = p;
  }
  return Object.assign(g, { deck: d, pile: [], burns: 0, cardsBurned: 0, playerBurns: 0, playerPickups: 0, turn: 'player', moves: 0, ended: false, order, out: [], choosing: !!opts.choose });
}

// Move three hand cards face-up onto a seat's table (pick-your-table rounds).
export function chooseTable(g, who, ids) {
  const p = g[who];
  if (ids.length !== 3 || new Set(ids).size !== 3 || ids.some(id => !p.hand.find(c => c.id === id))) return false;
  p.face = ids.map(id => p.hand.find(c => c.id === id));
  p.hand = p.hand.filter(c => !ids.includes(c.id));
  return true;
}
// The house saves its strongest cards for the endgame.
export const tableValue = c => ({ 10: 100, 2: 95, 14: 80, 13: 75, 12: 70, 11: 65, 9: 60, 8: 40 }[c.r] ?? c.r * 2);
export const aiTable = p => [...p.hand].sort((a, b) => tableValue(b) - tableValue(a)).slice(0, 3).map(c => c.id);

export function replenish(g, p, min = 3) { while (p.hand.length < min && g.deck.length) p.hand.push(g.deck.pop()); }

export function options(g, who) {
  const p = g[who], src = source(p);
  if (src === 'blind') return p.blind.length ? [[p.blind[0]]] : [];
  const cards = p[src], out = [];
  for (const c of cards) {
    if (!legal(c, g.pile)) continue;
    const chain = [c];
    out.push([...chain]);
    for (let j = 0; j < cards.length; j++) {
      const next = cards.find(x => !chain.includes(x) && valid([...chain, x], g.pile));
      if (!next) break;
      chain.push(next);
      out.push([...chain]);
    }
  }
  return out;
}

// A seat that empties its cards is out. The player going out wins; otherwise the
// round ends when one seat is left holding cards: that seat is the Bonehead.
function finish(g, who) {
  g.out = [...(g.out || []), who];
  const active = seatsOf(g).filter(s => !g.out.includes(s));
  if (who === 'player' || active.length <= 1) {
    g.ended = true;
    g.winner = who === 'player' ? 'player' : g.out[0];
    g.bonehead = who === 'player' ? null : active[0];
  }
}

// Per-round stats for the player; bonus goals and trophies read these.
export function pstats(g) {
  return (g.pstats ??= { plays: 0, maxPlay: 0, maxSame: 0, maxBurn: 0, quadBurns: 0, infernoBurns: 0, magic: [], magicPlays: 0, blindHits: 0, pickedUp: 0, maxHeld: 0 });
}
function trackPickup(g, who, n) {
  if (who !== 'player') return;
  const st = pstats(g);
  st.pickedUp += n;
  st.maxHeld = Math.max(st.maxHeld, g.player.hand.length);
}

export function play(g, who, ids, min = 3, protect = false) {
  const p = g[who], src = source(p), cards = ids.map(id => p[src].find(c => c.id === id));
  if (!cards.length || cards.some(c => !c) || new Set(ids).size !== ids.length) return { error: 'Choose your cards first.' };
  if (src !== 'blind' && !valid(cards, g.pile)) return { error: 'Start with a playable card. Link equal ranks or consecutive cards of one suit.' };
  if (src === 'blind' && cards.length !== 1) return { error: 'One blind card at a time.' };
  p[src] = p[src].filter(c => !ids.includes(c.id));
  g.moves++;
  if (src === 'blind' && !legal(cards[0], g.pile)) {
    if (protect) return { protected: true, cards, src };
    const n = g.pile.length + cards.length;
    p.hand.push(...g.pile, ...cards);
    if (who === 'player') g.playerPickups = (g.playerPickups || 0) + 1;
    trackPickup(g, who, n);
    g.pile = [];
    g.turn = nextSeat(g, who);
    return { pickup: true, cards, src };
  }
  g.pile.push(...cards);
  const burn = burned(g.pile), size = g.pile.length, burnedCards = burn ? [...g.pile] : [];
  if (who === 'player') {
    const st = pstats(g), counts = {};
    cards.forEach(c => { counts[c.r] = (counts[c.r] || 0) + 1; if ([2, 8, 9, 10].includes(c.r)) { st.magicPlays++; if (!st.magic.includes(c.r)) st.magic.push(c.r); } });
    st.plays++;
    st.maxPlay = Math.max(st.maxPlay, cards.length);
    st.maxSame = Math.max(st.maxSame, ...Object.values(counts));
    if (src === 'blind') st.blindHits++;
    if (burn) { st.maxBurn = Math.max(st.maxBurn, size); if (cards.at(-1).r === 10) st.infernoBurns++; else st.quadBurns++; }
  }
  if (burn) {
    g.pile = []; g.burns++;
    g.cardsBurned = (g.cardsBurned || 0) + size;
    if (who === 'player') g.playerBurns = (g.playerBurns || 0) + 1;
  }
  replenish(g, p, min);
  if (!cardsLeft(p)) finish(g, who);
  g.turn = burn && !(g.out || []).includes(who) ? who : nextSeat(g, who);
  return { cards, burn, size, src, burnedCards };
}

export function pickup(g, who) {
  if (g.ended || g.turn !== who || !g.pile.length || options(g, who).length) return false;
  if (who === 'player') g.playerPickups = (g.playerPickups || 0) + 1;
  const n = g.pile.length;
  g[who].hand.push(...g.pile);
  trackPickup(g, who, n);
  g.pile = [];
  g.turn = nextSeat(g, who);
  g.moves++;
  return true;
}
