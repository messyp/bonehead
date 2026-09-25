import { R } from './core/render.js';
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
const firefox = /firefox/i.test(navigator.userAgent);
R.init(firefox || !!saved.safe);
Post.init(view, !saved.safe);
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

document.addEventListener('visibilitychange', () => {
  if (!Audio.ctx) return;
  if (document.hidden) {
    Audio.ctx.suspend();
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(t => { last = t; document.body.classList.add('ready'); requestAnimationFrame(frame); });

// Handy for debugging from the console.
window.__bonehead = { Game, R, Post, Audio, Music, FX, firefox };
