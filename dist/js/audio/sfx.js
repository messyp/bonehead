// Synthesised sound design. Everything is generated at runtime; no samples needed.
export const Audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null, musicFilter: null, verb: null, verbSend: null, noiseBuf: null,
  sfxVol: 0.8, musicVol: 0.55, ready: false, onReady: [],

  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000; this.musicFilter.Q.value = 0.6;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.musicFilter); this.musicFilter.connect(this.master);
    // Shared plate-ish reverb from a decaying stereo noise impulse.
    this.verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (t < 0.01 ? t / 0.01 : 1); } }
    this.verb.buffer = ir;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.5;
    this.verb.connect(verbOut); verbOut.connect(this.master);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 1; this.verbSend.connect(this.verb);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.ready = true;
    this.onReady.forEach(f => f()); this.onReady = [];
  },

  setSfx(v) { this.sfxVol = v; if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); },
  setMusic(v) { this.musicVol = v; if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  muffle(on) { if (this.musicFilter) this.musicFilter.frequency.setTargetAtTime(on ? 650 : 18000, this.ctx.currentTime, on ? 0.08 : 0.25); },

  // ---------- primitives ----------
  tone(f, t0, dur, o = {}) {
    const ctx = this.ctx, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.glide ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    const peak = o.gain ?? 0.2, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) { const f2 = ctx.createBiquadFilter(); f2.type = o.filter; f2.frequency.value = o.ff ?? 2000; f2.Q.value = o.q ?? 0.7; if (o.fto) f2.frequency.exponentialRampToValueAtTime(o.fto, t0 + dur); osc.connect(f2); node = f2; }
    node.connect(g);
    this.route(g, o);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    return osc;
  },
  noise(t0, dur, o = {}) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = o.rate ?? 1;
    f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.ff ?? 2000, t0); f.Q.value = o.q ?? 0.8;
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t0 + (o.glide ?? dur));
    const peak = o.gain ?? 0.2, a = o.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); this.route(g, o);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
  },
  // Two-operator FM bell/keys.
  fm(f, t0, dur, o = {}) {
    const ctx = this.ctx, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * (o.ratio ?? 3.5);
    mg.gain.setValueAtTime(f * (o.index ?? 2), t0); mg.gain.exponentialRampToValueAtTime(f * 0.05 + 1, t0 + dur * 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(o.gain ?? 0.15, t0 + (o.attack ?? 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    car.connect(g); this.route(g, o);
    car.start(t0); mod.start(t0); car.stop(t0 + dur + 0.05); mod.stop(t0 + dur + 0.05);
  },
  route(node, o) {
    let out = node;
    if (o.pan) { const p = this.ctx.createStereoPanner(); p.pan.value = o.pan; node.connect(p); out = p; }
    out.connect(o.bus || this.sfxBus);
    if (o.verb) { const s = this.ctx.createGain(); s.gain.value = o.verb; out.connect(s); s.connect(this.verbSend); }
  },

  // ---------- named effects ----------
  play(name, arg = 0, arg2 = 0) {
    if (!this.ready || this.sfxVol <= 0) return;
    const fn = this.fx[name];
    if (!fn) return;
    try { fn.call(this, this.ctx.currentTime + 0.005, arg, arg2); } catch (err) { console.warn('sfx', name, err); }
  },
  fx: {
    hover(t, i) { this.tone(1700 + (i % 7) * 90, t, 0.035, { type: 'triangle', gain: 0.025 }); },
    ui(t) { this.tone(880, t, 0.05, { type: 'square', gain: 0.03, filter: 'lowpass', ff: 3000 }); this.noise(t, 0.02, { ff: 5000, gain: 0.04 }); },
    back(t) { this.tone(520, t, 0.06, { type: 'square', gain: 0.03, filter: 'lowpass', ff: 2200, to: 380 }); },
    select(t, n) {
      const f = 520 * Math.pow(2, (n % 12) / 12);
      this.tone(f, t, 0.09, { type: 'triangle', gain: 0.09 }); this.tone(f * 2, t, 0.05, { type: 'sine', gain: 0.03 });
      this.noise(t, 0.03, { ff: 3800, q: 1.2, gain: 0.08 });
    },
    deselect(t) { this.tone(420, t, 0.07, { type: 'triangle', gain: 0.07, to: 330 }); this.noise(t, 0.025, { ff: 2600, gain: 0.05 }); },
    deal(t, i) {
      this.noise(t, 0.06, { ff: 2400 + (i % 5) * 180, q: 0.9, gain: 0.16, fto: 4200, rate: 0.9 + (i % 4) * 0.05, pan: ((i % 5) - 2) * 0.12 });
      this.tone(300 + (i % 4) * 20, t + 0.01, 0.03, { type: 'triangle', gain: 0.025 });
    },
    swoosh(t) { this.noise(t, 0.18, { ff: 900, fto: 3800, q: 0.9, gain: 0.08, attack: 0.05 }); },
    land(t, p = 1) {
      this.tone(150, t, 0.14, { type: 'sine', to: 55, gain: 0.22 * p });
      this.noise(t, 0.05, { filter: 'lowpass', ff: 2200, gain: 0.22 * p });
      this.noise(t + 0.005, 0.03, { ff: 5200, q: 1.5, gain: 0.07 * p });
    },
    flip(t) { this.noise(t, 0.05, { ff: 3000, fto: 6000, gain: 0.1 }); this.tone(660, t + 0.02, 0.05, { type: 'triangle', gain: 0.03 }); },
    chip(t, i) {
      const f = 660 * Math.pow(2, Math.min(i, 18) / 12);
      this.fm(f, t, 0.22, { ratio: 2.01, index: 1.4, gain: 0.07 });
      this.tone(f * 2, t, 0.08, { type: 'square', gain: 0.018, filter: 'lowpass', ff: 5000 });
      this.noise(t, 0.02, { ff: 7000, q: 2, gain: 0.05 });
    },
    mult(t, i) {
      const f = 220 * Math.pow(2, Math.min(i, 12) / 12);
      this.tone(f, t, 0.3, { type: 'sawtooth', gain: 0.07, filter: 'lowpass', ff: 400, fto: 3000, q: 6 });
      this.tone(f * 1.5, t + 0.04, 0.25, { type: 'square', gain: 0.03, filter: 'lowpass', ff: 1800 });
      this.fm(f * 4, t + 0.02, 0.35, { ratio: 1.5, index: 3, gain: 0.04, verb: 0.3 });
    },
    total(t, big = 0) {
      [0, 4, 7, 12].forEach((n, i) => this.fm(784 * Math.pow(2, n / 12), t + i * 0.055, 0.5 + big * 0.3, { ratio: 3.01, index: 1.1, gain: 0.07, verb: 0.35 }));
      this.noise(t, 0.4, { filter: 'highpass', ff: 6000, gain: 0.05 + big * 0.04, attack: 0.01 });
    },
    tick(t, i) { this.tone(1200 + (i % 8) * 60, t, 0.025, { type: 'square', gain: 0.015, filter: 'lowpass', ff: 4000 }); },
    burn(t) {
      this.noise(t, 0.7, { ff: 300, fto: 3500, q: 0.8, gain: 0.3, attack: 0.08, glide: 0.5 });
      this.noise(t + 0.1, 1.4, { filter: 'lowpass', ff: 700, fto: 200, gain: 0.35, attack: 0.1 });
      this.tone(80, t + 0.05, 0.9, { type: 'sine', to: 30, gain: 0.4 });
      this.tone(160, t + 0.05, 0.5, { type: 'sawtooth', to: 50, gain: 0.08, filter: 'lowpass', ff: 600 });
      for (let i = 0; i < 16; i++) this.noise(t + 0.15 + Math.random() * 1.1, 0.012, { ff: 2000 + Math.random() * 4000, q: 3, gain: 0.12 + Math.random() * 0.1 });
      [0, 3, 7].forEach((n, i) => this.fm(523 * Math.pow(2, n / 12), t + 0.25 + i * 0.07, 0.6, { ratio: 2, index: 1.5, gain: 0.04, verb: 0.5 }));
    },
    slash(t) {
      this.noise(t, 0.16, { filter: 'highpass', ff: 9000, fto: 1200, gain: 0.35, glide: 0.12 });
      this.fm(2350, t + 0.02, 1.0, { ratio: 1.41, index: 2.5, gain: 0.08, verb: 0.6 });
      this.fm(3520, t + 0.02, 0.7, { ratio: 2.7, index: 1.2, gain: 0.04, verb: 0.6 });
      this.tone(90, t + 0.03, 0.6, { type: 'sine', to: 35, gain: 0.45 });
      this.noise(t + 0.03, 0.3, { filter: 'lowpass', ff: 1400, fto: 200, gain: 0.3 });
    },
    ghost(t) {
      [700, 1046, 1400, 1760].forEach((f, i) => { const o = this.tone(f, t + i * 0.07, 0.8, { type: 'sine', gain: 0.035, attack: 0.08, verb: 0.9 }); o.detune.setValueAtTime(0, t); o.detune.linearRampToValueAtTime(-40, t + 0.8); });
      this.noise(t, 0.6, { ff: 5000, q: 6, gain: 0.03, attack: 0.2, verb: 0.8 });
    },
    reset(t) {
      this.tone(180, t, 0.4, { type: 'sawtooth', to: 1400, gain: 0.05, filter: 'lowpass', ff: 800, fto: 5000, glide: 0.35 });
      this.noise(t, 0.35, { ff: 600, fto: 5000, gain: 0.08, attack: 0.25, glide: 0.35 });
      this.fm(1568, t + 0.33, 0.6, { ratio: 2, index: 2, gain: 0.06, verb: 0.6 });
    },
    undercut(t) { [988, 784, 659, 494, 392].forEach((f, i) => this.tone(f, t + i * 0.05, 0.14, { type: 'square', gain: 0.035, filter: 'lowpass', ff: 2600, verb: 0.3 })); this.tone(98, t + 0.2, 0.3, { type: 'sine', gain: 0.25, to: 60 }); },
    pickup(t) {
      [392, 370, 349, 311].forEach((f, i) => this.tone(f / 2, t + i * 0.13, 0.28, { type: 'sawtooth', gain: 0.06, filter: 'lowpass', ff: 900, fto: 250, verb: 0.2 }));
      this.tone(60, t + 0.45, 0.4, { type: 'sine', gain: 0.35, to: 40 });
    },
    bad(t) { this.tone(110, t, 0.16, { type: 'square', gain: 0.05, filter: 'lowpass', ff: 900 }); this.tone(116, t, 0.16, { type: 'square', gain: 0.05, filter: 'lowpass', ff: 900 }); this.tone(82, t + 0.1, 0.18, { type: 'square', gain: 0.04, filter: 'lowpass', ff: 700 }); },
    turn(t) { this.fm(988, t, 0.4, { ratio: 3.5, index: 1, gain: 0.04, verb: 0.4 }); this.fm(1319, t + 0.07, 0.5, { ratio: 3.5, index: 1, gain: 0.035, verb: 0.4 }); },
    blip(t, f) { this.tone(f * (0.92 + Math.random() * 0.16), t, 0.05, { type: 'square', gain: 0.025, filter: 'lowpass', ff: 2400 }); },
    win(t) {
      const n = [0, 4, 7, 12, 16, 19, 24];
      n.forEach((s, i) => { this.fm(523 * Math.pow(2, s / 12), t + i * 0.08, 0.7, { ratio: 3.01, index: 1.2, gain: 0.06, verb: 0.5 }); this.tone(523 * Math.pow(2, s / 12) / 2, t + i * 0.08, 0.2, { type: 'square', gain: 0.03, filter: 'lowpass', ff: 2000 }); });
      this.noise(t + 0.5, 1.2, { filter: 'highpass', ff: 7000, gain: 0.06, attack: 0.1 });
    },
    lose(t) { [[220, 261.6, 311], [207.6, 246.9, 293.7]].forEach((ch, j) => ch.forEach(f => this.tone(f, t + j * 0.5, 0.9, { type: 'sawtooth', gain: 0.04, filter: 'lowpass', ff: 1200, fto: 300, verb: 0.5 }))); this.tone(55, t + 0.5, 1.2, { type: 'sine', gain: 0.35 }); },
    stamp(t) { this.tone(70, t, 0.4, { type: 'sine', to: 35, gain: 0.6 }); this.noise(t, 0.12, { filter: 'lowpass', ff: 1800, gain: 0.5 }); this.noise(t, 0.3, { ff: 400, gain: 0.2 }); },
    trophy(t) { [0, 7, 12, 16, 19].forEach((n, i) => this.fm(1046 * Math.pow(2, n / 12), t + i * 0.06, 0.6, { ratio: 3.5, index: 0.8, gain: 0.05, verb: 0.6 })); },
    coin(t) { this.fm(1318, t, 0.25, { ratio: 2, index: 1.5, gain: 0.07 }); this.fm(1760, t + 0.07, 0.4, { ratio: 2, index: 1.5, gain: 0.07, verb: 0.3 }); },
    whoosh(t) { this.noise(t, 0.35, { ff: 500, fto: 2800, q: 0.7, gain: 0.1, attack: 0.12, glide: 0.3 }); },
    thud(t) { this.tone(110, t, 0.2, { type: 'sine', to: 45, gain: 0.3 }); this.noise(t, 0.05, { filter: 'lowpass', ff: 1200, gain: 0.2 }); },
    riser(t) { this.noise(t, 0.9, { ff: 400, fto: 6000, gain: 0.08, attack: 0.8, glide: 0.9 }); this.tone(200, t, 0.9, { type: 'sawtooth', to: 800, gain: 0.02, attack: 0.8, filter: 'lowpass', ff: 1200 }); },
    shuffle(t) { for (let i = 0; i < 10; i++) this.noise(t + i * 0.035, 0.04, { ff: 2600 + Math.random() * 1500, q: 1, gain: 0.08 }); },
  },
};
