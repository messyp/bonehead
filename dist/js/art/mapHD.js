import { Spr, rng } from '../core/pixel.js';

// The Midnight Circuit, detailed: the same top-down crypt and card table as map.js,
// painted at full virtual resolution with 16-bit style texture and banded, dithered
// lighting from the table lamp, wall torches and corner candles. On trial behind
// the dev panel (MAP ART) or ?map=detailed.

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
const h2 = (x, y, s = 0) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const smooth = t => t * t * (3 - 2 * t);
function vnoise(x, y, sc, s = 0) {
  const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy), u = smooth(gx - x0), v = smooth(gy - y0);
  const a = h2(x0, y0, s), b = h2(x0 + 1, y0, s), c = h2(x0, y0 + 1, s), d = h2(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const C = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// A tiny RGB raster: base colour, a pre-light shade multiplier and whether the
// pixel takes scene lighting (flames and glows don't).
function raster(w, h) {
  const img = { w, h, rgb: new Float32Array(w * h * 3), shade: new Float32Array(w * h).fill(1), lit: new Uint8Array(w * h).fill(1) };
  img.in = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  img.set = (x, y, c, lit = 1) => {
    x = Math.floor(x); y = Math.floor(y);
    if (!img.in(x, y)) return;
    const i = y * w + x;
    img.rgb[i * 3] = c[0]; img.rgb[i * 3 + 1] = c[1]; img.rgb[i * 3 + 2] = c[2]; img.lit[i] = lit;
  };
  img.get = (x, y) => { const i = (y * w + x) * 3; return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]]; };
  img.dark = (x, y, k) => { x = Math.floor(x); y = Math.floor(y); if (img.in(x, y)) img.shade[y * w + x] *= k; };
  img.rect = (x, y, rw, rh, c, lit) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) img.set(i, j, c, lit); };
  img.ell = (cx, cy, rx, ry, fn) => {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d <= 1 && img.in(x, y)) fn(x, y, d);
    }
  };
  img.line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) img.set(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), c);
  };
  return img;
}

// ---------- props ----------
function skull(img, x, y) {
  const b0 = C('#e8dcc0'), b1 = C('#c9b995'), b2 = C('#9c8b6c'), k = C('#1a1420');
  img.ell(x, y, 4.2, 3.8, (px, py) => img.set(px, py, py < y - 1 ? b0 : py < y + 2 ? b1 : b2));
  img.rect(x - 2, y + 3, 5, 2, b2);
  img.set(x - 2, y, k); img.set(x - 1, y, k); img.set(x + 1, y, k); img.set(x + 2, y, k); img.set(x - 2, y + 1, k); img.set(x + 2, y + 1, k);
  img.set(x, y + 2, k); img.set(x - 1, y + 4, k); img.set(x + 1, y + 4, k);
  img.set(x - 2, y - 3, C('#fff6de'));
  for (let i = -4; i <= 4; i++) img.dark(x + i + 1, y + 5, 0.6);
}
function bone(img, x, y, a) {
  const c = Math.cos(a) * 5, s = Math.sin(a) * 5, b1 = C('#d8caa6'), b2 = C('#a6957a');
  img.line(x - c, y - s, x + c, y + s, b1);
  img.line(x - c, y - s + 1, x + c, y + s + 1, b2);
  for (const [ex, ey] of [[x - c, y - s], [x + c, y + s]]) { img.set(ex - 1, ey, b1); img.set(ex + 1, ey, b1); img.set(ex, ey - 1, b1); img.set(ex, ey + 1, b2); }
}
function chips(img, x, y, n, col) {
  const c = C(col), edge = C('#f1e5ca');
  for (let k = 0; k < n; k++) {
    const yy = y - k * 2;
    img.ell(x, yy + 1, 5, 2.6, (px, py) => img.set(px, py, mul(c, 0.55)));
    img.ell(x, yy, 5, 2.6, (px, py) => img.set(px, py, (px + k) % 3 === 0 ? edge : c));
  }
  const top = y - (n - 1) * 2;
  img.ell(x, top, 5, 2.6, (px, py) => img.set(px, py, mul(c, 1.15)));
  img.ell(x, top, 2.6, 1.3, (px, py) => img.set(px, py, edge));
  img.ell(x + 2, y + 3, 6, 2.5, (px, py) => img.dark(px, py, 0.6));
}
function glass(img, x, y) {
  img.ell(x + 2, y + 3, 5, 3, (px, py) => img.dark(px, py, 0.6));
  img.ell(x, y, 4.5, 4.5, (px, py, d) => img.set(px, py, d > 0.8 ? C('#c9d6e0') : d > 0.55 ? C('#b8742c') : C('#d88f3a')));
  img.set(x - 2, y - 2, C('#ffffff')); img.set(x - 1, y - 2, C('#ffffff'));
}
function barrel(img, x, y, r) {
  img.ell(x + 3, y + 4, r + 1, r * 0.9, (px, py) => img.dark(px, py, 0.5));
  img.ell(x, y, r, r, (px, py, d) => {
    const a = Math.atan2(py - y, px - x), stave = Math.floor((a + Math.PI) / (Math.PI * 2) * 14);
    let c = stave % 2 ? C('#6a4127') : C('#5c3822');
    if (d > 0.86) c = C('#3a3440');
    else if (Math.abs(d - 0.55) < 0.07) c = C('#4a4454');
    else if (d < 0.5) c = (px + py) % 5 ? C('#7a4d2e') : C('#6a4127');
    if (py < y - r * 0.4 && d > 0.86) c = C('#6c6478');
    img.set(px, py, c);
  });
}
function crate(img, x, y, s) {
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) img.dark(x + i + 3, y + j + 4, 0.55);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const edge = i < 2 || j < 2 || i >= s - 2 || j >= s - 2, diag = Math.abs(i - j) < 2 || Math.abs(i - (s - 1 - j)) < 2;
    let c = (Math.floor(j / 4) % 2) ? C('#7a5232') : C('#6e482b');
    if (j % 4 === 3) c = C('#4a2e1b');
    if (edge || diag) c = C('#8a5f3a');
    if (i === 0 || j === 0) c = C('#a07046');
    if (i === s - 1 || j === s - 1) c = C('#3a2414');
    img.set(x + i, y + j, c);
  }
  for (const [i, j] of [[2, 2], [s - 3, 2], [2, s - 3], [s - 3, s - 3]]) img.set(x + i, y + j, C('#cfc2a8'));
}
function candle(img, x, y, hgt) {
  img.rect(x - 1, y - hgt, 3, hgt, C('#efe3c4'));
  img.set(x + 1, y - hgt, C('#cdbd98'));
  for (let j = 0; j < hgt; j++) img.set(x + 1, y - j, C('#cdbd98'));
  img.set(x, y - hgt - 1, C('#2a2020'));
  img.ell(x, y + 1, 3, 1.5, (px, py) => img.set(px, py, C('#e2d4b2')));
}
function floorCard(img, x, y, red) {
  for (let j = 0; j < 9; j++) for (let i = 0; i < 7; i++) img.dark(x + i + 1, y + j + 1, 0.6);
  img.rect(x, y, 7, 9, C('#e6dcc4'));
  img.rect(x, y + 8, 7, 1, C('#b8ab8e'));
  img.set(x + 3, y + 3, red ? C('#b3263f') : C('#2a2436')); img.set(x + 3, y + 4, red ? C('#b3263f') : C('#2a2436'));
  img.set(x + 1, y + 1, red ? C('#b3263f') : C('#2a2436'));
}

export function mapRoomHD(w, h, land) {
  const img = raster(w, h), r = rng(7171);
  const T = Math.round(h * (land ? 0.16 : 0.1)), B = Math.round(h * 0.06), S = Math.round(w * (land ? 0.06 : 0.08));
  const inner = h - T - B;
  // Same table as the classic map (a touch higher, leaving room for GO below)
  const cx = w / 2, cy = T + inner * (land ? 0.47 : 0.47);
  const rx = land ? w * 0.29 : w * 0.34, ry = land ? inner * 0.31 : inner * 0.3;

  // ---- floor: flagstones with bevels, grain, cracks and moss in the joints
  const tones = ['#3d3338', '#372e33', '#43383d', '#342b30', '#3f3539'].map(C);
  const mortar = C('#120e17'), moss = [C('#2c3a2b'), C('#3b4d35')];
  let y = T - 6;
  while (y < h) {
    const rh = 22 + Math.floor(r() * 8);
    let x = -Math.floor(r() * 24);
    while (x < w) {
      const cw = 22 + Math.floor(r() * 12), base = tones[Math.floor(r() * tones.length)], seed = Math.floor(r() * 1000);
      for (let j = 0; j < rh; j++) for (let i = 0; i < cw; i++) {
        const px = x + i, py = y + j;
        if (!img.in(px, py)) continue;
        const corner = (i === 0 || i === cw - 1) && (j === 0 || j === rh - 1);
        if (i === cw - 1 || j === rh - 1 || corner) {
          img.set(px, py, vnoise(px, py, 7, 3) > 0.68 ? moss[h2(px, py) < 0.5 ? 0 : 1] : mortar);
          continue;
        }
        const n = vnoise(px, py, 5, seed) * 0.65 + h2(px, py, 9) * 0.35;
        let k = n < 0.33 ? 0.86 : n > 0.74 ? 1.1 : 1;
        if (j === 0 || i === 0) k = 1.28;
        else if (j === rh - 2 || i === cw - 2) k = 0.72;
        // Worn, slightly lighter centres
        const cxs = Math.abs(i / cw - 0.5) + Math.abs(j / rh - 0.5);
        if (cxs < 0.25 && h2(px, py, 4) < 0.3) k *= 1.06;
        img.set(px, py, mul(base, k));
      }
      if (r() < 0.22) {
        let px = x + 4 + Math.floor(r() * (cw - 8)), py = y + 3;
        const len = 5 + Math.floor(r() * 9);
        for (let k = 0; k < len; k++) { img.set(px, py, C('#16121c')); img.set(px + 1, py, mul(base, 1.2)); px += Math.round(r() * 2 - 1); py++; }
      }
      x += cw;
    }
    y += rh;
  }
  // Blood and wax stains
  for (let i = 0; i < 6; i++) {
    const sx = S + 10 + r() * (w - S * 2 - 20), sy = T + 10 + r() * (inner - 20), rr = 3 + r() * 5, col = r() < 0.5 ? C('#4e1a24') : C('#5a2029');
    img.ell(sx, sy, rr, rr * 0.8, (px, py) => { if (h2(px, py, 21) < 0.75) img.set(px, py, col); });
    for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = rr + 1 + r() * 4; img.set(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, col); }
  }

  // ---- rug under the table: deep red, gold diamond border, tasselled ends
  const rw = Math.round(rx * 1.1 + 8), rh = Math.round(ry * 1.2 + 6), rx0 = Math.round(cx - rw), ry0 = Math.round(cy - rh);
  for (let j = 0; j < rh * 2; j++) for (let i = 0; i < rw * 2; i++) {
    const px = rx0 + i, py = ry0 + j, e = Math.min(i, j, rw * 2 - 1 - i, rh * 2 - 1 - j);
    let c;
    if (e < 2) c = C('#2a0a16');
    else if (e < 9) {
      const along = (e === j || e === rh * 2 - 1 - j) ? i : j, m = (along + 4) % 10, band = Math.abs(e - 5.5);
      c = Math.abs(m - 5) + band < 3.5 ? C('#c98f36') : C('#3e0f1e');
      if (Math.abs(m - 5) + band < 1.5) c = C('#f0c060');
    } else if (e === 9) c = C('#d9a444');
    else if (e === 10) c = C('#2a0a16');
    else {
      const mx = (i + 3) % 12, my = (j + 3) % 12, motif = Math.abs(mx - 6) + Math.abs(my - 6);
      c = motif === 4 ? C('#8e2438') : motif < 2 ? C('#b8862f') : h2(px, py, 5) < 0.12 ? C('#5e1628') : C('#6c1a2f');
    }
    img.set(px, py, c);
  }
  for (let j = 2; j < rh * 2 - 2; j += 2) for (const side of [-1, 1]) {
    const ex = side < 0 ? rx0 - 1 : rx0 + rw * 2;
    for (let k = 0; k < 4; k++) img.set(ex + side * k, ry0 + j, k === 3 ? C('#b8a882') : C('#e0d2ae'));
  }

  // ---- table: soft shadow, grained rim with brass studs, textured felt
  img.ell(cx + 7, cy + 11, rx + 12, ry + 12, (px, py, d) => { if (d < 0.9 || dith(px, py) < (1 - d) * 10) img.dark(px, py, 0.42); });
  const R1 = [rx + 9, ry + 9], R0 = [rx + 1, ry + 1];
  img.ell(cx, cy, R1[0], R1[1], (px, py, d) => {
    const din = Math.hypot((px + 0.5 - cx) / R0[0], (py + 0.5 - cy) / R0[1]);
    if (din <= 1) return;
    const a = Math.atan2((py - cy) / ry, (px - cx) / rx), g = Math.sin(a * 70 + vnoise(px, py, 4, 8) * 9);
    let c = g > 0.45 ? C('#7a4628') : g < -0.5 ? C('#5a321c') : C('#6a3c22');
    const top = (py - cy) / (ry + 9);
    c = mul(c, 1.18 - (top + 1) * 0.28);
    if (d > 0.965) c = C('#2a160c');
    else if (d > 0.9 && py < cy) c = mul(c, 1.25);
    img.set(px, py, c);
  });
  // Studs every ~14px round the rim
  const per = Math.PI * (3 * (rx + ry + 10) - Math.sqrt((3 * (rx + 5) + ry + 5) * (rx + 5 + 3 * (ry + 5))));
  const nStud = Math.round(per / 15);
  for (let k = 0; k < nStud; k++) {
    const a = k / nStud * Math.PI * 2, sx = Math.round(cx + Math.cos(a) * (rx + 5)), sy = Math.round(cy + Math.sin(a) * (ry + 5));
    img.set(sx, sy, C('#e0ae4c')); img.set(sx - 1, sy, C('#b9832e')); img.set(sx + 1, sy, C('#8a5a22'));
    img.set(sx, sy - 1, C('#fff0a8')); img.set(sx, sy + 1, C('#6d4318'));
  }
  // Inner lip, then felt
  img.ell(cx, cy, R0[0], R0[1], (px, py) => img.set(px, py, C('#24130b')));
  const inFelt = (px, py) => Math.hypot((px + 0.5 - cx) / rx, (py + 0.5 - cy) / ry) <= 1;
  const inStripe = (px, py) => Math.hypot((px + 0.5 - cx) / (rx - 8), (py + 0.5 - cy) / (ry - 8)) <= 1;
  img.ell(cx, cy, rx, ry, (px, py, d) => {
    const n = h2(px, py, 13);
    let c = n > 0.86 ? C('#23694a') : n < 0.1 ? C('#185038') : C('#1d5c40');
    if (((px + py) % 10 === 0 || (px - py + 1000) % 10 === 0) && n < 0.45) c = C('#206345');
    // A 1px gold pinstripe
    if (inStripe(px, py) && (!inStripe(px + 1, py) || !inStripe(px - 1, py) || !inStripe(px, py + 1) || !inStripe(px, py - 1))) c = C('#b8923e');
    img.set(px, py, c);
    // Rim shadow along the felt's top edge
    const edge = [1, 2, 3, 4].findIndex(k => !inFelt(px, py - k));
    if (edge >= 0 && dith(px, py) < 0.9 - edge * 0.2) img.dark(px, py, 0.7);
    else if (d > 0.93 && dith(px, py) < 0.5) img.dark(px, py, 0.82);
  });
  // Table dressing, kept clear of the four cards
  if (land) {
    chips(img, cx - rx * 0.3, cy - ry * 0.74, 4, '#c42a45'); chips(img, cx - rx * 0.19, cy - ry * 0.8, 2, '#2b76e5');
    chips(img, cx + rx * 0.34, cy + ry * 0.76, 5, '#f59e2e'); chips(img, cx + rx * 0.46, cy + ry * 0.7, 3, '#40af48');
    glass(img, cx + rx * 0.83, cy - ry * 0.36);
    skull(img, cx - rx * 0.86, cy + ry * 0.28);
  } else {
    chips(img, cx - rx * 0.64, cy - ry * 0.1, 4, '#c42a45'); chips(img, cx + rx * 0.66, cy + ry * 0.1, 5, '#f59e2e');
    glass(img, cx + rx * 0.62, cy - ry * 0.55);
    skull(img, cx - rx * 0.6, cy + ry * 0.58);
  }

  // ---- walls in perspective: the top wall faces us, the sides lean in
  const wallAt = (px, py) => {
    const dt = py / T, db = (h - 1 - py) / B, dl = px / S, dr = (w - 1 - px) / S, m = Math.min(dt, db, dl, dr);
    return m >= 1 ? null : m === dt ? 't' : m === db ? 'b' : m === dl ? 'l' : 'r';
  };
  const brickCol = [C('#4d4459'), C('#463e52'), C('#52485f'), C('#433b4e')];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const side = wallAt(px, py);
    if (!side) continue;
    const vert = side === 'l' || side === 'r';
    // Courses run along each wall; bricks 13 long, 6 high
    const u = vert ? py : px, v = vert ? (side === 'l' ? px : w - 1 - px) : (side === 't' ? py : h - 1 - py);
    const row = Math.floor(v / 6), off = row % 2 ? 6 : 0, bi = Math.floor((u + off) / 13);
    const mor = v % 6 === 5 || (u + off) % 13 === 0;
    let c = mor ? C('#1b1622') : brickCol[(bi * 7 + row * 3) % 4];
    if (!mor && v % 6 === 0) c = mul(c, 1.2);
    if (!mor && v % 6 === 4) c = mul(c, 0.8);
    if (!mor && h2(px, py, 31) < 0.08) c = mul(c, 0.85);
    const face = side === 't' ? 1 : side === 'b' ? 0.62 : 0.78;
    img.set(px, py, mul(c, face));
  }
  // Corner seams and the lit ledge where each wall meets the floor
  for (let k = 0; k < Math.max(T, S); k++) {
    const f = k / Math.max(T, S);
    img.set(Math.round(S * f), Math.round(T * f), C('#15111b')); img.set(Math.round(w - 1 - S * f), Math.round(T * f), C('#15111b'));
    img.set(Math.round(S * f), Math.round(h - 1 - B * f), C('#15111b')); img.set(Math.round(w - 1 - S * f), Math.round(h - 1 - B * f), C('#15111b'));
  }
  for (let px = S; px < w - S; px++) { img.set(px, T - 1, C('#7a6e8c')); img.set(px, T - 2, C('#5f5470')); img.set(px, h - B, C('#6a5f7a')); }
  for (let py = T; py < h - B; py++) { img.set(S - 1, py, C('#6a5f7a')); img.set(w - S, py, C('#3a3346')); }
  // Walls cast a soft shadow onto the floor
  for (let py = T; py < h - B; py++) for (let px = S; px < w - S; px++) {
    const d = Math.min((py - T) / 12, (px - S) / 8, (w - S - 1 - px) / 8);
    if (d < 1 && dith(px, py) > d) img.dark(px, py, 0.55);
  }
  // Arched, barred doorway in the top wall with a red glow beyond
  const dx = Math.round(w / 2), dw = Math.max(10, Math.round(w * 0.045)), dtop = Math.round(T * 0.18);
  for (let py = dtop - 3; py < T; py++) for (let px = dx - dw - 3; px <= dx + dw + 3; px++) {
    const archY = dtop + dw * 0.7 - Math.sqrt(Math.max(0, 1 - ((px - dx) / (dw + 3)) ** 2)) * dw * 0.7;
    if (py < archY) continue;
    const inner2 = px > dx - dw && px < dx + dw && py >= dtop + dw * 0.7 - Math.sqrt(Math.max(0, 1 - ((px - dx) / dw) ** 2)) * dw * 0.7;
    if (!inner2) { img.set(px, py, (px + py) % 4 ? C('#5d5070') : C('#4a3f5a')); continue; }
    const glow = 1 - (T - py) / (T - dtop);
    img.set(px, py, [40 + glow * 90, 8 + glow * 12, 16 + glow * 20], 0);
    if ((px - dx + 100) % 4 === 0) img.set(px, py, (py % 7 === 0) ? C('#7a7088') : C('#2e2836'));
  }
  // Torches (flames drawn live by the screen) and hanging banners
  const torches = (land ? [w * 0.1, w * 0.9] : [w * 0.2, w * 0.8]).map(x => ({ x: Math.round(x), y: Math.round(T * 0.45) }));
  for (const t of torches) {
    img.rect(t.x - 3, t.y + 4, 7, 2, C('#2e2836')); img.rect(t.x - 1, t.y + 1, 3, 9, C('#5a3a22'));
    img.set(t.x - 1, t.y + 1, C('#7a5232')); img.rect(t.x - 2, t.y, 5, 2, C('#3a3346'));
    for (let k = 0; k < 6; k++) img.set(t.x - 3 + k, t.y + 6, C('#1b1622'));
  }
  if (land) for (const bx of [w * 0.19, w * 0.81]) {
    const x0 = Math.round(bx - 6), bh = Math.round(T * 0.72), y0 = Math.round(T * 0.08);
    for (let j = 0; j < bh; j++) for (let i = 0; i < 13; i++) {
      const tip = j > bh - 6 && Math.abs(i - 6) < j - (bh - 6);
      if (tip) continue;
      let c = i % 4 === 0 ? C('#5e1426') : C('#7a1c32');
      if (i === 0 || i === 12) c = C('#c9973e');
      img.set(x0 + i, y0 + j, c);
      img.dark(x0 + i + 2, y0 + j + 2, 0.7);
    }
    img.rect(x0 - 1, y0 - 1, 15, 2, C('#3a3346'));
    // A little gold skull on each banner
    const sx = x0 + 6, sy = y0 + Math.round(bh * 0.45);
    img.ell(sx + 0.5, sy, 3, 2.6, (px, py) => img.set(px, py, C('#e0b050')));
    img.set(sx - 1, sy, C('#5e1426')); img.set(sx + 1, sy, C('#5e1426')); img.rect(sx - 1, sy + 2, 3, 2, C('#e0b050'));
  }
  // Hanging chains on the side walls
  for (const cxw of [Math.round(S * 0.5), Math.round(w - S * 0.5)]) for (let k = 0; k < 9; k++) {
    const py = T + 8 + k * 3;
    img.set(cxw, py, C('#8a8098')); img.set(cxw, py + 1, C('#4a4254'));
  }
  // Cobwebs in the upper corners
  for (const [ox, dir] of [[S, 1], [w - S - 1, -1]]) for (let k = 0; k < 5; k++) {
    img.line(ox, T, ox + dir * (8 + k * 4), T + (16 - k * 3), C('#7c7290'));
    img.line(ox + dir * (3 + k * 3), T, ox, T + 4 + k * 3, C('#5a5068'));
  }

  // ---- floor props away from the table: barrels, a crate, bones, skulls, cards
  const clear = (px, py, pad = 10) => Math.hypot((px - cx) / (rw + pad), (py - cy) / (rh + pad)) > 1.05 && Math.abs(px - cx) > rw * 0.1;
  const fx0 = S + 12, fx1 = w - S - 12, fy0 = T + 12, fy1 = h - B - 10;
  barrel(img, fx0 + 10, fy1 - 16, 8); barrel(img, fx0 + 26, fy1 - 10, 7);
  crate(img, fx1 - 22, fy0 + 20, 16); barrel(img, fx1 - 12, fy0 + 48, 7);
  for (let i = 0; i < 44; i++) {
    const px = fx0 + r() * (fx1 - fx0), py = fy0 + r() * (fy1 - fy0);
    if (!clear(px, py)) continue;
    const k = r();
    if (k < 0.16) skull(img, Math.round(px), Math.round(py));
    else if (k < 0.55) bone(img, Math.round(px), Math.round(py), r() * Math.PI);
    else if (k < 0.72) floorCard(img, Math.round(px), Math.round(py), r() < 0.5);
  }
  // Candle clusters in the four inner corners
  const candles = [];
  for (const [ax, ay] of [[fx0 + 4, fy0 + 6], [fx1 - 6, fy0 + 60], [fx0 + 44, fy1 - 4], [fx1 - 8, fy1 - 6]]) {
    const set = [[0, 0, 9], [5, 2, 6], [-4, 3, 5]];
    for (const [ox, oy, hh] of set) { candle(img, ax + ox, ay + oy, hh); candles.push({ x: ax + ox, y: ay + oy - hh - 2 }); }
    img.ell(ax, ay + 3, 8, 3, (px, py) => { if (h2(px, py, 44) < 0.5) img.set(px, py, C('#d9cba6')); });
  }

  // ---- lighting: lamp over the table, torches, candles, the door's red glow.
  // Banded in fifths with ordered dithering between bands, like a 16-bit scene.
  const lights = [
    { x: cx, y: cy - ry * 0.15, rx: rx * 1.9, ry: ry * 2.4, c: [1.0, 0.86, 0.66] },
    ...torches.map(t => ({ x: t.x, y: t.y + 14, rx: 90, ry: 70, c: [0.95, 0.58, 0.3] })),
    ...[[fx0 + 4, fy0 + 6], [fx1 - 6, fy0 + 60], [fx0 + 44, fy1 - 4], [fx1 - 8, fy1 - 6]].map(([x, y]) => ({ x, y, rx: 56, ry: 48, c: [0.9, 0.58, 0.32] })),
    { x: dx, y: T, rx: 42, ry: 30, c: [0.8, 0.12, 0.2] },
  ];
  const amb = [0.42, 0.39, 0.54];
  const px2 = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = py * w + px, base = [img.rgb[i * 3], img.rgb[i * 3 + 1], img.rgb[i * 3 + 2]];
    let out = base;
    if (img.lit[i]) {
      const L = [...amb];
      for (const l of lights) {
        const d = Math.hypot((px - l.x) / l.rx, (py - l.y) / l.ry);
        if (d >= 1) continue;
        const f = (1 - d) * (1 - d);
        L[0] += l.c[0] * f; L[1] += l.c[1] * f; L[2] += l.c[2] * f;
      }
      const edge = Math.hypot((px - w / 2) / (w / 2), (py - h / 2) / (h / 2));
      const vig = edge > 0.8 ? Math.max(0.35, 1 - (edge - 0.8) * 1.6) : 1, dd = dith(px, py);
      const q = v => Math.floor(v * vig * 5 + dd) / 5;
      const s = img.shade[i];
      out = [base[0] * q(L[0]) * s, base[1] * q(L[1]) * s, base[2] * q(L[2]) * s];
    }
    px2[i * 4] = out[0]; px2[i * 4 + 1] = out[1]; px2[i * 4 + 2] = out[2]; px2[i * 4 + 3] = 255;
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(new ImageData(px2, w, h), 0, 0);
  return { spr: new Spr(cv), candles, torches, table: { cx, cy, rx, ry } };
}
