# Proposal

## Why

Every region is one hand-made Tiled map, the same for every player. The owner wants replayable exploration (brief: *Procedural Biome-Based World Generation*, 2026-10-06): **every save gets its own natural world, random in layout but ecologically coherent**. A generated fir-beech forest must look and behave like one, not like randomly scattered tiles.

The owner decided on 2026-10-06:
- **a seed per save**, not one fixed seed per region
- **every region** in this change, the towns included: "we need all to be random"

## What Changes

- **Seed per save:**
  - a new save gets a world seed and a generation version
  - a region's map is a pure function of *template + biome + world seed + map ID + version*, so the same save always sees the same map
  - existing saves get a seed derived from their ID
- **Templates: authored + procedural.** Each natural region's Tiled map becomes a template.
  - Authored parts stay as they are: every region's spawn, signpost, person and station, with the same names and places as now. Everything else is generated, including the meadow's tutorial corner, its hedge row and gate, and the karst cave.
  - Each `generated` rectangle names its own biome, area and species, so a map can mix biomes: the karst gorge and its cave, or the meadow and the hedgerow behind the gate.
  - Rectangles of class `generated` mark where the generator fills in natural terrain for the region's biome.
- **Biomes as data:** `content/biomes/<id>.json` describe terrain densities and clustering, water, paths, the habitat zone kinds a biome has (dense forest, forest edge, clearing, stream, rocks, shallows, reed bed, …) and the tiles that draw them. There is no biome-specific code.
- **Staged, deterministic generation** (server, C#):
  - the stages: base terrain, water, paths and connectivity, habitat zones, vegetation, species spots, validation
  - a seeded PRNG only
  - a flood-fill validation; on failure, deterministic retries and a guaranteed fallback
- **Quests keep working:**
  - A generated barrier (the meadow's hedge) gets one gate per seed, opened by the same flag as today.
  - Validation proves the area behind it is closed without the flag and open through the gate with it.
  - The meadow sage is placed near the spawn, so the first quest's tutorial stays easy.
- **Ecology-aware spots:**
  - each region's species keep their spot, but its place comes from the species' new `placement` data (zone kinds, near or in water)
  - the habitats come from the biome's zone kinds
  - habitat searching keeps its weights
  - time, season and weather keep deciding encounters (D8, D11), unchanged
- **Per-save maps on the server:**
  - `GET /api/save/maps/{mapId}` returns the save's map as Tiled JSON
  - encounters, searches, wildlife, quests and weather use the save's map
  - generated maps are cached
  - the client loads maps from this endpoint; its parser and renderer don't change
- **All nine regions generated:**
  - Dravsko polje (meadow)
  - Kočevje (fir-beech forest)
  - Pohorje (mountain forest)
  - Triglav (alpine)
  - Cerknica (wetland)
  - Rakov Škocjan (karst)
  - Portorož (coast, with generated salt pans and promenade)
  - Ljubljana (city park)
  - Murska Sobota (village)
- **Structures:** buildings and other made things (houses, a farmhouse with a chimney nest, salt-pan basins, bridges) are small authored prefabs in `content/structures/`. The generator places them by the biome's rules (count, spacing, facing a path), never as loose tiles. Street lamps are placed along generated paths.
- **Debug view** (development builds only): an overlay of habitat zones, collision, water, paths, spots and spawn, with seed, biome and version.
- **Decision D13** records that natural terrain may be generated, amending D7.

## Capabilities

### New Capabilities

- **`world-generation`:** world seeds, templates, biomes, generation stages, connectivity, species placement, per-save maps and the debug view.

### Modified Capabilities

- **`world-exploration`:** *Maps are content*. Natural maps are templates filled per save, and the client loads the save's map from the server.

## Non-goals

- New regions, species or habitats; species calls; elevation as a game value (a 26×20 map has no meaningful elevation).
- Bigger maps: each region keeps its size (26×20, the meadow 32×28).
- Per-visit changes: a save's world stays the same; only encounters vary with time, season and weather.
- Generating the spawn, signpost, person and station: they keep their names and places (owner, 2026-10-06), so arriving, travelling, quests and stations work the same everywhere.
- New tiles beyond what the biomes strictly need (the shared tileset is extended only where a biome has no fitting tile).

## Impact

- **Domain:** `WorldGeneration`, a pure generator with its own PRNG; models for biomes and generated maps.
- **Application:**
  - a save's maps (`SaveMaps`), cached
  - encounters, searches, wildlife, quests and weather look up the save's map instead of the global catalog
- **Infrastructure:**
  - loading and validating biomes, templates and species placement
  - writing generated maps as Tiled JSON
  - a migration adding `world_seed` and `world_version` to `save_slots`
- **API:** `GET /api/save/maps/{mapId}`. The seed source is injectable; a fixed seed can be configured for development and E2E only.
- **Client:**
  - `WorldLoader` reads the save's map from the API
  - a development-only debug overlay in the engine
- **Content:**
  - 11 biome files (the nine region biomes, plus `cave` and `hedgerow`)
  - 9 templates (the maps with their generated parts replaced by `generated` rectangles)
  - structure prefabs
  - `placement` for the regions' species
- **Tests:**
  - generator: determinism, seeds differ, spawn, connectivity, bounds, zones, biome rules, species compatibility, statistical checks over many seeds
  - services
  - content validation
  - E2E with a fixed seed; routes are computed from the served map instead of hard-coded steps
- **Docs:** decisions (D13), architecture, gameplay, content (biomes, templates, placement); the docs media capture with a fixed seed.
