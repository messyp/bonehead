import { P } from '../art/palette.js';

// The run, one entry per round. Reorder or add rounds here.
//   opps: opponent ids (two opponents = a three-seat table)
//   rule: a rule change announced before the deal
//   skill: house AI (1 casual, 2 sharp); theme: background palette; key: music transpose
//   room: which room of the crypt the table is in (Room II opens once Room I is beaten)
export const ROUNDS = [
  { opps: ['lucky'], theme: 0, key: 0, skill: 1, room: 1 },
  { opps: ['velvet'], theme: 1, key: 3, skill: 2, rule: 'choose', room: 1 },
  { opps: ['tibia', 'fibula'], theme: 4, key: 5, skill: 2, rule: 'twins', name: 'The Twins', venue: 'THE HALL OF MIRRORS', room: 1 },
  { opps: ['boss'], theme: 2, key: -2, skill: 2, rule: 'noweapons', room: 1 },
  { opps: ['marrow'], theme: 1, key: 2, skill: 2, rule: 'open', room: 2 },
  { opps: ['nana'], theme: 5, key: 4, skill: 2, rule: 'nana', room: 2 },
  { opps: ['cadaverini', 'lucinda'], theme: 2, key: -3, skill: 2, rule: 'eye', name: 'Cadaverini & Lucinda', venue: 'THE GRAND THEATRE', room: 2 },
  { opps: ['ferryman'], theme: 6, key: -5, skill: 2, rule: 'toll', room: 2 },
];

export const ROOMS = [
  { n: 1, name: 'THE BACK ROOMS' },
  { n: 2, name: 'THE DEEP CRYPT' },
];
export const roomRounds = room => ROUNDS.map((rd, i) => ({ rd, n: i + 1 })).filter(x => (x.rd.room || 1) === room);

// Nana plays by her own house rules: two of these, chosen at the deal. Each marks the
// cards it changes, and the engine reads the marks.
export const HOUSE_RULES = {
  sevens: { name: 'SEVENS GO LOW', line: 'A ^t7^0 makes the next card 7 or lower.', mark: c => { if (c.r === 7) c.lowRule = true; } },
  threes: { name: 'INVISIBLE THREES', line: '^t3s^0 play on anything and are see-through.', mark: c => { if (c.r === 3) c.seeThrough = true; } },
  eights: { name: 'EIGHTS SKIP', line: 'Play an ^t8^0 and you go again.', mark: c => { if (c.r === 8) c.skip = true; } },
};

// While testing, every table on the map is playable in any order.
export const ROUND_LOCKS = false;

export const RULES = {
  choose: {
    title: 'PICK YOUR TABLE', color: P.gold1,
    lines: ['You get ^g6 cards^0 this round, not 3.', 'Choose ^g3^0 to lay face-up for later.', 'Save your magic for the endgame,', 'or spend it early. Your call.'],
  },
  noweapons: {
    title: 'NO WEAPONS', color: P.red1,
    lines: ['The Pit Boss checks you at the door.', '^r10s are just 10s^0 this round:', 'no playing on anything, no burning.', 'Four of a kind still burns the pile.'],
  },
  open: {
    title: 'OPEN HANDS', color: P.vio1,
    lines: ['Madame Marrow sees all.', 'Both hands are ^vdealt face up^0:', 'you see hers, she sees yours.', 'Plan ahead. She already has.'],
  },
  nana: {
    title: 'NANA\'S RULES', color: '#ff9fc4',
    lines: g => ['Nana\'s house, Nana\'s rules:', ...(g?.houseRules || []).map(id => HOUSE_RULES[id].line), 'Everything else as normal, dear.'],
  },
  eye: {
    title: 'EYE ON THE CARD', color: P.gold1,
    lines: ['Two opponents. And cards turn ^gface down^0', 'a moment after they land. No hints.', 'Remember what\'s on top: play a card', 'that doesn\'t beat it and ^ryou pick up^0.'],
  },
  toll: {
    title: 'PAY THE TOLL', color: P.teal1,
    lines: ['Every crossing has a price.', 'Each card you ^rpick up^0 costs', '^g25 points^0 from your run score.', 'Keep your hands clean.'],
  },
  twins: {
    title: 'TWO OPPONENTS', color: P.teal1,
    lines: ['The twins both sit in.', 'Go out first and you win.', 'If one twin goes out, beat the other.', 'Last one holding cards is the ^rBonehead^0.'],
  },
};

export const roundOf = n => ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, n - 1))];
export const seatsFor = n => ['player', ...roundOf(n).opps.map((_, i) => (i ? `house${i + 1}` : 'house'))];
