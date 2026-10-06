# Design

## Context

- **Maps:** 9 Tiled maps share one tileset. They have tile layers `ground`, `decor` and `collision`, and an `objects` layer with the spawn, signpost, NPCs, station, gates, lamps, habitat and area rectangles, and species spots.
- **The server reads every map at startup** (`FileContentCatalog`) and serves the files at `/content/maps/<id>.json`. Only four lookups depend on a map's layout:
  - `FindSpot(mapId, spotId)` for encounters
  - `SpotsOn(mapId)` for wildlife and weather
  - `FindHabitatAt(mapId, x, y)` for searches
  - `FindNpcOnMap(mapId, npcId)` for quests
- **Saves store their region, not a position**, so a game continues at the region's spawn.
- **Encounters already depend on time, season and weather** (D8, D11) and on habitat weights.

Motivation and owner decisions: see proposal.md.

## Goals / Non-Goals

**Goals:**
- Every save has its own natural world that looks like its biome.
- The world is always playable.
- Encounters, quests and stations keep working.
- New biomes and species are data only.

**Non-goals:** see proposal.

## Decisions

### 1. Where generation runs: the server, once per save and map, cached

| Option | Verdict |
|---|---|
| Server (C#), served as Tiled JSON | **Chosen.** The server must know spots and zones anyway (D3: it validates encounters and searches). One implementation; the client's parser and renderer are unchanged; phones only download a map. |
| Client (TS) | Rejected: the server would still need the same map, so the generator would exist twice and could drift. |
| Both, shared algorithm | Rejected for the same reason. |
| Build time (generated files in `content/`) | Rejected: one map for every player, not per save. |

- **Cache:** an in-memory LRU cache of generated maps (layout plus serialized JSON), keyed by `(mapId, worldSeed, worldVersion, contentVersion)`, bounded to 64 entries.
- **Cost:** a 26×20 map takes milliseconds, so a cache miss costs little.
- **Client caching:** responses carry an ETag; the map never changes for a save.

### 2. Determinism

- **PRNG:** SplitMix64, a small, well-known, testable algorithm in the Domain, checked against its published test vectors. No `Random`, no clocks.
- **Map seed:** the 64-bit FNV-1a hash of `worldSeed / mapId / biomeId / version`, the same hashing family as D11.
- **Sub-streams:** each stage gets its own stream (`seed ⊕ hash(stageName)`). Changing one stage's tuning doesn't reshuffle the others.
- **Version:**
  - The generation version is an integer constant (`v1`), stored per save at creation.
  - A future algorithm change bumps it. Saves on the old version either keep the old code path or are migrated by an explicit decision; this change ships v1 only.
  - Content edits (biome tuning, templates) change maps for everyone. That is accepted and recorded in D13: content is versioned in git like today.

### 3. Seed per save

- `save_slots` gains:
  - `world_seed` (`bigint`): random at creation through an injectable `IWorldSeedSource`
  - `world_version` (`int`)
- **Existing saves:** the migration gives them `world_seed = FNV-1a(id)` and version 1.
  - Nothing else in a save depends on layout: there are no stored positions; discoveries keep their species, and their `spot_id` is informational.
  - Their natural maps change once; quests, discoveries and research stay.
- **Fixed seeds:** development and E2E can set `WorldGeneration:FixedSeed`. It is ignored in production: the option is read only in the Development environment and refused at startup otherwise.

### 4. Templates: authored + procedural

A natural region's Tiled map stays the template. It gains:
- **Rectangles of class `generated`** (in tiles), each with:
  - its own `biome`
  - an `areaId` (and `underground`, as area zones have today)
  - the species it holds (a comma-separated `species` property)
  - Inside them, the template's own tiles, collision, spots and habitat zones are ignored and generated instead.
  - Outside them, everything is authored and kept as it is.
- **Optional `connector` points** on a `generated` rectangle's edge: authored path tiles the generated paths must reach (the left strip's path, the hedgerow gate, the cave mouth).
- Each species listed on a rectangle gets exactly one spot inside it, as today.
- A map can mix biomes. The generated area zones replace the authored ones inside the rectangles.

Content validation checks that:
- authored objects never lie inside a `generated` rectangle
- connectors lie on its edge
- every listed species has a habitat among the biome's zone kinds

**The stamps (authored parts) per region:**

| Region | Authored | Generated |
|---|---|---|
| Dravsko polje (32×28) | spawn, Vera, signpost, station (same places) | the meadow including the tutorial corner (`meadow`; the sage is marked near the spawn), the hedge row and its gate (a barrier, §4a), and the hedgerow strip behind it (`hedgerow`, area `south_hedgerow`, the shrike and the hawthorn) | the meadow (`meadow`); the hedgerow strip behind the gate (`hedgerow`, area `south_hedgerow`, the shrike and the hawthorn) |
| Kočevje, Pohorje, Triglav, Cerknica (26×20) | the left strip (columns 0–7: spawn, signpost, person, station) | columns 8–25 |
| Rakov Škocjan | left strip | the gorge (`karst`); the cave (`cave`, an underground area holding exactly the olm in cave water and the cave beetle and the bat on the cave floor), entered from the gorge |
| Portorož | left strip | promenade with lamps, salt-pan basins (structures), shore and sea |
| Ljubljana (city park) | left strip | park paths with lamps, lawns and tree groups, the Ljubljanica with bridges, the barje strip |
| Murska Sobota (village) | left strip | houses and the farmhouse (structures), fields, an orchard, the oxbow of the Mura |

### 4a. Gated barriers and tutorial species

**Barriers:** a `generated` rectangle can name a barrier on one of its edges.
- It gives the blocking terrain (`hedge`) and the gate flag (`hedgerow_open`), for example the meadow's hedgerow strip behind a hedge opened by Vera's quest.
- The generator:
  - draws the blocking terrain along the whole shared edge
  - places one `gate` object with `requiresFlag` at a PRNG-chosen cell of it
  - keeps the tiles in front of and behind the gate walkable, and connects them to paths on both sides
- Validation then checks both:
  - without the flag, no cell of the gated rectangle is reachable from the spawn
  - with it, every cell that should be is, and only through the gate
- So the quest unlock works as today, while the hedge and the gate move per save.

**Near the spawn:** a template can mark a species as `nearSpawn`.
- Its spot is then chosen only among compatible cells within 6 steps of the spawn (falling back to the nearest compatible cell).
- The meadow marks the meadow sage, so the first quest's tutorial stays easy.

### 5. Biomes as data

`content/biomes/<id>.json`, for example `fir_beech_forest`:

```json
{
  "id": "fir_beech_forest",
  "base": "forest_floor",
  "terrain": {
    "forest": { "density": 0.62, "clump": 3 },
    "rocks": { "density": 0.05, "clump": 1 },
    "openings": { "count": [1, 3], "size": [3, 6] }
  },
  "water": { "kind": "stream", "chance": 0.6, "width": 1 },
  "paths": { "width": 1, "branches": [0, 2] },
  "zones": {
    "dense_forest": { "habitat": "fir_beech_forest", "from": "forest" },
    "forest_edge": { "habitat": "fir_beech_forest", "from": "edge:forest" },
    "clearing": { "habitat": "fir_beech_forest", "from": "openings" },
    "stream_bank": { "habitat": "fir_beech_forest", "from": "edge:water" }
  },
  "tiles": { "forest_floor": [...], "forest": [...], "rocks": [...], "water": [...], "path": "autotile:path", "...": "..." }
}
```

- **What the generator interprets:** generic keys only, namely terrain layers with density and clumping, openings, water kinds (`stream`, `pond`, `lake`, `sea`, `shallows`), paths, zone rules and tile lists. There are no biome names in code.
- **Zones:**
  - `from` derives a zone kind from terrain: the cells of a layer, its edge band, an opening, or the band beside water.
  - Each zone kind names an existing habitat (`habitats/*.json`). The NatureDex and searches stay habitat-based.
- **Tiles:**
  - lists of tileset IDs, picked by the PRNG for variety
  - `autotile:<set>` picks edge and corner tiles from the 4-neighbour mask (the tileset already has path edge sets)
  - water edges use the same mechanism
- **Eleven biomes:** `meadow`, `hedgerow`, `fir_beech_forest`, `mountain_forest`, `alpine`, `wetland`, `karst`, `cave`, `coast`, `city_park`, `village`.
- **As built (phase 2):**
  - a layer may be `blocking` (reeds, cliffs, cave rock; cleanup opens it back to floor where a pocket needs a way) and may have a `bias` edge with a `biasStrength`, which raises its noise towards that edge (snow and scree towards the peaks, reeds towards the lake)
  - water kinds are `stream`, `pond` and `shore`: a band along one edge whose depth wanders by a tile, `shallowWidth` rows of `shallow` tiles on its land side, reaching the map's edge through the border
  - a biome without a `pathSet` (the cave) keeps its floor where paths run
  - placement `water: wade` puts a spot on wadeable water with no reachable land beside it, so only the boots reach it (the water lily, the demoiselle); the template reads wadeable tiles from the tileset
  - an opening drowned by water is no longer a path target
  - Rakov Škocjan keeps its authored stone wall with the cave mouth between two generated rectangles (gorge and cave), each with a connector beside the mouth, so no cross-area links are needed
- **Zone kinds without a habitat:** a zone kind may have no habitat (the cave's `cave_floor` and `cave_pool`, the alpine `snowfield` and `rock`). It is used for species placement only, is not searchable, and gets no habitat zone, as the cave has none today.

### 5a. Structures and lamps (towns, made things)

The owner wants the towns random too. Buildings can't be grown from noise, so they are **structures**: small authored prefabs in `content/structures/<id>.json`.
- **A prefab** has:
  - its tiles per layer and its collision
  - optional perch cells (a chimney, a roof ridge) and an optional door cell and side
  - the tiles around it it needs (for example walkable in front of the door)
- **Biomes list the structures they use,** with:
  - a count range
  - a minimum spacing
  - rules: facing a path (the door on a path cell), on a terrain (salt-pan basins on the shore), or in a row along a path (a village street)
- **The structures stage** runs after the paths and before the zones:
  - it tries candidate positions from the PRNG and keeps those that fit the rules
  - its cells are fixed for the later stages: no decor on them, and zones skip them
  - validation checks that every door can be reached
- **Lamps:** a biome can put `lamp` objects along its paths at an interval, offset to a path's side, never blocking the only way through. They light up as today.
- **Perched species** (the stork) take perch cells of structures as candidates, so the stork always nests on a chimney.
- **Templates are kept** for every region, with the left strip authored (the owner keeps the spawn, signpost, station and person with their names and places), so arriving, travel, quests and stations work the same everywhere.

### 6. Stages

All stages run on a grid the size of the map and touch only cells inside `generated` rectangles:

1. **Base:** every generated cell gets the biome's base terrain.
2. **Terrain layers:** for each layer, value noise (a few octaves on a coarse lattice, from the stage's PRNG) is thresholded at the layer's density, then smoothed with cellular-automaton passes (`clump`). This gives coherent clusters and natural edges, never salt-and-pepper.
3. **Openings:** clearings, meadows and gravel are carved as rounded blobs; this happens before water, so water can run through them.
4. **Water:**
   - a stream is a random walk across the area, with a bounded meander and a width
   - a pond or lake is a thresholded blob
   - the sea is a band along a template edge; shallows are the band's inner rim
   - water is collision, except tiles marked `wadeable` or `swimmable`, as today
5. **Paths and connectivity:**
   - an A* path over a cost grid (forest is expensive, openings cheap, water very expensive unless there's a ford or bridge tile) joins all connectors and openings
   - path cells clear blocking terrain and get path tiles
   - a few branches end in openings, never in nothing
6. **Habitat zones:**
   - every non-path walkable cell gets a zone kind from the `zones` rules (first match wins)
   - zones are converted into non-overlapping rectangles by greedy row merging, so the existing habitat-zone format, validation and `FindHabitatAt` stay the same
7. **Vegetation details:** decor tiles (flowers, bushes, single trees, reeds) by zone kind, at densities from the biome; blocking decor is never placed on a path or next to a connector.
8. **Species spots:**
   - for each listed species, the candidate cells are those whose zone kind matches its `placement` (and its habitat), that are reachable, and that are spaced from other spots
   - one cell is picked with the PRNG, weighted towards the zone kinds it prefers most
   - aquatic animals need water cells beside reachable land; perched ones need a tree or rock tile they can sit on
   - spot IDs stay `<mapId>_<speciesId>_1`, so encounters and NatureDex history keep meaningful IDs
9. **Validation, cleanup and retry:**
   - a flood fill from the spawn must reach every connector, NPC, signpost, station and gate approach, every spot (or, for aquatic ones, a tile beside it) and every path end
   - the area zones must cover every walkable cell, as today
   - every listed species must have a spot
   - the existing map validation must pass on the result
   - on failure, retry with the next sub-seed (up to 8 attempts, still deterministic)
   - then a guaranteed fallback: the last attempt with a direct path carved from the spawn to every unreachable target, and any species without a candidate placed in the nearest compatible zone
   - a test runs thousands of seeds per biome and asserts the fallback is rarely needed and never fails

### 7. Species placement data

Species files gain an optional block of gameplay placement data:

```json
"placement": { "zones": ["forest_edge", "clearing"], "water": "near" }
```

- **`zones`:** preferred zone kinds, in order of preference.
- **`water`:** `"in"` (aquatic), `"near"` (within 3 tiles), or absent.
- **Defaults:**
  - plants: any zone kind whose habitat lists the species
  - animals: the same, plus `"in"` for `aquatic`
  - perched animals need a perch
  - most species need no block
- **It is gameplay data (D6):**
  - It's fictional placement tuning like spawn weights, never shown to players, and consistent with the species' sourced habitat text.
  - Numeric elevation and temperature from the brief are not modelled: maps have no elevation, and the biome already stands for the environment.
- **Compatibility is checked:**
  - a region's listed species must be placeable in its biome (content validation at startup)
  - the generator only ever offers each species its compatible zones

### 8. Per-save maps on the server

- **`WorldMaps`:**
  - authored maps come from the catalog, the same for every save
  - natural maps come from the cache, or are generated from the template, biome and the save's seed and version
  - it returns a `MapLayout` (spots, habitat rectangles, NPC placements, spawn) and the Tiled JSON
- **The layout lookups move from `IContentCatalog` to `IWorldMaps`** (implemented by `WorldMaps`): spots and habitat zones per save, used by `EncounterService` and `WildlifeService`. `WeatherService` only asks whether a map exists. People are authored, so `QuestService` keeps finding them in the catalog.
  - The catalog keeps only global content: species, habitats, regions, quests, stations, items, biomes and templates.
- **`GET /api/save/maps/{mapId}`:**
  - `200` with the Tiled JSON and an `ETag` of `(seed, version, content hash)`
  - `304` on a matching `If-None-Match`
  - `404 unknown_map`, `401 invalid_save_token`
- **Static `/content/maps` stays** for authored maps and templates (the docs and tools read them), but the game loads all maps through the endpoint, for one code path.

### 9. Client

- **Loading:** `WorldLoader` loads `/api/save/maps/{mapId}` with the save token instead of `/content/maps/{mapId}.json`. Nothing else changes: the engine parses Tiled JSON as today.
- **Offline (PWA):** today's map files are fetched from `/content`. The endpoint's responses are cached by the service worker with the same freshness strategy as the API data it already handles; this will be verified in the installable-app E2E.

### 10. Debug view

- **Engine option `debug`:** draws, over the world, the habitat zones (colour per zone kind, from the map's zone objects), collision, water, path tiles, spots and the spawn.
- **Header:** the server adds `X-World` (`seed`, `biome`, `version`) to map responses in Development only, and the play screen shows it in a small dev panel.
- **Switching it on:** the overlay is enabled by `?debug=world` and only when Angular `isDevMode()` is true. Production builds compile it out of the panel, and the server never sends `X-World` there.

### 11. Performance

- **Server:** generation and the cache are on the server. The client gets one map JSON (~40 KB uncompressed today, similar after).
- **Client:** no generation work, and no per-frame cost. The debug overlay draws only when enabled.

## Risks / Trade-offs

- **Tileset limits:** generated forests can look plainer than hand-made ones until more transition tiles are drawn. New tiles are added only where a biome has none (for example water edges); the tileset stays one image.
- **Content changes alter existing worlds:** recorded in D13 and accepted; a save's quests, discoveries and research never depend on layout.
- **Tests that walk fixed steps:** E2E and the docs media capture move to a fixed seed plus routes computed from the served map (a test helper finds a path and presses the keys). This is more robust than hard-coded steps, but it's real work.
- **Scope:** nine biomes, structures and per-save maps is a large change. It is implemented in phases (tasks.md), each phase merged only when green:
  1. core, per-save maps and two forests
  2. alpine, wetland, karst
  3. structures, coast, meadow and the towns
- **Placement data versus D6:** placement is gameplay data and never shown; if it ever informs player-facing text, it will need sources first.
