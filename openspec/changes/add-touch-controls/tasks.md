## 1. Engine

- [x] 1.1 `Game.press(actions)` and `Game.release(actions)` through the action dispatcher; engine tests

## 2. Touch controls

- [x] 2.1 `TouchDevice` service (coarse pointer or first touch) behind an injection token
- [x] 2.2 `TouchControls` component: D-pad (sectors, dead zone, slide to turn, pointer capture), A and B, multi-touch, release on up, cancel, blur and hidden page; no browser gestures; `sl-SI` labels
- [x] 2.3 Wire into `PlayScreen`: `play--touch`, the hint hidden, actions sent to the game

## 3. Layout and buttons

- [x] 3.1 Upright layout: the world view at the top, the indicators, tracker, buttons and controls below
- [x] 3.2 Sideways layout: see-through controls at the bottom corners
- [x] 3.3 `viewport-fit=cover` and safe-area padding; `touch-action: manipulation` on the play screen
- [x] 3.4 The *Dnevnik* button
- [x] 3.5 `Fullscreen` service and button, hidden where unsupported

## 4. Tests and docs

- [x] 4.1 Component and play-screen tests; E2E with phone emulation (upright layout, D-pad walk to the sage, A observes, sideways layout)
- [x] 4.2 Docs: gameplay controls with touch (and remove "tap to walk"), architecture (input sources), a phone screenshot in the docs media
- [x] 4.3 Run `npm run check`, `npm run e2e`, `dotnet test`; all succeed
- [ ] 4.4 Manual check on a real phone (upright and sideways) and fullscreen on desktop and Android — **open:** needs a real phone; Chromium phone emulation and screenshots are recorded in the design notes
- [ ] 4.5 Run `openspec validate add-touch-controls --strict`, push, and verify all CI jobs pass on the pull request
