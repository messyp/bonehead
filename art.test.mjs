import assert from 'node:assert/strict';
import { FONT, TINY, glyph } from './dist/js/core/font.js';
import { inCard, CW, CH, silhouette, backPix, MAGIC } from './dist/js/art/cards.js';
import { OPPONENTS } from './dist/js/art/sprites.js';

// Every glyph row fits its declared width and the cap/descender grid.
for (const font of [FONT, TINY]) {
  for (const [ch, g] of Object.entries(font.glyphs)) {
    assert.ok(g.rows.length >= (font === TINY ? 5 : 7) && g.rows.length <= g.h, `glyph ${ch} has ${g.rows.length} rows`);
    for (const row of g.rows) assert.ok(/^[#.]+$/.test(row) && row.length === g.w, `glyph ${JSON.stringify(ch)} row "${row}"`);
  }
}
// UI copy never falls back to '?' for characters we actually use.
const used = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?:;-+=×/()\'"%&*<>·→←↑↓✦✓…♥♦♠♣';
for (const ch of used) if (ch !== '?') assert.notStrictEqual(glyph(FONT, ch), FONT.glyphs['?'], `FONT missing ${ch}`);
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .+-×/:!=') if (ch !== '?') assert.notStrictEqual(glyph(TINY, ch), TINY.glyphs['?'], `TINY missing ${ch}`);

// Card silhouette is symmetric and has rounded corners.
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
  assert.equal(inCard(x, y), inCard(CW - 1 - x, y));
  assert.equal(inCard(x, y), inCard(x, CH - 1 - y));
}
assert.equal(inCard(0, 0), false);
assert.equal(inCard(CW >> 1, CH >> 1), true);
assert.equal(silhouette('#000000').d.filter(Boolean).length, [...Array(CW * CH).keys()].filter(i => inCard(i % CW, Math.floor(i / CW))).length);
assert.ok(backPix().d.filter(Boolean).length > CW * CH * 0.9);
assert.deepEqual(Object.keys(MAGIC).map(Number), [2, 8, 9, 10]);

// Each opponent has dialogue for every event the table triggers.
for (const o of OPPONENTS) for (const kind of ['intro', 'think', 'houseBurn', 'playerBurn', 'playerPickup', 'housePickup', 'magic', 'houseWin', 'playerWin', 'low'])
  assert.ok(o.lines[kind]?.length, `${o.name} needs ${kind} lines`);

console.log('Art checks passed: font glyph grids, card silhouette symmetry, card back coverage, opponent dialogue coverage.');
