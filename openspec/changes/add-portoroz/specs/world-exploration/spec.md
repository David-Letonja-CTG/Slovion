## MODIFIED Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON). A map SHALL define:
- ground layers and a collision layer
- a spawn point
- interactive spots
- optional habitat zones (rectangles naming a habitat)
- area zones (rectangles naming an area) covering every walkable tile; an area zone may be marked `underground` (a boolean property)
- optional NPCs (tile objects naming an NPC)
- optional gates (tile objects naming the flag that opens them)
- exactly one signpost (a tile object of class `signpost`)
- optional research stations (tile objects of class `station` naming a station, see `research-stations`)
- optional lamp posts (tile objects of class `lamp`), which light up in the evening and at night (see `world-conditions`)

No map layout SHALL be hardcoded in game code. Content validation SHALL reject:
- NPCs naming an unknown NPC
- gates whose flag no quest rewards
- NPCs, gates, signposts, stations or lamp posts outside the map
- stations naming an unknown station
- an `underground` property that is not a boolean
- a map without exactly one signpost

#### Scenario: Entering the meadow
- **WHEN** a new game starts
- **THEN** the map `dravsko_polje_meadow` is shown with the player on its spawn tile, facing the spawn's direction

#### Scenario: Entering the current region
- **WHEN** a game continues for a save whose current region is `kocevje`
- **THEN** the map `kocevje_forest` is shown with the player on its spawn tile

#### Scenario: Habitat zones
- **WHEN** the meadow is loaded
- **THEN** its tall-grass tiles belong to a zone of habitat `tall_grass` and the path does not
- **AND** the hedgerow strip south of the meadow belongs to a zone of habitat `hedgerow`

#### Scenario: Habitat zones in the regions
- **WHEN** a region map is loaded
- **THEN** part of its walkable ground belongs to zones of the region's habitat, and the path from the spawn to the signpost does not:

  | Map | Habitat |
  |---|---|
  | `kocevje_forest` | `fir_beech_forest` |
  | `pohorje_forest` | `mountain_forest` |
  | `triglav_alps` | `alpine_grassland` |
  | `cerknica_lake` | `wetland` |
  | `rakov_skocjan_karst` | `karst` |
  | `ljubljana_park` | `city` |
  | `murska_sobota_village` | `farmland` |
  | `portoroz_coast` | `saltpan` |

#### Scenario: Species of the regions on their maps
- **WHEN** a region map is loaded
- **THEN** it has a resident spot for each of the region's animals and a fixed spot for each of its ground plants, and the player can reach each spot from the spawn
- **AND** some of its trees or shrubs (on the lake: reeds) lie inside the habitat zones

#### Scenario: Spots reached by wading
- **WHEN** `cerknica_lake` is loaded
- **THEN** the white water lily's spot and the banded demoiselle's spot can be reached from the spawn with the boots, but not without them
- **AND** every other spot on the lake can be reached without the boots

#### Scenario: People of the regions
- **WHEN** a region map is loaded
- **THEN** its person stands at tile (3, 10), beside the path near the spawn and outside the habitat zones:

  | Map | NPC |
  |---|---|
  | `kocevje_forest` | `jure` |
  | `pohorje_forest` | `maja` |
  | `triglav_alps` | `luka` |
  | `cerknica_lake` | `neza` |
  | `rakov_skocjan_karst` | `tilen` |
  | `ljubljana_park` | `ana` |
  | `murska_sobota_village` | `stefan` |
  | `portoroz_coast` | `nina` |

#### Scenario: Areas of the meadow
- **WHEN** the meadow is loaded
- **THEN** the meadow, its southern hedge and the gate belong to area `meadow`, and the hedgerow strip belongs to area `south_hedgerow`

#### Scenario: The hedgerow is closed off
- **WHEN** a save without flag `hedgerow_open` walks along the southern hedge of the meadow
- **THEN** the hedgerow strip is visible beyond it, and the closed gate is the only tile that could connect the meadow to the strip

#### Scenario: Vera and the gate
- **WHEN** the meadow is loaded
- **THEN** NPC `vera` stands next to the path near the spawn
- **AND** a gate requiring flag `hedgerow_open` is the only opening in the southern hedge

#### Scenario: A signpost near every spawn
- **WHEN** any repository map is loaded
- **THEN** it has exactly one signpost, which the player can reach from the spawn

#### Scenario: A station on every region map
- **WHEN** a region map is loaded
- **THEN** it has one research station on a tile beside the path near the spawn, outside the habitat zones, which the player can face from a reachable tile

#### Scenario: The karst gorge and its cave
- **WHEN** `rakov_skocjan_karst` is loaded
- **THEN** the gorge belongs to an area that is not underground and the cave to an area marked `underground`
- **AND** the olm's spot lies on a water tile inside the cave, and the cave beetle's and the bat's spots lie on the cave floor
- **AND** the habitat zones lie in the gorge only

#### Scenario: The Ljubljana park
- **WHEN** `ljubljana_park` is loaded
- **THEN** it has lamp posts along its paths, a `city` zone in the park, and a `wetland` zone on the barje strip with the fritillary's spot and a corncrake resident spot

#### Scenario: The Murska Sobota village
- **WHEN** `murska_sobota_village` is loaded
- **THEN** the stork's spot lies on a blocked roof tile that can be faced from a walkable tile
- **AND** a `farmland` zone covers the fields and the orchard, and a `wetland` zone covers the oxbow, where the otter's spot lies on a wadeable tile, and the Mura's bank

#### Scenario: The Portorož coast
- **WHEN** `portoroz_coast` is loaded
- **THEN** it has a promenade with lamp posts, a beach, a band of swimmable shallow sea and deep sea beyond it, and a `saltpan` zone over the salt pans
- **AND** every spot on land can be reached from the spawn without tools, and the noble pen shell's spot can be faced only from a swimmable tile

### Requirement: Collision
The player SHALL NOT enter any of these tiles:
- a tile marked as blocked in the collision layer
- a tile outside the map
- a tile with an NPC
- a tile with a resident animal
- a tile with a gate whose flag the save does not have

A blocked tile whose tileset tile is marked `wadeable` SHALL be enterable by a player with the boots, and one marked `swimmable` by a player with the snorkel (see `inventory`); only aquatic resident animals SHALL enter them.

Pressing towards such a tile SHALL turn the player to face it without moving.

#### Scenario: Walking into a fence
- **WHEN** the player faces open ground and presses `MoveUp` towards a blocked tile
- **THEN** the player turns to face up and stays on the same tile

#### Scenario: Map edge
- **WHEN** the player stands on the left edge of the map and holds `MoveLeft`
- **THEN** the player does not leave the map

#### Scenario: Closed gate
- **WHEN** a save without `hedgerow_open` walks into the southern gate
- **THEN** the player stays in front of it and the gate stays drawn

#### Scenario: Open gate
- **WHEN** a save with `hedgerow_open` walks into the gate's tile
- **THEN** the player walks through, the gate is not drawn, and the player can reach the hedgerow strip

#### Scenario: Wading with boots
- **WHEN** a player with the boots walks into Kočevje's stream
- **THEN** the player enters the stream tile

#### Scenario: Swimming with the snorkel
- **WHEN** a player with the snorkel walks into Portorož's shallow sea
- **THEN** the player enters the sea tile
