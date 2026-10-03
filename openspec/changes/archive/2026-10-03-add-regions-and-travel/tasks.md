## 1. Content and art

- [x] 1.1 Research and write `ursus_arctos`, `canis_lupus` and `rupicapra_rupicapra` with sources, clues, availability and wildlife traits; pictures and walk sprites
- [x] 1.2 New tileset rows (forest, alpine and signpost tiles, sway frames); the three maps with spawn, signpost, area zone and resident spot; the meadow signpost
- [x] 1.3 Areas, habitats and the four region files

## 2. Server

- [x] 2.1 Domain: `Region`, `UnlockRule`, `SaveSlot.RegionId` and `TravelTo`; tests
- [x] 2.2 Content: region loading and validation, signpost validation, `AllRegions`/`FindRegion`; content tests including the repository scenarios
- [x] 2.3 Migration `AddCurrentRegion`; `ISaveSlotRepository.UpdateAsync`
- [x] 2.4 `ProgressReader` shared by `QuestService` and `TravelService`; `TravelService`; application tests
- [x] 2.5 `GET /api/save/regions`, `POST /api/save/travel`, error codes `unknown_region` and `region_locked`; integration tests

## 3. Engine

- [x] 3.1 Signpost parsing, blocking, drawing and the `signpost` interaction in the precedence; tests

## 4. Client

- [x] 4.1 `GameApi.regions` and `travel`; the play screen enters the current region's map and uses the loaded map ID everywhere
- [x] 4.2 Travel map dialog with the schematic SVG, keyboard, pointer and locked hints; translations
- [x] 4.3 Travel: fade out, load the new place, start the new game, fade in, banner; reduced motion; errors; client tests
- [x] 4.4 E2E: travel to Kočevje after Vera's quest, reload and continue there; the existing paths pass

## 5. Docs and validation

- [x] 5.1 README (regions, travel, content: `regions`, signposts) and the spec list
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: travel map, locked hints, the fade, each region with its animal, *Nadaljuj* after travelling; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-regions-and-travel --strict`, push, and verify all CI jobs pass on the pull request
