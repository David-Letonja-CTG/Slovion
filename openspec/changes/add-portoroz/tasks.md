## 1. Species

- [x] 1.1 Sources: KPSS pages (stilt incl. observation calendar, little egret, glasswort, killifish), Krajinski park Strunjan (pen shell), sl.wikipedia (stilt, little egret, salema); GBIF
- [x] 1.2 Species groups `fish` and `mollusc` (domain, parser, client labels); tests
- [x] 1.3 Six species files with sourced facts, availability, clues and wildlife traits
- [x] 1.4 Pictures (32×32) and walk sprites (stilt, egret, killifish, salema, pen shell) in the art pass style

## 2. The snorkel

- [x] 2.1 Tool `snorkel` with its icon; Nina's quest rewards it
- [x] 2.2 Engine: `swimmable` tiles; the snorkel lets the player swim; aquatic residents may swim; tests

## 3. Map and art

- [x] 3.1 Tiles 142–147 (pebble beach, shallow sea and ripple, salt field, dyke, glasswort); every map's tileset entry at 152 tiles
- [x] 3.2 `portoroz_coast`: promenade with houses and lamps, beach, shallows, deep sea, salt pans with channel; zones, areas, spots, signpost, station, Nina
- [x] 3.3 Nina's sprite sheet

## 4. Region, habitats, quest, station

- [x] 4.1 `regions/portoroz.json`, areas, `habitats/saltpan.json`, `habitats/sea.json`, `stations/coast_station.json`
- [x] 4.2 `npcs/nina.json`, `quests/between_salt_and_sea.json`; Štefan's dialogue points onward

## 5. Tests and docs

- [x] 5.1 Content, integration and engine tests
- [x] 5.2 README and product vision
- [x] 5.3 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.4 Manual check: the promenade and salt pans by day, the lamps at night, Nina's quest and the snorkel, swimming to the salema and the pen shell, the travel map; screenshots
- [x] 5.5 Review the changed files against non-goals and every spec scenario; record deviations and source wording in design.md
- [x] 5.6 Run `openspec validate add-portoroz --strict`, push, and verify all CI jobs pass on the pull request
