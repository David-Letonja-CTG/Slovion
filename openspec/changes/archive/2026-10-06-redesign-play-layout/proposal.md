# Proposal

## Why

The play screen feels like a web page with a game in it, not a game. Measured on 2026-10-06 (new game, meadow):

| Screen | World view today | Share of the screen |
|---|---|---|
| 1920×1080 desktop | 1600×900 | 69 % |
| 1366×768 desktop | 1280×720 | 88 % |
| 390×844 phone, upright | 320×180 | 82 % of the width |
| 844×390 phone, sideways | 640×360 | 70 % |

The causes:
- **Integer-only scaling.** The world is drawn at the largest whole multiple of 320×180 that fits. Just below a multiple, a whole step is lost: an upright 390 px phone gets 3×, 320 CSS px of 390.
- **The keyboard hint is a row under the world.** Its 31 px make a 1080 px screen too short for 6×, so a full-HD desktop drops to 5×.
- **Stacked UI on upright phones.** Six full-width buttons and the indicator sit between the world and the controls, with a large empty gap above the controls.
- **Wordy buttons over the world.** On desktop the six buttons form a column at the top right; sideways on a phone they form a full-width row across the top of the world.

The owner asked for a game-first, responsive layout on 2026-10-06.

## What Changes

- **The world fills the screen.** The world view takes the largest 16:9 size that fits, not the largest whole multiple. It's drawn crisply at a whole multiple and only resampled for the last step, so pixels stay even. Never stretched.
- **A compact HUD over the world:**
  - top left: the conditions indicator and the quest tracker; the tracker can be collapsed to its title line
  - top right: icon buttons for *Svetilka*, *Nahrbtnik*, *Dnevnik* and a new *Več* (more) menu
- **A *Več* menu** holds the secondary actions: *Zvok*, mute and *Cel zaslon*, and on keyboard devices the controls hint.
- **The keyboard hint** shows over the bottom of the world when a game starts and fades out; it stays readable in *Več*.
- **Upright phones:**
  - the world at full width at the top, then the indicator and tracker, then one row of game buttons above the D-pad and A/B, like a handheld's *Start* and *Select*
  - the world is zoomed in and fills the screen down to the conditions line: a 180×240 (3:4) view, 390×520 CSS px on a 390×844 phone instead of 389×219, with 11×15 tiles; short phones (such as 375×667) get a 240×180 (4:3) view, whichever shows the world larger
  - the owner chose this from side-by-side prototypes on 2026-10-06, first the 4:3 zoom, then filling the height with the 3:4 one; the quest lies over the world's top-left corner, foldable
- **Sideways phones:** the world fills the height; the HUD buttons show icons only; the see-through controls sit in the bottom corners.
- **Touch controls styled as HUD**, not as page buttons.
- Every touch target at least 44 CSS px; the safe areas respected; no horizontal scrolling at any size.

## Capabilities

### New Capabilities

- **`play-layout`:** the game-first layout, the HUD, the *Več* menu and the keyboard hint.

### Modified Capabilities

- **`game-viewport`:** filling scale instead of integer-only scaling; how pixels stay crisp.
- **`touch-controls`:** the handheld layout upright and sideways.

## Non-goals

- Gameplay, the engine's input, the server, the API and content stay unchanged.
- No change to the 320×180 logical resolution or what the camera shows, except on upright touch screens (180×240 or 240×180).
- No taller view showing more of the map: most maps are 20 tiles high, so it would show most of a map at once.
- No new settings (for example, a choice between integer and filling scale).
- No redesign of the dialogs.

## Impact

- **Engine:**
  - `computeViewport`: filling scale and crisp drawing scale, for a given view size
  - the fixed `LOGICAL_WIDTH`/`LOGICAL_HEIGHT` become `WIDE_VIEW` (320×180), `TALL_VIEW` (180×240) and `COMPACT_VIEW` (240×180), passed to the renderers; `chooseView` picks the candidate shown largest
  - `createGame` takes a `views` option and gains `Game.setViews`, and sets the canvas's resampling per layout
- **Client device:** a `PORTRAIT` signal that follows the `orientation: portrait` media query.
- **Client:**
  - `PlayScreen` template and styles: the HUD, the *Več* menu, the hint
  - a small `HudIcon` component with the button icons
  - `QuestTracker`: collapsible
  - `TouchControls` and `LocationBanner`: styles only
  - a new `sl-SI` text (*Več*)
- **Tests:** viewport tests; play-screen tests for the menu and hint; E2E layout checks at the six target sizes.
- **Docs:** gameplay (buttons, layout, screenshots), architecture (canvas scaling).
- **Other specs:** `sound` ("the play screen SHALL offer a mute button and a *Zvok* button") and `inventory` ("a *Nahrbtnik* button over the world") still hold: mute and *Zvok* are in the *Več* menu on the play screen.
