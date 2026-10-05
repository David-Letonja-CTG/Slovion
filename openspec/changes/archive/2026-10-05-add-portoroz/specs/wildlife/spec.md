## MODIFIED Requirements

### Requirement: Wandering
A present resident SHALL wander, unless it is **perched**: from time to time it takes one step to a free neighbouring tile within 3 tiles of its home spot. A free tile is one that is:
- walkable and inside the map; for an **aquatic** resident instead a water tile (a `wadeable` or `swimmable` tile) inside the map
- not taken by the player, an NPC, a closed gate or another resident

A perched resident SHALL stay on its home spot's tile and never step. Its home MAY be a blocked tile (e.g. a nest on a roof); it still occupies that tile, and the player meets it by facing it, as any resident.

Each resident SHALL use its own seeded random sequence, so its movement is deterministic in tests. Residents SHALL move with a two-frame walk animation, facing their direction of travel. A resident next to the player SHALL stop wandering while the player stays next to it, so the player can talk to it.

#### Scenario: Staying near home
- **WHEN** a resident wanders for a long time without a torch nearby
- **THEN** it is never more than 3 tiles from its home spot

#### Scenario: Waiting for the player
- **WHEN** the player stands next to a resident
- **THEN** the resident stays on its tile

#### Scenario: The olm stays in its pool
- **WHEN** the olm wanders for a long time
- **THEN** it is only ever on water tiles of its pool, and it never leaves the water

#### Scenario: The stork stays on its nest
- **WHEN** the stork is present for a long time
- **THEN** it never leaves the nest's tile, although that tile is blocked

#### Scenario: Meeting the stork
- **WHEN** the player faces the stork's nest from a neighbouring walkable tile and presses `Interact`
- **THEN** an interaction with the stork's spot ID is started, not a search of the roof

#### Scenario: The salema stays in the sea
- **WHEN** the salema wanders for a long time
- **THEN** it is only ever on swimmable tiles of the shallows
