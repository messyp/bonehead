import { Pix } from '../core/pixel.js';
import { P } from './palette.js';

// The crown shown with the circuit's progress. (The room itself is in mapHD.js.)
export function crownIcon() {
  const p = new Pix(11, 8);
  p.poly([[0, 7], [0, 1], [3, 4], [5.5, 0], [8, 4], [11, 1], [11, 7]], P.gold1);
  p.hline(0, 10, 6, P.gold2);
  p.set(5, 5, P.red1);
  p.outline(P.ink0);
  return p;
}
