# Tasks

## 1. Content

- [x] 1.1 Get the owner's approval of the gameplay values and UI text in design.md; record it in design.md
- [x] 1.2 Extend the server content loader and validator with habitat files and map habitat zones; verify table-driven tests (unknown species, non-positive weight, chance out of range, duplicate habitat, zone naming a missing habitat, overlapping zones) and a repository-content test that `tall_grass` exists
- [x] 1.3 Add `content/habitats/tall_grass.json` and the two meadow zones; verify that the server and client parser tests agree on which tiles belong to `tall_grass` (south and north patches yes, path no)

## 2. Backend

- [x] 2.1 Add `Sighting` and `Habitat` to the domain and switch `SpeciesDiscovery`/`Encounter` to sightings with an optional habitat; verify domain tests (exactly one of spot or habitat)
- [x] 2.2 Implement `EncounterService.SearchAsync` with the two-draw roll; verify Application tests: nothing found, found and started, found and already identified, deterministic for a seed, weight frequencies over many seeded rolls, unknown habitat
- [x] 2.3 Add migration `AddHabitatSearch` and map the new columns; verify an integration test that a search-found observation stores its habitat and no spot
- [x] 2.4 Add `POST /api/save/searches`; verify integration tests with a seeded random source for `201`, `200 found:false`, `200 alreadyIdentified`, `404 unknown_habitat`, `400 bad_request`, `401`, and that OpenAPI lists the endpoint

## 3. Engine and client

- [x] 3.1 Parse habitat zones in the client and add `WorldMap.habitatAt`; make `Interaction` a spot/search union, preferring a faced spot; verify engine tests for every world-exploration scenario
- [x] 3.2 Add `GameApi.search`, the `nothing` overlay and the UI text; route search interactions; verify component tests for nothing found, found (dialog opens), already identified, `unknown_habitat` error and input blocking
- [x] 3.3 Add an E2E test that searches the south tall-grass zone and handles either outcome; verify `npm run e2e` passes

## 4. Docs, CI and validation

- [x] 4.1 Update README (controls, content folder: habitats) and CLAUDE.md content note; verify the links resolve
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual play check: search both zones, get both outcomes, identify a found species; capture screenshots
- [x] 4.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 4.5 Run `openspec validate add-habitat-search --strict`, push, and verify all CI jobs pass on the pull request
