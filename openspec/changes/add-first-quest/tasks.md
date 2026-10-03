## 1. Content and validation

- [x] 1.1 `content/npcs/vera.json` and `content/quests/eye_for_nature.json` with the approved Slovenian texts
- [x] 1.2 Tileset: gate and Vera tiles; meadow map: the NPC object at (7, 9), the gate object at (20, 19), and that tile made passable in the collision layer
- [x] 1.3 Domain content records `Npc` and `Quest`; content files and validation in `FileContentCatalog`: NPCs, quests, placeholders, map NPC and gate objects; catalog lookups
- [x] 1.4 Content validation tests for every new rule, plus the repository content

## 2. Quest progress (server)

- [x] 2.1 Domain `QuestProgress` and its tests
- [x] 2.2 `IQuestRepository`; EF Core configuration, repository (insert-if-absent) and migration `AddQuests`
- [x] 2.3 `QuestService` (conversation state table, completion with `TimeProvider`) and `ProgressService`; application tests for every state and edge case
- [x] 2.4 Endpoints `POST /api/save/conversations` and `GET /api/save/progress`; error code `unknown_npc`; integration tests, including reload, errors and OpenAPI

## 3. Engine

- [x] 3.1 Tiled parser: NPC and gate tile objects, with validation; tests
- [x] 3.2 `WorldMap` and `World`: NPC and gate blocking, `setOpenFlags`, NPC interaction precedence; tests
- [x] 3.3 Renderer: draw NPCs and closed gates between the map layers and the player; tests

## 4. Client

- [x] 4.1 `GameApi.talk` and `GameApi.progress`; `WorldLoader` loads progress with the map and handles its errors
- [x] 4.2 `DialogueBox` component; play screen routes NPC interactions, applies flags when the box closes, and handles errors
- [x] 4.3 `QuestTracker` component, fed by progress, conversations and identifications
- [x] 4.4 `sl.json` keys; component and play-screen tests for every scenario; `i18n:check` passes
- [x] 4.5 E2E: identify three species, talk to Vera, go through the gate into the hedgerow, reload with the gate still open

## 5. Docs and validation

- [x] 5.1 README: status, controls (talking), content folders (`npcs`, `quests`); `docs/product-vision.md` roadmap row 4 marked done once archived
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual play-through of the demo outcome on desktop and at phone size; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-first-quest --strict`, push, and verify all CI jobs pass on the pull request
