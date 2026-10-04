# Proposal

## Why

The owner chose a karst cave as the next habitat, opened after Neža's quest. Caves are the most distinctively Slovenian habitat:
- the olm (*človeška ribica*), Europe's only cave-dwelling vertebrate
- the first cave beetle ever described (*drobnovratnik*), found in Postojnska jama

The cave also gives the lamp, carried since the start, a real use: underground it is always dark.

The region is based on **Rakov Škocjan**, a karst gorge with a stream and caves in Notranjski regijski park. The park already sources many of our species, and it has pages for the olm and both planned entrance plants.

## What Changes

- **A new region, *Rakov Škocjan*** (`rakov_skocjan`): map `rakov_skocjan_karst`, opened by Neža's reward flag `lake_explored`. The journey now ends here; Neža's lines send the player on.
- **The map:**
  - **outside:** a shaded karst gorge, with a stream (wadeable) under rock walls and a searchable rocky slope
  - **inside:** the cave beyond its mouth, with a passage and an underground pool
- **Underground areas:** an area zone of the map may be marked `underground`. While the player is in such an area:
  - the map is dark at any time of day
  - a lit torch clears its circle around the player
  - no weather is drawn
  - animals react to the torch as they do at night

  The cave is such an area; the gorge is not.
- **Aquatic animals:** a species' wildlife traits may mark it `aquatic`. An aquatic resident lives and wanders only on water tiles, the reverse of other animals. The olm lives in the underground pool.
- **A new habitat, *Kras*** (`karst`), with zones on the gorge's slope and rocks. There is no searching inside the cave, since searches find plants only.
- **Five species,** each with sourced facts, three clues and a picture; the animals also get a walk sprite:

  | Species | Group | Slovenian name | Where | Main source |
  |---|---|---|---|---|
  | `proteus_anguinus` | amphibian | *človeška ribica* | the underground pool (aquatic) | Notranjski regijski park |
  | `leptodirus_hochenwartii` | insect | *drobnovratnik* | the cave floor | sl.wikipedia |
  | `rhinolophus_ferrumequinum` | mammal | *veliki podkovnjak* | the cave, in winter only ("zime preživi v hibernaciji v jamah") | sl.wikipedia |
  | `saxifraga_rotundifolia` | plant | *okroglolistni kamnokreč* | rocks in the gorge | Notranjski regijski park |
  | `chrysosplenium_alternifolium` | plant | *premenjalnolistni vraničnik* | by the stream in the gorge | Notranjski regijski park |

- **A research station,** *Podzemlje*, at the gorge path: the olm, the cave beetle and the bat; the goal is 2 of 3 at ★★★, so it does not need a winter visit.
- **A person and a quest:** Tilen, a cave researcher at the cave mouth, gives *V temo* (`into_the_dark`): identify three karst species. Its reward flag `caves_explored` ends the journey.
- **Weather** for the region: fictional weights, as for every region. Nothing is drawn underground.
- **Art:**
  - new tiles: rock wall, cave floor, cave wall, dark pool and the cave mouth
  - pictures and walk sprites for the new species
  - Tilen's sprite sheet, in the style of the art pass

**Demo outcome:**
1. Finish Neža's quest; *Rakov Škocjan* opens on the travel map.
2. In the gorge, the saxifrages grow by the stream and on the rocks, and Tilen waits at the cave mouth.
3. Walk into the cave: it goes dark, and the torch lights the way. The beetle is on the floor, the olm swims in the pool, and in winter a bat hangs in the cave.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **`regions`:** the sixth region in the journey.
- **`quests`:** Tilen's quest; Neža's quest no longer ends the journey (dialogue only).
- **`habitat-search`:** the `karst` habitat.
- **`species-catalog`:** the five species; the `aquatic` wildlife trait.
- **`world-exploration`:** the karst map; area zones may be `underground`.
- **`world-conditions`:** darkness and the torch underground.
- **`wildlife`:**
  - aquatic residents and their water tiles
  - torch reactions underground
  - the `aquatic` trait in the wildlife response
- **`weather`:** no weather drawn underground.
- **`research-stations`:** the sixth station.

## Non-goals

- Cave exploration mechanics (ropes, climbing, getting lost), or darkness affecting encounters or movement.
- Searching underground.
- More regions, or underground parts of existing maps.
- Fish or other aquatic animals beyond the olm, although the trait allows them later.

## Impact

- **Content:**
  - region, map, area files and habitat
  - NPC and quest; Neža's dialogue
  - five species with pictures and three walk sprites
  - new tiles, which every map's tileset entry gains
- **Server:**
  - the `aquatic` trait (content and the wildlife response)
  - the optional `underground` property of area zones is validated as a boolean
- **Engine:**
  - underground areas: darkness, torch and no weather
  - aquatic residents: they wander on water tiles only
- **Client:** passes the aquatic trait to the engine.
- **Tests:** content, map, engine, integration and client tests.
