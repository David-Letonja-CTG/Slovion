## ADDED Requirements

### Requirement: Area content
Each area SHALL be a content file with a stable lowercase snake_case ID and a localized name. Slovenian (`sl`) is required and other languages are optional. Area names are place labels for the game, not species facts. Area files SHALL be downloadable by clients under `/content/areas/`. Content validation SHALL reject:
- an invalid ID
- a duplicate ID
- a missing Slovenian name

#### Scenario: Repository areas
- **WHEN** the API starts with the repository content
- **THEN** area `meadow` is named *Travnik na Dravskem polju* and area `south_hedgerow` is named *Južna mejica*

#### Scenario: Area without a Slovenian name
- **WHEN** area `meadow` has no Slovenian name
- **THEN** content validation fails and names `meadow`

### Requirement: Area zones
Maps SHALL place areas with rectangles of class `area` that name an area ID. A tile belongs to a zone when its centre lies inside the rectangle, as for habitat zones. Content validation SHALL reject any of the following, naming the map and the zone:
- a zone naming an unknown area
- a zone covering no tiles
- a zone extending beyond the map
- a zone overlapping another area zone
- a walkable tile (one not blocked in the collision layer) that lies in no area

#### Scenario: Meadow and hedgerow
- **WHEN** the meadow map is loaded
- **THEN** the spawn and the gate tile lie in area `meadow`, and the hedgerow strip lies in area `south_hedgerow`

#### Scenario: A walkable tile without an area
- **WHEN** a map's walkable tile lies in no area zone
- **THEN** content validation fails and names the map and the tile

### Requirement: Current location
The game SHALL show the name of the area the player stands in, in Slovenian, below the season and time indicator. It SHALL update as soon as the player's tile lies in another area.

#### Scenario: Starting on the meadow
- **WHEN** a game starts
- **THEN** the location shows *Travnik na Dravskem polju*

#### Scenario: Through the gate
- **WHEN** the player walks from the gate tile onto the hedgerow strip
- **THEN** the location shows *Južna mejica*

### Requirement: Location banner
When a game starts, and whenever the player's tile enters a different area, a banner with the area's name SHALL slide in at the top centre of the game, stay about 2.5 seconds, and slide out. A new area change while a banner is shown SHALL replace it with the newer name. When the player prefers reduced motion, the banner SHALL appear and disappear without sliding. The banner SHALL be announced to screen readers, and it SHALL NOT take input or block movement.

#### Scenario: Entering the hedgerow
- **WHEN** the player steps from area `meadow` into area `south_hedgerow`
- **THEN** a banner shows *Južna mejica* and disappears after about 2.5 seconds while the player keeps walking

#### Scenario: Walking within an area
- **WHEN** the player walks from one meadow tile to another
- **THEN** no banner appears
