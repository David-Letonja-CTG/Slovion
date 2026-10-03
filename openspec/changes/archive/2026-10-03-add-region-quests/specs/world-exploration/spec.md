## MODIFIED Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON). A map SHALL define:
- ground layers and a collision layer
- a spawn point
- interactive spots
- optional habitat zones (rectangles naming a habitat)
- area zones (rectangles naming an area) covering every walkable tile
- optional NPCs (tile objects naming an NPC)
- optional gates (tile objects naming the flag that opens them)
- exactly one signpost (a tile object of class `signpost`)

No map layout SHALL be hardcoded in game code. Content validation SHALL reject:
- NPCs naming an unknown NPC
- gates whose flag no quest rewards
- NPCs, gates or signposts outside the map
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

#### Scenario: Species of the regions on their maps
- **WHEN** a region map is loaded
- **THEN** it has a resident spot for each of the region's animals and a fixed spot for each of its ground plants, and the player can reach each spot from the spawn
- **AND** some of its trees or shrubs lie inside the habitat zones

#### Scenario: People of the regions
- **WHEN** a region map is loaded
- **THEN** its person stands at tile (3, 10), beside the path near the spawn and outside the habitat zones:

  | Map | NPC |
  |---|---|
  | `kocevje_forest` | `jure` |
  | `pohorje_forest` | `maja` |
  | `triglav_alps` | `luka` |

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
