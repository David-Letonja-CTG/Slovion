## 1. Species

- [x] 1.1 Sources: DOPPS, park pages, Botanični vrt UL, a habitat source for the fritillary, the hedgehog's naming; GBIF
- [x] 1.2 Five species files with sourced facts, availability, clues and wildlife traits; the fritillary in `wetland`
- [x] 1.3 Pictures (32×32) and walk sprites (swift, hedgehog, kingfisher) in the art pass style

## 2. Lamps

- [x] 2.1 Server: `lamp` tile objects validated with the other tile objects; tests
- [x] 2.2 Engine: lamps parsed, blocking; renderer darkness layer with holes for the torch and lamps; tests

## 3. Map and art

- [x] 3.1 Tiles 122–133 (paving, roofs, walls, bridge, lamp post, fritillary, black alder and sway, park hedge, lawn); every map's tileset entry at 136 tiles
- [x] 3.2 `ljubljana_park`: street, park, river, bridge, barje strip; zones, areas, spots, lamps, signpost, station, Ana
- [x] 3.3 Ana's sprite sheet

## 4. Region, habitat, quest, station

- [x] 4.1 `regions/ljubljana.json`, areas, `habitats/city.json`, `stations/city_station.json`
- [x] 4.2 `npcs/ana.json`, `quests/city_nature.json`; Tilen's dialogue points onward

## 5. Tests and docs

- [x] 5.1 Content, integration, engine and renderer tests
- [x] 5.2 README and product vision
- [x] 5.3 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.4 Manual check: the park by day and at night (lamps), the kingfisher, the hedgehog at night, the fritillary, Ana's quest; screenshots
- [x] 5.5 Review the changed files against non-goals and every spec scenario; record deviations and source wording in design.md
- [x] 5.6 Run `openspec validate add-ljubljana --strict`, push, and verify all CI jobs pass on the pull request
