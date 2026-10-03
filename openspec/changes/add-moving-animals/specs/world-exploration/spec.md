## MODIFIED Requirements

### Requirement: Collision
The player SHALL NOT enter any of these tiles:
- a tile marked as blocked in the collision layer
- a tile outside the map
- a tile with an NPC
- a tile with a resident animal
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

### Requirement: Interacting with the faced tile
When the player is not mid-step and `Interact` is pressed, the game SHALL act on the first of these that applies:
1. If the player faces an NPC, it SHALL start a conversation with that NPC.
2. Otherwise, if the player faces a resident animal, it SHALL interact with that resident's spot.
3. Otherwise, if the player faces a plant spot, it SHALL interact with that spot.
4. Otherwise, if the player stands in a habitat zone, it SHALL start a search of that habitat at the player's tile.

If none applies, nothing SHALL happen and no request SHALL be sent. A spot whose species is an animal SHALL only be reachable through its resident, never as a fixed spot.

#### Scenario: Talking to Vera
- **WHEN** the player stands next to Vera, faces her and presses `Interact`
- **THEN** a conversation with NPC `vera` on map `dravsko_polje_meadow` is started

#### Scenario: Facing the meadow sage
- **WHEN** the player stands next to the meadow sage spot, faces it and presses `Interact`
- **THEN** an interaction with that spot's ID on map `dravsko_polje_meadow` is started

#### Scenario: Facing an animal
- **WHEN** the player faces the hare resident and presses `Interact`
- **THEN** an interaction with the hare's spot ID is started

#### Scenario: Standing in tall grass
- **WHEN** the player stands on a tile inside a `tall_grass` zone, faces no spot, animal or NPC and presses `Interact`
- **THEN** a search of that tile on map `dravsko_polje_meadow` is started

#### Scenario: A spot wins over the habitat
- **WHEN** the player stands in a habitat zone and faces a spot
- **THEN** the spot interaction is started, not a search

#### Scenario: Facing empty grass
- **WHEN** the player stands outside every habitat zone, faces a tile without a spot, animal or NPC and presses `Interact`
- **THEN** nothing happens

### Requirement: Draw order
Map layers SHALL be drawn in their authored order, with animated tiles showing their current frame. Above the ground layers SHALL be drawn, in order:
1. closed gates, NPCs and resident animals
2. the player
3. the player's lamp when the torch is on

#### Scenario: Player on grass
- **WHEN** the player stands on a grass tile
- **THEN** the player sprite is visible on top of the grass

#### Scenario: Vera on the meadow
- **WHEN** Vera's tile is on screen
- **THEN** her sprite is visible on top of the ground

## ADDED Requirements

### Requirement: Animated tiles
Tiles SHALL play the frame animations defined for them in the map's tileset (Tiled tile animations), using the game's clock. The meadow's trees and tall grass SHALL sway gently. Animation SHALL NOT affect collision, zones or interactions.

#### Scenario: Swaying trees
- **WHEN** a tree is on screen for a few seconds
- **THEN** it is drawn alternating between its animation frames

### Requirement: NPCs look around
An NPC SHALL be drawn from its 4-facing sprite sheet. While idle it SHALL face a new direction from time to time (down, left or right). When the player starts a conversation with it, it SHALL turn to face the player. Each NPC sprite SHALL be a 32×64 PNG in `content/npc-sprites/<npcId>.png` with the same layout as the player sprite: two frames per row, rows facing down, up, left and right.

#### Scenario: Vera turns to the player
- **WHEN** the player talks to Vera from her left side
- **THEN** Vera faces left, towards the player
