## MODIFIED Requirements

### Requirement: Species group
Each species SHALL declare one group: `plant`, `mammal`, `bird`, `insect` or `amphibian`. Any other value SHALL fail content validation.

#### Scenario: Unknown group
- **WHEN** a species declares group `fungus`
- **THEN** content validation fails and names the species and the group

### Requirement: Species availability content
Each species SHALL declare its availability:
- the seasons in which it can be found: a non-empty subset of `spring`, `summer`, `autumn` and `winter`
- optionally, the times of day in which it can be found: a non-empty subset of `morning`, `day`, `evening` and `night`
- optionally, weathers in which it is also found at any time of day (`alsoInWeather`): a non-empty subset of `clear`, `cloudy`, `rain`, `fog` and `snow`
- the sources the availability is based on, which SHALL be sources the species defines

Seasons are derived from sourced months, where spring is March–May, summer June–August, autumn September–November and winter December–February. A season is included when a sourced active, flowering or presence period covers at least one of its months. Times of day are restricted, and weathers named, only where a source states it.

Content validation SHALL reject any of the following, naming the species:
- missing availability
- empty or unknown seasons, times of day or weathers
- availability without sources, or with unknown sources

#### Scenario: Availability of the repository species
- **WHEN** the API starts with the repository content
- **THEN** the skylark and the hare are available in every season, and the dandelion is available in spring and autumn

#### Scenario: Unknown season
- **WHEN** a species declares the season `monsoon`
- **THEN** content validation fails and names the species and the season

#### Scenario: Unsourced availability
- **WHEN** a species declares availability without sources
- **THEN** content validation fails and names the species

#### Scenario: Unknown weather
- **WHEN** a species declares `alsoInWeather` with `hail`
- **THEN** content validation fails and names the species and the weather

### Requirement: Invalid content blocks startup and CI
The API SHALL refuse to start when content is invalid, reporting every problem found. The automated test suite SHALL validate the repository's content, so invalid content fails CI.

#### Scenario: Broken content in a pull request
- **WHEN** a change adds a species file without sources
- **THEN** CI fails with the validation errors

#### Scenario: Valid repository content
- **WHEN** the API starts with the repository's content
- **THEN** startup succeeds and `salvia_pratensis` is available

#### Scenario: Hedgerow species
- **WHEN** the API starts with the repository's content
- **THEN** `crataegus_monogyna` (group `plant`, *enovrati glog*) and `lanius_collurio` (group `bird`, *rjavi srakoper*) are available, each with sourced Slovenian facts, three clues and a picture

#### Scenario: Signature species of the regions
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues, a picture, a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `ursus_arctos` | `mammal` | *rjavi medved* | Kočevje |
  | `canis_lupus` | `mammal` | *volk* | Pohorje |
  | `rupicapra_rupicapra` | `mammal` | *gams* | Triglav |

#### Scenario: More species of the regions
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `cervus_elaphus` | `mammal` | *navadni jelen* | Kočevje |
  | `allium_ursinum` | `plant` | *čemaž* | Kočevje |
  | `galium_odoratum` | `plant` | *dišeča lakota* | Kočevje |
  | `sciurus_vulgaris` | `mammal` | *navadna veverica* | Pohorje |
  | `drosera_rotundifolia` | `plant` | *okroglolistna rosika* | Pohorje |
  | `vaccinium_myrtillus` | `plant` | *navadna borovnica* | Pohorje |
  | `marmota_marmota` | `mammal` | *alpski svizec* | Triglav |
  | `leontopodium_nivale` | `plant` | *planika* | Triglav |
  | `potentilla_nitida` | `plant` | *triglavska roža* | Triglav |
  | `abies_alba` | `plant` | *navadna jelka* | Kočevje |
  | `fagus_sylvatica` | `plant` | *navadna bukev* | Kočevje |
  | `picea_abies` | `plant` | *navadna smreka* | Pohorje |
  | `pinus_mugo` | `plant` | *rušje* | Triglav |

#### Scenario: Salamanders
- **WHEN** the API starts with the repository's content
- **THEN** `salamandra_salamandra` (group `amphibian`, *navadni močerad*, Kočevje) and `salamandra_atra` (group `amphibian`, *planinski močerad*, Triglav) are available, each with sourced Slovenian facts, three clues, a picture, a walk sprite, wildlife traits and sourced "also in weather" availability
