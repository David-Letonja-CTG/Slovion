# Tasks

## 1. Content and owner review

- [x] 1.1 Get the owner's approval of the species content draft and the UI text draft in design.md (D6); record the approval date in design.md
- [x] 1.2 Create `content/species/salvia_pratensis.json` from the approved draft (every fact with source IDs, three sources); verify it parses as JSON and every fact lists at least one defined source
- [x] 1.3 Create original placeholder art: `content/tilesets/meadow.png` (16×16 tiles: grass variants, path, tall grass, hedge/fence, tree, flowers, sage marker) and `client/public/sprites/player.png` (4 directions × 2 frames); verify the dimensions are multiples of 16
- [x] 1.4 Create `content/maps/dravsko_polje_meadow.json` (Tiled JSON, 32×20 tiles, layers `ground`/`decor`/`collision`/`objects`, spawn 3 tiles left of the sage spot facing right, embedded tileset referencing `../tilesets/meadow.png`); verify the structure with a quick JSON check

## 2. Backend: content catalog

- [x] 2.1 Add Domain read models (`Species`, localized facts, `Source`, `MapSpot`) and a `SpeciesId` value type with the `genus_species` rule; verify domain tests for valid and invalid IDs pass (remove the zero-tests allowance from `Slovion.Domain.Tests`)
- [x] 2.2 Add `IContentCatalog` (Application) and the file loader and validator (Infrastructure) that collect all errors; verify table-driven tests for each failure (bad ID, duplicate, unsourced fact, unknown source, missing `sl`, map without spawn, spot with unknown species) and a test that the repository's `content/` is valid
- [x] 2.3 Link `content/**` into the API build output and load the catalog at startup; verify an integration test that startup with an invalid content folder fails with the listed errors
- [x] 2.4 Serve `/content/maps/*` and `/content/tilesets/*` as static files; verify integration tests that the map and tileset return 200 and `/content/species/salvia_pratensis.json` returns 404

## 3. Backend: saves and discoveries

- [x] 3.1 Add Domain `SaveSlot` and `Discovery`; verify domain tests (a discovery belongs to one slot and species)
- [x] 3.2 Add EF mappings (snake_case), pin `dotnet-ef` as a local tool, create the first migration and apply pending migrations at startup; verify the integration test database has `save_slots` and `discoveries` after startup
- [x] 3.3 Implement `POST /api/saves` with a 256-bit token, SHA-256 hash storage and the `/api/save` token endpoint filter; verify integration tests: `201` with a token, two calls give different tokens, the stored hash is not the token, and missing or unknown tokens give `401 invalid_save_token`
- [x] 3.4 Implement the application use cases `RecordDiscovery` and `GetNatureDex` with `TimeProvider`; verify Application tests with fakes: new → `isNew` true with clock time, repeat → false with the original time, unknown spot → error, oldest-first ordering (remove the zero-tests allowance from `Slovion.Application.Tests`)
- [x] 3.5 Implement `POST /api/save/discoveries` and `GET /api/save/naturedex` with content-language selection; verify integration tests for every discovery and NatureDex scenario: `201`/`200`, concurrent duplicates store one row, `404 unknown_spot`, persistence across a new app host, `Accept-Language` `sl`/`de`/none with the `Content-Language` header
- [x] 3.6 Verify architecture tests still pass and the OpenAPI document lists the three new endpoints (integration test)

## 4. Engine: input

- [x] 4.1 Implement `input/actions.ts`, `input/keyboard.ts` and `input/action-state.ts`; verify unit tests: default mapping by `KeyboardEvent.code`, custom mapping, auto-repeat ignored, release on blur and hidden, most-recent-direction stack
- [x] 4.2 Implement the action dispatcher with `world`/`ui` consumers and `onUiAction`; verify unit tests that only the current consumer receives actions and that `Enter` arrives as `Interact` in the world and as `Confirm` in the UI

## 5. Engine: world

- [x] 5.1 Implement `world/tiled.ts` and `world/world-map.ts`; verify unit tests that parse the real `dravsko_polje_meadow.json` (size, spawn, spot, blocked tiles) and report errors for a missing spawn, a missing required layer and a non-orthogonal map
- [x] 5.2 Implement the grid mover `world/player.ts`; verify unit tests: exactly 4 tiles in 1 s walking and 8 running at 30 and 144 fps, a single-frame tap makes one step, blocked tile and map edge only turn the player, a started step completes after release
- [x] 5.3 Implement `world/camera.ts`; verify unit tests: centred in the middle, clamped at corners, centred along a dimension where the map is smaller than the view
- [x] 5.4 Implement interaction with the faced tile; verify unit tests that a faced spot triggers `onInteract({ mapId, spotId })`, empty tiles and mid-step presses trigger nothing
- [x] 5.5 Implement `render/world-renderer.ts`, extend `createGame` with `world` and `onInteract`, and remove `placeholder-renderer.ts`; verify the game tests are updated (fake images and context: layer order, player drawn after ground, integer pixel positions) and engine lint passes

## 6. Angular: session, play screen and overlays

- [x] 6.1 Add the approved UI text keys to `sl.json`; verify `npm run i18n:check` passes once templates use them
- [x] 6.2 Implement `SaveTokenStore` (with in-memory fallback), `GameApi` and the auth/language interceptor; verify unit tests: storage that throws still works in memory, the token is sent only to `/api/save/**` and in the header, and `Accept-Language` follows the active language
- [x] 6.3 Implement `GameSession`, `TitleScreen`, the replace-save confirmation, routes and the `play` guard; verify component tests for every game-session scenario (first visit, returning, confirm/decline, unknown token, network error, storage blocked)
- [x] 6.4 Implement `WorldLoader` and `PlayScreen` hosting the engine with the loaded world, plus the map error message; verify component tests with a stubbed engine factory: the world is passed in, and a load failure shows `errors.map`
- [x] 6.5 Implement `DiscoveryDialog` and the interact → API → dialog flow with consumer switching; verify tests: new/known messages with the species name, network error, world input disabled while open and restored after `Confirm`/`Cancel`
- [x] 6.6 Implement `NatureDexPanel` (`OpenMenu` to open, `Cancel` to close, entry fields, *Viri*, empty state); verify component tests for every naturedex scenario
- [x] 6.7 Add `/content` to `proxy.conf.json`; verify by running API and client together that the meadow renders and the sage can be discovered (screenshot)

## 7. End-to-end test, CI and docs

- [x] 7.1 Add Playwright (Chromium) with `client/e2e/` and `npm run e2e` (webServer: API + `ng serve`); verify the demo-path test passes locally against `docker compose` PostgreSQL
- [ ] 7.2 Add the `e2e` CI job with a `postgres:18` service; verify it passes on the pull request
- [x] 7.3 Update README and CLAUDE.md (content folder, E2E command, migration command) and mark D10 *Terenski dnevnik* as final in `docs/decisions.md`; verify the documented commands run as written

## 8. Validation

- [x] 8.1 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 8.2 Manual play check in the browser: walk, run, bump into a hedge, discover the sage, read the entry with sources, reload and continue; capture screenshots
- [x] 8.3 Review the full changed-file set against proposal non-goals (no identification, encounters, position saving, touch controls) and every spec scenario; record deviations in design.md
- [x] 8.4 Run `openspec validate add-meadow-walking-skeleton --strict`; it passes
