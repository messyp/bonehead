import { Audio } from './sfx.js';

// Generative lo-fi casino jazz. Layers fade in with game intensity:
// 0 title (keys + pad), 1 table (+ bass, brushes), 2 pressure (+ hats, chip lead).
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [
  { root: 45, v: [60, 64, 67, 71] },  // Am9
  { root: 38, v: [53, 57, 60, 64] },  // Dm9
  { root: 43, v: [53, 57, 59, 64] },  // G13
  { root: 48, v: [55, 59, 62, 64] },  // Cmaj9
  { root: 41, v: [52, 57, 60, 64] },  // Fmaj7
  { root: 47, v: [57, 60, 62, 65] },  // Bm7b5
  { root: 40, v: [56, 59, 62, 65] },  // E7b9
  { root: 45, v: [55, 60, 64, 67] },  // Am7 (turnaround voicing)
];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
const COMP = [[0, 3.2, 0.9], [6, 1.2, 0.6], [10, 1.6, 0.7], [14, 0.8, 0.45]];
const COMP_B = [[0, 1.5, 0.8], [3, 1, 0.5], [8, 2.5, 0.75], [13, 1, 0.5]];

export const Music = {
  on: false, bpm: 84, step: 0, next: 0, timer: null, level: 0, want: 0, key: 0, wantKey: 0,
  bus: null, keys: null, wob: null, crackle: null, layers: {}, seed: 7, motif: [],

  start() {
    if (!Audio.ready) { Audio.onReady.push(() => this.start()); return; }
    if (this.on) return;
    const ctx = Audio.ctx;
    this.on = true;
    if (!this.bus) this.build(ctx);
    this.next = ctx.currentTime + 0.1; this.step = 0;
    this.makeMotif();
    this.timer = setInterval(() => this.schedule(), 30);
  },
  stop() { this.on = false; clearInterval(this.timer); this.timer = null; },

  build(ctx) {
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9; this.bus.connect(Audio.musicBus);
    const mk = (g, to = this.bus) => { const n = ctx.createGain(); n.gain.value = g; n.connect(to); return n; };
    // Warm, slightly dark keys with a lazy stereo tremolo.
    const keysLp = ctx.createBiquadFilter(); keysLp.type = 'lowpass'; keysLp.frequency.value = 2600; keysLp.connect(this.bus);
    const trem = ctx.createStereoPanner(); trem.connect(keysLp);
    const tl = ctx.createOscillator(), tg = ctx.createGain(); tl.frequency.value = 0.18; tg.gain.value = 0.35; tl.connect(tg); tg.connect(trem.pan); tl.start();
    this.layers.keys = ctx.createGain(); this.layers.keys.gain.value = 0.9; this.layers.keys.connect(trem);
    const kv = ctx.createGain(); kv.gain.value = 0.35; this.layers.keys.connect(kv); kv.connect(Audio.verbSend);
    this.layers.bass = mk(0);
    this.layers.drums = mk(0);
    this.layers.hats = mk(0);
    this.layers.lead = mk(0);
    this.layers.pad = mk(0.0);
    const lv = ctx.createGain(); lv.gain.value = 0.5; this.layers.lead.connect(lv); lv.connect(Audio.verbSend);
    const pv = ctx.createGain(); pv.gain.value = 0.8; this.layers.pad.connect(pv); pv.connect(Audio.verbSend);
    // Ping-pong-ish delay on the lead.
    const d = ctx.createDelay(1); d.delayTime.value = 60 / this.bpm * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2000;
    this.layers.lead.connect(d); d.connect(dl); dl.connect(fb); fb.connect(d); const dp = ctx.createStereoPanner(); dp.pan.value = 0.5; dl.connect(dp); dp.connect(this.bus);
    // Tape wobble shared by all tonal voices (in cents).
    const w = ctx.createOscillator(), wg = ctx.createGain(); w.frequency.value = 0.35; wg.gain.value = 7; w.connect(wg); w.start(); this.wob = wg;
    // Vinyl crackle bed.
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.35 : 0);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 2500; cf.Q.value = 0.4;
    this.crackle = ctx.createGain(); this.crackle.gain.value = 0.09;
    src.connect(cf); cf.connect(this.crackle); this.crackle.connect(this.bus); src.start();
  },

  // level: 0 title, 1 table, 2 pressure. key: semitone offset per opponent.
  set(level, key = this.wantKey) { this.want = level; this.wantKey = key; },

  makeMotif() {
    let s = this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    // Two-bar call-and-response phrase on a pentatonic walk.
    let idx = 4;
    this.motif = [];
    for (let st = 0; st < 32; st++) {
      const onBeat = st % 4 === 0, rest = st >= 12 && st < 16 || st >= 28;
      if (!rest && r() < (onBeat ? 0.62 : 0.3)) {
        idx = Math.max(0, Math.min(PENTA.length - 1, idx + Math.round((r() - 0.5) * 4)));
        this.motif.push({ st, n: PENTA[idx], len: r() < 0.3 ? 3 : 1 });
      }
    }
  },

  schedule() {
    const ctx = Audio.ctx, s16 = 60 / this.bpm / 4;
    while (this.next < ctx.currentTime + 0.14) {
      const bar = Math.floor(this.step / 16), st = this.step % 16;
      if (st === 0) this.onBar(bar);
      const swing = st % 2 === 1 ? s16 * 0.28 : 0;
      this.play(bar, st, this.next + swing, s16);
      this.next += s16; this.step++;
    }
  },

  onBar(bar) {
    const ctx = Audio.ctx, t = ctx.currentTime, lv = this.want;
    if (bar % 2 === 0 && this.key !== this.wantKey) this.key = this.wantKey;
    this.level = lv;
    const g = (node, v) => node.gain.setTargetAtTime(v, t, 0.6);
    g(this.layers.pad, lv === 0 ? 0.55 : 0.12);
    g(this.layers.bass, lv >= 1 ? 0.85 : 0);
    g(this.layers.drums, lv >= 1 ? 0.8 : 0);
    g(this.layers.hats, lv >= 2 ? 0.9 : lv === 1 ? 0.35 : 0);
    g(this.layers.lead, lv >= 2 ? 0.55 : lv === 0 ? 0.22 : 0);
    if (bar % 8 === 0 && bar > 0) this.makeMotif();
  },

  play(bar, st, t, s16) {
    const ch = PROG[bar % 8], nextCh = PROG[(bar + 1) % 8], k = this.key, lv = this.level;
    // Keys: rootless voicings, strummed.
    const comp = bar % 4 === 3 ? COMP_B : COMP;
    for (const [at, len, vel] of comp) if (at === st) {
      const lift = bar % 8 >= 4 && at === 0 ? 12 : 0;
      ch.v.forEach((n, i) => this.ep(mtof(n + k + (i === 3 ? lift : 0)), t + i * 0.012, len * s16 * 4, vel * (0.85 + Math.random() * 0.2)));
    }
    // Pad swells on each bar (title layer).
    if (st === 0) ch.v.slice(0, 3).forEach(n => this.pad(mtof(n + k - 12), t, s16 * 16));
    // Walking bass.
    if (lv >= 1) {
      const root = ch.root + k, fifth = root + 7, approach = nextCh.root + k + (Math.random() < 0.5 ? -1 : 1);
      if (st === 0) this.bass(mtof(root), t, s16 * 5);
      if (st === 6) this.bass(mtof(Math.random() < 0.5 ? fifth : root + 12), t, s16 * 2);
      if (st === 8) this.bass(mtof(root + (Math.random() < 0.5 ? 3 : 7)), t, s16 * 4);
      if (st === 14) this.bass(mtof(approach), t, s16 * 2);
    }
    // Drums: soft kick, brushed snare, swung hats.
    if (lv >= 1) {
      if (st === 0 || st === 10 || (st === 7 && bar % 2)) this.kick(t, st === 0 ? 1 : 0.7);
      if (st === 4 || st === 12) this.snare(t);
      if (st % 2 === 0) this.hat(t, st % 4 === 0 ? 0.6 : 1, false);
      if (lv >= 2 && st % 2 === 1) this.hat(t, 0.5, false);
      if (st === 14 && bar % 4 === 3) this.hat(t, 1, true);
    }
    // Lead motif.
    const m = this.motif.find(x => x.st === (bar % 2) * 16 + st);
    if (m && (lv >= 2 || (lv === 0 && bar % 4 >= 2))) this.lead(mtof(m.n + k + (lv === 0 ? 0 : 12)), t, s16 * m.len * 1.6);
  },

  // ---------- voices ----------
  ep(f, t, dur, vel) {
    const ctx = Audio.ctx, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 1.6 * vel, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    this.wob.connect(car.detune); this.wob.connect(mod.detune);
    // A little tine: high-ratio FM blip at the attack.
    const tine = ctx.createOscillator(), tg = ctx.createGain(); tine.frequency.value = f * 4; tg.gain.setValueAtTime(0.012 * vel, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); tine.connect(tg); tg.connect(this.layers.keys);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.022 * vel, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    car.connect(g); g.connect(this.layers.keys);
    const end = t + dur + 0.4;
    car.start(t); mod.start(t); tine.start(t); car.stop(end); mod.stop(end); tine.stop(t + 0.15);
    car.onended = () => { try { this.wob.disconnect(car.detune); this.wob.disconnect(mod.detune); } catch { /* already gone */ } };
  },
  pad(f, t, dur) {
    const ctx = Audio.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.02, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    lp.connect(g); g.connect(this.layers.pad);
    for (const d of [-9, 0, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; this.wob.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur * 1.1);
      o.onended = () => { try { this.wob.disconnect(o.detune); } catch { /* already gone */ } };
    }
  },
  bass(f, t, dur) {
    const ctx = Audio.ctx, o = ctx.createOscillator(), s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; s.type = 'sine'; s.frequency.value = f / 2;
    this.wob.connect(o.detune);
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + 0.25); lp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.09, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    const sg = ctx.createGain(); sg.gain.value = 0.5;
    o.connect(lp); s.connect(sg); sg.connect(lp); lp.connect(g); g.connect(this.layers.bass);
    o.start(t); s.start(t); o.stop(t + dur + 0.15); s.stop(t + dur + 0.15);
    o.onended = () => { try { this.wob.disconnect(o.detune); } catch { /* already gone */ } };
  },
  kick(t, v) {
    const ctx = Audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(this.layers.drums); o.start(t); o.stop(t + 0.4);
  },
  snare(t) {
    const ctx = Audio.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = Audio.noiseBuf; f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(f); f.connect(g); g.connect(this.layers.drums); src.start(t, Math.random()); src.stop(t + 0.25);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 190;
    og.gain.setValueAtTime(0.06, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(og); og.connect(this.layers.drums); o.start(t); o.stop(t + 0.1);
  },
  hat(t, v, open) {
    const ctx = Audio.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = open ? 0.28 : 0.045;
    src.buffer = Audio.noiseBuf; f.type = 'highpass'; f.frequency.value = 7200;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(this.layers.hats); src.start(t, Math.random()); src.stop(t + d + 0.02);
  },
  lead(f, t, dur) {
    const ctx = Audio.ctx, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'square'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1900;
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.2); vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + 0.01); g.gain.setValueAtTime(0.03, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(lp); lp.connect(g); g.connect(this.layers.lead);
    o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
  },
};
