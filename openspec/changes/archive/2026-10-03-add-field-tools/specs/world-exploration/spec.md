## MODIFIED Requirements

### Requirement: Collision
The player SHALL NOT enter any of these tiles:
- a tile marked as blocked in the collision layer
- a tile outside the map
- a tile with an NPC
- a tile with a resident animal
- a tile with a gate whose flag the save does not have

A blocked tile whose tileset tile is marked `wadeable` SHALL be enterable by a player with the boots (see `inventory`); resident animals SHALL never enter it.

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

### Requirement: Interacting with the faced tile
When the player is not mid-step and `Interact` is pressed, the game SHALL act on the first of these that applies:
1. If the player faces an NPC, it SHALL start a conversation with that NPC.
2. Otherwise, if the player faces the signpost, it SHALL open the travel map.
3. Otherwise, if the player faces a resident animal, it SHALL interact with that resident's spot.
4. Otherwise, if the player faces a plant spot, it SHALL interact with that spot.
5. Otherwise, if the player has the binoculars and a resident animal stands 2 or 3 tiles straight ahead with no blocking tile in between, it SHALL interact with the nearest such resident's spot.
6. Otherwise, if the player faces a blocked tile (a tree, shrub, rock or similar) inside a habitat zone, it SHALL start a search of that habitat at the faced tile.
7. Otherwise, if the player stands in a habitat zone, it SHALL start a search of that habitat at the player's tile.

If none applies, nothing SHALL happen and no request SHALL be sent. A spot whose species is an animal SHALL only be reachable through its resident, never as a fixed spot. Signposts SHALL block movement.

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
