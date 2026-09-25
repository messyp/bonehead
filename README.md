# Bonehead

A pixel-art shedding roguelite inspired by Shithead. Beat four tables of house opponents, claim tricks between rounds, and don't be the Bonehead.

Version 2 is a ground-up presentation rework: everything is drawn to a canvas, with modern pixel art, spring-driven card motion, shader post-processing and a synthesized soundtrack. The tested rules engine, scoring and progression from v1 are unchanged.

## Run

Serve `dist/` with any static HTTP server (ES modules need `http://`, not `file://`):

```
python3 tools/devserver.py 8420
```

The dev server sends no-cache headers so edited modules always reload. Any static server works too.

No build step, no dependencies, no external requests. The whole game is about 850 KB.

## Tests

```
for t in *.test.mjs; do node $t; done
```

`engine`, `scoring`, `polish`, `burn` and `progression` cover the rules (including 500 simulated full games with card conservation checks). `runs.test.mjs` covers run selection. `rounds.test.mjs` covers three-seat tables and pick-your-table deals (400 simulated three-seat games). `goals.test.mjs` covers bonus goals, per-round stats and trophies. `art.test.mjs` checks the bitmap fonts, the card silhouette and opponent dialogue coverage.

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
  js/art/sprites.js     opponents (animated), mascot, icons, dialogue
  js/art/map.js         the top-down crypt room for the progression map
  js/art/logo.js        the BONEHEAD wordmark (title and HUD), title link icons, depth-of-field blur
  js/audio/sfx.js       synthesized sound effects and mix bus
  js/audio/music.js     generative lo-fi soundtrack with intensity layers
  js/game/game.js       table layout, card physics, turn flow, scoring, AI
  js/game/screens.js    tutorial, options, trophies, reward and result screens
  js/game/title.js      the title screen
  js/game/ui.js         pixel buttons, sliders, toggles, tooltips, modals
  js/game/rounds.js     the run: opponents, rule changes, themes and music key per round
tools/devserver.py      no-cache static server for development
tools/stamp.mjs         deploy step: content-hash every module via an import map
```

## Rounds

A run is four tables, defined in `js/game/rounds.js`:

1. Lucky Bones, classic rules.
2. The Velvet Reaper, **Pick Your Table**: everyone gets 6 cards and chooses 3 to lay face-up for later.
3. **The Twins** (Tibia and Fibula), two opponents at once. Go out first to win. If a twin goes out, beat the other. The last one holding cards is the Bonehead.
4. The Pit Boss, Pick Your Table again.

Between rounds, the **Midnight Circuit** map shows a crypt from above (in the spirit of The Binding of Isaac's rooms), with the four opponents as cards on a candle-lit card table, joined by a chalk path. Beaten tables are stamped BONEHEAD. Tap a card to select it (it lifts, glows and gets an arrow), then tap it again or press GO. While testing, every table is playable in any order (`ROUND_LOCKS` in `rounds.js`). A rule-change card then explains the twist before the deal.

## Title screen

The BONEHEAD wordmark sits centre stage in a magenta void, and cards drift past at different depths. The logo's chunky letters are drawn in code with a bevel, a plum 3D side and a heavy outline, and the O is a blocky skull with smouldering red eyes. The distant cards are blurred like a camera's depth of field, and the four nearest are placed like a poster, turning over now and then. Letters drop in one by one when the screen opens. After that, a glint sweeps across the logo and the skull chomps.

On a first play, PLAY opens the five-page HOW TO PLAY (SKIP on page one, LET'S GO at the end). Then comes the map, with a pointer to GO, and then the first deal (`bh2-onboarded` in storage). Any click or key during the intro finishes it, so an eager first click still lands on the button. Near cards swing further than far ones as the pointer moves, which gives the scene depth.

There is one big CTA (PLAY, or CONTINUE with a save). Under it are quiet links: NEW RUN, HOW TO PLAY, TROPHIES, OPTIONS. Your best run and trophy count sit centred along the top. The arrow keys move between the button and the links, and Enter picks. The HUD draws the very same wordmark, flattened into one sprite and scaled down (`wordmark()` in `js/art/logo.js`).

## Bonus goals and trophies

Round 1 always shows Double Cremation and Clean Getaway. Later rounds draw three goals from a pool of 11 (`GOALS` in `scoring.js`), such as Hat Trick, Long Run, Bonfire, Quad Squad, Conjurer, Old School, Blind Luck, Comeback Kid and Speed Run. Hover a goal for what it asks, your progress, and whether it pays immediately or on a win. The engine keeps per-round player stats (`pstats`) that drive both goals and the 16 trophies. The engine supports any number of seats (`deal(round, extra, min, { seats, choose })`), and two-seat behaviour is unchanged.

All art is generated in code at startup from the palette in `js/art/palette.js`. There are no image files apart from the favicon.

## Rendering

The game lays out in virtual pixels (a 480×300 minimum in landscape, 250×440 in portrait) and scales to the device. Sprites are upscaled by an integer factor and then drawn with smoothing, so pixels stay crisp at any zoom while cards still move and rotate smoothly. The 2D scene is composited in WebGL over a pixelated, dithered paint-swirl background that changes palette per opponent, with optional CRT scanlines, bloom and impact aberration. The vignette darkens only the background, so cards and buttons stay at full brightness to the corners. Call-to-action buttons get a pulsing halo when it's your move. Bloom comes only from coloured light (gold, fire, glows), so white card faces never haze over their red pips. Without WebGL2 it falls back to a plain 2D gradient.

If frames run slow for a few seconds, the render resolution steps down automatically.

Firefox always renders the 2D scene on a CPU-backed canvas (`willReadFrequently`), with a lower pixel budget. Its GPU canvas can drop images drawn from many small source canvases, which is how every glyph and sprite here is drawn. Options → Safe Rendering does the same in any browser and also turns off the WebGL effects.

## Audio

Everything is synthesized with Web Audio. The music is a generative lo-fi jazz loop: FM electric piano, walking bass, brushed drums, vinyl crackle, and a chiptune lead that joins when a round gets tense. It changes key per opponent and is muffled whenever a menu is open. The v1 MP3 is no longer used.

## Controls

- Click or tap a card to select it; select more to build a run, in any order. The game arranges the play order, and if a run isn't finished yet it tells you which card is missing. Press PLAY, or drag the card onto the pile, or flick it upward.
- Double-tap a card to auto-select the best run through it.
- **Card hints** (checkbox bottom-left, or Options) darken cards you can't play and show run helpers. Turn them off to judge every card yourself.
- When nothing beats the pile, your cards shake, then the pile lights up with a PICK UP button and says what beats you. Tap the pile or the button.
- Keyboard: ←/→ move focus, Space selects, Enter plays, S sorts, Esc pauses.
- Hover a card for its value and, for magic cards, what it does.

## Rules

Unchanged from v1. 2, 8, 9 and 10 always play. 2 resets, 8 is see-through, 9 forces 9 or lower, 10 burns the pile. Four of the same rank in a row also burns. Burns give another turn. Runs link equal ranks or consecutive cards of one suit. Once the deck and your hand are gone, play your face-up table cards, then flip blind cards one at a time. A bad flip picks up the pile.

Scoring is Chips × Mult: card chips times a run multiplier, plus burn and quick-play bonuses. Bonus goals and trophies persist in browser storage.

## Debug

Ctrl+Shift+D, or five quick taps on the title logo, opens the dev panel. It has a mascot trial for the loss screen (classic, or brand: a pixel take on the original rubber-hose Bonehead), test-table shortcuts, a round skipper, and renderer info. Art choices are stored per browser in `bh2-dev`. Players see the classic art unless they change it there.

`window.__bonehead` exposes the game objects. `window.__timeScale = 0.2` slows everything down. With a run in progress, Ctrl+Shift+B sets up a 10 burn, Ctrl+Shift+Q a four-of-a-kind, Ctrl+Shift+L the blind-card stage, Ctrl+Shift+R a suited run, and Ctrl+Shift+W wins the round.

## Deploying

Pushing to `main` runs the tests, stamps every module URL with a content hash (so a deploy is never mixed with cached old modules), and publishes `dist/` to GitHub Pages.

## Legacy

The v1 DOM build, its CSS, art, music and DOM-specific tests are preserved in `legacy-v1/`.
