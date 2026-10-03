## 1. Species

- [x] 1.1 Research and write the thirteen species with sources, clues and availability; wildlife traits for the deer, squirrel and marmot
- [x] 1.2 Pictures for all thirteen, walk sprites for the three animals, and ground-plant tiles 40–45; tilesets of all maps grow to 48 tiles

## 2. Maps and habitats

- [x] 2.1 Habitat zones (including trees and shrubs), ground-plant spots and resident spots on the three region maps
- [x] 2.2 Region habitats list the new species with their weights

## 3. Engine

- [x] 3.1 Searching a faced blocked tile in a habitat zone; engine tests

## 4. Tests

- [x] 4.1 Content tests: the thirteen species, region habitats, zones and spots; update NatureDex and habitat tests for the new counts
- [x] 4.2 Engine map tests: spots reachable; spawn, signpost and path outside habitat zones; trees inside them
- [x] 4.3 E2E: search at a tree on Pohorje and identify what is found

## 5. Docs and validation

- [x] 5.1 README status (species of the regions, searching at trees)
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: each region's plants and animals on the map, searching at a tree on Pohorje (found a bilberry), the journal sections; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-region-species --strict`, push, and verify all CI jobs pass on the pull request
