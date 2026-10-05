// Small helpers shared by the dev pages.
import { P } from '../js/art/palette.js';

// Game text uses ^x colour codes; turn them into coloured spans.
const CODES = { w: P.bone0, g: P.gold1, r: P.red1, b: P.blue1, t: P.teal1, v: P.vio1, d: P.ink6, k: P.ink0, o: P.fire2, p: P.red0, y: P.bone2, l: P.grn1 };
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function codeHTML(str) {
  let out = '', open = false;
  const parts = String(str).split(/(\^.)/);
  for (const part of parts) {
    if (/^\^.$/.test(part)) {
      if (open) { out += '</span>'; open = false; }
      const col = CODES[part[1]];
      if (col) { out += `<span style="color:${col}">`; open = true; }
    } else out += esc(part);
  }
  return out + (open ? '</span>' : '');
}

// Draw a sprite (a Spr from the game's pixel painter) onto a canvas at an integer scale.
export function pixCanvas(spr, k = 3, cls = 'px') {
  const c = document.createElement('canvas');
  c.width = spr.w * k; c.height = spr.h * k; c.className = cls;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(spr.c, 0, 0, c.width, c.height);
  return c;
}
