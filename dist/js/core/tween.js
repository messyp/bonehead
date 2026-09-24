// Easing, springs and a game-time clock so hit-stop freezes scripted sequences too.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
export const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

export function spring(v, vel, target, k, d, dt) {
  const a = k * (target - v) - d * vel;
  vel += a * dt;
  return [v + vel * dt, vel];
}

export const Clock = {
  t: 0, speed: 1, timers: [],
  wait(sec) {
    if (sec <= 0) return Promise.resolve();
    return new Promise(res => this.timers.push({ at: this.t + sec / this.speed, res }));
  },
  update(dt) {
    this.t += dt;
    if (!this.timers.length) return;
    const due = this.timers.filter(x => x.at <= this.t);
    if (!due.length) return;
    this.timers = this.timers.filter(x => x.at > this.t);
    due.forEach(x => x.res());
  },
  clear() { this.timers.forEach(x => x.res()); this.timers = []; },
};
export const wait = s => Clock.wait(s);
