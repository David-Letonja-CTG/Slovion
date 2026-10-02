## 1. Content and validation

- [x] 1.1 Generate the five 32×32 species pictures in `content/species-pictures/` (original pixel art, meadow palette, following the sourced characteristics)
- [x] 1.2 Add `text.sl.name` (*Visoka trava*) to `content/habitats/tall_grass.json`; extend `HabitatFile` and the domain `Habitat` with localized names
- [x] 1.3 `FileContentCatalog`: validate the habitat `sl` name, species pictures (exists, PNG signature, IHDR 32×32), and that every species is in at least one habitat; expose `AllHabitats` on `IContentCatalog`
- [x] 1.4 Serve `species-pictures` as a public content folder
- [x] 1.5 Content validation tests for each new rule, using the `ContentFolder` fixture (pictures written by the fixture), plus repository content

## 2. NatureDex sections (server)

- [x] 2.1 `NatureDexSection` and `NatureDexSlot`; `NatureDexService.GetAsync` builds sections by habitat ID, species in content order, with habitat-name language fallback
- [x] 2.2 Application tests: fresh save, statuses, species in two habitats, ordering, name fallback, removed species skipped
- [x] 2.3 Endpoint: new response shape (`habitats[]` with `habitatId`, `name`, `species[]` of `speciesId`/`status`/`entry`); update the OpenAPI checks
- [x] 2.4 Integration tests: the NatureDex response for fresh, observed and identified saves; picture download `200 image/png`; species JSON still not served

## 3. Client

- [x] 3.1 `game-api.ts`: new NatureDex types (`NatureDexSection`, `NatureDexSlot`, status `unknown`)
- [x] 3.2 `naturedex-selection.ts`: the pure `move` function and its tests
- [x] 3.3 Rewrite `naturedex-panel` as grid, card and page views: pictures with state filters, labels on hover, focus and selection, counts, empty message, *Nazaj*, focus handling, `handleAction`
- [x] 3.4 `play-screen`: route UI actions to the panel (`Cancel` returns from a view, then closes)
- [x] 3.5 `sl.json`: `naturedex.progress`, `naturedex.unknownLabel`, `naturedex.back`; `i18n:check` passes
- [x] 3.6 Panel and play-screen tests for every naturedex scenario
- [x] 3.7 E2E: update the sage and observed-only paths for the grid (count, hover label, page, back, close)

## 4. Docs and validation

- [x] 4.1 README: content folder (species pictures), journal description
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual check on desktop and a phone-sized viewport: the three states, hover labels, keyboard navigation, page and back; capture screenshots for the owner's review of the pictures
- [x] 4.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 4.5 Run `openspec validate add-naturedex-habitat-grid --strict`, push, and verify all CI jobs pass on the pull request
