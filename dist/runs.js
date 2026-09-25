import { valid } from './engine.js';
import { cardPoints } from './scoring.js';

const MAGIC = [2, 8, 9, 10];

// Every distinct legal play in a hand (as card sets), each with one playable order.
// Selection works on these, so players can pick a run's cards in any order.
export function allChains(hand, pile, maxLen = 8) {
  const out = new Map(), chain = [], used = new Set();
  let nodes = 0;
  const dfs = () => {
    if (++nodes > 60000) return;
    if (chain.length) {
      const key = chain.map(c => c.id).sort().join('|');
      if (!out.has(key)) out.set(key, { cards: [...chain], ids: new Set(chain.map(c => c.id)) });
    }
    if (chain.length >= maxLen) return;
    for (const c of hand) {
      if (used.has(c.id)) continue;
      chain.push(c);
      if (valid(chain, pile)) { used.add(c.id); dfs(); used.delete(c.id); }
      chain.pop();
    }
  };
  dfs();
  return [...out.values()];
}

export const containing = (chains, ids) => chains.filter(ch => ids.every(id => ch.ids.has(id)));
export const exactly = (chains, ids) => chains.find(ch => ch.cards.length === ids.length && ids.every(id => ch.ids.has(id))) || null;

// Longer runs first, spending as few magic cards as possible.
export function runScore(cards) {
  return cards.length * 1000 - cards.filter(c => MAGIC.includes(c.r)).length * 150 + cards.reduce((a, c) => a + cardPoints(c), 0) / 10;
}

// Best run through one card, for double-tap auto-select.
export function bestChain(chains, id) {
  let best = null;
  for (const ch of chains) if (ch.ids.has(id) && (!best || runScore(ch.cards) > runScore(best.cards))) best = ch;
  return best;
}

// Smallest run that completes a partial selection (what's still missing).
export function completion(chains, ids) {
  let best = null;
  for (const ch of containing(chains, ids)) if (!best || ch.cards.length < best.cards.length) best = ch;
  return best ? best.cards.filter(c => !ids.includes(c.id)) : null;
}
