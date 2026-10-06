## 1. Viewport

- [x] 1.1 `computeViewport`: filling 16:9 size in whole physical pixels, drawn at the integer scale above, `smooth` flag; viewport tests
- [x] 1.2 `createGame` sets `image-rendering` per layout; engine tests
- [x] 1.3 View size as engine data (`WIDE_VIEW`, `UPRIGHT_VIEW`): viewport, renderer, weather and darkness take it; `view` option and `Game.setView`; tests
- [x] 1.4 `PORTRAIT` signal; `PlayScreen.view` (touch and upright) to `GameCanvas` and `Game.setView`; the upright world host 4:3; tests
- [x] 1.5 Upright: the 3:4 view (`TALL_VIEW`) filling the space above the conditions line, the 4:3 one on short screens (`chooseView`, `Game.setViews`); the quest over the world; tests

## 2. Play screen

- [x] 2.1 HUD: `.play__info` (conditions, tracker) and `.play__actions` (torch, bag, journal, *Več*) with `HudIcon` icons
- [x] 2.2 *Več* menu: *Zvok*, mute, *Cel zaslon*, the hint on keyboard devices; open, close, `Escape`, outside press
- [x] 2.3 Keyboard hint as a fading overlay
- [x] 2.4 Collapsible quest tracker
- [x] 2.5 Layouts: desktop full-bleed, upright handheld column, sideways overlay; safe areas; no horizontal scroll
- [x] 2.6 Touch controls and location banner styles
- [x] 2.7 `sl-SI` text for *Več*

## 3. Tests and docs

- [x] 3.1 Play-screen and tracker tests; E2E: upright and sideways layouts, the mute test through *Več*
- [x] 3.2 Measure the six target sizes (world size, overlaps, 44 px, no horizontal scroll); screenshots
- [x] 3.3 Docs: gameplay (buttons and layout), architecture (canvas scaling); rerun the docs media capture
- [x] 3.4 Run `npm run check`, `npm run e2e` and `openspec validate redesign-play-layout --strict`
- [ ] 3.5 Manual check on a real phone (upright and sideways, notch and home bar) — **open:** verified with Chromium phone emulation (DPR 3, touch) only
