import { R, IOS } from './core/render.js';
import { Post } from './core/post.js';
import { Input } from './core/input.js';
import { FX } from './core/fx.js';
import { Clock } from './core/tween.js';
import { Cards, skullIcon } from './art/cards.js';
import { Sprites } from './art/sprites.js';
import { Audio } from './audio/sfx.js';
import { Music } from './audio/music.js';
import { Game } from './game/game.js';

const view = document.getElementById('view');
// Firefox always uses the software canvas; Safe Rendering also drops WebGL effects.
let saved = {};
try { saved = JSON.parse(localStorage.getItem('bh2-settings')) || {}; } catch { /* storage may be unavailable */ }
const firefox = /firefox/i.test(navigator.userAgent), params = new URLSearchParams(location.search);
// ?safe=1 forces Safe Rendering for this visit, handy when a device can't reach Options
const safe = !!saved.safe || params.has('safe');
R.init(firefox || safe);
Post.init(view, !safe);
Input.init(view);
Cards.init();
Sprites.init(() => skullIcon());
Game.init();

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  R.resize(window.innerWidth, window.innerHeight, dpr);
  view.width = R.W; view.height = R.H;
  Game.computeLayout();
}
window.addEventListener('resize', resize);
resize();

Input.onFirst = () => { Audio.unlock(); Music.start(); };
// iOS only lets audio start inside certain gestures, and suspends it after calls or
// switching apps, so keep nudging it on every tap until it's really running.
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
  window.addEventListener(type, () => { if (!Audio.ctx || Audio.ctx.state !== 'running') { Audio.unlock(); Music.start(); } }, { passive: true });
}

document.addEventListener('visibilitychange', () => {
  if (!Audio.ctx) return;
  if (document.hidden) {
    Audio.ctx.suspend(); Audio.silent?.pause();
    if (Game.scene === 'table' && Game.started && !Game.modal && !Game.g?.ended) Game.openModal('pause');
  } else Audio.ctx.resume();
});

// Drop render resolution if the device can't keep up.
let slow = 0, fast = 0, last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw) * (window.__timeScale ?? 1);
  last = now;
  if (raw > 0.026 && raw < 0.2) slow++; else slow = Math.max(0, slow - 2);
  if (slow > 150 && R.quality > 0.5) { R.quality = Math.max(0.5, R.quality - 0.25); slow = 0; resize(); }
  fast++;
  R.dt = dt;
  let gdt = dt;
  if (Game.hitstop > 0) { Game.hitstop -= dt; gdt = 0; }
  // One bad frame must never stop the loop (that's a black screen). If frames keep
  // failing, show the error with a reload option.
  try {
    Clock.update(gdt);
    Post.update(dt);
    FX.update(gdt);
    Game.update(gdt);
    R.begin(dt);
    Game.draw();
    view.style.cursor = Input.cursor;
    Input.cursor = 'default';
    Input.endFrame();
    Post.render(R.scene, R.S, R.t);
    failures = 0;
  } catch (err) {
    console.error(err); window.__lastErr = err?.message || String(err);
    try { R.ctx.restore(); Input.endFrame(); } catch { /* best effort */ }
    if (++failures === 30) window.__bootFail?.(err?.message || String(err));
  }
  requestAnimationFrame(frame);
}
let failures = 0;
requestAnimationFrame(t => { last = t; document.body.classList.add('ready'); requestAnimationFrame(frame); });

// ?debug=1: a small readout of renderer, audio and errors, to screenshot from a device
window.addEventListener('error', e => { window.__lastErr = e.message; });
if (params.has('debug')) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9;font:11px/1.35 ui-monospace,Menlo,monospace;color:#b8ffb0;background:rgba(0,0,0,.75);padding:6px 8px;pointer-events:none;white-space:pre-wrap;max-width:92vw';
  document.body.appendChild(d);
  let frames = 0, t0 = performance.now();
  const count = () => { frames++; requestAnimationFrame(count); }; count();
  setInterval(() => {
    const now = performance.now(), fps = Math.round(frames * 1000 / (now - t0)); frames = 0; t0 = now;
    const a = Audio.ctx, gl = Post.gl ? (Post.broken ? 'black, switched to plain' : Post.ok ? 'on' : 'lost') : 'off';
    d.textContent = [
      `WebGL ${gl}${Post.scene?.parentNode ? ' · plain scene shown' : ''}${safe ? ' · safe mode' : ''}`,
      `canvas ${R.W}x${R.H} · dpr ${R.dpr.toFixed(2)} · S ${R.S.toFixed(2)} · k ${R.k}${R.soft ? ' · soft' : ''}`,
      `fps ${fps} · quality ${R.quality}`,
      `audio ${a ? `${a.state} · ${a.sampleRate}Hz · ${(a.baseLatency * 1000 || 0).toFixed(0)}ms` : 'not started (tap)'}`,
      `iOS ${IOS} · ${navigator.userAgent}`,
      `last error: ${window.__lastErr || 'none'}`,
    ].join('\n');
  }, 500);
}

// Handy for debugging from the console.
window.__bonehead = { Game, R, Post, Audio, Music, FX, firefox };
