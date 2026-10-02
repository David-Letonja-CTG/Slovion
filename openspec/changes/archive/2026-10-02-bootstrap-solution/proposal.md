# Proposal

## Why

The repository contains no code. Before any gameplay slice can be built, Slovion needs a working, tested skeleton that wires together every layer the first slice depends on — .NET backend, PostgreSQL, Angular application, framework-free canvas engine, localization and CI — so integration problems surface now rather than inside the first gameplay change.

## What Changes

- Create the .NET 10 solution with `Slovion.Domain`, `Slovion.Application`, `Slovion.Infrastructure`, `Slovion.Api`, organized internally by feature module, plus test projects and architecture tests enforcing layer dependencies.
- ASP.NET Core API exposing an OpenAPI document and a health check (including database connectivity). No gameplay endpoints.
- PostgreSQL for local development via Docker Compose; EF Core wired to it (no game tables yet).
- Angular application (`client/`) with a sl-SI localization setup: every player-facing string comes from a translation catalog.
- Framework-free TypeScript game engine (`client/src/engine/`) with a fixed-timestep game loop and a pixel-perfect, integer-scaled canvas viewport hosted by an Angular component. Lint rules forbid Angular imports inside the engine.
- Development proxy so the Angular dev server reaches the API without CORS configuration.
- GitHub Actions CI: build, test and lint for backend and client.
- `global.json` pinning the .NET 10 SDK; shared build settings (nullable, warnings as errors, central package management).

**Demo outcome:** `docker compose up` + API + `ng serve` shows a Slovenian-titled page with a crisp, correctly scaled game canvas; `/health` reports healthy; CI is green.

## Capabilities

### New Capabilities

- `localization`: How player-facing text is sourced, which locale is used, how missing translations are detected, and how the backend avoids emitting player-facing prose.
- `game-viewport`: How the game world is presented on screen — fixed logical resolution, integer scaling, crisp pixels, responsiveness, and frame-rate-independent simulation timing.

### Modified Capabilities

None (no existing specs).

## Non-goals

- No gameplay: no maps, movement, input actions, species, encounters, NatureDex, quests or saving.
- No game API endpoints, no database tables or migrations for game state.
- No authentication, accounts or personal data (decisions D4, D5).
- No PWA/offline support, no native mobile packaging.
- No English or other second language — only the mechanism that allows it later.
- No deployment/hosting pipeline.

## Impact

- New: `Slovion.slnx`, `src/`, `tests/`, `client/`, `docker-compose.yml`, `global.json`, `Directory.Build.props`, `Directory.Packages.props`, `.editorconfig`, `.github/workflows/ci.yml`, `.gitignore`.
- Developer prerequisites: .NET 10 SDK, Node 24 + npm, Docker Desktop (WSL2), Angular CLI.
- New dependencies: Npgsql EF Core provider, ASP.NET Core OpenAPI, an architecture-test library, Testcontainers (PostgreSQL), a runtime Angular translation library, angular-eslint.
