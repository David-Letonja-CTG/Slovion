## MODIFIED Requirements

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
  | `wetland` | *Mokrišče* | 6 | grey heron, corncrake, tree frog, banded demoiselle, yellow iris, Siberian iris, white water lily, snake's-head fritillary |
  | `karst` | *Kras* | 7 | olm, cave beetle (*drobnovratnik*), greater horseshoe bat, round-leaved saxifrage, alternate-leaved golden saxifrage |
  | `city` | *Mesto* | 8 | common swift, white-breasted hedgehog, kingfisher, black alder |

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
