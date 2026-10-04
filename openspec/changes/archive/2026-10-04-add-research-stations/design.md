# Design

## Context

What exists today:
- **Research levels** (1–3) are stored per discovery. A sighting at another day or time of day raises the level, and the sighting response (`AlreadyIdentifiedResponse`) says whether it advanced and carries the entry with its new level.
- **Signposts** are tile objects of class `signpost`. Server and engine both parse them, the engine blocks movement on them, and interacting opens the travel map.
- **Notices** (*Novo v nahrbtniku: …*, place names) use the play screen's banner.
- ***Terenski dnevnik*** (`NatureDexPanel`) has a grid view and species pages, driven by UI actions from the play screen.
- **The tileset** has 56 tiles (8 × 7).

The owner chose themed research challenges, journal certificates, and one station per region.

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the two spec deltas.

## Goals / Non-Goals

**Goals:**
- Stations build on research levels. Completion is derived, so there is no new table (D3: the server decides).
- Content-driven: themes, lists and goals live in station files.

**Non-Goals:** see proposal.

## Decisions

### 1. Content

- **Station file** `content/stations/<id>.json`:

  ```json
  {
    "id": "forest_station",
    "species": ["abies_alba", "fagus_sylvatica", "picea_abies"],
    "goal": 3,
    "text": { "sl": { "name": "Raziskovalna postaja v Kočevju", "theme": "Gozdna drevesa" } }
  }
  ```

- **Names:**
  - *Raziskovalna postaja na Dravskem polju*
  - *… v Kočevju*
  - *… na Pohorju*
  - *… pod Triglavom*
  - *… ob Cerkniškem jezeru*
- **Placement:** a tile object of class `station` with a `stationId` property, bottom-anchored like the signpost:

  | Map | Tile | Faced from |
  |---|---|---|
  | `dravsko_polje_meadow` | (14, 8) | (14, 9) |
  | `kocevje_forest` | (6, 8) | (6, 9), the path |
  | `pohorje_forest` | (5, 10) | (5, 9), the path |
  | `triglav_alps` | (6, 8) | (6, 9) |
  | `cerknica_lake` | (6, 8) | (6, 9) |

  All are walkable tiles outside the habitat zones, not next to the signpost or the region's person.
- **Validation** (`FileContentCatalog.Stations.cs`):
  - the station file rules, plus map objects naming an unknown station
  - a station placed on no map or on more than one
  - `AllStations` is sorted by the order of the region its map belongs to

### 2. Server

- **Domain:**
  - `Station(Id, Species, Goal, Text)` and `StationText(Name, Theme)`
  - `Station.ResearchedCount(levels)` and `IsMet(levels)` over a species → level lookup
- **Application:**
  - `StationService.ListAsync(save, language)` reads the save's discoveries and builds `StationView`s:
    - id, name, theme, map ID, goal, researched count, met
    - species: id, level, and name once identified
  - `EncounterService`, when a sighting advances a species to level 3, adds `NewCertificates`: the stations listing that species whose researched count now equals their goal, as (id, name). The goal was not met before, because this species was not at level 3.
- **API:**
  - `GET /api/save/stations` returns `{ stations: [...] }`
  - `AlreadyIdentifiedResponse` gains `newCertificates: [{ stationId, name }]`, empty when none

### 3. Engine

- **Parser:** `tiled.ts` reads `station` tile objects into `WorldMap.stations` (x, y, gid, stationId) and `stationAt(x, y)`, with the same problems as signposts (outside the map, missing ID).
- **World:**
  - `isFixedObstacle` includes stations
  - `interact` gains step 3, `{ kind: 'station', mapId, stationId }`
  - stations are drawn like the signpost, as tile objects in the draw order

### 4. Client

- **Station dialog:** `StationDialog` takes a `stationId` and loads `GET /api/save/stations`. It shows:
  - name and theme
  - a row of pictures (`/content/species-pictures/<id>.png`; unidentified ones as silhouettes, labelled *Neznana vrsta*)
  - stars per picture
  - *Popolnoma raziskane vrste: {researched} od {goal}*
  - *Potrdilo je v terenskem dnevniku.* when the goal is met

  `Cancel` and `Confirm` close it.
- **Certificates:** a *Potrdila* button in the journal's header switches to a `certificates` view, which loads the stations and lists the met ones: name, theme, and the names of the species at level 3. `Cancel` returns to the grid. Without certificates it shows *Potrdila prejmeš na raziskovalnih postajah, ko popolnoma raziščeš njihove vrste.*
- **Notice:** when the research message (`known` overlay) closes, each `newCertificates` entry shows the banner *Novo potrdilo: {name}*.
- **Translations:**
  - `station.progress`, `station.met`, `station.unknown`
  - `naturedex.certificates.title`, `naturedex.certificates.empty`, `naturedex.certificates.button`
  - `certificate.received`

### 5. Art

- **Tile 56:** a small wooden field-station board on legs, with a leaf emblem (placeholder, original).
- **Tileset size:** row 7 makes 64 tiles (128 × 128), and every map's embedded tileset entry grows to match.

## Testing

- **Domain:** researched count and met, with missing species and levels below 3.
- **Application:**
  - station views for new, partial and met saves; names only once identified
  - `NewCertificates` only on the sighting that meets the goal, and not when it was already met
- **Content:**
  - the five repository stations and their maps
  - each validation rule with broken fixtures
- **Integration:**
  - `GET /api/save/stations` for a new save, and `401` without a token
  - a sighting that meets a goal returns `newCertificates`. Research levels are set up through the database, since reaching level 3 needs in-game time.
- **Engine:** parsing stations (and their problems), blocking, interaction precedence (station over resident), and every region map's station reachable to face.
- **Client:** the station dialog (progress, silhouettes, met text, closing), the *Potrdila* view (list, empty, back), and the notice after the research message.
- **E2E:** open the meadow station from the path and read its theme and progress.

## Risks / Trade-offs

- **[Finishing takes time]** Level 3 needs three different times of day or days per species. A station is a long-term goal, which suits milestones.
- **[Species shared between lists]** None today. If lists overlap later, one sighting may complete two stations; the notice shows both.

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the two spec deltas. Each scenario is covered by a domain, application, content, integration, engine, client or E2E test. No non-goal was touched: no gameplay rewards, ranks or titles; no knowledge questions; no station people; no flags needed; no new species.

- **Certificates are computed in `EncounterService` through a static helper** (`StationService.EarnedBy`, with `LevelsOf`). Injecting `StationService` would have changed the encounter service's constructor in three test classes. The rule lives in one place either way.
- **Seeding research levels in tests:**
  - **Integration:** the save's `created_at` is moved 15 minutes back, and discoveries are added at research levels 3, 3 and 2. The sage sighted at 23:00 in-game then reaches level 3 and meets the meadow station's goal.
  - **Application:** levels are raised through the in-memory repository at 18:00 and 22:00 in-game.
- **The station board is tile 56,** so the station objects use `gid` 57. The tileset grew to 64 tiles (128 × 128), and every map's embedded entry matches.
- **Unidentified species in the station dialog** are labelled *Neznana vrsta* (`naturedex.unknown`), as the spec says. The journal grid's "???" label is not used there.
- **The *Potrdila* page** is a third journal view next to the grid and species pages. Its back button takes focus like a species page, and `Cancel` or `Confirm` return to the grid.
- **Manual check:**
  - **Setup:** a save with the dandelion and hawthorn at ★★★ and the sage at ★★, at night.
  - **The notice:** sighting the sage showed *Raziskava napreduje: travniška kadulja (3/3)*, then *Novo potrdilo: Raziskovalna postaja na Dravskem polju*.
  - **The board** stood beside the path at (14, 8). Its dialog showed 3 of 3, the stars, a silhouette for the Siberian iris, and *Potrdilo je v terenskem dnevniku.*
  - ***Potrdila*** listed the certificate with *Travniki in mejice* and the three species.
