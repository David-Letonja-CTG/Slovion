## MODIFIED Requirements

### Requirement: Maps are content
Maps SHALL be loaded from content data (Tiled JSON). A map SHALL define:
- ground layers and a collision layer
- a spawn point
- interactive spots
- optional habitat zones (rectangles naming a habitat)

No map layout SHALL be hardcoded in game code.

#### Scenario: Entering the meadow
- **WHEN** a game starts or continues
- **THEN** the map `dravsko_polje_meadow` is shown with the player on its spawn tile, facing the spawn's direction

#### Scenario: Habitat zones
- **WHEN** the meadow is loaded
- **THEN** its tall-grass tiles belong to a zone of habitat `tall_grass` and the path does not
- **AND** the hedgerow strip south of the meadow belongs to a zone of habitat `hedgerow`

#### Scenario: The hedgerow is closed off
- **WHEN** the player walks along the southern hedge of the meadow
- **THEN** the hedgerow strip is visible beyond it, but no walkable tile connects the meadow to the strip
