# Design

## Context

Builds on the archived `bootstrap-solution`. Already in place:
- `createGame(container, canvas, options)` with an injected `GameEnvironment` and fixed-timestep loop
- the `GameCanvas` Angular host
- Transloco with `sl.json`
- problem details with a `code`
- `SlovionDbContext` without entities
- Testcontainers integration tests and CI

Motivation: see proposal.md. Requirements: the seven spec deltas.

Relies on these decisions (`docs/decisions.md`):
- **D3** — the client moves and collides; the server decides discoveries.
- **D4/D5** — anonymous token-only save slots, no personal data.
- **D6** — sourced facts, owner review.
- **D7** — content as files in `content/`, the API serves it, PostgreSQL stores player state only.
- **D10** — the in-game name is *Terenski dnevnik*.

## Goals / Non-Goals

**Goals:**
- One playable path across all layers, with each layer tested at its own level and one E2E test covering the whole path.
- Formats and boundaries that later changes extend rather than replace: map format, content schema, engine ↔ UI events, save identity.

**Non-Goals:**
- General-purpose engine features (entity system, scripting, audio, tweening library).
- A content editor or authoring tools. Maps can be edited in Tiled; species JSON is edited by hand.

## Decisions

### 1. Backend modules

Feature folders in each layer, following the existing layer rules:

| Module | Domain | Application | Infrastructure | Api |
|---|---|---|---|---|
| `Saves` | `SaveSlot`, `SaveToken` | create slot, resolve token | EF mapping, token hashing | `POST /api/saves`, token endpoint filter |
| `Discovery` | `Discovery`, `SpeciesId` | record discovery, read NatureDex | EF mapping | `POST /api/save/discoveries`, `GET /api/save/naturedex` |
| `Content` | `Species`, `MapSpot` (read models) | `IContentCatalog` port | file loader + validator | static map/tileset files |

The Application layer defines the ports (`ISaveSlotRepository`, `IDiscoveryRepository`, `IContentCatalog`). Time comes from .NET's `TimeProvider`, which tests replace with `FakeTimeProvider`.

### 2. Save token

- The server generates 32 random bytes (`RandomNumberGenerator`), encoded base64url, so 256 bits of entropy.
- Only the **SHA-256 hash** is stored, behind a unique index. A database leak therefore doesn't reveal usable tokens, and lookup stays a single indexed query. A slow password hash isn't needed for random 256-bit secrets.
- The client sends `Authorization: Bearer <token>`. An endpoint filter on the `/api/save` group resolves the slot, or returns `401 invalid_save_token`.
- Endpoints use `/api/save/...` (singular: "the save this token identifies"), so no ID or token ever appears in a URL (game-session spec).
- Logging: request logging stays at `Warning`, and no code logs headers or tokens (D5).
- *Alternative:* the save ID in the path as a capability URL. Rejected because URLs end up in logs and browser history.

### 3. Persistence

- **`save_slots`:** `id uuid PK`, `token_hash bytea UNIQUE NOT NULL`, `created_at timestamptz`.
- **`discoveries`:** `save_slot_id uuid FK → save_slots ON DELETE CASCADE`, `species_id text`, `map_id text`, `spot_id text`, `discovered_at timestamptz`, `PRIMARY KEY (save_slot_id, species_id)`.
- Table and column names are mapped explicitly to snake_case. With two tables, an extra naming-convention package isn't worth it.
- **Idempotency:** insert, and on a PostgreSQL unique violation (`23505`) re-read the existing row. The primary key guarantees one row under concurrency (discovery spec).
- **Migrations:** the first EF migration lives in Infrastructure. The API applies pending migrations at startup, and integration tests get them for free. `dotnet-ef` is pinned as a local tool (`.config/dotnet-tools.json`).
  - *Alternative:* a migration bundle in deployment. Postponed until there is a deployment; startup migration is fine for a single instance.
- Orphaned save slots (a device lost its token) are kept. They hold no personal data. A retention policy can come later.

### 4. Content layout and formats

```text
content/
  species/salvia_pratensis.json
  maps/dravsko_polje_meadow.json      # Tiled JSON, embedded tileset
  tilesets/meadow.png                 # original placeholder pixel art
```

The API project links `content/**` into its build output, so the API, the integration tests and future published builds all read the same files from `AppContext.BaseDirectory/content`.

**Species file** (sources are referenced by ID from every fact):

```json
{
  "id": "salvia_pratensis",
  "scientificName": { "value": "Salvia pratensis L.", "sources": ["gbif"] },
  "sources": {
    "gbif": { "title": "…", "publisher": "…", "url": "…", "accessed": "2026-10-02", "licence": "…" }
  },
  "text": {
    "sl": {
      "name": { "value": "travniška kadulja", "sources": ["bv-ul", "nrp"] },
      "family": { "value": "…", "sources": ["…"] },
      "habitat": { "value": "…", "sources": ["…"] },
      "distribution": { "value": "…", "sources": ["…"] },
      "season": { "value": "…", "sources": ["…"] },
      "characteristics": [ { "value": "…", "sources": ["…"] } ]
    }
  }
}
```

**Map format: a deliberately small subset of Tiled JSON** (orthogonal, 16×16 tiles, one embedded tileset):
- **Tile layers:**
  - `ground` (required)
  - `decor` (optional, drawn after `ground`)
  - `collision` (required, not drawn; any non-zero tile = blocked)
- **Object layer `objects`:**
  - one object of class `spawn`, with property `facing`
  - objects of class `spot`, with properties `spotId` and `speciesId`

Object positions snap to the containing tile. The map file can be opened and edited in Tiled. A custom map format was rejected because it would need its own editor.

**Validation:** the Infrastructure loader collects *all* errors, then throws one exception that lists them, which aborts startup (species-catalog spec). It checks:
- ID pattern `^[a-z]+_[a-z]+$`
- duplicate IDs
- unknown source references
- facts without sources
- missing `sl` text
- map structure
- spots naming unknown species

A content test in `Slovion.IntegrationTests` loads the real `content/`; table-driven fixtures cover each failure.

**Two map parsers, one format:** the server reads only the `objects` layer, while the client parser reads everything. Both have tests against the same `dravsko_polje_meadow.json`, so the two can't drift apart unnoticed.

### 5. Static content and localized content

- **Static files:** `/content/maps/*` and `/content/tilesets/*` are served by `UseStaticFiles` with a file provider limited to those two folders. Species JSON is **not** served raw. Players receive species text only through localized endpoints, so sources and locale fallback are always applied.
- **Language selection:** the content language is chosen from `Accept-Language` (q-values respected) among the languages the content has. It falls back to `sl` and is echoed in `Content-Language` (localization spec delta).
- **Dev proxy:** `client/proxy.conf.json` gains `/content`.

### 6. Engine

New framework-free modules in `client/src/engine/`. The existing lint boundary still applies.

```text
input/   actions.ts      Action union, direction helpers
         keyboard.ts     KeyboardEvent.code → actions; ignores auto-repeat; releases on blur/hidden
         action-state.ts held set, per-step presses, most-recent-direction stack
world/   tiled.ts        parse + validate the Tiled subset → WorldMap (errors list problems)
         world-map.ts    size, isBlocked(x,y), spotAt(x,y), spawn
         player.ts       grid mover: idle | stepping(progress), facing, walk 4 / run 8 tiles/s
         camera.ts       pure: (player px, map px, view px) → top-left offset, clamped/centred
render/  world-renderer.ts  tile layers from tileset image, player sprite frame
```

- **Movement:** step progress accumulates `stepMs × speed`. When a step completes and the direction is still held, the remainder carries into the next step, so 1 s walking is exactly 4 tiles at any frame rate (world-exploration spec). A small epsilon absorbs float drift, the same approach the loop uses.
- **Input routing:** keyboard events go to one `ActionDispatcher` with a single current consumer, `world` or `ui` (input-actions spec).
  - The engine owns the dispatcher and exposes `setActionConsumer('world' | 'ui')` plus `onUiAction(cb)` for Angular overlays.
  - Keyboard → action mapping lives in one place, and the UI uses the same `Confirm`/`Cancel` semantics.
- **Engine ↔ host contract:**
  - `createGame(container, canvas, { world: LoadedWorld, onInteract, environment? })`
  - `LoadedWorld = { map: WorldMap, tileset: CanvasImageSource, playerSprite: CanvasImageSource }`
  - The **host loads assets** and the engine never fetches. That keeps the engine deterministic and unit-testable with fake images.
  - `onInteract({ mapId, spotId })` fires only for spots (world-exploration spec).
- **Rendering:** draw at integer logical pixels after camera offset (crispness). Player sprite sheet: 4 directions × 2 walk frames, 16×16 px.
- **Removed:** `placeholder-renderer.ts`. The world renderer replaces it, and no spec references the test pattern.

### 7. Angular

- **Routes:** `''` → `TitleScreen`, `'play'` → `PlayScreen`. A guard redirects `play` to the title when no session is active (e.g. a direct deep link).
- **Services:**
  - `SaveTokenStore`: `localStorage` key `slovion.saveToken`, every access wrapped in `try/catch`, with in-memory fallback (game-session spec: storage unavailable).
  - `GameApi`: typed calls. An interceptor adds `Authorization` for `/api/save/**` and `Accept-Language` from the active Transloco language.
  - `GameSession`: new game / continue / reset on `invalid_save_token`.
  - `WorldLoader`: fetches the map JSON and images, then parses via the engine's `tiled.ts`.
- **`PlayScreen`** hosts `GameCanvas` plus the overlays `DiscoveryDialog`, `NatureDexPanel` and `ErrorDialog`. Opening an overlay switches the action consumer to `ui`; closing switches it back to `world`.
- **Errors:** problem `code` values map to keys `errors.<code>`; network failures map to `errors.network`.
- **Accessibility:** overlays use `role="dialog"`, `aria-modal`, initial focus on the primary button, and focus returns to the canvas on close.
- **Gender-neutral copy:** Slovenian past-tense verbs are gendered ("odkril/odkrila"), and the game has no player gender. All copy therefore uses nouns or imperatives ("Nov vnos …", "Razišči …").

### 8. End-to-end test

- **Setup:** Playwright (Chromium only) in `client/e2e/`, run with `npm run e2e`. The Playwright `webServer` config starts the API (`dotnet run`) and `ng serve`. PostgreSQL must be running (`docker compose up -d db`).
- **Path:** new game → two `ArrowRight` taps, waiting after each until the step completes → `E` → dialog → `M` → NatureDex shows *travniška kadulja* → reload → *Nadaljuj* → still listed.
  - The meadow places the spawn 3 tiles left of the sage, facing right, so the path is deterministic. Each tap is exactly one step (world-exploration spec).
- **CI:** a third job, `e2e`, with a `postgres:18` service container. One retry in CI only.

## Species content draft (for owner review — D6)

**Approved by the project owner on 2026-10-02**, together with the UI text below, the in-game name *Terenski dnevnik* and keeping this as one change.

Facts are paraphrased in original Slovenian wording, never copied verbatim. Sources:

| ID | Source | Publisher | URL | Licence / use |
|---|---|---|---|---|
| `bv-ul` | Salvia pratensis (travniška kadulja) | Botanični vrt Univerze v Ljubljani | http://www.botanicni-vrt.si/component/rastline/salvia-pratensis | No licence stated; facts paraphrased with attribution |
| `nrp` | Travniška kadulja | Notranjski regijski park | https://notranjski-park.si/odkrijte/enciklopedija/rastlinski-svet/ustnatice/travniska-kadulja | © Notranjski regijski park; facts paraphrased with attribution |
| `gbif` | Salvia pratensis L. (GBIF Backbone Taxonomy) | GBIF Secretariat | https://www.gbif.org/species/2927007 | CC BY 4.0 |

All three accessed 2026-10-02.

| Fact | Slovenian text (draft) | Sources |
|---|---|---|
| Name | travniška kadulja | `bv-ul`, `nrp` |
| Scientific name | Salvia pratensis L. | `gbif` |
| Family | ustnatice (Lamiaceae) | `nrp`, `gbif` |
| Habitat | Suhi travniki in pašniki. Raste na suhih, s hranili revnih tleh na sončnih, svetlih mestih. | `nrp` |
| Distribution | V Sloveniji je zelo pogosta in splošno razširjena vrsta. | `nrp` |
| Flowering | Cveti od maja do avgusta. | `nrp` |
| Characteristic | Zraste od 30 do 60 cm visoko. | `nrp` |
| Characteristic | Steblo je štirirobo in se v zgornjem delu, kjer so cvetovi, razveji. | `nrp` |
| Characteristic | Pritlični listi imajo dolge peclje in tvorijo listno rozeto; njihov rob je naguban in topo nazobčan. | `nrp` |
| Characteristic | Cvetovi so modri do vijolični in dolgi od 2 do 2,5 cm; po štiri do osem jih raste v vretencih. | `bv-ul`, `nrp` |

The two sources disagree on the flowering period: `bv-ul` says May–June, `nrp` says May–August. The draft uses the wider `nrp` range and cites it.

## UI text draft (`sl.json` additions)

| Key | Text |
|---|---|
| `title.newGame` | Nova igra |
| `title.continue` | Nadaljuj |
| `title.confirmReplace` | Začneš novo igro? Obstoječa igra na tej napravi bo izgubljena. |
| `title.confirmReplaceYes` | Da, začni novo igro |
| `common.cancel` | Prekliči |
| `common.close` | Zapri |
| `discovery.new` | Nov vnos v Terenskem dnevniku: {{name}} |
| `discovery.known` | Ta vrsta je že zapisana v Terenskem dnevniku: {{name}} |
| `naturedex.title` | Terenski dnevnik |
| `naturedex.empty` | Terenski dnevnik je še prazen. Razišči travnik in poišči rastline in živali. |
| `naturedex.family` / `.habitat` / `.distribution` / `.season` / `.characteristics` / `.sources` | Družina / Rastišče / Razširjenost / Čas cvetenja / Prepoznavni znaki / Viri |
| `errors.invalid_save_token` | Shranjene igre ni bilo mogoče najti. Začni novo igro. |
| `errors.unknown_spot` | Tega mesta ni bilo mogoče raziskati. |
| `errors.network` | Povezava s strežnikom ni uspela. Poskusi znova. |
| `errors.map` | Območja ni bilo mogoče naložiti. |

`naturedex.season` is labelled *Čas cvetenja* because the only species is a plant. A per-group label (plants vs. animals) arrives when the first animal does.

## Risks / Trade-offs

- **[Change size: the largest so far]** → Task groups are ordered so each one ends green and demonstrable (backend API first, then engine, then UI, then E2E). It could be split at the group boundary between exploration and discovery if review prefers.
- **[Two map parsers (C#, TS) drift]** → Both are tested against the same content file, and the supported format is documented above.
- **[`POST /api/saves` is unauthenticated, so it can be spammed]** → Acceptable while nothing is publicly hosted. Rate limiting is noted as a prerequisite for public deployment.
- **[Startup migrations with several API instances]** → Single instance for now; revisit with deployment.
- **[E2E flakiness from real-time movement]** → Taps instead of holds, waiting on visible UI state, and one CI retry. The time-sensitive behaviour is covered by deterministic unit tests.
- **[Fact errors or source disagreement]** → Owner review gate (task), and every fact is shown with its sources in-game.
- **[Placeholder art looks rough]** → Accepted. Art is swappable because maps reference tilesets by path and the engine draws by tile ID.

## Implementation notes (deviations recorded during apply)

- **Idempotent insert:** `INSERT … ON CONFLICT (save_slot_id, species_id) DO NOTHING`, then re-read when nothing was inserted. This is a single atomic statement, which is simpler than catching unique violations (`23505`) and equally race-free (§3).
- **Tool manifest location:** `dotnet-tools.json` sits at the repository root, the .NET 10 default, rather than in `.config/` (§3).
- **Entity name:** the domain entity is `SpeciesDiscovery` (in namespace `Slovion.Domain.Discovery`), so the class name doesn't clash with its namespace.
- **Map ID:** the ID is the map's file name (`dravsko_polje_meadow`). The map doesn't repeat it as a property, so the two can't disagree.
- **Startup migration toggle:** `Database:MigrateOnStartup` (default `true`). Integration tests that deliberately run without a database switch it off so the API still starts.
- **One key press goes to one consumer** (bug found by the E2E test). `Escape` means `Cancel` + `OpenMenu`, and `Enter` means `Interact` + `Confirm`. Closing an overlay on the first action handed input back to the world, which then received the second action of the same key press: the journal reopened, and the dialog would have re-triggered the interaction. `ActionSink.pressAll` now delivers every action of one physical input to the consumer that had input when the key went down. A regression test covers it.
- **Menu callback:** the world reports `OpenMenu` through `GameOptions.onOpenMenu` (and `GameCanvas.menuRequested`). The design's host contract only listed `onInteract`.
- **Overlays:** discovery and error messages share one `MessageDialog`, with content projected by the play screen, instead of separate `DiscoveryDialog`/`ErrorDialog` components.
- **UI text added beyond the approved draft:**
  - `common.loading` (*Nalaganje …*)
  - `play.controlsHint` (the controls line under the game)
  - `naturedex.discoveredAt` (*Zapisano*)
  - `errors.error` (*Nekaj je šlo narobe. Poskusi znova.*)

  All are gender-neutral. The dynamically used `errors.*` keys are declared to the key checker with a `t(...)` comment.
- **Test-only client helpers** (`*.testing.ts`, `testing/` folders) are excluded from the app build (`tsconfig.app.json`), because the dev server type-checks every file under `src/`.
- **Map layout:** the hedge in front of the spawn is two rows above it, so the first `↑` moves one tile and the next one bumps into it.

## Open Questions

None blocking. Exact tile choices and the map layout are made during implementation within the constraints above (spawn 3 tiles left of the sage, map larger than the view in both dimensions).
