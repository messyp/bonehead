import assert from 'node:assert/strict';
import { deal, play, pickup, options, nextSeat, chooseTable, aiTable, cardsLeft } from './dist/engine.js';

let seed = 7;
Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const c = (r, s = 0) => ({ r, s, id: `${r}-${s}` });
const SEATS = ['player', 'house', 'house2'];

// Turn order and skipping seats that are out.
let g = deal(3, 0, 3, { seats: SEATS });
assert.equal(nextSeat(g, 'player'), 'house');
assert.equal(nextSeat(g, 'house'), 'house2');
assert.equal(nextSeat(g, 'house2'), 'player');
g.out = ['house'];
assert.equal(nextSeat(g, 'player'), 'house2');

// A twin going out first doesn't end the round; the last seat holding cards is the Bonehead.
g = deal(3, 0, 3, { seats: SEATS });
g.deck = []; g.turn = 'house'; g.house = { hand: [c(14)], face: [], blind: [] };
play(g, 'house', ['14-0']);
assert.equal(g.ended, false);
assert.deepEqual(g.out, ['house']);
assert.equal(g.turn, 'house2');
g.house2 = { hand: [c(10, 1)], face: [], blind: [] };
play(g, 'house2', ['10-1']);
assert.equal(g.ended, true);
assert.equal(g.winner, 'house');
assert.equal(g.bonehead, 'player');
// The player going out wins immediately.
g = deal(3, 0, 3, { seats: SEATS });
g.deck = []; g.player = { hand: [c(14)], face: [], blind: [] };
play(g, 'player', ['14-0']);
assert.equal(g.ended, true);
assert.equal(g.winner, 'player');

// Pick-your-table deal: 3 blind + 6 in hand each, no face-up cards until chosen.
g = deal(2, 0, 3, { choose: true });
assert.equal(g.choosing, true);
for (const s of ['player', 'house']) { assert.equal(g[s].hand.length, 6); assert.equal(g[s].face.length, 0); assert.equal(g[s].blind.length, 3); }
const pick = g.player.hand.slice(0, 3).map(x => x.id);
assert.equal(chooseTable(g, 'player', pick.slice(0, 2)), false, 'needs exactly three');
assert.ok(chooseTable(g, 'player', pick));
assert.deepEqual(g.player.face.map(x => x.id), pick);
assert.equal(g.player.hand.length, 3);
// The house saves its strongest cards.
g.house.hand = [c(3), c(10), c(5), c(2, 1), c(14, 2), c(4)];
assert.deepEqual(aiTable(g.house).sort(), ['10-0', '14-2', '2-1'].sort());

// 400 random three-seat games: cards are conserved and every game ends.
let finished = 0, playerWins = 0;
for (let n = 0; n < 400; n++) {
  g = deal(3, 0, 3, { seats: SEATS, choose: n % 2 === 0 });
  if (g.choosing) { for (const s of SEATS) assert.ok(chooseTable(g, s, aiTable(g[s]))); g.choosing = false; }
  let burned = 0;
  for (let move = 0; move < 30000 && !g.ended; move++) {
    const who = g.turn;
    assert.ok(!g.out.includes(who), 'a seat that is out never takes a turn');
    const opts = options(g, who);
    if (opts.length) { const r = play(g, who, opts[Math.floor(Math.random() * opts.length)].map(x => x.id)); assert.ok(!r.error); if (r.burn) burned += r.size; }
    else assert.ok(pickup(g, who));
    const all = [...g.deck, ...g.pile, ...SEATS.flatMap(s => [...g[s].hand, ...g[s].face, ...g[s].blind])];
    assert.equal(all.length + burned, 52);
    assert.equal(new Set(all.map(x => x.id)).size, all.length);
  }
  assert.ok(g.ended, 'game finished');
  if (g.winner === 'player') playerWins++;
  else assert.ok(cardsLeft(g.player) > 0 && g.bonehead === 'player');
  finished++;
}
assert.equal(finished, 400);
console.log(`Round rule checks passed: seat order, twins elimination, pick-your-table deal, AI table choice, 400/400 three-seat games (random player won ${playerWins}).`);
