import assert from 'node:assert/strict';
import { deal, options, play, pickup, misplay, legal, valid, source, rule, isMagic, cardsLeft, seatsOf } from './dist/engine.js';
import { ROUNDS, RULES, ROOMS, HOUSE_RULES, roomRounds } from './dist/js/game/rounds.js';

let seed = 11;
Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const c = (r, s = 0, x = {}) => ({ r, s, id: `${r}-${s}-${Object.keys(x).join('')}`, ...x });

// Two rooms of four; Room II holds the new cast and rules.
assert.equal(ROUNDS.length, 8);
assert.deepEqual(roomRounds(1).map(x => x.n), [1, 2, 3, 4]);
assert.deepEqual(roomRounds(2).map(x => x.n), [5, 6, 7, 8]);
assert.equal(ROOMS.length, 2);
for (const rd of ROUNDS) if (rd.rule) assert.ok(RULES[rd.rule], `rule ${rd.rule} is described`);
assert.equal(ROUNDS[6].opps.length, 2, 'Cadaverini and Lucinda sit together');

// Nana's marks.
const seven = c(7, 0, { lowRule: true }), three = c(3, 1, { seeThrough: true });
assert.deepEqual(rule([c(5), seven]), { r: 7, low: true }, 'a marked 7 sends the next card low');
assert.equal(legal(c(6), [seven]), true);
assert.equal(legal(c(8, 2), [seven]), true, 'an 8 is still magic');
assert.equal(legal(c(12), [seven]), false);
assert.equal(legal(c(9, 3), [c(5), c(9, 1)]), true, 'plain 9s still undercut as before');
assert.equal(legal(c(10, 3), [c(5), c(9, 1)]), true, '10 still plays on anything');
assert.equal(legal(c(12, 3), [c(5), c(9, 1)]), false);
assert.equal(isMagic(three), true, 'invisible 3s play on anything');
assert.equal(legal(three, [c(14)]), true);
assert.deepEqual(rule([c(11), three]), { r: 11, low: false }, 'and are see-through');
// A skip 8 gives its player another go.
{
  const g = deal(6, 0, 3);
  g.deck = []; g.turn = 'player'; g.pile = [c(5)];
  g.player = { hand: [c(8, 1, { skip: true }), c(4)], face: [], blind: [] };
  play(g, 'player', [g.player.hand[0].id]);
  assert.equal(g.turn, 'player');
}

// Eye on the Card: a misplay goes down and the whole pile comes back, even when the
// player was holding a card that would have beaten it (the bug a playtester found:
// a normal pickup refuses when you have a legal play).
{
  const g = deal(7, 0, 3, { seats: ['player', 'house', 'house2'] });
  g.deck = []; g.turn = 'player'; g.pile = [c(12, 0), c(14, 1)];
  const wrong = c(4, 2), good = c(10, 3), total = () => g.deck.length + g.pile.length + seatsOf(g).reduce((a, s) => a + cardsLeft(g[s]), 0);
  g.player = { hand: [wrong, good, c(6, 1)], face: [], blind: [] };
  const before = total();
  assert.equal(pickup(g, 'player'), false, 'a normal pickup is refused while you hold a 10');
  assert.equal(misplay(g, 'player', [wrong.id]), true);
  assert.equal(g.pile.length, 0, 'the pile is picked up');
  assert.equal(g.player.hand.length, 5, 'two left in hand + the two pile cards + the misplayed 4');
  assert.ok(g.player.hand.some(x => x.id === wrong.id), 'the misplayed card comes back too');
  assert.equal(g.turn, 'house', 'and the turn passes on');
  assert.equal(total(), before, 'no cards lost');
  assert.equal(g.playerPickups, 1);
  // Face-up table cards misplayed come back into the hand as well
  g.turn = 'player'; g.pile = [c(13, 2)]; g.player = { hand: [], face: [c(5, 0), c(11, 1)], blind: [c(3, 3)] };
  assert.equal(misplay(g, 'player', ['5-0-']), true);
  assert.deepEqual(g.player.hand.map(x => x.r).sort((a, b) => a - b), [5, 13]);
  assert.equal(g.player.face.length, 1);
  // Not your turn, or unknown cards: nothing happens
  assert.equal(misplay(g, 'player', ['nope']), false);
}

// Simulated games under every pair of house rules and with disarmed 10s: cards are
// conserved and every game finishes.
const ids = Object.keys(HOUSE_RULES), combos = [[], ...ids.flatMap((a, i) => ids.slice(i + 1).map(b => [a, b])), ['plain']];
let games = 0;
for (const combo of combos) for (let k = 0; k < 60; k++) {
  const seats = k % 3 === 0 ? ['player', 'house', 'house2'] : ['player', 'house'];
  const g = deal(6, 0, 3, { seats });
  const all = [...g.deck, ...seatsOf(g).flatMap(s => [...g[s].hand, ...g[s].face, ...g[s].blind])], total = all.length;
  for (const card of all) { for (const id of combo) if (HOUSE_RULES[id]) HOUSE_RULES[id].mark(card); if (combo.includes('plain') && card.r === 10) card.plain = true; }
  let moves = 0;
  while (!g.ended && moves++ < 4000) {
    const who = g.turn, opts = options(g, who);
    if (opts.length) play(g, who, opts[Math.floor(Math.random() * opts.length)].map(x => x.id));
    else pickup(g, who);
    const count = g.deck.length + g.pile.length + (g.cardsBurned || 0) + seatsOf(g).reduce((a, s) => a + cardsLeft(g[s]), 0);
    assert.equal(count, total, `cards conserved (${combo.join('+') || 'classic'})`);
  }
  assert.ok(g.ended, `game finishes (${combo.join('+') || 'classic'})`);
  games++;
}
// Eye on the Card simulations: the player sometimes plays a random card blind, legal or
// not; misplays must never lose cards or stall the game.
for (let k = 0; k < 120; k++) {
  const g = deal(7, 0, 3, { seats: ['player', 'house', 'house2'] });
  const total = g.deck.length + seatsOf(g).reduce((a, s) => a + cardsLeft(g[s]), 0);
  let moves = 0;
  while (!g.ended && moves++ < 4000) {
    const who = g.turn, src = source(g[who]);
    if (who === 'player' && src !== 'blind' && Math.random() < 0.4) {
      const pick = g.player[src][Math.floor(Math.random() * g.player[src].length)];
      if (valid([pick], g.pile)) play(g, who, [pick.id]); else assert.equal(misplay(g, who, [pick.id]), true);
    } else {
      const opts = options(g, who);
      if (opts.length) play(g, who, opts[0].map(x => x.id)); else pickup(g, who);
    }
    const count = g.deck.length + g.pile.length + (g.cardsBurned || 0) + seatsOf(g).reduce((a, s) => a + cardsLeft(g[s]), 0);
    assert.equal(count, total, 'cards conserved with misplays');
  }
  assert.ok(g.ended, 'eye games finish');
  games++;
}

console.log(`rooms: ok (${games} simulated games across ${combos.length} rule sets)`);
