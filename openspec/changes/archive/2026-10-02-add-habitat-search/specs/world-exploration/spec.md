# Spec Delta

## MODIFIED Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON) that defines ground layers, a collision layer, a spawn point, interactive spots and optional habitat zones (rectangles naming a habitat). No map layout SHALL be hardcoded in game code.

#### Scenario: Entering the meadow
- **WHEN** a game starts or continues
- **THEN** the map `dravsko_polje_meadow` is shown with the player on its spawn tile, facing the spawn's direction

#### Scenario: Habitat zones
- **WHEN** the meadow is loaded
- **THEN** its tall-grass tiles belong to a zone of habitat `tall_grass` and the path does not

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
