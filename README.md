# Slovion

An original 2D exploration RPG set in a fictionalized Slovenia. Instead of fictional monsters, the player discovers, identifies and learns about **real Slovenian nature** — animals, birds, insects, plants, trees, fungi and more — and records them in a field journal (the NatureDex).

> **Explore → Discover → Identify → Learn → Collect → Progress → Explore further**

- Primary language: Slovenian (`sl-SI`)
- For all ages; no combat, no capture — players collect *observations*
- No GPS — the game world is a fictionalized Slovenia, playable anywhere
- No personal data is collected

## Status

🚧 **First playable slice in progress.** Start a new game, walk across a small Dravsko polje meadow, observe real species (meadow sage, dandelion, brown hare, skylark, swallowtail), identify each one from sourced clues, read about it in *Terenski dnevnik* (the in-game NatureDex: a picture grid per habitat where found species turn from silhouettes to colour), and keep your progress after reloading. Vera, a nature conservationist by the path, gives the first quest (*Oko za naravo*: identify three species); completing it opens the gate into a hedgerow (*mejica*) with two more species, hawthorn and red-backed shrike. An in-game clock (one real second = one in-game minute, three in-game days per season) brings mornings, evenings, nights and seasons: species are only found when they are around, e.g. in winter only the skylark and the hare. A corner indicator shows the season, time of day, clock and the current place; entering another place shows its name in a banner, and at night a torch lights a circle around the player. Animals live in the world: they wander around their home, can be met and identified by walking up to them, and react to the torch at night (curious ones come closer, shy ones move away); trees and grass sway, and Vera looks around. Searching the grass finds plants. A signpost (*kažipot*) by every spawn opens a travel map of Slovenia: the regions form a journey — Vera's quest opens Kočevje (with the brown bear), where the forester Jure's quest opens Pohorje (the wolf), where the warden Maja's quest opens Triglav (the chamois) and the mountain guide Luka, whose quest opens Cerkniško jezero (the birdwatcher Neža, a heron on the shore and a corncrake in the wet meadow at dusk), whose quest opens Rakov Škocjan (the cave researcher Tilen, a karst gorge and the dark cave Zelške jame with the olm, the first described cave beetle and, in winter, a hibernating bat; underground the lamp lights the way), whose quest opens Ljubljana (the park gardener Ana in a city park by the Ljubljanica, with swifts over the houses, a kingfisher on the bank, a hedgehog on the lawn at night and, beyond the bridge, a strip of Ljubljansko barje with the snake's-head fritillary; street lamps light the park in the evening and at night), whose quest opens Murska Sobota (the farmer Štefan in a Prekmurje village, with a white stork standing on its nest on a chimney, a hoopoe in the old orchard, field pansies at the field edges, and an otter in an oxbow of the Mura) — and the game continues in the region where the player last was. Region quests count only that region's species. Identified species can be researched further: seeing one again at another time of day (or on another day) raises its research level up to three stars, and each level reveals more of its journal page. Each region has its own weather (clear, cloudy, rain, fog or snow), changing every six in-game hours and drawn over the map; salamanders come out by day in the rain. A bag (*Nahrbtnik*) holds field tools: the lamp from the start, then binoculars (Vera), a magnifier (Jure) and rubber boots (Maja), which let the player identify animals from three tiles away, see two clues at once for plants and insects, and wade across Kočevje's stream and the lake's shallows. Each region has its own animals, flowers and trees (47 species in all), searchable forest floor, bog edges, alpine grassland and the lake's wet meadow, reeds and shallows, and trees, shrubs and rocks inside those areas can be searched like tall grass. Every region has a research station (*raziskovalna postaja*) with a themed list of species, e.g. forest trees or birds; fully researching enough of them (★★★) earns a certificate (*potrdilo*) on the *Potrdila* page of *Terenski dnevnik*. The game can be installed as an app (PWA): it opens without a connection (playing needs one) and offers new versions with *Osveži*. All art is original pixel art in one shared palette: textured map tiles with path edges and shadowed decor, outlined characters and animals with walking frames, and outlined, shaded species pictures.

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
content/    game content as versioned files: species (with sources), species pictures, habitats, NPCs, quests, regions, maps (Tiled), tilesets
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

Specs (capabilities): [`localization`](openspec/specs/localization/spec.md), [`game-viewport`](openspec/specs/game-viewport/spec.md), [`input-actions`](openspec/specs/input-actions/spec.md), [`game-session`](openspec/specs/game-session/spec.md), [`world-exploration`](openspec/specs/world-exploration/spec.md), [`species-catalog`](openspec/specs/species-catalog/spec.md), [`discovery`](openspec/specs/discovery/spec.md), [`identification`](openspec/specs/identification/spec.md), [`naturedex`](openspec/specs/naturedex/spec.md), [`habitat-search`](openspec/specs/habitat-search/spec.md), [`quests`](openspec/specs/quests/spec.md), [`player-progress`](openspec/specs/player-progress/spec.md), [`world-conditions`](openspec/specs/world-conditions/spec.md), [`map-areas`](openspec/specs/map-areas/spec.md), [`wildlife`](openspec/specs/wildlife/spec.md), [`regions`](openspec/specs/regions/spec.md), [`species-research`](openspec/specs/species-research/spec.md), [`weather`](openspec/specs/weather/spec.md). Completed changes are in [`openspec/changes/archive/`](openspec/changes/archive/).

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

# End-to-end: plays the demo path in Chromium, and checks the installable production build offline
# (needs the database; starts the API, the client and a production build server itself)
npx playwright install chromium   # once
npm run e2e
# next to your own running servers: E2E_API_PORT=5180 E2E_CLIENT_PORT=4300 npm run e2e
```

CI runs the same checks on every push and pull request (`.github/workflows/ci.yml`).

### Installing the app

Production builds (`npm run build`) are an installable app (PWA): a web app manifest with icons, and a service worker that caches the built app so it opens without a connection. The dev server never registers the service worker. Browsers offer *Install* / *Add to Home Screen* over HTTPS or on `localhost`; playing still needs the server (D3). To try it locally, run the API, then `npm run build` and `node e2e/serve-dist.mjs 4201` in `client/`, and open http://localhost:4201. The service worker never caches `/api` or `/content`; a new version shows *Osveži*.

### Controls

Arrow keys or WASD to walk, Shift to run, E / Enter / Space to interact (talk to someone you face, read the signpost, search a tree or shrub you face, or search while standing in tall grass), L to switch the torch (*svetilka*) on or off, I to open the bag (*Nahrbtnik*), M to open *Terenski dnevnik*, Esc to close. In the observation dialog: arrows to choose, Enter to confirm, Esc to leave. In *Terenski dnevnik*: arrows to move through the pictures, Enter to open a species, Esc to go back. In a conversation: Enter for the next line, Esc to skip. On the travel map: up and down to choose a region, Enter to travel, Esc to close (mouse and touch work too).

### Content and database

- **Species** live in `content/species/<genus_species>.json`. Every fact needs a source; the API refuses to start on invalid content, and `dotnet test` validates it. Animals also declare `wildlife` traits (the torch reaction `curious`, `shy` or `calm`; fictional gameplay data, never shown as a fact) and have a walk sprite in `content/wildlife-sprites/<genus_species>.png` (two 16×16 frames facing right). `availability` lists the seasons (and optionally the times of day) a species can be found, with sources: derived from sourced months (spring = March–May, …), plants count while they flower (trees and shrubs all year, since they are always there), and times of day are only restricted where a source says so. `alsoInWeather` lists weathers in which a species is also found at any time of day, again only where a source says so.
- **Species pictures** live in `content/species-pictures/<genus_species>.png`: original 32×32 pixel art, one per species (required). The journal shows them as silhouettes, greyscale or colour depending on progress.
- **Maps** are Tiled JSON in `content/maps/` (orthogonal, 16×16 tiles, layers `ground`, `decor`, `collision`, `objects`) and can be edited in [Tiled](https://www.mapeditor.org/). The `objects` layer holds the spawn, species spots, habitat zones (rectangles of class `habitat` with a `habitatId`), area zones (rectangles of class `area` with an `areaId`; every walkable tile must lie in one), NPCs (tile objects of class `npc` with an `npcId`), gates (tile objects of class `gate` with the `requiresFlag` that opens them) exactly one signpost (a tile object of class `signpost`) and optional lamp posts (tile objects of class `lamp`), which block their tile and light a circle around them in the evening and at night.
- **Habitats** live in `content/habitats/<habitatId>.json`: a Slovenian display name (the journal section title), an `order` (position in the journal), the chance that a search finds something and the species weights (rarity). Chance and weights are fictional gameplay values, never shown to players. Every species must be listed in at least one habitat.
- **Regions** live in `content/regions/<regionId>.json`: the region's map (every map belongs to exactly one region), its position on the travel map (percent of `client/public/images/slovenia.svg`), its order in the travel list, a Slovenian name and locked hint, and an unlock rule: `{}` (always open), `{ "flag": "<flag>" }` (a quest reward) or `{ "identifiedSpecies": <n> }`. Unlock rules are fictional gameplay data. `weather` holds weights per season and weather kind (fictional gameplay data, D11). New saves start in `dravsko_polje`.
- **Tools** live in `content/items/<id>.json` (a localized name and description, and whether every save starts with it) with a 16×16 icon in `content/item-icons/<id>.png`; quests give tools with `reward.items`. Tool effects are keyed by ID (`lamp`, `binoculars`, `magnifier`, `boots`). Tileset tiles with the property `wadeable` are crossable with the boots.
- **Research stations** live in `content/stations/<id>.json`: a localized name and theme, a list of species and a goal (how many of them must reach research level 3; fictional gameplay data). Each station is placed on exactly one map as a tile object of class `station` with a `stationId`; completion is derived from research levels, nothing is stored.
- **Underground areas:** an area zone may carry the boolean Tiled property `underground` (a cave): there the map is dark at any time of day, the torch lights a circle, no weather is drawn and animals react to the torch.
- **Aquatic animals** declare `"aquatic": true` in their `wildlife` traits: they live and wander on wadeable water tiles only. **Perched animals** declare `"perched": true`: they stay on their home spot's tile, which may be blocked (a nest on a roof), and are met by facing it. An animal cannot be both.
- **Areas** (named places) live in `content/areas/<areaId>.json`: a localized name shown in the corner and in the banner when the player enters the place.
- **NPCs** live in `content/npcs/<npcId>.json` (a localized name) with a 4-facing sprite sheet in `content/npc-sprites/<npcId>.png` and **quests** in `content/quests/<questId>.json`: the giving NPC, the goal (how many species to identify, optionally only of one habitat), the reward flag, and Slovenian texts (title, tracker texts, dialogue per quest state; `{identified}` and `{goal}` are filled in). Every NPC gives exactly one quest, and every gate's flag must be some quest's reward. Dialogue addresses the player without gendered forms.
- **Database migrations** are applied automatically when the API starts. To add one: `dotnet tool restore`, then `dotnet ef migrations add <Name> --project src/Slovion.Infrastructure --output-dir Persistence/Migrations`.

## Content and IP

Slovion is an original IP inspired by the *genre* of classic handheld exploration RPGs. It does not use or imitate any assets, names, characters or data from existing franchises. All real-world species information is based on cited, authoritative sources; gameplay values (rarity, difficulty, rewards) are fictional.

"Slovion" is a working title; name/trademark availability has not yet been verified.
