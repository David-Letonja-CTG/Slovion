# wildlife Specification

## Purpose

Defines the animals living in the world: resident animals on their home spots, which of them are present at the save's in-game time, how they wander, how the player meets them, and how they react to the torch (fictional gameplay data).

## Requirements

### Requirement: Resident animals
Every map spot whose species is not a plant SHALL be a **resident** animal. The client SHALL draw it as an animated sprite instead of a static tile. A resident SHALL be present only while its species is available at the save's in-game time (D8).

`GET /api/save/wildlife?mapId=` SHALL return, for every resident of that map:
- its spot ID
- its species ID, which selects the sprite
- its torch reaction
- whether it is present now

The client SHALL draw only present residents. It SHALL never treat an absent resident's spot as a fixed spot.

An unknown map SHALL respond `404` with code `unknown_map`. A missing map ID SHALL respond `400` with code `bad_request`. Requests without a valid save token SHALL respond `401` with code `invalid_save_token`. The client SHALL load the list with the world and reload it whenever the time of day changes or the page becomes visible again.

#### Scenario: Meadow residents on a spring morning
- **WHEN** a new save requests the wildlife of `dravsko_polje_meadow`
- **THEN** the response lists the hare, skylark and swallowtail spots of the meadow and the shrike spot of the hedgerow, all present, and no plant spots

#### Scenario: Out of season
- **WHEN** a save in winter requests the wildlife of the meadow
- **THEN** the swallowtail and the shrike are listed as not present, and the hare and the skylark as present

### Requirement: Wandering
A present resident SHALL wander: from time to time it takes one step to a free neighbouring tile within 3 tiles of its home spot. A free tile is one that is:
- walkable and inside the map
- not taken by the player, an NPC, a closed gate or another resident

Each resident SHALL use its own seeded random sequence, so its movement is deterministic in tests. Residents SHALL move with a two-frame walk animation, facing their direction of travel. A resident next to the player SHALL stop wandering while the player stays next to it, so the player can talk to it.

#### Scenario: Staying near home
- **WHEN** a resident wanders for a long time without a torch nearby
- **THEN** it is never more than 3 tiles from its home spot

#### Scenario: Waiting for the player
- **WHEN** the player stands next to a resident
- **THEN** the resident stays on its tile

### Requirement: Meeting an animal
Residents SHALL block movement like NPCs. When the player faces a resident and presses `Interact`, the game SHALL start the encounter of the resident's spot through the existing spot encounter (D3), wherever the resident currently stands. All outcomes and messages are the same as for spots: an encounter, *already recorded*, or *not now*.

#### Scenario: Meeting the hare
- **WHEN** the player faces the hare resident and presses `Interact`
- **THEN** an interaction with the hare's spot ID on map `dravsko_polje_meadow` is started

#### Scenario: Walking into an animal
- **WHEN** the player walks towards a resident's tile
- **THEN** the player turns to face it and stays on the same tile

### Requirement: Torch reactions
While the torch is lit in the evening or at night, residents within 4 tiles of the player SHALL react according to their species' torch reaction, which is fictional gameplay data (D6):
- `curious` residents SHALL step towards the player until they are next to them
- `shy` residents SHALL step away from the player, even beyond their usual 3 tiles
- `calm` residents SHALL keep wandering as usual

When the torch is off, the time is morning or day, or the player is farther than 4 tiles away, residents SHALL return towards home and wander again. Torch reactions SHALL NOT change encounters.

#### Scenario: A curious hare
- **WHEN** it is night, the torch is lit and the player stands 3 tiles from the hare
- **THEN** the hare steps towards the player until it is next to them

#### Scenario: A shy shrike
- **WHEN** it is evening, the torch is lit and the player comes within 4 tiles of the shrike
- **THEN** the shrike steps away from the player

#### Scenario: No reaction by day
- **WHEN** the torch is lit by day near the hare
- **THEN** the hare keeps wandering around its home
