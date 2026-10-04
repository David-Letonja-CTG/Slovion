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

### Requirement: Interacting with the faced tile
When the player is not mid-step and `Interact` is pressed, the game SHALL act on the first of these that applies:
1. If the player faces an NPC, it SHALL start a conversation with that NPC.
2. Otherwise, if the player faces the signpost, it SHALL open the travel map.
3. Otherwise, if the player faces a research station, it SHALL open that station (see `research-stations`).
4. Otherwise, if the player faces a resident animal, it SHALL interact with that resident's spot.
5. Otherwise, if the player faces a plant spot, it SHALL interact with that spot.
6. Otherwise, if the player has the binoculars and a resident animal stands 2 or 3 tiles straight ahead with no blocking tile in between, it SHALL interact with the nearest such resident's spot.
7. Otherwise, if the player faces a blocked tile (a tree, shrub, rock or similar) inside a habitat zone, it SHALL start a search of that habitat at the faced tile.
8. Otherwise, if the player stands in a habitat zone, it SHALL start a search of that habitat at the player's tile.

If none applies, nothing SHALL happen and no request SHALL be sent. A spot whose species is an animal SHALL only be reachable through its resident, never as a fixed spot. Signposts, stations and lamp posts SHALL block movement.

#### Scenario: Talking to Vera
- **WHEN** the player stands next to Vera, faces her and presses `Interact`
- **THEN** a conversation with NPC `vera` on map `dravsko_polje_meadow` is started

#### Scenario: Reading the signpost
- **WHEN** the player faces the meadow's signpost and presses `Interact`
- **THEN** the travel map opens

#### Scenario: Facing the meadow sage
- **WHEN** the player stands next to the meadow sage spot, faces it and presses `Interact`
- **THEN** an interaction with that spot's ID on map `dravsko_polje_meadow` is started

#### Scenario: Facing an animal
- **WHEN** the player faces the hare resident and presses `Interact`
- **THEN** an interaction with the hare's spot ID is started

#### Scenario: Standing in tall grass
- **WHEN** the player stands on a tile inside a `tall_grass` zone, faces no spot, animal, signpost or NPC and presses `Interact`
- **THEN** a search of that tile on map `dravsko_polje_meadow` is started

#### Scenario: Searching at a tree
- **WHEN** the player stands on the path in Pohorje, outside every habitat zone, faces a spruce inside a `mountain_forest` zone and presses `Interact`
- **THEN** a search of the spruce's tile on map `pohorje_forest` is started

#### Scenario: A spot wins over the habitat
- **WHEN** the player stands in a habitat zone and faces a spot
- **THEN** the spot interaction is started, not a search

#### Scenario: Facing empty grass
- **WHEN** the player stands outside every habitat zone, faces a tile without a spot, animal, signpost or NPC and presses `Interact`
- **THEN** nothing happens

#### Scenario: Facing walkable grass in a zone from outside
- **WHEN** the player stands outside every habitat zone and faces a walkable tile inside one
- **THEN** nothing happens; walkable ground is searched by standing on it

#### Scenario: An animal seen through binoculars
- **WHEN** a player with the binoculars faces open ground with the hare 2 tiles ahead and presses `Interact`
- **THEN** an interaction with the hare's spot is started

#### Scenario: Reading a station
- **WHEN** the player faces the Kočevje research station and presses `Interact`
- **THEN** the dialog of station `forest_station` opens
