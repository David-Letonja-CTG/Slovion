## MODIFIED Requirements

### Requirement: Habitat content
Each habitat SHALL be a content file containing:
- a stable ID
- a localized display name, with Slovenian (`sl`) required and other languages optional
- a search chance between 1 and 100 percent
- at least one species with a positive integer weight

The display name is a game label, not a biological fact. The chance and the weights are gameplay data. Neither SHALL be shown to players as biological facts, and the chance and the weights SHALL NOT be shown to players at all.

Content validation SHALL reject any of the following:
- unknown species
- non-positive weights
- a chance outside 1–100
- a missing Slovenian name
- duplicate habitat IDs
- map zones that name an unknown habitat

#### Scenario: Valid repository habitats
- **WHEN** the API starts with the repository content
- **THEN** habitat `tall_grass` is available with its weighted species and the Slovenian name *Visoka trava*

#### Scenario: Unknown species in a habitat
- **WHEN** a habitat lists species `vulpes_vulpes`, which does not exist
- **THEN** content validation fails and names the habitat and the species

#### Scenario: Zone naming a missing habitat
- **WHEN** a map zone refers to habitat `swamp` and no such habitat exists
- **THEN** content validation fails and names the map and the habitat

#### Scenario: Habitat without a Slovenian name
- **WHEN** habitat `tall_grass` has no Slovenian name
- **THEN** content validation fails and names `tall_grass`
