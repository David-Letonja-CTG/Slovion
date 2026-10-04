## 1. Species

- [x] 1.1 Sources: park pages and sl.wikipedia read for exact text; GBIF names and families; gaps filled or left out
- [x] 1.2 Five species files with sourced facts, availability, clues and wildlife traits (`aquatic` for the olm)
- [x] 1.3 Pictures (32×32) and walk sprites for the three animals, in the art pass style

## 2. Rules

- [x] 2.1 Server: `WildlifeTraits.Aquatic` (content, validation, wildlife response); `underground` area property validated as a boolean; tests
- [x] 2.2 Engine: `underground` areas (parser, `World.isUnderground`, cave tint, torch circle, no weather, torch reactions); tests
- [x] 2.3 Engine and client: aquatic residents wander on water tiles only; the trait passed from the wildlife response; tests

## 3. Map and art

- [x] 3.1 Tiles 112–121 (rock wall, cave floor, cave wall, cave mouth, pool with ripple, scree, gorge floor, the two saxifrages); every map's tileset entry at 128 tiles
- [x] 3.2 `rakov_skocjan_karst`: gorge, stream, cave, pool; zones, areas (`zelske_jame` underground), spots, signpost, station, Tilen
- [x] 3.3 Tilen's sprite sheet

## 4. Region, habitat, quest, station

- [x] 4.1 `regions/rakov_skocjan.json`, areas, `habitats/karst.json`, `stations/cave_station.json`
- [x] 4.2 `npcs/tilen.json`, `quests/into_the_dark.json`; Neža's dialogue points onward

## 5. Tests and docs

- [x] 5.1 Content, integration, engine and client tests for the region, species, station and rules
- [x] 5.2 README and product vision
- [x] 5.3 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.4 Manual check: into the cave by day (darkness, torch, no rain), the olm in its pool, the beetle, the bat in winter, Tilen's quest; screenshots
- [x] 5.5 Review the changed files against non-goals and every spec scenario; record deviations and source wording in design.md
- [x] 5.6 Run `openspec validate add-karst-cave --strict`, push, and verify all CI jobs pass on the pull request
