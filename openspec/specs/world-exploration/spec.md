# world-exploration Specification

## Purpose

Defines how the player moves through the game world: maps authored as data, tile-by-tile movement with walking and running, collision, a following camera, and interacting with what the player faces.

## Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON). A map SHALL define:
- ground layers and a collision layer
- a spawn point
- interactive spots
- optional habitat zones (rectangles naming a habitat)
- area zones (rectangles naming an area) covering every walkable tile
- optional NPCs (tile objects naming an NPC)
- optional gates (tile objects naming the flag that opens them)

No map layout SHALL be hardcoded in game code. Content validation SHALL reject:
- NPCs naming an unknown NPC
- gates whose flag no quest rewards
- NPCs or gates outside the map

#### Scenario: Entering the meadow
- **WHEN** a game starts or continues
- **THEN** the map `dravsko_polje_meadow` is shown with the player on its spawn tile, facing the spawn's direction

#### Scenario: Habitat zones
- **WHEN** the meadow is loaded
- **THEN** its tall-grass tiles belong to a zone of habitat `tall_grass` and the path does not
- **AND** the hedgerow strip south of the meadow belongs to a zone of habitat `hedgerow`

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

### Requirement: Invalid map is reported
If a map cannot be loaded or does not satisfy the supported format (orthogonal, fixed tile size, a spawn point, layers referenced by name), the game SHALL show a Slovenian error message instead of a broken or blank world.

#### Scenario: Map without spawn
- **WHEN** a map without a spawn object is loaded
- **THEN** loading fails with an error identifying the missing spawn, and the player sees an error message

### Requirement: Tile-by-tile movement
The player SHALL occupy exactly one tile. Holding a movement action SHALL move the player tile by tile at 4 tiles per second, or 8 tiles per second while `Run` is held. A started step SHALL always complete, and movement between tiles SHALL be drawn smoothly.

#### Scenario: Walking one second
- **WHEN** the player holds `MoveRight` on open ground for exactly one second of simulated time
- **THEN** the player has moved exactly 4 tiles right, at any display refresh rate

#### Scenario: Running
- **WHEN** the player holds `MoveRight` and `Run` for one second on open ground
- **THEN** the player has moved exactly 8 tiles right

#### Scenario: Short tap
- **WHEN** the player taps `MoveDown` for a single frame
- **THEN** the player completes exactly one step down

### Requirement: Collision
The player SHALL NOT enter any of these tiles:
- a tile marked as blocked in the collision layer
- a tile outside the map
- a tile with an NPC
- a tile with a gate whose flag the save does not have

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

### Requirement: Camera follows the player
The camera SHALL keep the player centred, but SHALL NOT show anything beyond the map edges. Along a dimension where the map is smaller than the view, the map SHALL be centred.

#### Scenario: Near a map corner
- **WHEN** the player stands on the top-left tile
- **THEN** the view shows the top-left corner of the map with no area outside the map

#### Scenario: Middle of the map
- **WHEN** the player stands far from all edges
- **THEN** the player is drawn at the centre of the view

### Requirement: Interacting with the faced tile
When the player is not mid-step and `Interact` is pressed, the game SHALL act on the first of these that applies:
1. If the player faces an NPC, it SHALL start a conversation with that NPC.
2. Otherwise, if the player faces a spot, it SHALL interact with that spot.
3. Otherwise, if the player stands in a habitat zone, it SHALL start a search of that habitat at the player's tile.

If none applies, nothing SHALL happen and no request SHALL be sent.

#### Scenario: Talking to Vera
- **WHEN** the player stands next to Vera, faces her and presses `Interact`
- **THEN** a conversation with NPC `vera` on map `dravsko_polje_meadow` is started

#### Scenario: Facing the meadow sage
- **WHEN** the player stands next to the meadow sage spot, faces it and presses `Interact`
- **THEN** an interaction with that spot's ID on map `dravsko_polje_meadow` is started

#### Scenario: Standing in tall grass
- **WHEN** the player stands on a tile inside a `tall_grass` zone, faces no spot or NPC and presses `Interact`
- **THEN** a search of that tile on map `dravsko_polje_meadow` is started

#### Scenario: A spot wins over the habitat
- **WHEN** the player stands in a habitat zone and faces a spot
- **THEN** the spot interaction is started, not a search

#### Scenario: Facing empty grass
- **WHEN** the player stands outside every habitat zone, faces a tile without a spot or NPC and presses `Interact`
- **THEN** nothing happens

### Requirement: Draw order
Map layers SHALL be drawn in their authored order. NPCs and closed gates SHALL be drawn above the ground layers, and the player SHALL be drawn above the ground layers and NPCs.

#### Scenario: Player on grass
- **WHEN** the player stands on a grass tile
- **THEN** the player sprite is visible on top of the grass

#### Scenario: Vera on the meadow
- **WHEN** Vera's tile is on screen
- **THEN** her sprite is visible on top of the ground
