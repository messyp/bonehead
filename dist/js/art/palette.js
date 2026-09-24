// One palette for the whole game. Every sprite, panel and particle pulls from here.
export const P = Object.freeze({
  ink0: '#07060d', ink1: '#110f1e', ink2: '#1b1830', ink3: '#2a2649', ink4: '#3b3566', ink5: '#5a5390', ink6: '#8a82c0',
  bone0: '#fff8ea', bone1: '#f1e5ca', bone2: '#d6c59f', bone3: '#a2906c', bone4: '#645643',
  red0: '#ff9c8f', red1: '#ff5264', red2: '#d9294d', red3: '#931a3e', red4: '#4f0d27',
  gold0: '#fff4b8', gold1: '#ffd45e', gold2: '#f59e2e', gold3: '#b95a1e', gold4: '#6d2c15',
  teal0: '#c2fff1', teal1: '#5ff2d2', teal2: '#22b9a5', teal3: '#157275', teal4: '#0c3b47',
  blue0: '#c4ecff', blue1: '#5cbcff', blue2: '#2b76e5', blue3: '#1c4199', blue4: '#122152',
  vio0: '#f3d2ff', vio1: '#c483ff', vio2: '#8c48e6', vio3: '#532b9f', vio4: '#2b1659',
  grn0: '#dcffa6', grn1: '#93ea5c', grn2: '#40af48', grn3: '#206c3b', grn4: '#11392b',
  fire0: '#fff7cf', fire1: '#ffe066', fire2: '#ff9a1f', fire3: '#f04a24', fire4: '#8f1b2b',
  white: '#ffffff', black: '#000000',
});

// Round themes drive the background swirl and a few accent colours.
export const THEMES = [
  { name: 'back room', a: '#0f4a4a', b: '#12203f', c: '#1f6f63', accent: P.teal1 },
  { name: 'velvet', a: '#3b1a63', b: '#150f33', c: '#7a2a74', accent: P.vio1 },
  { name: 'last chance', a: '#6a1628', b: '#1a0c1e', c: '#b8452a', accent: P.red1 },
  { name: 'title', a: '#43195c', b: '#0e1230', c: '#b0305a', accent: P.gold1 },
];

const cache = new Map();
export function rgba(hex) {
  let v = cache.get(hex);
  if (v) return v;
  const h = hex.replace('#', '');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255];
  cache.set(hex, v);
  return v;
}
export function hexToVec(hex) { const [r, g, b] = rgba(hex); return [r / 255, g / 255, b / 255]; }
