import { P } from '../art/palette.js';

// The run, one entry per round. Reorder or add rounds here.
//   opps: opponent ids (two opponents = a three-seat table)
//   rule: a rule change announced before the deal
//   skill: house AI (1 casual, 2 sharp); theme: background palette; key: music transpose
export const ROUNDS = [
  { opps: ['lucky'], theme: 0, key: 0, skill: 1 },
  { opps: ['velvet'], theme: 1, key: 3, skill: 2, rule: 'choose' },
  { opps: ['tibia', 'fibula'], theme: 4, key: 5, skill: 2, rule: 'twins', name: 'The Twins', venue: 'THE HALL OF MIRRORS' },
  { opps: ['boss'], theme: 2, key: -2, skill: 2, rule: 'choose' },
];

// While testing, every table on the map is playable in any order.
export const ROUND_LOCKS = false;

export const RULES = {
  choose: {
    title: 'PICK YOUR TABLE', color: P.gold1,
    lines: ['You get ^g6 cards^0 this round, not 3.', 'Choose ^g3^0 to lay face-up for later.', 'Save your magic for the endgame,', 'or spend it early. Your call.'],
  },
  twins: {
    title: 'TWO OPPONENTS', color: P.teal1,
    lines: ['The twins both sit in.', 'Go out first and you win.', 'If one twin goes out, beat the other.', 'Last one holding cards is the ^rBonehead^0.'],
  },
};

export const roundOf = n => ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, n - 1))];
export const seatsFor = n => ['player', ...roundOf(n).opps.map((_, i) => (i ? `house${i + 1}` : 'house'))];
