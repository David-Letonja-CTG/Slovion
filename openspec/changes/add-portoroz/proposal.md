# Proposal

## Why

The owner planned three more regions as a chain (Ljubljana → Murska Sobota → Portorož), each with a new mechanic. Portorož is the last:
- **The coast:** a seaside promenade, a pebble beach, the shallow sea, and the Sečovlje salt pans.
- **Its mechanic:** a snorkel mask, a new tool that lets the player swim in shallow sea and meet the sea life there.

## What Changes

- **A new region, *Portorož*** (`portoroz`): map `portoroz_coast`, opened by Štefan's reward flag `farmland_explored`. Štefan's lines send the player on.
- **The map:**
  - a promenade with houses and lamp posts (Ljubljana's tiles)
  - a pebble beach, then a band of shallow sea and the deep sea beyond
  - the Sečovlje salt pans: salt fields, earthen dykes and a channel
- **The snorkel (new tool):** *maska z dihalko* (`snorkel`), the reward of the Portorož quest.
  - Tileset tiles marked `swimmable` (the shallow sea) block movement, except for a player with the snorkel, as `wadeable` tiles do for the boots.
  - Aquatic animals may live on `swimmable` tiles as well as on `wadeable` ones.
  - Deep sea stays closed.
- **Two new species groups:** `fish` (*riba*) and `mollusc` (*mehkužec*), for the sea life.
- **Two new habitats:** *Soline* (`saltpan`) in the salt pans, and *Morje* (`sea`) for the sea life, whose journal section the snorkel fills.
- **Six new species,** each with sourced facts, three clues and a picture; the animals also get a walk sprite:

  | Species | Group | Slovenian name | Where | Main sources |
  |---|---|---|---|---|
  | `himantopus_himantopus` | bird | *polojnik* | the salt pans; March–October | Krajinski park Sečoveljske soline (KPSS), sl.wikipedia |
  | `egretta_garzetta` | bird | *mala bela čaplja* | the salt pans; all year | KPSS, sl.wikipedia |
  | `salicornia_europaea` | plant | *navadni osočnik* | the salt fields; flowers July–September | KPSS |
  | `aphanius_fasciatus` | fish | *solinarka* | the salt-pan channel (aquatic); spring to autumn | KPSS |
  | `sarpa_salpa` | fish | *salpa* | the shallow sea (aquatic) | sl.wikipedia |
  | `pinna_nobilis` | mollusc | *veliki leščur* | the sea floor among the shallows (perched) | Krajinski park Strunjan |

- **A person and a quest:** Nina, a marine biologist, gives *Med solinami in morjem* (`between_salt_and_sea`): identify three `saltpan` species. Its rewards are the snorkel and the flag `coast_explored`. It is the last step of the journey, so her lines say the journey is complete and invite the player into the sea.
- **A research station,** *Morje in soline*: stilt, little egret, glasswort, killifish, salema and pen shell; goal 3 of 6.
- **Weather** weights for the region (fictional).
- **Art,** in the art pass style:
  - tiles: pebble beach, shallow sea and its ripple frame, salt field, dyke, glasswort
  - the snorkel's icon, pictures and walk sprites for the new species
  - Nina's sprite sheet

**Demo outcome:**
1. Finish Štefan's quest; *Portorož* opens on the travel map.
2. Stilts and little egrets walk in the salt pans, killifish swim in the channel, glasswort grows on the salt fields; the lamps light the promenade at night.
3. Nina's quest gives the snorkel. With it, the player swims into the shallow sea and meets the salema and the pen shell.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **`regions`:** the ninth region in the chain.
- **`quests`:** Nina's quest; Štefan's quest no longer ends the journey (dialogue only).
- **`habitat-search`:** the `saltpan` and `sea` habitats.
- **`species-catalog`:** the groups `fish` and `mollusc`; the five new species.
- **`inventory`:** the snorkel and what it does.
- **`world-exploration`:** `swimmable` tiles; the Portorož map.
- **`wildlife`:** aquatic animals also live on `swimmable` tiles.
- **`research-stations`:** the ninth station.

## Non-goals

- Swimming animations, diving, depth, or breath.
- Boats, the pier as a walkable structure into the sea, or entering buildings.
- Salt-making as an activity.
- A real map of Portorož or Sečovlje; both are fictionalized and put on one map.
- Seagrass meadows as a species: no source with species-level facts for the Slovenian sea was found.
- Hosting; the owner keeps it for last.

## Impact

- **Content:**
  - region, map and areas
  - habitats `saltpan` and `sea`
  - six species with pictures and five walk sprites
  - the tool `snorkel` with its icon
  - NPC, quest and station; Štefan's dialogue
  - new tiles, which every map's tileset entry gains
- **Server:** the species groups `fish` and `mollusc`.
- **Client:** the group labels in the Slovenian catalog.
- **Engine:** `swimmable` tiles in the tileset parser; the snorkel lets the player swim; aquatic residents swim there too.
- **Tests:** content, map, engine (swimming) and integration.
