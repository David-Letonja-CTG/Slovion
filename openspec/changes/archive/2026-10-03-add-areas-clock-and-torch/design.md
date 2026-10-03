# Design

## Context

Builds on `add-world-conditions`:
- The engine owns an in-game clock (`World.time`, advanced per fixed step) and calls `onConditionsChange` when the season or time of day changes.
- The renderer draws one full-screen tint per time of day.
- The play screen shows `ConditionsIndicator` (*Pomlad · jutro*) top-right.

Maps already use rectangle zones for habitats, validated by both parsers with the tile-centre rule. Public content folders are served under `/content` (maps, tilesets, species pictures).

Motivation: see proposal.md. Requirements: the four spec deltas.

Approved by the project owner on 2026-10-03.

Relies on these decisions:
- **D3:** the client owns rendering, movement and the torch, which affects nothing on the server.
- **D7:** area names are content.
- **D8:** the clock.
- **D10:** original art; no new art here.

## Goals / Non-Goals

**Goals:**
- Small, visible improvements: a clock, a sense of place, and a torch that makes the night fun.
- Keep the engine framework-free and deterministic: the clock, areas and torch are all testable with the fake clock and fake frames.
- Prepare the torch so a later change can let species react to it, without building that now.

**Non-Goals:** see proposal.

## Decisions

### 1. Clock in the indicator

`onConditionsChange(season, timeOfDay)` becomes **`onTimeChange(time: WorldTime)`**. It is called whenever the whole in-game minute changes, and also after `setWorldTime`. The play screen derives the season, time of day and `HH:MM` from it.

- **Update rate:** the call comes once per in-game minute, which is once per real second. That is cheap with signals.
- **Screen readers:** the indicator's `aria-live` moves to a visually hidden element that holds only the season and time of day, so the minute ticks aren't announced.

The format is `Pomlad · jutro · 08:15`. The hours are zero-padded and the clock is 24-hour, as usual in Slovenian.

### 2. Areas

- **Content:** `content/areas/<id>.json` holds `{ "id": "meadow", "text": { "sl": { "name": "Travnik na Dravskem polju" } } }`. `areas` is added to the public content folders. Area names are labels, not facts, so they need no sources.
- **Map:** the meadow map gets two `area` rectangles:

  | Zone | Area | Tiles |
  |---|---|---|
  | `area_meadow` | `meadow` | x 0–31, y 0–19 |
  | `area_south_hedgerow` | `south_hedgerow` | x 0–31, y 20–27 |

  The border hedges are blocked tiles, so the coverage rule only concerns walkable tiles.
- **Server validation:** `FileContentCatalog` checks the area files (ID, `sl` name, duplicates) and the area zones. The zone rules are those of habitat zones: known area, at least one tile, inside the map, no overlap. It also checks coverage: every tile with collision 0 must lie in an area zone. The server doesn't otherwise use areas.
- **Client parser:** the Tiled parser reads area zones into `WorldMap.areas` with the same rules. `areaAt(x, y)` returns the area ID.
- **Area names on the client:** `WorldLoader` fetches `/content/areas/<id>.json` for every area the map references, in parallel with the tileset. It passes a `Record<areaId, name>` for the current language, falling back to `sl`. The name lookup happens on the client, from public content, like the map itself.
- **Engine:** `World` tracks the player's current area. When the area ID of the player's *tile* changes, including the first update, it calls `onAreaChange(areaId)`.

### 3. Location line and banner

- **Location line:** the play screen keeps `area` (the current ID) and renders the name under the indicator as a second line.
- **`LocationBanner` component:**
  - It is absolutely positioned top-centre with `pointer-events: none`, and its `role="status"` gets the text.
  - Each new area name restarts a CSS animation: slide down and fade in over 0.3 s, hold, then slide up and fade out over 0.3 s, for a total of 2.5 s. Restarting is done by keying the element on a change counter.
  - With `prefers-reduced-motion: reduce`, it only fades.
  - The banner is not an overlay. It doesn't take UI input, so the world keeps input and the player keeps walking.
- **Banner text:** the area name in a pixel-style frame. There is no new art, only CSS borders in the existing palette.

### 4. Torch

- **Action:** a new logical action `Torch`, with `KeyL: ['Torch']` in the default map.
- **Engine:** `World` handles `Torch` presses like `OpenMenu`. It toggles `torchOn`, even mid-step, and calls `onTorchChange(on)` so the play screen's button reflects the state. `Game.setTorch(on)` lets the button switch it, and the state comes back through the same callback.
- **Rendering:** when the torch is on and the time of day is `evening` or `night`, the tint isn't a flat fill. A **radial gradient** centred on the player is filled across the whole view:
  - from transparent at a radius of 2 tiles
  - to the tint colour at 3.5 tiles
  - the gradient pads with the tint colour beyond that

  This uses the standard canvas API with one fill, no off-screen canvas, and crisp logical pixels.
- **Night tint:** `rgba(10, 14, 40, 0.68)`, darker than before (0.45), so the night is clearly dark and the torch is worth using. Evening stays `0.20` orange, and the torch also opens a circle in the evening.
- **Button:** a *Svetilka* button with `aria-pressed`, next to the indicator. It works with mouse and touch, and keyboard users use `L`.
- **Lifetime:** the torch starts off on every load. It isn't persisted and isn't sent to the server.

### 5. UI text (`sl.json`, for owner review)

| Key | Text |
|---|---|
| `torch.button` | *Svetilka* |
| `torch.on` | *Svetilka je prižgana.* (screen-reader status) |
| `torch.off` | *Svetilka je ugasnjena.* (screen-reader status) |
| `area.label` | *Lokacija* (accessible label for the location line) |
| `play.controlsHint` | adds *L: svetilka* |

Area names live in content:
- `meadow`: *Travnik na Dravskem polju*
- `south_hedgerow`: *Južna mejica*

## Testing

| Level | What is tested |
|---|---|
| Integration: content | area validation (unknown area, missing `sl` name, overlap, beyond the map, an uncovered walkable tile); repository areas and zones; `/content/areas/meadow.json` is served |
| Engine | parser area zones and coverage; area-change callbacks (start, crossing, no repeat within an area); per-minute time callbacks; `Torch` toggling and the callback; the renderer's gradient path at night with the torch on, a flat tint with it off, and no tint by day; the `L` mapping |
| Client | area names loaded for the map; the indicator clock text and minute updates; the location line updates; the banner shows on start and on change, replaces itself, and has a reduced-motion style; the torch button toggles and reflects the state; `L` does nothing while a dialog is open |
| E2E | start shows the banner *Travnik na Dravskem polju* and the clock *08:0x*; `L` toggles the torch button state; the quest path checks the banner *Južna mejica* after the gate |

## Implementation notes (review, task 4.4)

I reviewed every changed file against the non-goals and every scenario in the four spec deltas. Each scenario is covered by a content-validation, engine, client or E2E test. No non-goal was touched:
- species don't move or react to the torch
- the torch isn't persisted and the server doesn't know about it
- there are no new sprites, sounds or map transitions

Deviations and additions:
- **Shared zone code:**
  - **Server:** habitat and area zones go through one zone validator. The internal record `HabitatZone` became `MapZone(Id, …)`, and habitat error messages are unchanged.
  - **Client parser:** it shares one `parseZones` function. `classOf` and `property` moved to module level.
- **Area names on the client:** `WorldLoader` returns a `LoadedPlace`, which is `LoadedWorld` plus `areaNames`, using the active language with a Slovenian fallback. The engine's `LoadedWorld` stays unchanged.
- **Engine callbacks:** the world's host callbacks are grouped in a `WorldListeners` object (`onTimeChange`, `onAreaChange`, `onTorchChange`). `onConditionsChange` from `add-world-conditions` is replaced by `onTimeChange`, as planned.
- **Indicator:** it shows season, time of day and clock in one line. A visually hidden live region announces only the season and the time of day. The location line sits inside the same box.
- **Torch button:** it returns focus to the game canvas after a click, so the keyboard keeps working. A visually hidden live region announces *Svetilka je prižgana/ugasnjena*.
- **Banner on phones:** on narrow screens (≤ 40rem) the banner sits below the indicator and the torch button. The manual check at 390×844 showed it overlapping the indicator.
- **Banner restart:** each new place re-creates the banner through a keyed `@for`, which restarts the CSS animation. The banner removes itself on `animationend`.

- **Content files are sent with `Cache-Control: no-cache`:** found after the PR opened. A browser had heuristically cached the old meadow map, which has no area zones. The new client correctly rejected it (walkable tiles without a place) and showed *Območja ni bilo mogoče naložiti*. Files under `/content` are now always revalidated, and ETags keep that cheap. An integration test asserts the header.

**Manual check** at 1280×720 and 390×844, with no console errors:
- The start banner *Travnik na Dravskem polju* appeared and was gone after about 2.5 s, while the clock moved 08:00 → 08:03.
- With the quest completed through the API and the clock shifted to 22:00 in the dev database, the night was clearly dark.
- The torch, switched with `L`, lit a soft circle that followed the player through the gate. There the banner and the location changed to *Južna mejica*.

## Risks / Trade-offs

- **Per-second updates of the indicator** are cheap, but they are a regular change-detection tick. They only touch one small component through signals.
- **Darker nights could make the map hard to read** with the torch off. At 0.68 the paths and the player stay visible. This is reviewed in the manual check and tunable in one constant.
- **The banner and the quest tracker share the top of the screen:** the tracker is top-left, the indicator top-right, and the banner top-centre. On narrow phones they may touch. The banner is short-lived, and the manual check covers 390 px.
- **Two parsers must agree on area coverage:** both are tested on the same map, as with habitats.

## Open Questions

None. The names, UI texts, key choice (`L`) and the darker night need owner review.
