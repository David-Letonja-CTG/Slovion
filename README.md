# Slovion

An original 2D exploration RPG set in a fictionalized Slovenia. Instead of fictional monsters, the player discovers, identifies and learns about **real Slovenian nature** — animals, birds, insects, plants, trees, fungi and more — and records them in a field journal (the NatureDex).

> **Explore → Discover → Identify → Learn → Collect → Progress → Explore further**

- Primary language: Slovenian (`sl-SI`)
- For all ages; no combat, no capture — players collect *observations*
- No GPS — the game world is a fictionalized Slovenia, playable anywhere
- No personal data is collected

## Status

🚧 **First playable slice in progress.** Start a new game, walk across a small Dravsko polje meadow, observe real species (meadow sage, dandelion, brown hare, skylark, swallowtail), identify each one from sourced clues, read about it in *Terenski dnevnik* (the in-game NatureDex: a picture grid per habitat where found species turn from silhouettes to colour), and keep your progress after reloading. Vera, a nature conservationist by the path, gives the first quest (*Oko za naravo*: identify three species); completing it opens the gate into a hedgerow (*mejica*) with two more species, hawthorn and red-backed shrike. Art is placeholder.

First milestone: a small playable vertical slice in a **Dravsko polje meadow** — walk around, discover and identify a few real species, read about them in Slovenian, complete a small quest, and keep progress across reloads. See the [roadmap](docs/product-vision.md#roadmap--first-vertical-slice).

## Tech stack

| Area | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core (minimal APIs, OpenAPI), EF Core — modular monolith |
| Database | PostgreSQL (Docker for local development) |
| Frontend | Angular (UI, menus, NatureDex, localization) |
| Game rendering | Framework-free TypeScript engine on HTML Canvas |
| Platforms | Responsive web / PWA first (desktop, tablet, mobile) |

## Repository layout

```text
src/        .NET backend (Domain, Application, Infrastructure, Api)
tests/      backend tests (unit, integration, architecture)
client/     Angular app; client/src/engine/ = canvas game engine
content/    game content as versioned files: species (with sources), species pictures, habitats, NPCs, quests, maps (Tiled), tilesets
docs/       product vision and decision log
openspec/   specifications and change proposals
```

## Documentation

| Document | Contents |
|---|---|
| [docs/product-vision.md](docs/product-vision.md) | Game concept, world, systems, roadmap |
| [docs/decisions.md](docs/decisions.md) | Binding product and architecture decisions (D1–D10) |
| [openspec/](openspec/) | Capability specs and change proposals |
| [CLAUDE.md](CLAUDE.md) | Rules and conventions for the AI development agent |

## Development process

Slovion is built **one validated slice at a time** using [OpenSpec](https://github.com/Fission-AI/OpenSpec) spec-driven development:

**SPEC → PLAN → IMPLEMENT → VALIDATE**

Every behavior change starts as a change proposal in `openspec/changes/<change-id>/` (proposal, spec deltas, design, tasks). After implementation and validation it is archived and its specs are merged into `openspec/specs/`.

```bash
npm install -g @fission-ai/openspec
openspec list                     # in-progress changes
openspec show bootstrap-solution  # view a change
openspec validate --all --strict  # validate changes and specs
```

Specs (capabilities): [`localization`](openspec/specs/localization/spec.md), [`game-viewport`](openspec/specs/game-viewport/spec.md), [`input-actions`](openspec/specs/input-actions/spec.md), [`game-session`](openspec/specs/game-session/spec.md), [`world-exploration`](openspec/specs/world-exploration/spec.md), [`species-catalog`](openspec/specs/species-catalog/spec.md), [`discovery`](openspec/specs/discovery/spec.md), [`identification`](openspec/specs/identification/spec.md), [`naturedex`](openspec/specs/naturedex/spec.md), [`habitat-search`](openspec/specs/habitat-search/spec.md). Completed changes are in [`openspec/changes/archive/`](openspec/changes/archive/).

## Getting started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (pinned in `global.json`)
- [Node.js 24](https://nodejs.org/) + npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows: requires WSL2) — for the database and integration tests

### Run locally

```bash
# 1. Database (PostgreSQL on localhost:5432)
docker compose up -d db

# 2. API on http://localhost:5080 — /health, /openapi/v1.json
dotnet run --project src/Slovion.Api

# 3. Client on http://localhost:4200 (proxies /api, /health, /openapi to the API)
cd client
npm ci
npm start
```

### Run all checks

```bash
# Backend: formatting, build, unit + architecture + integration tests (integration tests need Docker)
dotnet format Slovion.slnx --verify-no-changes
dotnet test --solution Slovion.slnx

# Client: formatting, lint, translation keys, unit tests, production build
cd client
npm run check

# End-to-end: plays the demo path in Chromium (needs the database; starts API and client itself)
npx playwright install chromium   # once
npm run e2e
# next to your own running servers: E2E_API_PORT=5180 E2E_CLIENT_PORT=4300 npm run e2e
```

CI runs the same checks on every push and pull request (`.github/workflows/ci.yml`).

### Controls

Arrow keys or WASD to walk, Shift to run, E / Enter / Space to interact (talk to someone you face, or search while standing in tall grass), M to open *Terenski dnevnik*, Esc to close. In the observation dialog: arrows to choose, Enter to confirm, Esc to leave. In *Terenski dnevnik*: arrows to move through the pictures, Enter to open a species, Esc to go back. In a conversation: Enter for the next line, Esc to skip (mouse and touch work too).

### Content and database

- **Species** live in `content/species/<genus_species>.json`. Every fact needs a source; the API refuses to start on invalid content, and `dotnet test` validates it.
- **Species pictures** live in `content/species-pictures/<genus_species>.png`: original 32×32 pixel art, one per species (required). The journal shows them as silhouettes, greyscale or colour depending on progress.
- **Maps** are Tiled JSON in `content/maps/` (orthogonal, 16×16 tiles, layers `ground`, `decor`, `collision`, `objects`) and can be edited in [Tiled](https://www.mapeditor.org/). The `objects` layer holds the spawn, species spots, habitat zones (rectangles of class `habitat` with a `habitatId`), NPCs (tile objects of class `npc` with an `npcId`) and gates (tile objects of class `gate` with the `requiresFlag` that opens them).
- **Habitats** live in `content/habitats/<habitatId>.json`: a Slovenian display name (the journal section title), an `order` (position in the journal), the chance that a search finds something and the species weights (rarity). Chance and weights are fictional gameplay values, never shown to players. Every species must be listed in at least one habitat.
- **NPCs** live in `content/npcs/<npcId>.json` (a localized name) and **quests** in `content/quests/<questId>.json`: the giving NPC, the goal (how many species to identify), the reward flag, and Slovenian texts (title, tracker texts, dialogue per quest state; `{identified}` and `{goal}` are filled in). Every NPC gives exactly one quest, and every gate's flag must be some quest's reward. Dialogue addresses the player without gendered forms.
- **Database migrations** are applied automatically when the API starts. To add one: `dotnet tool restore`, then `dotnet ef migrations add <Name> --project src/Slovion.Infrastructure --output-dir Persistence/Migrations`.

## Content and IP

Slovion is an original IP inspired by the *genre* of classic handheld exploration RPGs. It does not use or imitate any assets, names, characters or data from existing franchises. All real-world species information is based on cited, authoritative sources; gameplay values (rarity, difficulty, rewards) are fictional.

"Slovion" is a working title; name/trademark availability has not yet been verified.
