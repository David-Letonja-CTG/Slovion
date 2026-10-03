## 1. Areas (content and server validation)

- [x] 1.1 `content/areas/meadow.json` and `south_hedgerow.json`; area zones in the meadow map; `areas` as a public content folder
- [x] 1.2 `FileContentCatalog`: area files and area zones (known, inside, no overlap, every walkable tile covered); content validation tests, and a test that the area files are served

## 2. Engine

- [x] 2.1 `Torch` action and the `L` mapping; the Tiled parser reads area zones (with coverage); tests
- [x] 2.2 `World`: current area with `onAreaChange`; `onTimeChange` per in-game minute (replacing `onConditionsChange`); torch toggle with `onTorchChange`; `Game.setTorch`; tests
- [x] 2.3 Renderer: darker night; lit circle (radial gradient) with the torch on in the evening and at night; tests

## 3. Client

- [x] 3.1 `WorldLoader` loads the area names; the play screen tracks the area, the time and the torch
- [x] 3.2 Indicator with the clock and a quiet live region; location line; `LocationBanner` with its animation (respecting reduced motion); torch button
- [x] 3.3 `sl.json` keys; component and play-screen tests for every scenario
- [x] 3.4 E2E: start banner and clock; torch toggle; *Južna mejica* banner after the gate in the quest path

## 4. Docs and validation

- [x] 4.1 CLAUDE.md logical actions (`Torch`); README controls and areas
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual check: banner on start and at the gate, clock ticking, a night with and without the torch on desktop and at phone size; capture screenshots
- [x] 4.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 4.5 Run `openspec validate add-areas-clock-and-torch --strict`, push, and verify all CI jobs pass on the pull request
