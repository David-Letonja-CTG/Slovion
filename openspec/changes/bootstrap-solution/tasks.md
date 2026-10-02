# Tasks

## 1. Repository and backend skeleton

- [ ] 1.1 Add `.gitignore` (dotnet + node), `.editorconfig`, `global.json` (SDK 10.0.x), `Directory.Build.props` (net10.0, nullable, implicit usings, warnings as errors) and `Directory.Packages.props`; verify `dotnet --version` inside the repo resolves to 10.0.x
- [ ] 1.2 Create `Slovion.slnx` with `Slovion.Domain`, `Slovion.Application`, `Slovion.Infrastructure`, `Slovion.Api` and their project references per design §1; verify `dotnet build` succeeds with zero warnings
- [ ] 1.3 Create `Slovion.Domain.Tests`, `Slovion.Application.Tests`, `Slovion.IntegrationTests`, `Slovion.ArchitectureTests` (xUnit); verify `dotnet test` discovers and runs them
- [ ] 1.4 Add architecture tests (NetArchTest) for the layer rules in design §2; verify they pass, and that temporarily adding a forbidden reference (Domain → Infrastructure) makes them fail

## 2. API, errors, health and database

- [ ] 2.1 Add `docker-compose.yml` with a `postgres:18` service, named volume and healthcheck; verify `docker compose up -d` reports the service healthy (requires WSL2 — see Risks)
- [ ] 2.2 Add `SlovionDbContext` (no entities) with Npgsql in Infrastructure, connection string from configuration with a development default; verify the API starts against the compose database
- [ ] 2.3 Add `/health` with the DbContext health check; add an integration test (Testcontainers) asserting 200 when the database is up and a non-healthy status when it is unreachable
- [ ] 2.4 Add problem-details with a mandatory `code` extension and an `/api/**` fallback returning 404 `not_found`; add an integration test for the "Unknown API route" scenario (localization spec)
- [ ] 2.5 Add built-in OpenAPI document at `/openapi/v1.json` (Development only); add an integration test asserting the document is served and valid JSON
- [ ] 2.6 Fix the API's local port in `launchSettings.json`; verify `dotnet run --project src/Slovion.Api` serves `/health`

## 3. Angular application and localization

- [ ] 3.1 Generate the Angular 22 workspace in `client/` (standalone, zoneless, Vitest, no SSR); add angular-eslint and Prettier; verify `ng lint`, `ng test` and `ng build` succeed
- [ ] 3.2 Check Transloco and transloco-keys-manager peer-dependency compatibility with Angular 22 before installing; if incompatible, apply the ngx-translate fallback and note it in design.md
- [ ] 3.3 Configure Transloco: `public/i18n/sl.json`, default/fallback `sl`, strict missing-key handler in dev/test; register `sl` locale data, set `LOCALE_ID` and `<html lang="sl">`; add unit tests for "First launch", "Locale-sensitive formatting" and "Missing key at runtime in tests"
- [ ] 3.4 Render the shell title from the catalog; add unit tests for "Text resolved by key" and "Second catalog in tests" (fixture `en` catalog in tests only, not shipped)
- [ ] 3.5 Add `npm run i18n:check` (transloco-keys-manager find, failing on missing keys); verify it fails when a template uses an unknown key and passes otherwise
- [ ] 3.6 Select an OFL pixel font, verify glyph coverage for `čšžćđČŠŽĆĐ` (e.g. by inspecting its cmap), self-host it under `public/fonts/` with its licence; verify visually in the browser that the diacritics render in the UI font
- [ ] 3.7 Add `proxy.conf.json` forwarding `/api`, `/health`, `/openapi` to the API; verify `ng serve` can fetch `/health` through the proxy

## 4. Engine and game viewport

- [ ] 4.1 Create `client/src/engine/` with an ESLint `no-restricted-imports` rule forbidding `@angular/*` and `rxjs`; verify lint fails when such an import is added to an engine file
- [ ] 4.2 Implement the pure viewport-scale function; add unit tests for every scaling scenario in the game-viewport spec (1280×720@1, 1000×700@1, 412×800@2.625, 240×300@1, 1920×1080@1)
- [ ] 4.3 Implement the fixed-timestep loop with injected `Clock`/`FrameScheduler`, 250 ms clamp and visibility pause; add unit tests for 30 fps, 144 fps, long stall and hidden-tab scenarios
- [ ] 4.4 Implement `createGame(canvas, options)` with `start()`/`stop()`, nearest-neighbour rendering and the checkerboard placeholder; add unit tests that `stop()` cancels the scheduled frame and removes resize/visibility/DPR listeners
- [ ] 4.5 Add `GameCanvasComponent` hosting the engine (create after render, `ResizeObserver` + DPR media query, stop on destroy); add a component test that destroying the component stops the game

## 5. CI and developer docs

- [ ] 5.1 Add `.github/workflows/ci.yml` with backend and client jobs per design §10; verify the workflow passes on a pushed branch
- [ ] 5.2 Update `README.md` with prerequisites and the four commands (DB, API, client, all checks); verify each command works as written on a clean checkout
- [ ] 5.3 Add build/test/lint commands to `CLAUDE.md` "Commands" section; verify they match README

## 6. Validation

- [ ] 6.1 Run `dotnet format --verify-no-changes`, `dotnet build`, `dotnet test`, `npm run lint`, `npm run i18n:check`, `npm test`, `npm run build`; all succeed
- [ ] 6.2 Manual check: open the app at 1280×720, a resized narrow window and a mobile emulation at DPR 2.625; the canvas is crisp, correctly scaled and letterboxed, and the title shows Slovenian text with diacritics
- [ ] 6.3 Review the full changed-file set against proposal non-goals (no game endpoints, tables, entities or speculative systems) and against every spec scenario; record any deviation in design.md
- [ ] 6.4 Run `openspec validate bootstrap-solution --strict`; it passes
