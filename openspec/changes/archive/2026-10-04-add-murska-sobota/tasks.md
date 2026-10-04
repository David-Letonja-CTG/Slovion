## 1. Species

- [x] 1.1 Sources: Notranjski regijski park pages, DOPPS (*Štorklje*), sl.wikipedia (stork, otter, hoopoe); GBIF
- [x] 1.2 Five species files with sourced facts, availability, clues and wildlife traits; the skylark in `farmland`, the otter and the purple willow in `wetland`
- [x] 1.3 Pictures (32×32) and walk sprites (stork, hoopoe, otter) in the art pass style

## 2. Perched animals

- [x] 2.1 Server: the `perched` trait (loading, validation, wildlife response); tests
- [x] 2.2 Engine: perched residents stay on their home tile, which may be blocked, and don't react to the torch; tests

## 3. Map and art

- [x] 3.1 Tiles 134–141 (chimney with the nest, ploughed and crop fields, field pansy, purple willow, gravel bank, old fruit tree and sway); every map's tileset entry at 144 tiles
- [x] 3.2 `murska_sobota_village`: street and houses with the nest, fields, orchard, oxbow, Mura bank; zones, areas, spots, signpost, station, Štefan
- [x] 3.3 Štefan's sprite sheet

## 4. Region, habitat, quest, station

- [x] 4.1 `regions/murska_sobota.json`, areas, `habitats/farmland.json`, `stations/farmland_station.json`
- [x] 4.2 `npcs/stefan.json`, `quests/under_the_storks_nest.json`; Ana's dialogue points onward

## 5. Tests and docs

- [x] 5.1 Content, integration and engine tests
- [x] 5.2 README and product vision
- [x] 5.3 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.4 Manual check: the stork on the chimney (also in the evening with the torch), the hoopoe, the field pansy, the otter, the travel map; screenshots
- [x] 5.5 Review the changed files against non-goals and every spec scenario; record deviations and source wording in design.md
- [x] 5.6 Run `openspec validate add-murska-sobota --strict`, push, and verify all CI jobs pass on the pull request
