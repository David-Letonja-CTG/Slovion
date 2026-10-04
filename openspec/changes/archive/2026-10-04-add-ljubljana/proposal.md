# Proposal

## Why

The owner planned three more regions (Ljubljana, Murska Sobota, Portorož), continuing the journey as a chain, each with a new mechanic. Ljubljana comes first:
- **A first town in the game:** a city park by the Ljubljanica river, at the edge of Ljubljansko barje.
- **Its mechanic:** street lamps that light the park at night.

DOPPS counts Ljubljansko barje as Slovenia's most important corncrake site, so the corncrake, already in the game, can also be met here.

## What Changes

- **A new region, *Ljubljana*** (`ljubljana`): map `ljubljana_park`, opened by Tilen's reward flag `caves_explored`. Tilen's lines send the player on.
- **The map:**
  - a city park with paths, lawns and trees
  - a street at the park's edge with houses and lamp posts
  - the Ljubljanica river with a bridge and a reedy bank
  - a strip of Ljubljansko barje wet meadow beyond it
- **Street lamps (new):** a map may place lamp posts (tile objects of class `lamp`). In the evening and at night, each lamp clears a soft circle of light around it, like the torch, without the player doing anything. Lamp posts block movement. Animals do not react to lamps.
- **A new habitat, *Mesto*** (`city`): the park's lawns, trees and hedges are searchable. The barje strip uses the existing `wetland` habitat.
- **Five new species,** each with sourced facts, three clues and a picture; the animals also get a walk sprite:

  | Species | Group | Slovenian name | Where | Main source |
  |---|---|---|---|---|
  | `apus_apus` | bird | *hudournik* | over the park and the houses; spring and summer | DOPPS |
  | `erinaceus_roumanicus` (confirmed against the sources when building) | mammal | *beloprsi jež* | the park at dusk and night | Notranjski regijski park |
  | `alcedo_atthis` | bird | *vodomec* | the Ljubljanica bank | Notranjski regijski park |
  | `fritillaria_meleagris` | plant | *močvirska logarica* | the barje strip; spring | Botanični vrt UL, plus a habitat source |
  | `alnus_glutinosa` | plant | *črna jelša* | the river bank | Notranjski regijski park |

  The corncrake (`crex_crex`, existing) also lives on the barje strip.
- **A person and a quest:** Ana, a park gardener, gives *Mestna narava* (`city_nature`): identify three city species. Its reward flag, `city_explored`, opens Murska Sobota in the next change. Until then, Ana's closing lines don't promise a next stop.
- **A research station,** *Mestna narava*: swift, hedgehog, kingfisher and black alder, goal 3 of 4.
- **Weather** weights for the region (fictional).
- **Art,** in the art pass style:
  - tiles: paved path, house walls and roofs, a lawn, a bridge, and a lamp post that lights up at night
  - pictures and walk sprites for the new species
  - Ana's sprite sheet

**Demo outcome:**
1. Finish Tilen's quest; *Ljubljana* opens on the travel map.
2. By day, Ana waits in the park, swifts fly over the houses in summer, and the kingfisher sits on the river bank.
3. At night, the lamp posts light the paths, and the hedgehog comes out on the lawn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **`regions`:** the seventh region in the chain.
- **`quests`:** Ana's quest; Tilen's quest no longer ends the journey (dialogue only).
- **`habitat-search`:** the `city` habitat; the fritillary joins `wetland`.
- **`species-catalog`:** the five new species.
- **`world-exploration`:** lamp posts as map objects that block movement; the Ljubljana map.
- **`world-conditions`:** lamp light in the evening and at night.
- **`research-stations`:** the seventh station.

## Non-goals

- Murska Sobota and Portorož; they come in their own changes.
- Traffic, shops, buildings that can be entered, or crowds.
- Lamps changing animal behaviour or encounters.
- A real map of Ljubljana; the park is fictionalized (no real street names).

## Impact

- **Content:**
  - region, map and areas
  - habitat `city`, and the `wetland` habitat's species list
  - five species with pictures and three walk sprites
  - NPC, quest and station; Tilen's dialogue
  - new tiles, which every map's tileset entry gains
- **Server:** lamp objects are validated like signposts (tile object, inside the map).
- **Engine:** lamp objects in the parser; they block movement; the renderer clears a light circle around each lamp in the evening and at night.
- **Tests:** content, map, engine (lamps), renderer and integration.
