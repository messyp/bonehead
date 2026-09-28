import assert from 'node:assert/strict';
import { legal, rule, burned, valid, isMagic, tableValue, play, deal } from './dist/engine.js';
import { cardPoints, pickGoals } from './dist/scoring.js';
import { allChains } from './dist/runs.js';
import { ROUNDS, RULES } from './dist/js/game/rounds.js';

// The Pit Boss's "No Weapons" round: 10s carry plain: true and play as ordinary cards.
const c = (r, s = 0, extra = {}) => ({ r, s, id: `${r}-${s}${extra.plain ? 'p' : ''}`, ...extra });
const ten = c(10, 1), plainTen = c(10, 2, { plain: true });

assert.equal(ROUNDS[3].rule, 'noweapons', 'the Pit Boss round confiscates weapons');
assert.ok(RULES.noweapons.title);

// A live 10 plays on anything and burns; a disarmed one is just a 10.
assert.equal(isMagic(ten), true);
assert.equal(isMagic(plainTen), false);
assert.equal(legal(ten, [c(14)]), true);
assert.equal(legal(plainTen, [c(14)]), false, 'a disarmed 10 cannot beat an ace');
assert.equal(legal(plainTen, [c(9)]), false, 'a 9 still demands 9 or lower');
assert.equal(legal(plainTen, [c(7)]), true, 'a disarmed 10 beats a 7 like any 10');
assert.equal(burned([c(5), ten]), true);
assert.equal(burned([c(5), plainTen]), false, 'a disarmed 10 does not burn');
assert.deepEqual(rule([c(5), plainTen]), { r: 10, low: false }, 'next card must be 10 or higher');
assert.equal(legal(c(7, 3), [c(5), plainTen]), false);
assert.equal(legal(c(12, 3), [c(5), plainTen]), true);
// Four of a kind still burns, disarmed or not.
const quad = [c(10, 0, { plain: true }), c(10, 1, { plain: true }), c(10, 2, { plain: true }), c(10, 3, { plain: true })];
assert.equal(burned(quad), true);
// Runs through a disarmed 10 follow normal rules.
assert.equal(valid([c(9, 1), plainTen && c(10, 1, { plain: true }), c(11, 1)], [c(4)]), true);

// Scoring and table value treat it as an ordinary card.
assert.equal(cardPoints(ten), 300);
assert.equal(cardPoints(plainTen), 100);
assert.ok(tableValue(ten) > tableValue(plainTen));

// Playing one: no burn, the turn passes.
const g = deal(4, 0, 3);
g.deck = []; g.turn = 'player'; g.pile = [c(6)];
g.player = { hand: [plainTen, c(3)], face: [], blind: [] };
const res = play(g, 'player', [plainTen.id]);
assert.equal(res.burn, false);
assert.equal(g.pile.length, 2);
assert.equal(g.turn, 'house');

// Disarmed 10s are not magic when ranking runs; the conjurer goal can be excluded.
assert.ok(allChains([plainTen, c(3)], [c(14)]).length === 0, 'nothing plays on an ace');
for (let i = 0; i < 50; i++) assert.ok(!pickGoals(4, Math.random, ['conjurer']).includes('conjurer'));

console.log('weapons: ok');
