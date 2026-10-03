## 1. Clock and availability (domain and content)

- [x] 1.1 Domain `Season`, `TimeOfDay`, `WorldTime` (since creation, from minutes) with the shared case table in tests
- [x] 1.2 Domain `Availability` with `IsAvailable`; `Species` gains it; tests
- [x] 1.3 Source the two missing facts (the shrike's autumn departure, the swallowtail's day flight) and add `availability` to all 7 species files
- [x] 1.4 `FileContentCatalog` reads and validates availability; content validation tests, plus repository values

## 2. Server

- [x] 2.1 `EncounterService`: the save's world time from `CreatedAt` and `TimeProvider`; spot `NotNow`; search over available species only; application tests
- [x] 2.2 `POST /api/save/encounters` answers `200 { found: false }` for `NotNow`; `GET /api/save/time`; integration tests with a fake clock, plus OpenAPI

## 3. Engine

- [x] 3.1 `world-time.ts` (the same rule, with the shared case table); the world advances time per step and reports season and time-of-day changes
- [x] 3.2 Renderer tint by time of day; `GameOptions.worldTime`, `onConditionsChange`, `Game.setWorldTime`; tests

## 4. Client

- [x] 4.1 `GameApi.time()`; the play screen loads the time with the world, passes it to the game, and re-syncs when the page becomes visible
- [x] 4.2 `ConditionsIndicator` component; spot *not now* message; `sl.json` keys
- [x] 4.3 Component and play-screen tests for every scenario; E2E checks *Pomlad · jutro*

## 5. Docs and validation

- [x] 5.1 `docs/decisions.md` D8 accepted; README (time and seasons, availability content)
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: the morning start, the evening and night tint with a fake or advanced server clock, a spot answering *not now*, the indicator; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-world-conditions --strict`, push, and verify all CI jobs pass on the pull request
