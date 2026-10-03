## MODIFIED Requirements

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
