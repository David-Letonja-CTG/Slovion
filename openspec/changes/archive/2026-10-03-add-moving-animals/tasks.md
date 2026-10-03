## 1. Content and art

- [x] 1.1 Generate the walk sprites (hare, skylark, swallowtail, shrike), Vera's sheet, the tree and tall-grass sway tiles, and the lamp
- [x] 1.2 `wildlife` blocks in the animal species; the shrike spot; remove animal decor tiles; tile animations in the map's tileset
- [x] 1.3 Validation: wildlife traits, wildlife and NPC sprites, tile animation frames; public folders; content tests

## 2. Server

- [x] 2.1 `WildlifeService` and `GET /api/save/wildlife` (`unknown_map`); searches pick only plants; application and integration tests

## 3. Engine

- [x] 3.1 Seeded random; tileset animations in the parser and the renderer
- [x] 3.2 Residents: wandering, waiting, torch reactions, blocking, interaction precedence, `setResidents`; tests
- [x] 3.3 NPC facings, idle turns, facing the player; NPC sprite drawing; resident drawing (mirrored); lamp drawing; tests

## 4. Client

- [x] 4.1 `GameApi.wildlife`; `WorldLoader` loads NPC, wildlife and lamp sprites; the play screen passes residents and refreshes them
- [x] 4.2 Client tests; E2E: the quest path identifies the hare through the API; the existing paths pass

## 5. Docs and validation

- [x] 5.1 README (moving animals, torch reactions, content: `wildlife`, sprites, animations)
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: animals wander, curious and shy at night with the torch, the lamp, swaying trees, Vera looking around and facing the player; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-moving-animals --strict`, push, and verify all CI jobs pass on the pull request
