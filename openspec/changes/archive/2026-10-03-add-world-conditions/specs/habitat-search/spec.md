## MODIFIED Requirements

### Requirement: Searching a habitat
`POST /api/save/searches` with a map and a tile SHALL search the habitat zone that contains the tile. The server SHALL then roll for a find using the habitat's search chance:
- **On a successful roll**, the server SHALL pick one species by weight among the habitat's species that are available at the save's current in-game time, using its random source.
- **When the roll fails, or when no species of the habitat is available**, it SHALL respond `200` with `found: false` and record nothing.

#### Scenario: Nothing found
- **WHEN** a search in `tall_grass` rolls above the search chance
- **THEN** the response is `200` with `found: false` and the save's NatureDex is unchanged

#### Scenario: Deterministic with a fixed random source
- **WHEN** the same search is made twice at the same in-game time with identically seeded random sources
- **THEN** both searches have the same outcome and species

#### Scenario: Weights decide frequency
- **WHEN** many searches are rolled in a habitat whose weights are 3 for `lepus_europaeus` and 1 for `alauda_arvensis`, and both are available
- **THEN** the hare is found about three times as often as the skylark

#### Scenario: Only available species are found
- **WHEN** a search in `tall_grass` succeeds at night in winter
- **THEN** the species found is the hare or the skylark, never the swallowtail, the dandelion or the sage

#### Scenario: Nothing available
- **WHEN** a habitat's species are all unavailable at the save's current time and a search's roll succeeds
- **THEN** the response is `200` with `found: false` and nothing is recorded
