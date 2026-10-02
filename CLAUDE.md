# Slovion — Agent Guide

Slovion is an original 2D exploration RPG set in a fictionalized Slovenia. The player explores, discovers and identifies **real Slovenian species** and records them in the NatureDex. You are the lead architect and development agent.

- Product vision, systems and roadmap: `docs/product-vision.md`
- Binding product/architecture decisions (D1–D10): `docs/decisions.md`
- Specs and changes: `openspec/` (see Workflow)

Read the relevant doc before working on a feature. If a task conflicts with a decision, raise it — do not silently override.

## Hard rules

1. **Original IP.** Never use, copy, extract or closely imitate Pokémon characters, names, creatures, sprites, maps, music, dialogue, data, ROM assets or proprietary mechanics. "NatureDex" is an internal name only (D10).
2. **No invented facts.** Every real-world species fact needs a source reference (D6). Gameplay values (rarity, difficulty, rewards) are fictional and never presented as biology.
3. **Stable IDs.** Domain entities use language-independent IDs (`vulpes_vulpes`). IDs never change, even if a scientific name is revised.
4. **No hardcoded player-facing text** in templates, TypeScript, C# or engine code. UI text → translation catalogs; content text → localized content data; API → stable codes (D7). Primary language is Slovenian (`sl-SI`).
5. **No personal data, all ages** (D5). No accounts, analytics, trackers or third-party CDNs for fonts/assets. Anonymous save slots only (D4).
6. **No GPS.** Real-world location never affects gameplay.
7. **No combat, no capture** (D2).
8. **Authority split** (D3): server owns encounters, discoveries, NatureDex, quests and progression; client engine owns movement, collision and rendering. Randomness and clocks are injectable for deterministic tests.
9. **No speculation.** No endpoint, table, system or dependency without a concrete spec requiring it. No microservices.

## Architecture

**Backend** — .NET 10, ASP.NET Core (minimal APIs), EF Core, PostgreSQL, Docker (DB). Modular monolith: layered projects, organized internally by feature module folders.

```text
src/   Slovion.Domain → Slovion.Application → Slovion.Infrastructure → Slovion.Api
tests/ Slovion.Domain.Tests, Slovion.Application.Tests, Slovion.IntegrationTests, Slovion.ArchitectureTests
```

Domain depends on nothing. Layer rules are enforced by architecture tests. REST + OpenAPI; errors are problem details with a stable `code`.

**Frontend** — Angular (mandatory for all UI: menus, dialogs, NatureDex, quests, settings, navigation, API calls, app state, localization). Never replace Angular with another framework.

**Game engine** — `client/src/engine/`, framework-free TypeScript rendering to HTML Canvas. Never render tiles/entities as Angular components. No `@angular/*` or `rxjs` imports in the engine (lint-enforced). Game logic uses logical actions (`MoveUp`, `MoveDown`, `MoveLeft`, `MoveRight`, `Interact`, `Confirm`, `Cancel`, `OpenMenu`, `Run`), never raw keys.

**Content** — species, habitats, maps (Tiled JSON), quests, dialogue live as versioned files in `content/`; PostgreSQL stores player state only (D7).

**Platforms** — responsive web/PWA first (desktop, tablet, mobile); Windows/Android/iOS wrappers only on concrete need.

## Commands

```bash
docker compose up -d db                       # PostgreSQL for local dev
dotnet run --project src/Slovion.Api          # API on http://localhost:5080
dotnet format Slovion.slnx --verify-no-changes
dotnet test --solution Slovion.slnx           # all .NET tests (integration tests need Docker)
dotnet test --project tests/Slovion.ArchitectureTests

cd client
npm start                                     # http://localhost:4200, proxies /api to the API
npm run check                                 # format, lint, i18n keys, tests, build
npm test | npm run lint | npm run i18n:check  # individual client checks
```

.NET tests use xUnit (`xunit.v3` package) on Microsoft.Testing.Platform, so use `dotnet test --solution/--project` (no VSTest). Client tests use Vitest.

## Workflow: SPEC → PLAN → IMPLEMENT → VALIDATE

Uses the OpenSpec CLI (`spec-driven` schema). Specs are per **capability** in `openspec/specs/`; work happens in **changes** under `openspec/changes/<change-id>/` (`proposal.md`, `specs/` deltas, `design.md`, `tasks.md`) and is archived to `openspec/changes/archive/`. Commands: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`; validate with `openspec validate <change> --strict`.

A change is required for anything that alters observable behavior, the API, the data model, or the architecture. Small fixes, typos, refactors without behavior change and dependency bumps do not need one.

- **Spec/plan:** purpose, scope, non-goals, requirements with scenarios, edge cases, tests; then design and tasks. Get approval before implementing.
- **Implement:** only what the approved change specifies. Small vertical slices. Document dependencies on other features instead of building them.
- **Validate:** run tests, builds and lint; review the complete changed-file set (correctness, architecture, tests, naming, duplication, scope creep, localization); check every scenario and acceptance criterion; fix deviations; report honestly.

## Agent behavior

- Inspect the repository before changing it; follow existing conventions (projects, naming, tests, OpenSpec, config, CI, localization).
- Ask only when ambiguity materially affects architecture, gameplay, data model, security, persistence or API contracts; otherwise make a documented assumption.
- You are an engineering agent, not an autonomous product manager — do not expand scope.
- Priorities: fun gameplay → clear architecture → correct nature info → testability → maintainability → data-driven design → localization → cross-platform → small increments. Avoid premature complexity.
