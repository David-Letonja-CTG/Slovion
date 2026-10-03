# Proposal

## Why

The whole game is one meadow. The owner asked for new places in Slovenia: Kočevje with the brown bear, Pohorje with the wolf, and Triglav with the chamois. Each should be reached by travelling and unlocked by progress, so that learning species opens up the country. This is the second of three back-to-back changes. The third adds more species, both animals and plants, to the new regions.

## What Changes

- **Regions** are content (`content/regions/<regionId>.json`). Each region has:
  - a map
  - a localized name and a hint explaining what unlocks it
  - a position on the travel map
  - an unlock rule: always open, a progress flag, or a number of identified species

  The four regions are:

  | Region | Map | Unlocked by |
  |---|---|---|
  | **Dravsko polje** | the existing meadow | always open |
  | **Kočevje** | new forest map | the flag `hedgerow_open`, i.e. Vera's quest |
  | **Pohorje** | new mountain-forest map | **6** identified species |
  | **Triglav** | new alpine map | **8** identified species |

  The unlock numbers are fictional gameplay data, for owner review.
- **Signposts:** every map has a signpost (*kažipot*) near its spawn. Interacting with it opens the **travel map**: a schematic map of Slovenia with the four regions. Locked regions show what unlocks them, e.g. *Prepoznaj še 2 vrsti.* Choosing an open region travels there.
- **Travel is decided by the server** (D3). `POST /api/save/travel` checks the unlock rule and stores the save's **current region**, and `GET /api/save/regions` lists the regions with their state. A migration adds the current region to the save slot.
- **Arriving:** the screen fades out, the region's map loads with the player on its spawn, the screen fades in, and the place banner shows the area's name.
- **Continuing a game** enters the save's current region instead of always the meadow.
- **Three new maps:** `kocevje_forest`, `pohorje_forest` and `triglav_alps`, each with:
  - its own tiles: firs, beeches, rocks, scree, snow, alpine grass and the signpost
  - one area named after the place
  - a habitat for the journal: *Jelovo-bukov gozd*, *Gorski gozd*, *Visokogorje* (no search zones yet, because searches only find plants, which come in the third change)
  - its signature animal as a resident
- **Three new sourced species:**
  - *rjavi medved* (*Ursus arctos*)
  - *volk* (*Canis lupus*)
  - *gams* (*Rupicapra rupicapra*)

  Each comes with facts and sources (D6), three clues, a picture, a walk sprite, availability (e.g. the bear's winter rest, if the sources state it) and torch traits. The planned traits are bear `shy`, wolf `shy` and chamois `calm`, for owner review.
- ***Terenski dnevnik*** gains the three new habitat sections after *Mejica*.

**Demo outcome:**
1. Finish Vera's quest and walk to the signpost by the spawn.
2. The travel map shows Kočevje open, and Pohorje and Triglav locked with their hints.
3. Travel to Kočevje: the screen fades, the forest appears, the banner shows *Kočevski gozd*, and a bear wanders among the firs.
4. Reload: the game continues in Kočevje.

## Capabilities

### New Capabilities

- `regions`:
  - region content and unlock rules
  - the travel map and travelling, including the transition
  - the save's current region and its API

### Modified Capabilities

- `world-exploration`: maps have signposts, interacting with a signpost opens the travel map, and the game enters the current region's map.
- `game-session`: *Nadaljuj* enters the save's current region.
- `species-catalog`: the repository content includes the three new species.

## Non-goals

- More species for the new regions, plants included. That is the third change.
- Walking between maps, doors or warps. Travel happens only through signposts.
- Quests, NPCs or gates in the new regions.
- A detailed or geographically exact map of Slovenia. The travel map is schematic.
- Weather, region-specific time, or region-specific seasons. The clock stays per save (D8).
- Fast travel to a spot within a map, or saving the position within a map. Arrival is always at the region's spawn.

## Impact

- **Content:**
  - `content/regions/*.json` (4 regions)
  - 3 maps, areas and habitats
  - 3 species with pictures and walk sprites
  - new tiles (a new tileset row) and the signpost tile
- **Database:** migration `AddCurrentRegion`, which adds `region_id` to `save_slots`, defaulting to `dravsko_polje`.
- **Server:**
  - region loading and validation (map exists, flag is rewarded, counts are positive, every map belongs to exactly one region)
  - `TravelService`
  - `GET /api/save/regions` and `POST /api/save/travel`
  - error codes `unknown_region` and `region_locked`
- **Engine:** signpost objects in the parser; a `signpost` interaction.
- **Client:**
  - loads the current region's map
  - the travel map dialog
  - fade transitions
  - reloads the world on travel
- **Tests:** in all layers, plus an E2E travel path.
