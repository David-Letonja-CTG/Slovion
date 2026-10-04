# habitat-search Specification

## Purpose

Defines how players search habitats for species: habitat zones in maps, habitat content with fictional encounter values, and server-decided search outcomes that lead into the existing identification flow.

## Requirements

### Requirement: Habitat content
Each habitat SHALL be a content file. It SHALL contain:
- a stable ID
- a localized display name, with Slovenian (`sl`) required and other languages optional
- a positive integer order, which sorts habitats for display
- a search chance between 1 and 100 percent
- at least one species with a positive integer weight

The display name is a game label, not a biological fact. The chance and the weights are gameplay data and SHALL NOT be shown to players.

Content validation SHALL reject any habitat with:
- unknown species
- non-positive weights
- a chance outside 1–100
- a missing Slovenian name
- a missing or non-positive order
- a duplicate habitat ID

Content validation SHALL also reject map zones that name an unknown habitat.

#### Scenario: Valid repository habitats
- **WHEN** the API starts with the repository content
- **THEN** habitat `tall_grass` (*Visoka trava*, order 1) and habitat `hedgerow` (*Mejica*, order 2) are available with their weighted species

#### Scenario: Region habitats
- **WHEN** the API starts with the repository content
- **THEN** the region habitats list their animals and plants:

  | Habitat | Name | Order | Species |
  |---|---|---|---|
  | `fir_beech_forest` | *Jelovo-bukov gozd* | 3 | bear, red deer, wild garlic, sweet woodruff, silver fir, beech |
  | `mountain_forest` | *Gorski gozd* | 4 | wolf, red squirrel, round-leaved sundew, bilberry, Norway spruce |
  | `alpine_grassland` | *Visokogorje* | 5 | chamois, alpine marmot, edelweiss, *triglavska roža*, mountain pine (*rušje*) |
  | `wetland` | *Mokrišče* | 6 | grey heron, corncrake, tree frog, banded demoiselle, yellow iris, Siberian iris, white water lily |

#### Scenario: Unknown species in a habitat
- **WHEN** a habitat lists species `vulpes_vulpes`, which does not exist
- **THEN** content validation fails and names the habitat and the species

#### Scenario: Zone naming a missing habitat
- **WHEN** a map zone refers to habitat `swamp` and no such habitat exists
- **THEN** content validation fails and names the map and the habitat

#### Scenario: Habitat without a Slovenian name
- **WHEN** habitat `tall_grass` has no Slovenian name
- **THEN** content validation fails and names `tall_grass`

#### Scenario: Habitat without an order
- **WHEN** habitat `hedgerow` has no order
- **THEN** content validation fails and names `hedgerow`

### Requirement: Searching a habitat
`POST /api/save/searches` with a map and a tile SHALL search the habitat zone that contains the tile. The server SHALL then roll for a find using the habitat's search chance:
- **On a successful roll**, the server SHALL pick one species by weight among the habitat's **plants** that are available at the save's current in-game time, using its random source. Animals are found by meeting them (see `wildlife`).
- **When the roll fails, or when no plant of the habitat is available**, it SHALL respond `200` with `found: false` and record nothing.

#### Scenario: Nothing found
- **WHEN** a search in `tall_grass` rolls above the search chance
- **THEN** the response is `200` with `found: false` and the save's NatureDex is unchanged

#### Scenario: Deterministic with a fixed random source
- **WHEN** the same search is made twice at the same in-game time with identically seeded random sources
- **THEN** both searches have the same outcome and species

#### Scenario: Weights decide frequency
- **WHEN** many searches are rolled in a habitat whose plant weights are 3 for `taraxacum_officinale` and 1 for `salvia_pratensis`, and both are available
- **THEN** the dandelion is found about three times as often as the sage

#### Scenario: Only available species are found
- **WHEN** a search in `tall_grass` succeeds in summer
- **THEN** the species found is the sage, never the dandelion, which flowers in spring and autumn

#### Scenario: Only plants are found
- **WHEN** a search in `tall_grass` succeeds on a spring morning
- **THEN** the species found is the dandelion or the sage, never the hare, the skylark or the swallowtail

#### Scenario: Nothing available
- **WHEN** a habitat's plants are all unavailable at the save's current time and a search's roll succeeds
- **THEN** the response is `200` with `found: false` and nothing is recorded

### Requirement: Found species lead to identification
A species found by searching SHALL be handled like a spot interaction. If it is not yet identified, the server SHALL record the observation, open an encounter, and respond `201` with the same encounter content as a spot (group, clues, candidates, no answer). If it is already identified, the server SHALL respond `200` with `alreadyIdentified: true` and its NatureDex entry. The observation SHALL record the habitat where it happened.

#### Scenario: Finding an unidentified hare
- **WHEN** a search in `tall_grass` finds `lepus_europaeus` for a save that has not identified it
- **THEN** the response is `201` with an encounter of group `mammal`
- **AND** the save's NatureDex lists `lepus_europaeus` as observed

#### Scenario: Finding an identified species
- **WHEN** a search finds `salvia_pratensis` for a save that already identified it
- **THEN** the response is `200` with `alreadyIdentified: true`

### Requirement: Invalid searches
A search naming an unknown map, or a tile outside every habitat zone, SHALL respond `404` with code `unknown_habitat`. A search without a map or tile SHALL respond `400` with code `bad_request`. A search without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Searching on the path
- **WHEN** a save searches tile (10, 10) of the meadow, which lies in no habitat zone
- **THEN** the response is `404` with code `unknown_habitat`

### Requirement: Search feedback
The client SHALL block world input from the moment a search is sent. When nothing is found it SHALL show a gender-neutral Slovenian message that nothing is here, closable with `Confirm` or `Cancel`. A found species SHALL open the identification dialog, and an identified one the "already recorded" message.

#### Scenario: Empty search
- **WHEN** the server responds `found: false`
- **THEN** a Slovenian message says there is nothing here, and after closing it the player can move again

#### Scenario: Something in the grass
- **WHEN** the server responds `201` with an encounter
- **THEN** the identification dialog opens for that encounter
