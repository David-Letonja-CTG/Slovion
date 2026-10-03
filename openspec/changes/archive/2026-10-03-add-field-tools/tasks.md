## 1. Server

- [x] 1.1 Domain `Item`, `Quest.RewardItems`; tool loading and validation, item icons folder (public, no-cache); content tests
- [x] 1.2 `ProgressReader.ItemsOf`; `items` in progress and conversation results and responses; application and integration tests

## 2. Content

- [x] 2.1 Four tool files and icons; quest rewards for Vera, Jure and Maja
- [x] 2.2 Stream tiles (wadeable, ripple animation) in every map's tileset; Kočevje's stream and the salamander's new spot

## 3. Engine

- [x] 3.1 `Inventory` action and `I` key; `onOpenInventory`
- [x] 3.2 Tools in the world: wading with boots (player only), binoculars reach; wadeable tiles in the parser; engine tests

## 4. Client

- [x] 4.1 Items from progress and conversations; tools passed to the engine; new-tool notice
- [x] 4.2 The bag dialog and button; translations; magnifier's two clues; client tests
- [x] 4.3 E2E: the bag on a new game and after Vera's quest

## 5. Docs and validation

- [x] 5.1 README (tools, controls); CLAUDE.md logical actions; product vision roadmap
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: the bag, a new-tool notice, binoculars at a distance, two clues with the magnifier, wading the stream; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-field-tools --strict`, push, and verify all CI jobs pass on the pull request
