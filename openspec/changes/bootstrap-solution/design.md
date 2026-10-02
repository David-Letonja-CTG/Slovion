# Design

## Context

Greenfield repository (only `README.md`, `CLAUDE.md`, OpenSpec scaffolding and `docs/`). Motivation: see proposal.md. Requirements: `specs/localization`, `specs/game-viewport`.

Relies on decisions in `docs/decisions.md`:
- **D3** — the client engine owns rendering/timing; the server owns game state (none yet).
- **D5** — no personal data and no third-party trackers → fonts and assets are self-hosted.
- **D7** — the API returns stable codes, never player-facing prose.
- **D9** — OpenSpec CLI conventions.

Toolchain verified on the dev machine: .NET SDK 10.0.401, Node 24.21, npm 11.19, Angular CLI 22.2.1, OpenSpec 1.14.0. Docker Desktop is installed but needs WSL2 (a reboot) before it can run.

## Goals / Non-Goals

**Goals:**
- Every layer compiles, runs and is covered by at least one meaningful automated test.
- Layer and engine boundaries are **enforced by tooling**, not by convention alone.
- One command per concern: start DB, run API, run client, run all checks.

**Non-Goals:**
- No domain types, entities, migrations or game endpoints. The empty layers exist only so the dependency rules can be tested.
- No containerized API image (deployment comes later). Docker is used for PostgreSQL only.
- No E2E browser tests yet (Playwright is introduced with the first gameplay change).

## Decisions

### 1. Repository layout

```text
Slovion.slnx
global.json                    # pins SDK 10.0.x (rollForward: latestFeature)
Directory.Build.props          # net10.0, nullable, implicit usings, warnings as errors
Directory.Packages.props       # central package management
docker-compose.yml             # postgres only
src/
  Slovion.Domain/              # no dependencies
  Slovion.Application/         # → Domain
  Slovion.Infrastructure/      # → Application, Domain (EF Core, Npgsql)
  Slovion.Api/                 # → Application, Infrastructure (composition root)
tests/
  Slovion.Domain.Tests/
  Slovion.Application.Tests/
  Slovion.IntegrationTests/    # WebApplicationFactory + Testcontainers
  Slovion.ArchitectureTests/   # layer dependency rules
client/                        # Angular workspace
  src/app/                     # Angular UI
  src/engine/                  # framework-free TypeScript engine
  public/i18n/sl.json          # UI translation catalog
  public/fonts/                # self-hosted UI/pixel font + licence
.github/workflows/ci.yml
```

- **`.slnx`** is the default solution format in .NET 10 and is easier to merge than `.sln`.
- **`Slovion.ArchitectureTests`** is a fourth test project, not listed in CLAUDE.md. The boundary rules span all layers, so they don't belong in a layer's own test project.
- **`content/`** is not created yet. It arrives with the first change that has content (D7).

### 2. Modular monolith inside layered projects

The four projects follow CLAUDE.md. Inside each project, code is grouped by **feature module folders** (`Slovion.Domain/NatureDex/…`, namespace `Slovion.Domain.NatureDex`), not by technical type. Architecture tests enforce:
- Domain references no other Slovion project, no EF Core and no ASP.NET Core.
- Application references only Domain.
- Infrastructure does not reference Api.

Module-to-module isolation rules come once a second module exists.
*Alternative considered:* one project per module (e.g. `Slovion.NatureDex.Domain`). Rejected for now because there are zero modules and that structure multiplies project count early.

### 3. API style, OpenAPI and errors

- **Minimal APIs** with one endpoint-group extension per module (`MapNatureDexEndpoints()` later). This uses less ceremony than controllers and fits feature folders.
- **OpenAPI:** the built-in `Microsoft.AspNetCore.OpenApi` serves the document at `/openapi/v1.json`, in Development only. An interactive UI can be added later if wanted.
- **Errors:** `AddProblemDetails()` customized to always include a `code` extension. A fallback for unmatched `/api/**` routes returns 404 `not_found` (localization spec).
- **Health:** `/health` uses the EF Core DbContext health check, so it also reports database connectivity. It's used by docker-compose, the integration tests and developers. It's not a gameplay endpoint.

### 4. Persistence

- EF Core 10 + Npgsql. `SlovionDbContext` lives in Infrastructure with **no entity sets** yet.
- Migrations start with the first change that persists state.
- The connection string comes from configuration. Development defaults point at the compose database, and no secrets are committed beyond local dev credentials.
- PostgreSQL image pinned to a major version (`postgres:18`).

### 5. Backend testing

- xUnit, using xUnit's own assertions. FluentAssertions is avoided because of its commercial licence since v8.
- Integration tests use `WebApplicationFactory<Program>` with a PostgreSQL **Testcontainers** instance, so CI and local runs need Docker.
- Architecture tests use **NetArchTest.Rules**. *Alternative:* ArchUnitNET is more powerful but heavier; it can be revisited if module-isolation rules get complex.

### 6. Angular application

- Angular 22, standalone components, **zoneless** change detection and signals, all current CLI defaults.
- Unit tests use Vitest (the CLI default), linting uses angular-eslint, and formatting uses Prettier.
- Dev proxy (`proxy.conf.json`) forwards `/api`, `/health` and `/openapi` to the API on a fixed local port, so no CORS configuration is needed.

### 7. Localization: Transloco with key-based JSON catalogs

- **Transloco**, with catalogs at `public/i18n/<lang>.json` and `sl` as both default and fallback language.
- A strict **missing-key handler** throws in development and tests (spec: missing translations are detected).
- `registerLocaleData(localeSl)` with `LOCALE_ID = 'sl'`, and `<html lang="sl">`.
- CI runs **transloco-keys-manager** in find mode to fail on keys used in code but missing from `sl.json`.
- *Alternative considered:* Angular's built-in `@angular/localize`. Rejected because it writes the source-language text into templates (conflicting with "no hardcoded strings"), needs a separate build per locale, and gives no runtime language switching.
- *Alternative:* ngx-translate is equivalent in capability. Transloco was chosen for its scoped catalogs and its tooling for finding missing keys.
- Content text (species, dialogue) is **not** in these catalogs (D7). It comes later with the content.

### 8. Engine boundary

- `client/src/engine/` is plain TypeScript. An ESLint `no-restricted-imports` rule forbids `@angular/*` and `rxjs` inside the engine, and engine unit tests run without Angular TestBed.
- Public surface: `createGame(canvas, options) → { start(), stop() }`. Time and frame scheduling are injected (`Clock`, `FrameScheduler`) so the loop is deterministic in tests.
- **Viewport math** is a pure function, `(availableCssSize, devicePixelRatio) → { scale, cssSize, backingStoreSize }`, so every scaling scenario in the spec is a plain unit test.
  - The integer scale is computed in **physical pixels**. The canvas backing store is `320·s × 180·s` physical pixels, and its CSS size is the backing store divided by DPR.
  - Below 1× the canvas falls back to fractional CSS downscaling.
- **Loop:** fixed 1/60 s accumulator with the 250 ms catch-up clamp. It pauses on `visibilitychange`, and on resume it resets the accumulator so hidden time is discarded.
- **Angular host:** a single `GameCanvasComponent` creates the game in `afterNextRender`, feeds it size changes from a `ResizeObserver` (plus DPR via `matchMedia`), and calls `stop()` through `DestroyRef`.
- **Placeholder rendering:** a 16-px checkerboard test pattern with a 1-px border, to make scaling and crispness visible by eye. This is temporary and replaced by the map renderer in the next change.

### 9. Font

- One self-hosted, **OFL-licensed pixel font** whose glyph coverage includes `čšžćđČŠŽĆĐ`. Coverage is checked before adoption, and the licence file is committed next to it.
- No Google Fonts CDN, which would send player IPs to a third party (D5).

### 10. CI

- One GitHub Actions workflow (ubuntu-latest), with two jobs:
  - **backend:** `dotnet format --verify-no-changes`, `dotnet build`, `dotnet test`. Testcontainers works on the hosted runner's Docker.
  - **client:** `npm ci`, lint, translation-key check, `ng test`, `ng build`.

## Risks / Trade-offs

- **[Docker not usable locally until WSL2 is enabled and the machine rebooted]** → Integration tests can't run locally until then. CI still runs them. Unit and architecture tests don't need Docker.
- **[Transloco or angular-eslint lagging behind Angular 22]** → Check peer-dependency compatibility first, during setup. If there's a mismatch, switch to ngx-translate, which needs no spec change.
- **[An empty skeleton tempts speculative code]** → The non-goals above are explicit, and the final validation step reviews the changed files for scope creep.
- **[Physical-pixel scaling yields fractional CSS sizes on odd DPRs]** → Accepted. Crispness depends on physical pixels, and the unit tests cover DPR 1, 2 and 2.625.
- **[Pixel font without full Latin Extended-A coverage]** → Coverage is checked before the font is adopted. If no suitable pixel font exists, use a clean OFL sans-serif for UI text, which doesn't affect the spec.

## Open Questions

- Which pixel font exactly. This is decided during the font task against the coverage requirement and doesn't change specs or tasks.
