import assert from 'node:assert/strict';
import { deal, play, pickup, pstats } from './dist/engine.js';
import { GOALS, pickGoals, roundGoals } from './dist/scoring.js';
import { trophies, earnedTrophies } from './dist/progression.js';

const c = (r, s = 0) => ({ r, s, id: `${r}-${s}` });

// Round 1 keeps the classic pair; later rounds get three distinct goals from the pool.
assert.deepEqual(pickGoals(1), ['double', 'clean']);
for (let n = 0; n < 50; n++) {
  const ids = pickGoals(2 + (n % 3));
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  ids.forEach(id => assert.ok(GOALS[id], id));
}
// Every goal explains itself for the hover overlay.
for (const [id, gl] of Object.entries(GOALS)) { assert.ok(gl.desc.length > 20, id); assert.ok(gl.points > 0, id); }
assert.ok(Object.keys(GOALS).length >= 10, 'a pool big enough to vary between rounds');

// Engine stats feed the goals.
let g = deal(2);
g.goals = ['hattrick', 'longrun', 'bonfire'];
g.pile = [c(3, 3)];
g.player.hand = [c(5, 0), c(5, 1), c(5, 2), c(6, 2), c(7, 2)];
play(g, 'player', ['5-0', '5-1', '5-2', '6-2', '7-2']);
assert.equal(pstats(g).maxSame, 3);
assert.equal(pstats(g).maxPlay, 5);
let goals = roundGoals(g);
assert.ok(goals.find(x => x.id === 'hattrick').complete);
assert.ok(goals.find(x => x.id === 'longrun').complete);
assert.ok(!goals.find(x => x.id === 'bonfire').complete);
assert.deepEqual(earnedTrophies(g, { cards: [c(5, 0), c(5, 1), c(5, 2), c(6, 2), c(7, 2)] }), ['stairway']);

// Four of a kind burn: quads goal + Clean Cut trophy; pile size feeds Bonfire.
g = deal(2); g.goals = ['quads', 'bonfire', 'double'];
g.pile = [c(3), c(4), c(5), c(6), c(12), c(9, 1), c(9, 2), c(9, 3)];
g.player.hand = [c(9, 0), c(3, 1), c(4, 1)];
const r = play(g, 'player', ['9-0']);
assert.ok(r.burn);
goals = roundGoals(g);
assert.ok(goals.find(x => x.id === 'quads').complete);
assert.ok(goals.find(x => x.id === 'bonfire').complete, '9 cards burned');
assert.ok(earnedTrophies(g, r).includes('quads'));

// Pickups count toward Comeback Kid and Hoarder.
g = deal(2); g.goals = ['comeback'];
g.pile = Array.from({ length: 18 }, (_, i) => c(14, i % 4));
g.player.hand = [c(3), c(4, 1)];
assert.ok(pickup(g, 'player'));
assert.equal(pstats(g).pickedUp, 18);
assert.equal(pstats(g).maxHeld, 20);
assert.ok(earnedTrophies(g, {}).includes('hoarder'));
g.ended = true; g.winner = 'player'; g.opps = ['tibia', 'fibula'];
const t = earnedTrophies(g, {});
assert.ok(roundGoals(g)[0].complete, 'comeback pays once you win');
assert.ok(t.includes('comeback') && t.includes('twins') && t.includes('purist') && t.includes('overachiever'));
for (const id of t) assert.ok(trophies[id], `trophy ${id} is defined`);
assert.ok(Object.keys(trophies).length >= 15);

console.log(`Goal checks passed: ${Object.keys(GOALS).length} goals, ${Object.keys(trophies).length} trophies, engine stats drive goals and trophies.`);
