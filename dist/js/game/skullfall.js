import { R } from '../core/render.js';
import { Audio } from '../audio/sfx.js';
import { buildLogo } from '../art/logo.js';

// When you're the Bonehead, the logo skull pours from the sky and piles up from the
// bottom of the screen like cereal into a bowl, then the result card lands on top.
// Plain circle physics: gravity, bounce, friction and spin, with pairwise contacts.

let art = null;
function getArt() {
  if (art) return art;
  const L = buildLogo(), s = L.skull;
  // Pivot on the cranium's centre (the sprite also carries the jaw and 3D side)
  return (art = { idle: s.spr, chomp: L.chomp.spr, ax: (s.ox + 12) / s.spr.w, ay: (s.oy + 11) / s.spr.h, radius: 12.5 });
}

export const SkullFall = {
  bodies: [], active: false, t: 0, token: -1, clacks: 0, landed: false,

  start(token, reduced = false) {
    const a = getArt(), vw = R.vw, vh = R.vh;
    const base = Math.max(12, Math.min(24, Math.min(vw, vh) / 14));
    // Enough skulls to fill about three quarters of the screen once they settle
    let n = Math.round(0.74 * vw * vh / (Math.PI * base * base / 0.8));
    if (reduced) n = Math.round(n * 0.35);
    this.bodies = Array.from({ length: n }, (_, i) => {
      const r = base * (0.8 + Math.random() * 0.45);
      return {
        r, sc: r / a.radius, x: r + Math.random() * (vw - 2 * r), y: -r - Math.random() * 60,
        vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 220, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 9,
        at: (i / n) * (reduced ? 0.6 : 1.0) + Math.random() * 0.08, live: false, chomp: Math.random() < 0.18,
      };
    });
    this.active = true; this.t = 0; this.token = token; this.landed = false;
  },

  clear() { this.active = false; this.bodies = []; },

  update(dt) {
    if (!this.active) return;
    this.t += dt; this.clacks = Math.max(0, this.clacks - dt * 18);
    const vw = R.vw, vh = R.vh, G = 1500, bs = this.bodies;
    for (const b of bs) if (!b.live && this.t >= b.at) b.live = true;
    const live = bs.filter(b => b.live), steps = 4, h = Math.min(dt, 1 / 30) / steps;
    for (let s = 0; s < steps; s++) {
      for (const b of live) {
        b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h; b.rot += b.spin * h;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.35; }
        if (b.x > vw - b.r) { b.x = vw - b.r; b.vx = -Math.abs(b.vx) * 0.35; }
        if (b.y > vh - b.r) {
          if (b.vy > 260) this.hit(b.vy, true);
          b.y = vh - b.r; b.vy = -b.vy * 0.22; b.vx *= 0.8; b.spin = b.spin * 0.6 + (b.vx / b.r) * 0.4;
        }
      }
      // Contacts: push overlapping skulls apart (heavier ones move less), then trade
      // a little bounce, friction and spin along the contact
      for (let i = 0; i < live.length; i++) {
        const A = live[i];
        for (let j = i + 1; j < live.length; j++) {
          const B = live[j], dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, over = rr - d;
          const ma = A.r * A.r, mb = B.r * B.r, wa = mb / (ma + mb), wb = ma / (ma + mb);
          A.x -= nx * over * wa; A.y -= ny * over * wa; B.x += nx * over * wb; B.y += ny * over * wb;
          const rvx = B.vx - A.vx, rvy = B.vy - A.vy, vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            if (vn < -240) this.hit(-vn, false);
            const jn = -(1 + 0.2) * vn / (1 / ma + 1 / mb);
            A.vx -= jn * nx / ma; A.vy -= jn * ny / ma; B.vx += jn * nx / mb; B.vy += jn * ny / mb;
            const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = vt * 0.12;
            A.vx += tx * jt * wa; A.vy += ty * jt * wa; B.vx -= tx * jt * wb; B.vy -= ty * jt * wb;
            A.spin += vt / A.r * 0.15; B.spin -= vt / B.r * 0.15;
          }
        }
      }
    }
    for (const b of live) { b.spin *= Math.pow(0.35, dt); if (b.y > vh - b.r * 1.5) b.vx *= Math.pow(0.4, dt); }
  },

  // Bone-on-bone clacks, rate-limited so a hundred contacts don't become noise
  hit(speed, floor) {
    if (!this.landed && floor) { this.landed = true; R.shake(0.18); Audio.play('thud'); }
    if (this.clacks > 6) return;
    this.clacks += 1;
    Audio.play('clack', Math.floor(Math.random() * 7) + (floor ? 0 : 3), Math.min(1, speed / 900));
  },

  draw() {
    if (!this.active) return;
    const a = getArt();
    for (const b of this.bodies) {
      if (!b.live) continue;
      R.spr(b.chomp ? a.chomp : a.idle, b.x, b.y, { sc: b.sc, rot: b.rot, ax: a.ax, ay: a.ay });
    }
  },
};
