## 1. Server

- [x] 1.1 `Quest.GoalHabitatId`; quest loading and validation of the goal habitat; content tests
- [x] 1.2 `ProgressReader` counts per habitat; `QuestService` uses the quest's habitat; domain and application tests

## 2. Content

- [x] 2.1 NPCs `jure`, `maja`, `luka` with sprite sheets; the three quests; NPC objects on the region maps
- [x] 2.2 Pohorje and Triglav unlock by `pohorje_open` and `triglav_open`, with new hints; content and integration tests for the journey

## 3. Client

- [x] 3.1 Reload progress after a correct identification instead of counting locally; client tests
- [x] 3.2 E2E: update the travel and Pohorje search paths for the new unlocks

## 4. Docs and validation

- [x] 4.1 `docs/product-vision.md` roadmap (built changes, next: deeper journal entries, habitats, weather, inventory) and README
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual check: meet Jure and Luka in the game (Maja through the API), complete the journey, travel map hints; capture screenshots
- [x] 4.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 4.5 Run `openspec validate add-region-quests --strict`, push, and verify all CI jobs pass on the pull request
