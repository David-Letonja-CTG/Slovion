# Slovion

An original 2D exploration RPG set in a fictionalized Slovenia. Instead of fictional monsters, the player discovers, identifies and learns about **real Slovenian nature** — animals, birds, insects, plants, trees, fungi and more — and records them in a field journal (the NatureDex).

> **Explore → Discover → Identify → Learn → Collect → Progress → Explore further**

- Primary language: Slovenian (`sl-SI`)
- For all ages; no combat, no capture — players collect *observations*
- No GPS — the game world is a fictionalized Slovenia, playable anywhere
- No personal data is collected

## Status

🚧 **Planning stage.** The repository currently contains the product vision, architecture decisions and the first OpenSpec change. No code yet.

First milestone: a small playable vertical slice in a **Dravsko polje meadow** — walk around, discover and identify a few real species, read about them in Slovenian, complete a small quest, and keep progress across reloads. See the [roadmap](docs/product-vision.md#roadmap--first-vertical-slice).

## Tech stack

| Area | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core (minimal APIs, OpenAPI), EF Core — modular monolith |
| Database | PostgreSQL (Docker for local development) |
| Frontend | Angular (UI, menus, NatureDex, localization) |
| Game rendering | Framework-free TypeScript engine on HTML Canvas |
| Platforms | Responsive web / PWA first (desktop, tablet, mobile) |

## Planned repository layout

```text
src/        .NET backend (Domain, Application, Infrastructure, Api)
tests/      backend tests (unit, integration, architecture)
client/     Angular app; client/src/engine/ = canvas game engine
content/    species, maps, quests and dialogue as versioned data files
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

Current change: [`bootstrap-solution`](openspec/changes/bootstrap-solution/proposal.md) — solution skeleton, localization and game viewport.

## Getting started

Build and run instructions will be added with the `bootstrap-solution` change. Prerequisites:

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 24](https://nodejs.org/) + npm, and Angular CLI (`npm install -g @angular/cli`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows: requires WSL2)

## Content and IP

Slovion is an original IP inspired by the *genre* of classic handheld exploration RPGs. It does not use or imitate any assets, names, characters or data from existing franchises. All real-world species information is based on cited, authoritative sources; gameplay values (rarity, difficulty, rewards) are fictional.

"Slovion" is a working title; name/trademark availability has not yet been verified.
