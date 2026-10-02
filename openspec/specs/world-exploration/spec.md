# world-exploration Specification

## Purpose

Defines how the player moves through the game world: maps authored as data, tile-by-tile movement with walking and running, collision, a following camera, and interacting with what the player faces.

## Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON) that defines ground layers, a collision layer, a spawn point, interactive spots and optional habitat zones (rectangles naming a habitat). No map layout SHALL be hardcoded in game code.

#### Scenario: Entering the meadow
- **WHEN** a game starts or continues
- **THEN** the map `dravsko_polje_meadow` is shown with the player on its spawn tile, facing the spawn's direction

#### Scenario: Habitat zones
- **WHEN** the meadow is loaded
- **THEN** its tall-grass tiles belong to a zone of habitat `tall_grass` and the path does not

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
The player SHALL NOT enter a tile marked as blocked in the collision layer or a tile outside the map. Pressing towards such a tile SHALL turn the player to face it without moving.

#### Scenario: Walking into a fence
- **WHEN** the player faces open ground and presses `MoveUp` towards a blocked tile
- **THEN** the player turns to face up and stays on the same tile

#### Scenario: Map edge
- **WHEN** the player stands on the left edge of the map and holds `MoveLeft`
- **THEN** the player does not leave the map

### Requirement: Camera follows the player
The camera SHALL keep the player centred, but SHALL NOT show anything beyond the map edges. Along a dimension where the map is smaller than the view, the map SHALL be centred.

#### Scenario: Near a map corner
- **WHEN** the player stands on the top-left tile
- **THEN** the view shows the top-left corner of the map with no area outside the map

#### Scenario: Middle of the map
- **WHEN** the player stands far from all edges
- **THEN** the player is drawn at the centre of the view

### Requirement: Interacting with the faced tile
When the player is not mid-step and `Interact` is pressed, the game SHALL interact with the spot on the tile the player faces, if there is one. Otherwise, if the player stands in a habitat zone, the game SHALL start a search of that habitat at the player's tile. If neither applies, nothing SHALL happen and no request SHALL be sent.

#### Scenario: Facing the meadow sage
- **WHEN** the player stands next to the meadow sage spot, faces it and presses `Interact`
- **THEN** an interaction with that spot's ID on map `dravsko_polje_meadow` is started

#### Scenario: Standing in tall grass
- **WHEN** the player stands on a tile inside a `tall_grass` zone, faces no spot and presses `Interact`
- **THEN** a search of that tile on map `dravsko_polje_meadow` is started

#### Scenario: A spot wins over the habitat
- **WHEN** the player stands in a habitat zone and faces a spot
- **THEN** the spot interaction is started, not a search

#### Scenario: Facing empty grass
- **WHEN** the player stands outside every habitat zone, faces a tile without a spot and presses `Interact`
- **THEN** nothing happens

### Requirement: Draw order
Map layers SHALL be drawn in their authored order, and the player SHALL be drawn above the ground layers.

#### Scenario: Player on grass
- **WHEN** the player stands on a grass tile
- **THEN** the player sprite is visible on top of the grass
