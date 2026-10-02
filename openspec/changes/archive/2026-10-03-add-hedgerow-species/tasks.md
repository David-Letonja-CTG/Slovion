## 1. Species content

- [x] 1.1 Research `crataegus_monogyna` from Slovenian sources and write `content/species/crataegus_monogyna.json`: every fact sourced, three clues
- [x] 1.2 Research `lanius_collurio` the same way and write `content/species/lanius_collurio.json`
- [x] 1.3 Generate both 32×32 pictures in `content/species-pictures/`

## 2. Habitat order and the hedgerow habitat

- [x] 2.1 `order` in `HabitatFile` and the domain `Habitat`; validation (required, positive); `AllHabitats` sorted by order, then ID
- [x] 2.2 `order` 1 in `tall_grass.json`; new `content/habitats/hedgerow.json` (*Mejica*, order 2, 60 %, shrike 60, hawthorn 40)
- [x] 2.3 Tests: broken-content cases (missing or non-positive order); NatureDex ordering in application tests; fresh-save sections in integration tests

## 3. Map

- [x] 3.1 Add the hawthorn tiles to `content/tilesets/meadow.png` (a new row)
- [x] 3.2 Extend the meadow map to 32×28 with the hedgerow strip, its zones and the hawthorn spot; keep the southern hedge closed
- [x] 3.3 Update the parser tests (C# and TypeScript) for the new size, the hedgerow zone tiles and the closed hedge

## 4. Docs and validation

- [x] 4.1 README: species list in the status line; habitat `order` in the content notes
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual check: the journal shows both sections in order, the strip is visible but unreachable, and the art reads well; capture screenshots for the owner
- [x] 4.4 Review the changed files against non-goals and every spec scenario, and check every species fact against its source; record deviations in design.md
- [x] 4.5 Run `openspec validate add-hedgerow-species --strict`, push, and verify all CI jobs pass on the pull request
