## Phase 1 — core, per-save maps, two forests

- [ ] 1.1 Domain `WorldGeneration`: PRNG (PCG32) and FNV-1a seeding with stage sub-streams; tests (known sequences, determinism)
- [ ] 1.2 Domain models: biome definition, template, generated map (layers, collision, zones, objects); grid helpers (flood fill, A*, noise, cellular smoothing, autotile masks); tests
- [ ] 1.3 Stages 1–9 (base, terrain layers, openings, water, paths, zones, vegetation, spots, validation with retries and fallback); tests per stage
- [ ] 1.4 Generator property tests over many seeds per biome: determinism, different seeds differ, spawn valid, connectivity, bounds, zones match biome rules, species compatibility, the fallback is rarely used and never fails
- [ ] 1.5 Infrastructure: load and validate `biomes/`, templates (`biome` property, `generated` rectangles, connectors, `generation` species) and species `placement`; write generated maps as Tiled JSON; content tests
- [ ] 1.6 Saves: `world_seed`, `world_version` (migration; existing saves seeded from their ID); injectable `IWorldSeedSource`; `WorldGeneration:FixedSeed` in Development only
- [ ] 1.7 Application `SaveMaps` with an LRU cache; move the layout lookups from the catalog; encounters, searches, wildlife, quests and weather use the save's map; tests
- [ ] 1.8 API `GET /api/save/maps/{mapId}` (ETag, 304, `unknown_map`, `invalid_save_token`; `X-World` in Development); integration tests; OpenAPI
- [ ] 1.9 Client: `WorldLoader` from the endpoint; the service worker caches it; tests
- [ ] 1.10 Debug overlay (engine option) and dev panel, `?debug=world`, development builds only; tests
- [ ] 1.11 Biomes `fir_beech_forest` (Kočevje) and `mountain_forest` (Pohorje); their templates and species placement; tiles added where needed
- [ ] 1.12 E2E with a fixed seed; a route helper that walks to a target on the served map; update the Kočevje and Pohorje tests
- [ ] 1.13 Decision D13; docs (architecture, content: biomes, templates, placement; gameplay)
- [ ] 1.14 `dotnet test`, `npm run check`, `npm run e2e`; PR for phase 1

## Phase 2 — alpine, wetland, karst

- [ ] 2.1 Biome `alpine` (Triglav): grassland, scree and rocks, dwarf pine; template; placement
- [ ] 2.2 Biome `wetland` (Cerknica): open water, shallows (`wadeable`), reed bed, mud edge, wet meadow; template; placement
- [ ] 2.3 Biome `karst` (Rakov Škocjan): limestone, sparse grass, river through the gorge; template; placement
- [ ] 2.3a Biome `cave`: an underground area entered from the gorge, cave floor and cave water (zone kinds without a habitat), holding exactly the olm (in cave water), the cave beetle and the bat (on the floor); tests
- [ ] 2.4 Tests and E2E for these regions; PR for phase 2

## Phase 3 — coast, meadow, towns

- [ ] 3.0 Structures: prefab content (`structures/`: tiles, collision, perches, door side), placement stage (count, spacing, facing a path, inside generated areas), lamps along paths; tests
- [ ] 3.1 Biome `coast` (Portorož): sea band with `swimmable` shallows, shore, scrub, salt-pan basins as structures, promenade with lamps; template; placement
- [ ] 3.1a Gated barriers (blocking edge with one gate per seed, validation with and without the flag) and `nearSpawn` species; tests
- [ ] 3.2 Biomes `meadow` (Dravsko polje: tall grass, field edges, the tutorial corner with the sage near the spawn) and `hedgerow` (the strip behind the generated hedge and gate: the shrike, the hawthorn); spawn, Vera, signpost and station stay; template; placement
- [ ] 3.2a Biome `city_park` (Ljubljana): paths with lamps, lawns, tree groups, the Ljubljanica with bridges, a barje strip (`wetland` zone); template; placement
- [ ] 3.2b Biome `village` (Murska Sobota): houses and a farmhouse with a chimney (the stork's perch) as structures, fields, an orchard, an oxbow of the Mura (`wadeable`); template; placement
- [ ] 3.3 Meadow E2E (tutorial, Vera, hedgerow, signpost) with routes; the docs media capture with a fixed seed and routes
- [ ] 3.4 Full checks; docs; `openspec validate add-world-generation --strict`; PR for phase 3
- [ ] 3.5 Manual playtest of each region on a few seeds (desktop and phone), recorded in the PR
