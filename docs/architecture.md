# Architecture

How Slovion fits together, from the browser to the database. The binding rules behind it are in [decisions.md](decisions.md) (D1–D11); the behaviour of each part is specified in [`openspec/specs/`](../openspec/specs/).

- [The whole system](#the-whole-system)
- [Who decides what](#who-decides-what)
- [Backend](#backend)
- [Frontend](#frontend)
- [Game engine](#game-engine)
- [Request flows](#request-flows)
- [Data](#data)
- [Deployment](#deployment)
- [Where to change what](#where-to-change-what)

## The whole system

```mermaid
flowchart LR
  subgraph Browser
    direction TB
    UI["Angular app<br/>screens, dialogs, journal,<br/>localization, API calls"]
    Engine["Game engine<br/>framework-free TypeScript<br/>on an HTML canvas"]
    SW["Service worker<br/>(installed app)"]
    UI -- "creates, feeds state" --> Engine
    Engine -- "interactions<br/>(talk, observe, search…)" --> UI
  end

  subgraph Server["ASP.NET Core API (modular monolith)"]
    direction TB
    Api["Api<br/>minimal endpoints"]
    App["Application<br/>use cases"]
    Domain["Domain<br/>rules"]
    Infra["Infrastructure<br/>content catalog, EF Core"]
    Api --> App --> Domain
    Infra --> App
  end

  Content[("content/<br/>species, maps, quests…<br/>versioned files")]
  DB[("PostgreSQL<br/>player state only")]

  UI -- "/api (JSON, save token)" --> Api
  UI -- "/content (maps, tilesets,<br/>sprites, pictures)" --> Api
  Infra -- "loads and validates<br/>at startup" --> Content
  Infra -- "EF Core" --> DB
  SW -. "caches the app shell" .-> UI
```

- **Content is files, state is rows.** Species, maps, quests and the rest live as versioned files in [`content/`](../content/) (D7). The API refuses to start if any of them is invalid. PostgreSQL stores only what a save did: discoveries, encounters, quests, the current region.
- **One server, layered.** A modular monolith (no microservices): four projects with strict dependencies, organized inside by feature folders.
- **Two client layers.** Angular owns every screen and all communication; the engine only simulates and draws the world. The engine never imports Angular or RxJS (lint rule), so it stays a plain, testable TypeScript library.
- **Anonymous saves.** A new game creates a save slot and returns a random token, kept in the browser (D4, D5). Every `/api/save/*` call sends it as a bearer token; the server stores only its hash.

## Who decides what

The split follows D3: the server is the authority for everything that counts, the client for everything that moves.

| The server decides | The client decides |
|---|---|
| What can be found where, and when (time, season, weather) | Movement, collision, the camera |
| Encounters, identification, the journal and research levels | Drawing tiles, animals, light and weather |
| Quests, rewards, tools, unlocked regions | Which tile the player faces and what that means (talk, observe, search) |
| The in-game clock (from the save's creation time) and the weather | Animals wandering and reacting to the torch, between server updates |

Randomness and time are injected on both sides (`IRandomSource` and `TimeProvider` on the server; seeded random and a fake clock in the engine), so every rule is tested deterministically.

## Backend

```mermaid
flowchart TB
  Api["<b>Slovion.Api</b><br/>endpoints, problem details,<br/>save-token filter, static /content"]
  App["<b>Slovion.Application</b><br/>services: encounters, journal, quests,<br/>travel, wildlife, weather, stations<br/>ports: IContentCatalog, repositories, IRandomSource"]
  Domain["<b>Slovion.Domain</b><br/>entities and rules: species, sightings,<br/>quest progress, world time, weather"]
  Infra["<b>Slovion.Infrastructure</b><br/>FileContentCatalog (content/ files),<br/>EF Core DbContext, repositories, migrations"]

  Api --> App
  Api --> Infra
  App --> Domain
  Infra --> App
  Infra --> Domain
```

- **Domain** depends on nothing. **Application** defines the ports it needs (`IContentCatalog`, the repositories, `IRandomSource`); **Infrastructure** implements them. **Api** is the composition root. [`tests/Slovion.ArchitectureTests`](../tests/Slovion.ArchitectureTests/) enforce these rules.
- **Feature folders** cut across the layers with the same names, so one feature is easy to find in every project:

  | Feature | What it covers | Endpoints (`/api/save/…` unless noted) |
  |---|---|---|
  | Saves | anonymous save slots and tokens | `POST /api/saves` |
  | Discovery | searching, encounters, identification, the journal (NatureDex), research levels | `searches`, `encounters`, `encounters/{id}/identification`, `naturedex` |
  | Quests | talking to people, quest state, flags, tools | `conversations`, `progress` |
  | Travel | regions, unlock rules, the current region | `regions`, `travel` |
  | Wildlife | which resident animals are around now | `wildlife` |
  | World | the in-game clock and the weather | `time`, `weather` |
  | Stations | research stations and certificates | `stations` |
  | Content | the validated content catalog; maps, tilesets, sprites and pictures as static files | `GET /content/…` |

- **Errors** are RFC 7807 problem details with a stable `code` (e.g. `unknown_map`, `invalid_save_token`); the client translates codes, never server text (D7).
- **OpenAPI** is served at `/openapi/v1.json` in development.

## Frontend

```mermaid
flowchart TB
  subgraph Angular["Angular app (client/src/app)"]
    Title["title/<br/>TitleScreen: new game, continue"]
    Play["play/<br/>PlayScreen: loads a region, routes<br/>interactions to the API and dialogs"]
    Dialogs["play/<br/>identification, dialogue, journal,<br/>travel map, bag, station, banners"]
    Canvas["game/<br/>GameCanvas: hosts the engine"]
    Loader["play/WorldLoader<br/>map JSON, tileset, sprites"]
    Api["api/<br/>GameApi + interceptor (save token)"]
    Session["session/<br/>GameSession, SaveTokenStore"]
    I18n["i18n/<br/>Transloco, sl-SI catalog"]
    Pwa["pwa/<br/>updates, connection status"]
    Audio["audio/<br/>AudioService, sound settings,<br/>Web Audio synth"]
  end
  Engine["engine/ (client/src/engine)"]

  Title --> Session
  Play --> Api
  Play --> Loader
  Play --> Dialogs
  Play --> Canvas
  Play --> Audio
  Canvas --> Engine
  Dialogs --> Api
  Api --> Session
```

- **`PlayScreen` is the conductor.** It loads the current region (regions, progress, time, wildlife, weather, the map and its images), creates the game through `GameCanvas`, and turns each engine interaction into an API call and a dialog. While a dialog is open, input goes to the UI instead of the world.
- **Sound is synthesized** with Web Audio in `audio/synth/` (framework-free like the engine, tested against a fake audio context). `AudioService` makes the audio context on the first click or key press, loads the themes and soundscapes from `public/audio/`, and stops while the page is hidden; `PlayScreen` tells it the scene (map, time of day, weather, underground) and which effect to play. Sound never affects the game.
- **All text is translated.** UI text comes from the `sl-SI` catalog (`public/i18n/sl.json`, checked by `npm run i18n:check`); content text comes localized from the API (D7).
- **The installed app** (PWA) caches the built app shell with its music and soundscapes, never `/api` or `/content`; playing needs the server, and a new version shows *Osveži*. The dev server never registers the service worker. To try it locally: run the API, then `npm run build` and `node e2e/serve-dist.mjs 4201` in `client/`, and open http://localhost:4201.

## Game engine

```mermaid
flowchart LR
  Keys["keyboard / touch"] --> Dispatcher["ActionDispatcher<br/>logical actions<br/>(MoveUp, Interact, Torch…)"]
  Dispatcher --> State["ActionState"]
  Loop["GameLoop<br/>fixed time step"] --> World
  State --> World["World<br/>player, residents, NPCs,<br/>tools, clock, interactions"]
  Map["WorldMap<br/>parsed from Tiled JSON:<br/>layers, collision, spots, zones,<br/>NPCs, gates, lamps"] --> World
  World -- "onInteract" --> Host["host (PlayScreen)"]
  Host -- "residents, flags, tools,<br/>time, weather" --> World
  Loop --> Renderer["renderWorld<br/>tiles, objects, animals, player,<br/>darkness and light, weather"]
  World --> Renderer
  Renderer --> CanvasEl["canvas<br/>480 × 270, integer-scaled"]
```

- **`createGame`** (`game.ts`) wires everything: input, the loop, the world, the renderer and a `GameEnvironment` (clock, frame scheduler, size and visibility), which tests replace with fakes.
- **Logical actions only.** Game code reacts to `MoveUp`, `Interact`, `Torch`…, never to keys; the keyboard map lives in one place.
- **Maps are data.** `tiled.ts` parses and validates Tiled JSON into a `WorldMap`; tile properties (`wadeable`, `swimmable`) and object classes (`spot`, `habitat`, `area`, `npc`, `gate`, `signpost`, `station`, `lamp`) drive behaviour. See [content.md](content.md).
- **Drawing** happens at a logical 480 × 270, scaled by whole numbers for crisp pixel art. The time-of-day tint goes into an offscreen layer, and the torch and lamp posts cut soft circles of light out of it.

## Request flows

**Observing and identifying an animal or plant**

```mermaid
sequenceDiagram
  actor P as Player
  participant E as Engine (World)
  participant UI as PlayScreen + dialog
  participant API as Api (Discovery)
  participant S as EncounterService
  participant DB as PostgreSQL

  P->>E: faces an animal or plant, presses Interact
  E->>UI: onInteract { kind: "spot", mapId, spotId }
  UI->>API: POST /api/save/encounters
  API->>S: start encounter
  S->>S: is the species around now?<br/>(season, time of day, weather)
  S->>DB: store encounter (species, candidate names)
  API-->>UI: clues + candidate names
  P->>UI: picks a name
  UI->>API: POST /api/save/encounters/{id}/identification
  S->>DB: record discovery / raise research level
  API-->>UI: result, journal entry, new certificates
```

Searching tall grass or a tree works the same way through `POST /api/save/searches`: the server picks a plant from the habitat zone's weighted list (fictional rarity values) and opens an encounter.

**Entering a region**

```mermaid
sequenceDiagram
  participant UI as PlayScreen
  participant API as Api
  participant L as WorldLoader
  participant E as Engine

  UI->>API: GET regions, progress, time
  UI->>L: load the current region's map
  L->>API: GET /content/maps/{map}.json, tileset, sprites
  UI->>API: GET wildlife, weather for the map
  UI->>E: createGame(map, images, residents, flags, tools, time)
  loop while playing
    UI->>API: re-sync time, reload wildlife and weather when they change
    UI->>E: setResidents / setWeather / setWorldTime
  end
```

Talking to someone (`POST conversations`) returns the dialogue for the quest's state and the save's new flags and tools; travelling (`POST travel`) sets the current region, and the play screen loads the new map.

## Data

```mermaid
erDiagram
  SAVE_SLOTS ||--o{ DISCOVERIES : "has"
  SAVE_SLOTS ||--o{ ENCOUNTERS : "has"
  SAVE_SLOTS ||--o{ QUEST_PROGRESS : "has"
  SAVE_SLOTS {
    uuid id
    bytea token_hash
    timestamptz created_at "starts the in-game clock"
    text region_id "current region"
  }
  DISCOVERIES {
    uuid save_slot_id
    text species_id
    text map_id
    timestamptz observed_at
    timestamptz identified_at
    int research_level "0-3"
  }
  ENCOUNTERS {
    uuid id
    uuid save_slot_id
    text species_id
    text_array candidates
    timestamptz created_at
    timestamptz closed_at
  }
  QUEST_PROGRESS {
    uuid save_slot_id
    text quest_id
    timestamptz started_at
    timestamptz completed_at
  }
```

- **Derived, not stored:** progress flags and tools come from completed quests, unlocked regions from flags, station certificates from research levels, the in-game time from `created_at`. Changing content therefore never needs a data migration.
- **Migrations** run at API startup (EF Core, `src/Slovion.Infrastructure/Persistence/Migrations`). To add one: `dotnet tool restore`, then `dotnet ef migrations add <Name> --project src/Slovion.Infrastructure --output-dir Persistence/Migrations`.

## Deployment

Production is one Oracle Cloud Always Free Arm VM running a Docker Compose stack (D12):

```mermaid
flowchart LR
  Player["Browser"] -- "HTTPS" --> Web
  subgraph VM["OCI VM — Docker Compose"]
    Web["web<br/>Caddy: TLS, client files, proxy"] -- "/api, /content, /health" --> Api["api<br/>ASP.NET Core + content"] --> Db[("db<br/>PostgreSQL")]
  end
  GH["GitHub Actions"] -- "images" --> GHCR[("ghcr.io")]
  GH -- "SSH deploy" --> VM
  VM -- "daily dump" --> Bucket[("Object Storage")]
```

- **Same origin as in development:** Caddy serves the built client and forwards `/api`, `/content` and `/health` to the API, so the client needs no configuration.
- **Images:** `deploy/api.Dockerfile` and `deploy/web.Dockerfile`, cross-built for `arm64` and `amd64`. CI builds them on every pull request and runs `deploy/smoke-test.sh` against the whole stack.
- **Deploys:** publishing a release deploys it with `.github/workflows/deploy.yml` (CI must have passed for its commit), with a health check and an automatic rollback.

Setup, secrets, backups and operations are in [hosting.md](hosting.md).

## Where to change what

| To… | Change | Specs and tests |
|---|---|---|
| Add a species, region, quest, tool or station | Content files only — see [content.md](content.md) | Content validation runs at startup and in `dotnet test` |
| Add a game rule the server decides | `Domain` (rule) and `Application` (use case), an endpoint in `Api/<Feature>` | Domain and application tests, integration tests |
| Add something that moves or is drawn | `client/src/engine/` (world, renderer, tiled parser) | Engine tests with `textMap` and a fake environment |
| Add music, ambience or a sound effect | `client/public/audio/` (data) or `client/src/app/audio/synth/` — see [content.md](content.md#sound) | Synth tests with the fake audio context, the audio data test |
| Add a screen, dialog or text | `client/src/app/` and `public/i18n/sl.json` | Component tests, `npm run i18n:check` |
| Store new player state | an entity in `Domain`, its configuration and a migration in `Infrastructure` | Integration tests (need Docker) |
| Change how the game is hosted or deployed | `deploy/`, `.github/workflows/deploy.yml`, [hosting.md](hosting.md) | The container smoke test in CI |
| Change the docs' pictures | rerun [`client/scripts/docs-media/capture.mjs`](../client/scripts/docs-media/capture.mjs) | — |

Every change that alters behaviour starts as an OpenSpec change (`openspec/changes/<id>/`) — see the [README](../README.md#how-work-is-done).
