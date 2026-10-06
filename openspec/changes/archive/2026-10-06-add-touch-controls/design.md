# Design

## Context

What exists today:
- **Input:** the engine reads the keyboard only (`engine/input/keyboard.ts`). Keys become logical actions in an `ActionSink`. The `ActionDispatcher` routes them to the world or, while a dialog is open, to the UI. Dialogs already react to actions (`handleAction`), and their buttons work with mouse and touch.
- **Viewport:** the world view is a fixed 320×180 game pixels, scaled by the largest integer that fits the canvas host and centred (`game-viewport`). The play screen is a column: the canvas host (`flex: 1`), then the keyboard hint. The clock and place, the torch, bag and sound buttons sit at the top right over the world view; the quest tracker sits at the top left.
- **On an upright phone** (412×915 CSS px, DPR 2.625) the integer scale is 3: the view is 366×206 CSS px, centred in a tall host, with empty space above and below. The top-right panel (now five buttons) covers most of that small view.
- **Missing pieces:** there's no journal button (only `M`) and no fullscreen.

Approved by the project owner on 2026-10-06.

Motivation: see proposal.md. Requirements: `specs/touch-controls/spec.md`, `specs/game-viewport/spec.md`.

## Goals / Non-Goals

**Goals:**
- Phones and tablets can play everything a keyboard player can, comfortably with two thumbs.
- An upright phone shows the world unobstructed and uses the rest of the screen for controls, like a handheld console.
- Fullscreen on any browser that supports it.
- Desktop play stays exactly as it is, apart from the new *Dnevnik* and fullscreen buttons.

**Non-Goals:** see proposal.

## Decisions

### 1. Touch is another input source for the same actions

`Game` gets two methods:
- `press(actions: readonly Action[])`
- `release(actions: readonly Action[])`

They feed the same `ActionDispatcher` as the keyboard. So:
- world and dialog routing is unchanged
- the world receives `MoveRight`, not "a touch"
- gameplay code doesn't change
- the engine stays framework-free

The controls themselves are UI, so they're an Angular component (the project rule: Angular for all UI) that calls these methods through `PlayScreen`.

| Control | Actions | Like |
|---|---|---|
| D-pad | one of `MoveUp`, `MoveDown`, `MoveLeft`, `MoveRight` | arrows, WASD |
| A | `Interact` + `Confirm` | `E`, `Enter`, `Space` |
| B | `Cancel` + `Run` | `Esc` (without `OpenMenu`) + `Shift` |

**Why B is Cancel and Run together:**
- the world ignores `Cancel`, and dialogs ignore `Run`
- so B is "back" in dialogs and "run" while walking, like a handheld's B button

B doesn't send `OpenMenu`: the journal gets its own button.

**Alternative considered: tap the map to walk there.** Rejected by the owner. It needs pathfinding and is imprecise at gates, streams and caves.

**Known limit:** if the keyboard and a finger hold the same action and one lets go, the action is released. The two are not used together in practice, so the sources aren't reference-counted.

### 2. The D-pad is one surface, not four buttons

- One element with pointer capture. The direction comes from the angle of the finger relative to the centre, in four 90° sectors.
- A dead zone (the inner 25 % of the radius) holds nothing.
- Sliding to another sector releases the old direction and presses the new one, so turning doesn't need a lift.
- `pointerup`, `pointercancel` and `lostpointercapture` release.
- Each control tracks its own `pointerId`, so the D-pad and B work at the same time.

**Release when focus goes:** when the window blurs or the page is hidden, the component releases everything, as the keyboard source does.

**Browser gestures:**
- `touch-action: none` and `user-select: none` on the controls
- no `contextmenu`
- `-webkit-touch-callout: none`
- `touch-action: manipulation` on the play screen, against double-tap zoom

### 3. When the controls appear

A small `TouchDevice` signal service:
- `true` when `matchMedia('(pointer: coarse)')` matches
- otherwise `true` from the first `pointerdown` with `pointerType === 'touch'`

The play screen shows `TouchControls` and hides the keyboard hint while it's `true`. Tests replace it through an injection token.

### 4. Handheld layout in CSS

The play screen gets a `play--touch` class when the controls are shown. Orientation comes from `@media (orientation: portrait)`.

**Upright (`play--touch` and portrait):**
- **The world view:** the canvas host gets `aspect-ratio: 16 / 9; width: 100%`. The engine still computes the integer scale inside it: 366 of 412 CSS px on the reference phone, 89 %, with no overlays.
- **Below it, a panel holds:**
  - the clock and place
  - the quest tracker
  - a row of the play screen's buttons: *Svetilka*, *Nahrbtnik*, *Dnevnik*, *Zvok*, *Utišaj*, fullscreen
  - the D-pad on the left and A/B on the right, at the bottom

  The panel uses the existing components in a different place; it doesn't duplicate them.
- **Sizes:** the D-pad is 9.5rem across; A and B are 4rem circles.

**Sideways (`play--touch` and landscape):**
- the canvas host fills the screen as today
- the controls are absolutely positioned at the bottom corners with `opacity: 0.55` (1 while pressed)
- the indicators and buttons stay at the top, as on desktop
- on a 915×412 phone the integer scale is 6: 731×411 CSS px, with about 90 px of letterbox on each side, so the controls mostly sit on the letterbox

**Safe areas:**
- `index.html` gets `viewport-fit=cover`
- the controls and panels pad with `env(safe-area-inset-*)`

**Why not grow the world view to fill an upright screen:** an upright phone would show 22×25 tiles while maps are 26×20, so the map edge would show. It also changes the engine's fixed resolution (`game-viewport`). Placing the 16:9 view well is enough.

### 5. Fullscreen

- A `Fullscreen` service wraps the browser API:
  - `available` = `document.fullscreenEnabled`
  - `active` = a signal updated on `fullscreenchange`
  - `toggle()` calls `document.documentElement.requestFullscreen({ navigationUI: 'hide' })` or `document.exitFullscreen()`
- The whole document goes fullscreen, so dialogs, banners and the touch controls come along.
- The button sits with the others. It's labelled *Cel zaslon* and shows its state like the torch button (highlighted and `aria-pressed`): a single short label fits a 360 px phone's button grid, where *Celozaslonsko* overflowed.
- It's hidden where `available` is false, e.g. iPhone Safari. iOS users who add the game to the home screen get the standalone app, which is already full screen.
- Rejected failures (e.g. no user gesture) are ignored.

### 6. The *Dnevnik* button

A button beside *Nahrbtnik* calls the same `onMenu()` as the `OpenMenu` action. It helps mouse players too.

## Risks / Trade-offs

- **[Thumbs cover the view when sideways]** Mitigation: the controls sit mostly on the letterbox and are see-through. Upright, nothing covers the view.
- **[Small phones]** A 360×640 phone upright gives a 320×180 view at scale 2 (DPR 3: 960 px). There's enough room below for the controls at their minimum sizes.
- **[Touch laptops showing controls]** They appear only after a touch; a mouse and keyboard player never sees them.
- **[Two input sources holding one action]** See Decision 1.

## Testing

- **Engine:** `Game.press` and `Game.release` reach the world, or the UI listener while the UI is the consumer. A held D-pad direction walks the player, and a release stops after the current step.
- **`TouchControls` component, with pointer events:**
  - each control sends its actions
  - the D-pad sector, the dead zone and sliding to turn
  - multi-touch
  - release on up, cancel and window blur
  - nothing on `contextmenu`
- **Play screen:**
  - the controls and `play--touch` are shown with a fake touch device and hidden without one
  - the keyboard hint is hidden while they're shown
  - the controls drive a dialog
  - *Dnevnik* opens the journal
  - the fullscreen button, with a fake Fullscreen API: hidden when unavailable, toggles, follows `fullscreenchange`
- **E2E (Playwright, Pixel 7 emulation with touch):**
  - upright: the world view is at least 85 % of the width and nothing overlaps it
  - walk to the meadow sage with the D-pad and observe it with A
  - sideways: the controls sit at the bottom corners
- **Manual:** a real phone, upright and sideways; fullscreen on desktop and Android.

## Implementation notes

### Deviations from the plan

- **Fullscreen has one label, *Cel zaslon*,** shown as on or off like the torch button (highlighted, `aria-pressed`). *Celozaslonsko* overflowed its button in the 3-column grid on a 360 px phone. The spec now says "shows whether fullscreen is on" instead of "shows which way it switches".
- **The touch controls sit above dialogs** (z-index 11 over the overlay's 10), so the D-pad, A and B drive dialogs as the spec requires. Only the D-pad and the buttons take touches; the rest of a dialog stays tappable.
  - **Upright:** dialogs end above the controls area. `.overlay` uses `--play-controls-height`, which the play screen sets, as its bottom inset.
  - **Found by:** the first E2E run, where the observation dialog's overlay covered B.
- **Sideways:**
  - the buttons make one compact row along the top edge with the clock at its end, rather than a 2-column block, which covered about a quarter of the world view
  - the quest tracker sits below that row
- **Upright:** the buttons form a 3-column grid under the clock and place.
- **The Fullscreen and touch-device services live in `app/device/`.** `TOUCH_DEVICE` is an injection token holding a signal; tests provide `signal(true)` or `signal(false)`.
- **Docs fix:** `docs/architecture.md` said the world is drawn at 480 × 270; it is 320 × 180 (code and `game-viewport` spec), now corrected. "Tap to walk" is gone from `docs/gameplay.md`.

### What was verified, and how

- **Automated:**
  - `npm run check`: 448 unit and component tests, lint, i18n, build
  - all 15 E2E tests, including 4 new ones with Pixel 7 emulation (touch input and a coarse pointer): the upright layout, a D-pad walk to the sage with A and B, *Dnevnik* by touch, and the sideways layout
  - `dotnet test` (491) and `dotnet format`
- **Screenshots in Chromium:** the Pixel 7 upright and sideways, a 360×640 phone, desktop, and the observation dialog and journal on a phone. Desktop is unchanged apart from the *Dnevnik* and *Cel zaslon* buttons.
- **Fullscreen in Chromium:** the button enters fullscreen (`document.fullscreenElement` is the page), shows it as on, and follows the browser leaving it.
- **Not yet done: a real phone (task 4.4).** That covers how it feels with thumbs, iOS Safari (no fullscreen button), Android fullscreen, and the notch's safe areas.
