# Design

## Context

- **Viewport** (`engine/viewport.ts`): `computeViewport` picks the largest integer scale in physical pixels, sizes the backing store to it, and centres the canvas. The world is drawn in logical pixels through a transform; the canvas is shown with `image-rendering: pixelated`.
- **Play screen** (`play/play-screen.*`): a flex column with the canvas host (`flex: 1`) and, on keyboard devices, the hint row below it. One absolutely positioned panel at the top right holds the conditions indicator and six text buttons; the quest tracker sits at the top left. On upright touch screens the panel and tracker become static blocks between the world and the controls; sideways, the panel becomes a row across the top.

Requested and approved by the project owner on 2026-10-06; measurements and causes in proposal.md.

## Goals / Non-Goals

**Goals:** the world uses as much of the screen as 16:9 allows at every size, with a HUD that reads as part of the game. **Non-goals:** see proposal.

## Decisions

### 1. Filling scale, drawn at a whole multiple

The shown size is the largest rectangle of the view's shape that fits, at scale `min(w·dpr / 320, h·dpr / 180)`, with each side rounded down to whole physical pixels. Width and height use the same scale, so the world is never stretched (to within one pixel; see §1a for why it is not snapped to exact 16×9 steps).

The world is still drawn with nearest-neighbour at an integer scale: the backing store is `ceil(shown / 320)` times 320×180. So every game pixel is the same size in the backing store.

| Shown size is… | Canvas shown with | Result |
|---|---|---|
| an exact multiple | `image-rendering: pixelated` | identical to today |
| between multiples | default (smooth) resampling, downwards by less than one step | even pixels; only their edges blend |

This is the "sharp bilinear" technique. Nearest-neighbour at a fractional scale would make some game pixels one physical pixel wider than others, which shimmers when the camera moves.

**Alternative considered: keep integer scaling when it covers at least ~90 %.** That keeps 1366×768 perfectly crisp, but needs an arbitrary threshold, still loses 8 % on 844×390, and the owner asked for the viewport to be used aggressively. At DPR ≥ 2 (phones, most laptops) the resampled edges are not visible.

**Alternative considered: upscale from the integer scale below.** Cheaper, but at low scales (1.2–1.9×) most pixels end up blended. Downscaling from the scale above keeps them sharp.

Very small areas (under 1 physical pixel per game pixel) keep today's behaviour.

### 1a. A zoomed-in view on upright touch screens

- **Why:** upright, the world is limited by the screen's width. A 16:9 view can't grow taller, and characters were about 19 CSS px tall.
- **What:** upright touch screens zoom in, in two steps chosen by the owner from prototypes:
  1. **4:3 (240×180):** the same height and narrower, so the same width shows it a third larger. Chosen over 320×240, which shows more map: most maps are 20 tiles high, so that would reveal most of a map at once.
  2. **3:4 (180×240), filling the screen down to the conditions line:** chosen over a taller 240×320 at the 4:3 zoom, which would show a whole 20-tile map height so the camera wouldn't scroll vertically. 180×240 shows 11×15 tiles at about 2.2 CSS px per game pixel on a 390 px phone, and scrolls both ways.
- **The tall view is flexible:** 180 wide, and as tall as the space allows from 180 to 240 (`fitView`).
  - The space above the buttons differs between phones, and a browser's address bar takes some of it: a Pixel 7 in Chrome leaves 412×521, where a fixed 3:4 view would be height-limited with 8 px bars at the sides.
  - With the flexible height the world always fills the width: 180×227 there.
- **Short spaces:** upright screens get both views (`UPRIGHT_VIEWS` = `COMPACT_VIEW`, `TALL_VIEW`), and `chooseView` picks the one whose game pixels are shown largest. It compares exact scales, and 4:3 wins a tie.
  - An iPhone SE (375×667) gets a square 180×180 view (1.95 CSS px per game pixel, against 1.56 for 4:3).
  - 4:3 wins only where the space is wider than tall.
  - It runs on every layout, so it follows the space as it changes.
- **Whole pixels per side:** a flexible height breaks the exact 16×9 steps of §1. `computeViewport` now rounds each side of the shown size down to whole physical pixels on its own, which keeps the shape to within one pixel (1366×768: 1365×768).
- **The view size is engine data:** `ViewSize`, with `WIDE_VIEW`, `TALL_VIEW` and `COMPACT_VIEW`.
  - The renderer, the weather and the darkness layer take the view instead of the old constants.
- **The host offers the candidates:** `PlayScreen.views` is `UPRIGHT_VIEWS` when `TOUCH_DEVICE` and `PORTRAIT` are both true, and `[WIDE_VIEW]` otherwise. That is the same condition as the handheld CSS layout.
  - `GameCanvas` passes the views to a new game.
  - Turning the phone calls `Game.setViews`, which lays the canvas out again at once without restarting the game.
- **Upright layout:** the world host takes all the height the conditions line, the button row and the controls leave (`flex: 1`), and the quest tracker lies over its top-left corner, foldable.
- **Alternative considered: the engine picks from all views on every screen.** Rejected: a 16:10 laptop window would get a 4:3 view with side bars. The candidates are offered only upright.
- **Known effect:** rain and snow particles are spread over a narrower view, so they are denser upright. Accepted.

### 2. The world is absolutely positioned; the HUD overlays it

- `.play` is a fixed-size, `overflow: hidden` box of `100dvh`.
- The canvas host covers the safe area: `position: absolute`, inset by `env(safe-area-inset-*)`. The engine measures and centres inside it, as before.
- No layout row is reserved below the world on desktop any more.

**HUD:**
- top left (`.play__info`): the conditions indicator, then the quest tracker
- top right (`.play__actions`): *Svetilka*, *Nahrbtnik*, *Dnevnik*, *Več*

The HUD is offset by the safe-area insets and wraps when narrow, so the two groups never overlap.

**Upright touch screens:** the play screen is a column, like a handheld:
1. the world at full width (`aspect-ratio: 16 / 9`, below the top safe area)
2. the info row
3. a spacer
4. the action row (*Svetilka*, *Nahrbtnik*, *Dnevnik*, *Več*)
5. the controls

The dialogs' bottom edge (`--play-controls-height`) is unchanged, so the controls still drive the dialogs.

### 3. Icon buttons with labels

- Each HUD button has a small pixel icon (`HudIcon`: inline SVG rectangles, `currentColor`, `crispEdges`) and its catalog label.
- Sideways on touch screens the label is visually hidden. Its text still names the button for screen readers and tests, so no `aria-label` is duplicated.
- The icons are original drawings (D10); paths are not player-facing text.

### 4. The *Več* menu

- A button with `aria-expanded` and `aria-controls` opens a small panel under the action row with *Zvok*, mute and *Cel zaslon* (where available). On keyboard devices it also has the controls hint.
- It closes:
  - when its button is pressed again
  - when an item is chosen: mute and fullscreen act and give focus back to the game, as today; *Zvok* opens its dialog
  - on `Escape` on *Več* or in the panel, which returns focus to *Več*. The key stops there: the game's keyboard listens on the window and maps `Escape` to `OpenMenu`, which would also open the journal
  - on a press anywhere outside it
- The *Več* button is not shown when the panel would be empty (touch, no audio, no fullscreen).

**Why these are secondary:** the player uses them rarely. The torch, the bag and the journal are used during play and stay one tap away.

### 5. Keyboard hint

- On keyboard devices the hint overlays the bottom centre of the world when the play screen opens.
- A CSS animation fades it out after about 10 s. It is not interactive and doesn't take space.
- The same text is in the *Več* menu.
- It stays hidden on touch screens (`touch-controls`).

### 6. Quest tracker can collapse

- The tracker becomes `<details open>`: the summary line is the label, title and progress (or the return hint).
- The quest summary sits in the body.
- Native `details` is keyboard and screen-reader accessible without extra code.
- It starts open, as today.

### 7. Touch controls as HUD

Styles only:
- dark translucent panels with the pixel border
- A and B with accent letters
- sideways, a slightly smaller D-pad (8 rem) and buttons (3.5 rem = 56 px), still above 44 px

## Risks / Trade-offs

- **Resampled edges on low-DPR desktops** at non-integer sizes (e.g. 1366×768 at DPR 1: 4.25×) look slightly softer than integer scaling. Accepted for the owner's priority on space. 1920×1080 is an exact 6× and stays pixel-perfect.
- **The backing store can be one step larger** than the shown size (at most `(n+1)² / n²` the pixels). That's small at these sizes.
- **The HUD overlays the world's corners on desktop and sideways.** The camera's centre (the player) stays clear. The tracker can be collapsed.

## Verification

- Six target sizes:
  - desktop at DPR 1: 1920×1080 and 1366×768
  - phones at DPR 3 with touch: 390×844, 430×932, 844×390 and 932×430
- At each: the world's size, overlaps, 44 px targets, and no horizontal scroll, measured with Playwright; screenshots before and after.
