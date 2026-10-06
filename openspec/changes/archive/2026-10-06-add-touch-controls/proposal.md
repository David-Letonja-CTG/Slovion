# Proposal

## Why

Phones and tablets can't play the game today:
- **No touch input.** The engine listens only to the keyboard, so a phone can't walk, interact, search or run. The journal has no on-screen button either. (`docs/gameplay.md` wrongly says "tap to walk".)
- **A small strip on an upright phone.** The world view is 16:9 (320×180 game pixels). On a phone held upright it's about 366×206 CSS pixels at the top of an otherwise empty screen.
- **No fullscreen,** on PC or on phones.

The platform target is "responsive web/PWA first (desktop, tablet, mobile)", and the owner asked for this next. The owner chose:
- a handheld-style layout
- a D-pad with A and B buttons
- a fullscreen button wherever the browser supports one

## What Changes

- **On-screen touch controls** on touch devices:
  - **D-pad:** hold to keep walking. Sliding the thumb to another direction turns without lifting.
  - **A:** interact or confirm, like `E` or `Enter`.
  - **B:** back, like `Esc`; held while walking, it runs, like `Shift`.
  - They send the same logical actions as the keyboard, so walking, interacting, searching, running and every dialog work unchanged.
  - Several fingers at once, e.g. the D-pad and B to run.
- **Handheld layout on touch devices:**
  - **Upright:** the world view across the top at full width, nothing drawn over it. The clock and place, the quest tracker, the buttons and the controls sit in the area below.
  - **Sideways:** the world view fills the screen. See-through controls sit at the bottom corners; the indicators and buttons stay at the top, as on PC.
  - The keyboard hint is hidden while touch controls are shown.
- **A *Dnevnik* button** opens the journal with mouse or touch, for every player.
- **A fullscreen button** (*Cel zaslon*) wherever the browser supports fullscreen: PC, Android and tablets. It's hidden on iPhone, where Safari can't make a page fullscreen; the installed app already runs full screen there.
- **No accidental browser gestures:** pressing the controls doesn't zoom, scroll, select text or open a long-press menu. On phones with a notch, the controls stay inside the safe area.

## Capabilities

### New Capabilities

- **`touch-controls`:** the on-screen D-pad and buttons, how they map to actions, when they're shown, the handheld layout, and the *Dnevnik* button.

### Modified Capabilities

- **`game-viewport`:** adds fullscreen.

## Non-goals

- Tapping the map to walk there (pathfinding), gamepads, remappable controls.
- Changing the world view's size or the integer scaling: upright phones still see the same 320×180 view, only placed better.
- Locking the screen orientation, vibration.
- Changes to the server, the API or content.

## Impact

- **Engine:**
  - `Game` gains a way to press and release actions from another input source
  - the touch controls are routed through the same dispatcher as the keyboard
- **Client (Angular):**
  - a `TouchControls` component in `play/`
  - layout styles for upright and sideways touch screens
  - the *Dnevnik* and fullscreen buttons
  - `viewport-fit=cover` in `index.html` for the safe areas
  - new Slovenian texts in `public/i18n/sl.json`
- **Tests:** engine, component and play-screen tests; a Playwright test with phone emulation that walks to the meadow sage with the D-pad and observes it with A.
- **Docs:**
  - gameplay: controls with touch, and removing the wrong "tap to walk"
  - architecture: input sources
  - a phone screenshot in the docs media
