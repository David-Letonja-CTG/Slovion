# Tasks

## 1. Content and owner review

- [x] 1.1 Get the owner's approval of the species content draft (including the ⚠ items) and the UI text in design.md; record the decisions in design.md
- [x] 1.2 Extend the content validator with `group` and `identification.clues` rules; verify table-driven tests for an unknown group, a clue out of range, duplicate clues and fewer than three clues
- [x] 1.3 Add `group` and clues to `salvia_pratensis.json` and create the four approved species files; verify the repository content test passes and every fact cites a defined source
- [x] 1.4 Extend the placeholder tileset to 8×2 tiles with dandelion, hare, skylark and swallowtail tiles, and add their four spots to the meadow map; verify existing tile IDs are unchanged and all spots are reachable (client map test)

## 2. Backend: encounters and identification

- [x] 2.1 Add `Encounter` and identification state to the domain (`ObservedAt`, `IdentifiedAt`, idempotent `Identify`); verify domain tests
- [x] 2.2 Add the `IRandomSource` port and candidate selection; verify Application tests: four distinct candidates including the correct one, deterministic for a seed, all species when fewer than four exist
- [x] 2.3 Implement `EncounterService` (start: unknown spot / already identified / started with clues and candidates and observation recorded; answer: unknown encounter / not a candidate / correct / wrong) with fakes; verify Application tests for each outcome and that clues come from the declared characteristics
- [x] 2.4 Add the `AddEncounters` migration (rename `observed_at`, add `identified_at` set from existing rows, `encounters` table, partial unique index) and repositories with atomic close; verify an integration test that a walking-skeleton discovery becomes an identified entry after migrating
- [x] 2.5 Replace `POST /api/save/discoveries` with the encounter and identification endpoints and extend the NatureDex response; verify integration tests for every identification and discovery scenario (`201`/`200`, `unknown_spot`, `unknown_encounter`, `bad_request` leaving the encounter open, answering twice, another save's encounter, one open encounter per save, concurrent starts, persistence across restart, `Content-Language`) and that OpenAPI lists the new endpoints

## 3. Client

- [x] 3.1 Add the approved UI text to `sl.json` and remove `discovery.new`/`naturedex.season`; verify `npm run i18n:check`
- [x] 3.2 Update `GameApi` types and calls (start encounter, answer, staged NatureDex entries); verify unit tests for the new requests and `unknown_encounter` error mapping
- [x] 3.3 Implement `IdentificationDialog` (clues revealed one by one, candidates, leave, keyboard selection via UI actions, mouse); verify component tests for the dialog scenarios
- [x] 3.4 Wire the play screen: interaction → encounter → dialog → answer → result message, plus the already-identified message and errors; verify component tests for correct, wrong, leave, already identified, network error and input routing
- [x] 3.5 Show observed entries as *Neznana vrsta* with group and hint, and the group-specific season label; verify NatureDex component tests

## 4. End-to-end, CI and docs

- [x] 4.1 Update the E2E demo path (identify the sage by clicking its name) and add a wrong-answer E2E test that checks the *Neznana vrsta* entry; verify `npm run e2e` passes locally
- [x] 4.2 Update `docs/product-vision.md` (roadmap: this change and `add-habitat-search`) and README controls/description; verify the links resolve
- [x] 4.3 Push and verify all CI jobs pass on the pull request

## 5. Validation

- [x] 5.1 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.2 Manual play check: identify one species correctly, one wrongly then correctly, leave an encounter, read entries; capture screenshots
- [x] 5.3 Review the changed-file set against non-goals and every spec scenario; record deviations in design.md
- [x] 5.4 Run `openspec validate add-species-identification --strict`; it passes
