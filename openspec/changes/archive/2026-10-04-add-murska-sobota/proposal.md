# Proposal

## Why

The owner planned three more regions as a chain (Ljubljana → Murska Sobota → Portorož), each with a new mechanic. Ljubljana is done, so Murska Sobota comes next:
- **A Prekmurje village** at the edge of Murska Sobota, with fields, an old orchard and the Mura river.
- **Its mechanic:** the white stork on a chimney. Wikipedia names the stork "simbol Prekmurja", and DOPPS says it nests on roof ridges, chimneys and poles.

## What Changes

- **A new region, *Murska Sobota*** (`murska_sobota`): map `murska_sobota_village`, opened by Ana's reward flag `city_explored`. Ana's lines send the player on.
- **The map:**
  - a village street with houses; one chimney carries a stork's nest
  - fields and an old orchard (the farmland zone)
  - the Mura with a gravel bank and willow shrubs
  - an oxbow (*mrtvica*) with shallow water, where the otter lives
- **Perched animals (new):** an animal species may declare the wildlife trait `perched`.
  - A perched resident stays on its home tile and never wanders or reacts to the torch.
  - Its home may be a blocked tile, such as a nest on a roof.
  - The player meets it by facing that tile, as with any resident.
  - The stork is the first perched animal.
- **A new habitat, *Kulturna krajina*** (`farmland`): the fields and the orchard are searchable. The existing skylark joins it, since its sources name fields. The otter and the purple willow join the existing `wetland` habitat.
- **Five new species,** each with sourced facts, three clues and a picture; the animals also get a walk sprite:

  | Species | Group | Slovenian name | Where | Main sources |
  |---|---|---|---|---|
  | `ciconia_ciconia` | bird | *bela štorklja* | the nest on the chimney; spring and summer, by day | Notranjski regijski park, DOPPS, sl.wikipedia |
  | `upupa_epops` | bird | *smrdokavra* | the old orchard; spring to autumn, by day | Notranjski regijski park, sl.wikipedia |
  | `lutra_lutra` | mammal | *vidra* | the oxbow (aquatic) | Notranjski regijski park, sl.wikipedia |
  | `viola_arvensis` | plant | *njivska vijolica* | field edges; April–October | Notranjski regijski park |
  | `salix_purpurea` | plant | *rdeča vrba* | the Mura's gravel bank | Notranjski regijski park |

- **A person and a quest:** Štefan, a farmer who watches the village's storks, gives *Pod štorkljinim gnezdom* (`under_the_storks_nest`): identify three `farmland` species. Its reward flag, `farmland_explored`, opens Portorož in the next change; until then, Štefan's closing lines promise no next stop.
- **A research station,** *Kulturna krajina*: stork, hoopoe, otter, field pansy and purple willow; goal 3 of 5.
- **Weather** weights for the region (fictional).
- **Art,** in the art pass style:
  - tiles: the chimney with the stork's nest, a ploughed field, a crop field, the field pansy, the purple willow, a gravel bank, and an old fruit tree with its sway frame
  - pictures and walk sprites for the new species
  - Štefan's sprite sheet

**Demo outcome:**
1. Finish Ana's quest; *Murska Sobota* opens on the travel map.
2. In spring, a stork stands on its nest on a chimney, and the player identifies it from beside the house.
3. A hoopoe walks in the orchard, field pansies grow at the field edges, and the otter swims in the oxbow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **`regions`:** the eighth region in the chain.
- **`quests`:** Štefan's quest; Ana's quest no longer ends the journey (dialogue only).
- **`habitat-search`:** the `farmland` habitat; the skylark joins it, and the otter and the purple willow join `wetland`.
- **`species-catalog`:** the five new species; the wildlife trait `perched`.
- **`wildlife`:** perched residents stay on their home tile, which may be blocked, and don't react to the torch; the wildlife list says whether each one is perched.
- **`world-exploration`:** the Murska Sobota map.
- **`research-stations`:** the eighth station.

## Non-goals

- Portorož; it comes in its own change.
- Storks flying, or nests on other maps.
- Farming, crops that grow, or buildings that can be entered.
- A real map of Murska Sobota; the village is fictionalized (no real street names).
- A reptile group (e.g. the pond turtle); it would need a new species group.

## Impact

- **Content:**
  - region, map and areas
  - habitat `farmland`, and the `wetland` habitat's species list
  - five species with pictures and three walk sprites
  - NPC, quest and station; Ana's dialogue
  - new tiles, which every map's tileset entry gains
- **Server:** the wildlife trait `perched` (loading, validation, and in the wildlife response).
- **Engine:** perched residents stay put and may stand on a blocked tile.
- **Tests:** content, map, engine (perched residents) and integration.
