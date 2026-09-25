# Bonehead

A pixel-art shedding roguelite inspired by Shithead. Beat three house opponents, claim tricks between rounds, and don't be the Bonehead.

Version 2 is a ground-up presentation rework: everything is drawn to a canvas, with modern pixel art, spring-driven card motion, shader post-processing and a synthesized soundtrack. The tested rules engine, scoring and progression from v1 are unchanged.

## Run

Serve `dist/` with any static HTTP server (ES modules need `http://`, not `file://`):

```
python3 -m http.server 8420 --directory dist
```

No build step, no dependencies, no external requests. The whole game is about 850 KB.

## Tests

```
for t in *.test.mjs; do node $t; done
```

`engine`, `scoring`, `polish`, `burn` and `progression` cover the rules (including 500 simulated full games with card conservation checks). `runs.test.mjs` covers run selection. `art.test.mjs` checks the bitmap fonts, the card silhouette and opponent dialogue coverage.

## Structure

```
dist/
  engine.js scoring.js progression.js guidance.js   rules and scoring (unchanged from v1)
  runs.js               every legal run in a hand, for any-order selection and double-tap
  js/main.js            boot, main loop, hit-stop, adaptive resolution
  js/core/render.js     virtual-pixel renderer, sprite upscaling, bitmap text, panels
  js/core/post.js       WebGL2 pass: dithered swirl background, CRT, bloom, aberration
  js/core/fx.js         particles, pops, banners, pixel dissolve, card slicing, slash
  js/core/font.js       hand-drawn 5x7 proportional font and 3x5 tiny font
  js/core/pixel.js      pixel painter used to generate every sprite
  js/art/cards.js       card faces, skeleton court cards, magic cards, back, foil
  js/art/sprites.js     opponents (animated), title mascot, icons, dialogue
  js/audio/sfx.js       synthesized sound effects and mix bus
  js/audio/music.js     generative lo-fi soundtrack with intensity layers
  js/game/game.js       table layout, card physics, turn flow, scoring, AI
  js/game/screens.js    title, tutorial, options, trophies, reward and result screens
  js/game/ui.js         pixel buttons, sliders, toggles, tooltips, modals
```

All art is generated in code at startup from the palette in `js/art/palette.js`. There are no image files apart from the favicon.

## Rendering

The game lays out in virtual pixels (a 480×300 minimum in landscape, 250×440 in portrait) and scales to the device. Sprites are upscaled by an integer factor and then drawn with smoothing, so pixels stay crisp at any zoom while cards still move and rotate smoothly. The 2D scene is composited in WebGL over a pixelated, dithered paint-swirl background that changes palette per opponent, with optional CRT scanlines, bloom and impact aberration. Without WebGL2 it falls back to a plain 2D gradient.

If frames run slow for a few seconds, the render resolution steps down automatically.

Firefox always renders the 2D scene on a CPU-backed canvas (`willReadFrequently`), with a lower pixel budget. Its GPU canvas can drop images drawn from many small source canvases, which is how every glyph and sprite here is drawn. Options → Safe Rendering does the same in any browser and also turns off the WebGL effects.

## Audio

Everything is synthesized with Web Audio. The music is a generative lo-fi jazz loop: FM electric piano, walking bass, brushed drums, vinyl crackle, and a chiptune lead that joins when a round gets tense. It changes key per opponent and is muffled whenever a menu is open. The v1 MP3 is no longer used.

## Controls

- Click or tap a card to select it; select more to build a run, in any order. The game arranges the play order, and if a run isn't finished yet it tells you which card is missing. Press PLAY, or drag the card onto the pile, or flick it upward.
- Double-tap a card to auto-select the best run through it.
- Keyboard: ←/→ move focus, Space selects, Enter plays, S sorts, Esc pauses.
- Hover a card for its value and, for magic cards, what it does.

## Rules

Unchanged from v1. 2, 8, 9 and 10 always play. 2 resets, 8 is see-through, 9 forces 9 or lower, 10 burns the pile. Four of the same rank in a row also burns. Burns give another turn. Runs link equal ranks or consecutive cards of one suit. Once the deck and your hand are gone, play your face-up table cards, then flip blind cards one at a time. A bad flip picks up the pile.

Scoring is Chips × Mult: card chips times a run multiplier, plus burn and quick-play bonuses. Bonus goals and trophies persist in browser storage.

## Debug

Ctrl+Shift+D, or five quick taps on the title logo, opens the dev panel. It has side-by-side art trials for the title mascot (classic, grin, chibi) and the logo skull (classic, cute), test-table shortcuts, and renderer info. Art choices are stored per browser in `bh2-dev`. Players see the classic art unless they change it there.

`window.__bonehead` exposes the game objects. `window.__timeScale = 0.2` slows everything down. With a run in progress, Ctrl+Shift+B sets up a 10 burn, Ctrl+Shift+Q a four-of-a-kind, Ctrl+Shift+L the blind-card stage, Ctrl+Shift+R a suited run, and Ctrl+Shift+W wins the round.

## Legacy

The v1 DOM build, its CSS, art, music and DOM-specific tests are preserved in `legacy-v1/`.
