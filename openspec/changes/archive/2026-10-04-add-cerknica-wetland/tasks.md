## 1. Species

- [x] 1.1 Sources: read each park page (exact text), GBIF names, family and flowering-month sources
- [x] 1.2 Seven species files with sourced facts, availability, clues and wildlife traits
- [x] 1.3 Pictures (32×32) for the seven species; walk sprites for the four animals

## 2. Map and art

- [x] 2.1 Tileset row 6 (deep water with ripple, reeds, wet meadow, plant decor, shore); every map's tileset entry at 56 tiles
- [x] 2.2 `cerknica_lake` map: shore path, wet meadow, reeds, shallows, islet, deep water; zones, area, spots, signpost, Neža
- [x] 2.3 Neža's sprite sheet

## 3. Region, habitat, quest

- [x] 3.1 `regions/cerknica.json` with weather; `areas/cerknica_lake.json`; `habitats/wetland.json`
- [x] 3.2 `npcs/neza.json`, `quests/vanishing_lake.json`; Luka's dialogue points to the lake

## 4. Tests

- [x] 4.1 Content tests: repository region, habitat, quest and species
- [x] 4.2 Map tests: Neža's tile, reachability with and without the boots, the corncrake's meadow spot
- [x] 4.3 Integration tests: four locked regions for a new save, the lake after Luka's quest (client fixtures needed no change)

## 5. Docs and validation

- [x] 5.1 README status and content notes; product vision roadmap
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: travel to the lake, Neža's quest, the heron, wading to the lily and the islet, the corncrake at dusk; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations and source wording in design.md
- [x] 5.5 Run `openspec validate add-cerknica-wetland --strict`, push, and verify all CI jobs pass on the pull request
