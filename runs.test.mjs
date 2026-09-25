import assert from 'node:assert/strict';
import { allChains, containing, exactly, bestChain, completion } from './dist/runs.js';
import { valid } from './dist/engine.js';

const c = (r, s = 0) => ({ r, s, id: `${r}-${s}` });
const ids = cards => cards && cards.map(x => x.id);
const hand = [c(6, 1), c(4, 1), c(5, 1), c(9, 0), c(4, 2), c(12, 3)];
const chains = allChains(hand, [c(3, 0)]);

// Every indexed chain is a legal play in the stored order.
for (const ch of chains) assert.ok(valid(ch.cards, [c(3, 0)]), ids(ch.cards).join(' '));
// Picking 6♥ then 4♥ is a partial run: not playable yet, but still completable.
assert.equal(exactly(chains, ['6-1', '4-1']), null);
assert.ok(containing(chains, ['6-1', '4-1']).length > 0, 'a longer run still contains 6♥ and 4♥');
assert.deepEqual(ids(completion(chains, ['6-1', '4-1'])), ['5-1'], 'the missing card is 5♥');
// Adding 5♥ makes it exactly one play, in climbing order regardless of pick order.
assert.deepEqual(ids(exactly(chains, ['6-1', '4-1', '5-1']).cards), ['4-1', '5-1', '6-1']);
// Pair then climb: 4♣ 4♥ 5♥ 6♥ is found as one play.
assert.equal(exactly(chains, ['5-1', '4-2', '6-1', '4-1']).cards.length, 4);
// Cards that can never link are rejected.
assert.equal(containing(chains, ['6-1', '12-3']).length, 0);
// Double-tap picks the longest run through a card.
assert.deepEqual(ids(bestChain(chains, '5-1').cards).sort(), ['4-1', '4-2', '5-1', '6-1']);
assert.deepEqual(ids(bestChain(chains, '12-3').cards), ['12-3']);
// The pile still gates the first card: nothing through a 3 when a queen is on top.
assert.equal(bestChain(allChains([c(3, 1), c(4, 1)], [c(12, 0)]), '3-1'), null);
// A big post-pickup hand indexes quickly.
const big = Array.from({ length: 28 }, (_, i) => c(2 + (i % 13), i % 4));
const t0 = performance.now(); allChains(big, []); const ms = performance.now() - t0;
assert.ok(ms < 400, `indexing a 28-card hand took ${ms.toFixed(0)}ms`);

console.log(`Run checks passed: partial runs complete in any order, missing-card hints, best run per card, 28-card index in ${ms.toFixed(0)}ms.`);
