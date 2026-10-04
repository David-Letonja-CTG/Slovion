# Proposal

## Why

The game has meadow, forest, mountain forest and alpine habitats, but no water. The owner chose a wetland based on **Cerkniško jezero**, the intermittent karst lake in Notranjska, as the fifth stop on the journey after Luka's quest. Its shallows can only be crossed with Maja's boots. Notranjski regijski park, whose pages already source three species, documents the lake's species in detail.

## What Changes

- **A new region, *Cerkniško jezero*** (`cerknica`): map `cerknica_lake`, opened by Luka's reward flag `alps_explored`. The journey now runs Dravsko polje → Kočevje → Pohorje → Triglav → Cerkniško jezero.
- **The map:**
  - a shore path from the spawn and signpost
  - a wet meadow
  - a belt of reeds
  - wide shallows (wadeable with the boots) with a small islet
  - open deep water (never walkable)
- **A new habitat, *Mokrišče*** (`wetland`), covering the wet meadow, the reeds and the shallows. All of them can be searched.
- **Seven species**, each with sourced facts, three clues and a picture; the animals also get a walk sprite:

  | Species | Group | Slovenian name | How it is found |
  |---|---|---|---|
  | `ardea_cinerea` | bird | *siva čaplja* | lives on the shore |
  | `crex_crex` | bird | *kosec* | lives in the wet meadow, out only at dusk and at night |
  | `hyla_arborea` | amphibian | *zelena rega* | lives by the reeds |
  | `calopteryx_splendens` | insect | *pasasti bleščavec* | lives on the islet, reached by wading |
  | `iris_pseudacorus` | plant | *vodna perunika* | on the shore by the reeds |
  | `iris_sibirica` | plant | *sibirska perunika* | in the wet meadow |
  | `nymphaea_alba` | plant | *beli lokvanj* | out in the shallows, reached by wading |

- **A person and a quest:** Neža, a birdwatcher by the lake, gives *Presihajoče jezero* (`vanishing_lake`): identify three wetland species. The reward flag `lake_explored` ends the journey. Luka's lines change to send the player on to the lake.
- **Weather** for the region: rain and fog more often than elsewhere, and snow only in winter. These are fictional gameplay values.
- **Art (placeholder, original):**
  - a new tileset row: deep water with a ripple frame, reeds, wet meadow ground, and decor tiles for the three plants
  - pictures for the seven species and walk sprites for the four animals
  - Neža's sprite sheet

**Demo outcome:**
1. Finish Luka's quest; the travel map shows *Cerkniško jezero* open.
2. On the lake, Neža offers her quest. A heron stands on the shore.
3. Wade out to the water lily and the demoiselle on the islet, and find the corncrake in the wet meadow at dusk. Three wetland species complete Neža's quest.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `regions`: the fifth region in the journey; a new save has four locked regions.
- `quests`: Neža's quest; Luka's quest no longer ends the journey (dialogue only).
- `habitat-search`: the `wetland` habitat.
- `species-catalog`: the seven wetland species.
- `world-exploration`: the lake map's habitat zones, spots and person, and spots reached only by wading.

## Non-goals

- The seasonal rise and fall of the real lake (the owner chose shallows instead).
- New mechanics or tools; the boots already cross shallow water.
- Fish, swimming, boats or deep-water access.
- More areas than one for the lake map.
- Changes to the engine or the API. Existing rules cover regions, zones, spots, wading and searching.

## Impact

- **Content:**
  - `regions/cerknica.json`, `maps/cerknica_lake.json`, `areas/cerknica_lake.json`, `habitats/wetland.json`
  - `npcs/neza.json` with its sprite, `quests/vanishing_lake.json`
  - Luka's dialogue
  - seven species with pictures; four walk sprites
  - the tileset's new row, which every map's embedded tileset entry gains
- **Server, engine, client:** no code changes expected. Content validation and existing tests cover the new files.
- **Tests:**
  - **Content tests:** region, habitat, species, quest.
  - **Map tests:** zones and spots, the person's tile, reachability. The lily and the islet need the boots.
  - **Integration tests:** the region list and its locks.
  - **Client tests:** the travel map's region count.
- **Docs:** README status and content notes; product vision roadmap.
