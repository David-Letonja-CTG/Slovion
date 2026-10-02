# Design

## Context

Builds on `add-species-identification`:
- `EncounterService` (spot → observation → encounter → answer)
- `IRandomSource` (seeded in tests)
- the strict content validator
- the Tiled parsers (server: objects layer only; client: everything)
- the play-screen overlay state machine

Motivation: see proposal.md. Requirements: the two spec deltas.

Relies on these decisions:
- **D3:** the server rolls on an explicit action, never per step; the client is trusted for positions.
- **D7:** habitats are content.
- **D6:** gameplay values are fictional and separate from facts.

## Goals / Non-Goals

**Goals:**
- Searches reuse the identification flow unchanged.
- Habitat data is extendable to more habitats and maps.
- Rolls are deterministic in tests.

**Non-Goals:** see proposal (no visible rarity, no conditions, no limits).

## Decisions

### 1. Map zones

A habitat zone is a rectangle object in the `objects` layer:
- class `habitat`
- `x`/`y`/`width`/`height` in pixels
- property `habitatId`

A tile belongs to a zone when its **centre** lies inside the rectangle. Overlapping zones are a validation error, which keeps "the habitat at a tile" unambiguous. Both parsers (C# and TS) read zones and are tested against the same map file.

The meadow gets two zones over its tall-grass patches:

| Zone | Tiles | Pixels (x, y, w, h) |
|---|---|---|
| south | x 12–18, y 12–15 | 192, 192, 112, 64 |
| north | x 8–13, y 3–6 | 128, 48, 96, 64 |

### 2. Habitat content (gameplay data)

`content/habitats/tall_grass.json`:

```json
{ "id": "tall_grass", "searchChancePercent": 70,
  "species": [ { "speciesId": "lepus_europaeus", "weight": 30 }, … ] }
```

Habitat IDs use the same lowercase snake_case pattern as map IDs. Validation checks:
- the ID pattern
- duplicate IDs
- the chance is 1–100
- weights are positive integers
- species exist
- at least one species
- zones name an existing habitat
- zones don't overlap

### 3. Domain

- **New record `Sighting(MapId, SpotId?, HabitatId?, SpeciesId)`** with factories `AtSpot(MapSpot)` and `InHabitat(mapId, habitatId, speciesId)`. Exactly one of spot and habitat is set.
- `SpeciesDiscovery.Observe` and `Encounter.Start` take a `Sighting` instead of a `MapSpot`, and both entities gain `HabitatId?`.
- **New record `Habitat(Id, SearchChancePercent, Species: IReadOnlyList<(SpeciesId, int Weight)>)`** in `Domain/Content`.

### 4. Application

- `IContentCatalog` gains `FindHabitatAt(mapId, x, y)`.
- `EncounterService.SearchAsync(slot, mapId, x, y, language)` returns one of:
  - `UnknownHabitat`
  - `NothingFound`
  - `Found(StartEncounterResult)`, where `StartEncounterResult` is the existing result type, either `Started` or `AlreadyIdentified`
- **Roll**, two draws from `IRandomSource`:
  1. `NextIndex(100) < chance` decides whether anything is found
  2. `NextIndex(totalWeight)` walks the cumulative weights

  Both draws are deterministic for a seed (spec).
- The existing spot path and the search path share one private `StartAsync(slot, sighting, species, language)`.

### 5. Persistence

**Migration `AddHabitatSearch`:**
- `discoveries.spot_id` and `encounters.spot_id` become nullable
- both tables gain `habitat_id text NULL`
- existing rows are unchanged (they all came from spots)

### 6. API

| Endpoint | Response |
|---|---|
| `POST /api/save/searches` `{mapId, x, y}` | `201` encounter (same body as `/encounters`) · `200 {alreadyIdentified: true, entry}` · `200 {found: false}` · `404 unknown_habitat` · `400 bad_request` |

### 7. Engine and client

- The Tiled parser reads zones, and `WorldMap.habitatAt(x, y)` returns the habitat ID or `undefined`.
- `Interaction` becomes a union: `{ kind: 'spot', mapId, spotId } | { kind: 'search', mapId, x, y }`.
  - The world checks the faced spot first, then the habitat at the player's own tile (world-exploration spec).
  - This is a breaking change to the engine ↔ host contract, and `GameCanvas`/`PlayScreen` are updated with it.
- `GameApi.search()` is added.
- The play screen gains overlay state `nothing` (message dialog). Found species reuse the `encounter` and `known` states.
- **E2E:** a test walks into the south zone and searches until something is found or the search reports nothing. It asserts on whichever outcome happens, so it's robust to randomness. The deterministic cases are covered by integration tests with a seeded random source.

## Gameplay values (fictional — for owner review)

These are design choices, not biology. They are never shown to players. **Approved by the project owner on 2026-10-02**, together with the UI text below.

| Habitat | Search chance | Species weights |
|---|---|---|
| `tall_grass` | 70 % | poljski zajec 30 · poljski škrjanec 30 · lastovičar 20 · navadni regrat 15 · travniška kadulja 5 |

Rationale: animals that hide in or flush out of tall grass are the most common finds; plants are mostly found on their spots, so they are rarer in searches. With five species, every species can be found by searching.

## UI text draft (`sl.json` additions)

| Key | Text |
|---|---|
| `search.nothing` | Tu ni ničesar. Poskusi drugje. |
| `errors.unknown_habitat` | Tukaj ni mogoče iskati. |
| `play.controlsHint` (updated) | Puščice ali WASD: hoja · Shift: tek · E: razišči ali išči v visoki travi · M: Terenski dnevnik |

## Implementation notes (review, task 4.4)

The review checked every changed file against the proposal's non-goals and every scenario in both spec deltas. Each scenario is covered by a domain, application, integration, client or E2E test. No non-goal was touched: rarity and chances are never sent to the client, and there are no conditions, limits, new species or new art. The deviations and additions below don't change observable behavior beyond the specs:

- **`Sighting` value** (domain): a spot sighting or a habitat sighting. `Encounter` and `SpeciesDiscovery` take it instead of a map/spot pair, so both carry exactly one origin (`SpotId` or `HabitatId`).
- **Shared result mapping**: `EncounterService` uses one private start path for spots and searches. `DiscoveryEndpoints` maps both through one `ToResult`, so the 201/200 responses are identical by construction.
- **Zone validation on both sides**: `FileContentCatalog` validates zones at startup (unknown habitat, no tiles, beyond the map, overlap). The client Tiled parser also rejects malformed zones. A tile belongs to a zone when its centre is inside the rectangle, in both parsers.
- **`HabitatZone`** is an internal Infrastructure record (not domain), because zones are a map-file detail used only for lookup.
- **`WorldMap`** gains an optional `habitats` constructor parameter (default empty), so existing test maps are unchanged.
- **E2E search test** accepts either outcome (found or nothing), as planned under Risks. Exact outcomes are covered by seeded integration tests.
- **Code style refactor** (requested by the owner during apply): C# declaration heads on one line and member order fields → properties → constructors → methods, applied to the touched backend and test files and documented in CLAUDE.md. Formatting and ordering only, no behavior change.

## Risks / Trade-offs

- **[Spamming `E` makes searching trivial]** → Accepted for now (non-goal). Every search is still one server call, and limits can come later with scoring.
- **[Client sends its own position (D3 trusted client)]** → The server only checks that the tile is inside a habitat. This is single-player, with no gain from cheating.
- **[Randomness in E2E]** → The E2E test asserts on either outcome; exact outcomes are tested with seeded integration tests.
- **[Two parsers must agree on zone coverage]** → Both parsers are tested on the same map for the same zone tiles.

## Open Questions

None. The gameplay values above need owner review but don't change the specs or tasks.
