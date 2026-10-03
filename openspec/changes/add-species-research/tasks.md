## 1. Server

- [x] 1.1 `SpeciesDiscovery` research level and `Research`; domain tests
- [x] 1.2 Migration `AddResearch` (existing identified rows get level 1); `IDiscoveryRepository.ResearchAsync`
- [x] 1.3 `EncounterService` researches on sightings of identified species; `NatureDexService` reveals facts and sources by level; application tests
- [x] 1.4 API fields `researched` and `researchLevel`, nullable hidden facts; integration tests including the migration upgrade

## 2. Client

- [x] 2.1 API types; research messages (`research.advanced`, `research.later`, `research.complete`); translations
- [x] 2.2 Journal: stars on identified pictures, level line and hint on the page, hidden facts left out; client tests
- [x] 2.3 E2E: the "come back later" message after observing an identified species again

## 3. Docs and validation

- [x] 3.1 README (research levels) and the spec list
- [x] 3.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 3.3 Manual check: identify, sight again at once and later (advancing the clock in the database), the journal at levels 1–3; capture screenshots
- [x] 3.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [ ] 3.5 Run `openspec validate add-species-research --strict`, push, and verify all CI jobs pass on the pull request
