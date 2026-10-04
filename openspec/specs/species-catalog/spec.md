# species-catalog Specification

## Purpose

Defines the real-world species content the game teaches from: stable language-independent identities, localized descriptions, and a source reference for every fact, validated so incorrect or unsourced content never reaches players.

## Requirements

### Requirement: Stable species identity
Each species SHALL have an ID of the form `genus_species` in lowercase ASCII (e.g. `salvia_pratensis`). IDs SHALL be unique and SHALL never change; the scientific name is a separate attribute that may be revised without changing the ID.

#### Scenario: Invalid ID
- **WHEN** content contains a species with ID `Salvia-Pratensis`
- **THEN** content validation fails and names the invalid ID

#### Scenario: Duplicate ID
- **WHEN** two species files declare the ID `salvia_pratensis`
- **THEN** content validation fails and names the duplicate

### Requirement: Every fact has a source
Every real-world fact of a species — common name, scientific name, family, habitat, distribution, flowering or activity period, and each identifying characteristic — SHALL reference at least one source. Each source SHALL record its title, publisher, URL, access date and licence or usage note.

#### Scenario: Unsourced characteristic
- **WHEN** a characteristic has no source reference
- **THEN** content validation fails and names the species and the fact

#### Scenario: Reference to an unknown source
- **WHEN** a fact references a source ID that the species does not define
- **THEN** content validation fails

### Requirement: Slovenian text is required
Every species SHALL have Slovenian (`sl`) text for all of its localized facts. Other languages are optional.

#### Scenario: Missing Slovenian habitat
- **WHEN** a species has no Slovenian habitat text
- **THEN** content validation fails

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

#### Scenario: Wetland species
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `ardea_cinerea` | `bird` | *siva čaplja* | Cerkniško jezero |
  | `crex_crex` | `bird` | *kosec* | Cerkniško jezero |
  | `hyla_arborea` | `amphibian` | *zelena rega* | Cerkniško jezero |
  | `calopteryx_splendens` | `insect` | *pasasti bleščavec* | Cerkniško jezero |
  | `iris_pseudacorus` | `plant` | *vodna perunika* | Cerkniško jezero |
  | `iris_sibirica` | `plant` | *sibirska perunika* | Cerkniško jezero |
  | `nymphaea_alba` | `plant` | *beli lokvanj* | Cerkniško jezero |

#### Scenario: Karst species
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `proteus_anguinus` | `amphibian` | *človeška ribica* | Rakov Škocjan |
  | `leptodirus_hochenwartii` | `insect` | *drobnovratnik* | Rakov Škocjan |
  | `rhinolophus_ferrumequinum` | `mammal` | *veliki podkovnjak* | Rakov Škocjan |
  | `saxifraga_rotundifolia` | `plant` | *okroglolistni kamnokreč* | Rakov Škocjan |
  | `chrysosplenium_alternifolium` | `plant` | *premenjalnolistni vraničnik* | Rakov Škocjan |
- **AND** `proteus_anguinus` is aquatic

#### Scenario: City species
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `apus_apus` | `bird` | *hudournik* | Ljubljana |
  | `erinaceus_roumanicus` | `mammal` | *beloprsi jež* | Ljubljana |
  | `alcedo_atthis` | `bird` | *vodomec* | Ljubljana |
  | `fritillaria_meleagris` | `plant` | *močvirska logarica* | Ljubljana |
  | `alnus_glutinosa` | `plant` | *črna jelša* | Ljubljana |

### Requirement: Spots reference existing species
Every interactive spot in a map that names a species SHALL reference an existing species ID.

#### Scenario: Spot with unknown species
- **WHEN** a map spot references `vulpes_vulpes` but no such species exists
- **THEN** content validation fails and names the map and spot

### Requirement: Species group
Each species SHALL declare one group: `plant`, `mammal`, `bird`, `insect` or `amphibian`. Any other value SHALL fail content validation.

#### Scenario: Unknown group
- **WHEN** a species declares group `fungus`
- **THEN** content validation fails and names the species and the group

### Requirement: Identification clues
Each species SHALL declare exactly three identification clues, each referring to a different one of its identifying characteristics. Clue choice and order are gameplay data; the clue text is the sourced characteristic itself.

#### Scenario: Clue pointing nowhere
- **WHEN** a species declares a clue for its fifth characteristic but has only four
- **THEN** content validation fails and names the species

#### Scenario: Too few clues
- **WHEN** a species declares two clues
- **THEN** content validation fails and names the species

### Requirement: Species picture
Each species SHALL have a picture at `content/species-pictures/<speciesId>.png`: a 32×32 pixel PNG. Pictures SHALL be original illustrations (D10). They are not facts and SHALL NOT be presented as such. Pictures SHALL be downloadable by clients under `/content/species-pictures/`. A missing picture, a file that is not a PNG, or a PNG of a different size SHALL fail content validation. The failure SHALL name the species.

#### Scenario: Missing picture
- **WHEN** content contains species `salvia_pratensis` but no file `content/species-pictures/salvia_pratensis.png`
- **THEN** content validation fails and names `salvia_pratensis`

#### Scenario: Wrong size
- **WHEN** the picture of `salvia_pratensis` is 64×64 pixels
- **THEN** content validation fails and names `salvia_pratensis`

#### Scenario: Picture download
- **WHEN** a client requests `/content/species-pictures/lepus_europaeus.png`
- **THEN** the response is `200` with a PNG image

### Requirement: Every species belongs to a habitat
Every species SHALL be listed in at least one habitat, so that it has a place in *Terenski dnevnik*. A species that is in no habitat SHALL fail content validation, and the failure SHALL name the species.

#### Scenario: Species without a habitat
- **WHEN** content contains species `vulpes_vulpes` that no habitat lists
- **THEN** content validation fails and names `vulpes_vulpes`

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

### Requirement: Wildlife traits and sprites
Every species that is not a plant SHALL declare:
- wildlife traits: a torch reaction of `curious`, `shy` or `calm`, and optionally `aquatic` (the animal lives in water; see `wildlife`)
- a walk sprite at `content/wildlife-sprites/<speciesId>.png`: a PNG of 32×16 pixels holding two 16×16 frames of the animal facing right, which is mirrored when it faces left

Wildlife traits are fictional gameplay data and SHALL NOT be presented as biological facts (D6). Sprites are original illustrations (D10) and SHALL be downloadable under `/content/wildlife-sprites/`. Plants SHALL NOT declare wildlife traits. Content validation SHALL reject the following, naming the species:
- missing or unknown traits on an animal
- traits on a plant
- a missing or wrongly sized sprite

#### Scenario: The hare is curious
- **WHEN** the API starts with the repository content
- **THEN** `lepus_europaeus` has torch reaction `curious` and a 32×16 walk sprite

#### Scenario: Animal without traits
- **WHEN** an animal species declares no wildlife traits
- **THEN** content validation fails and names the species

#### Scenario: Plant with traits
- **WHEN** `salvia_pratensis` declares wildlife traits
- **THEN** content validation fails and names the species

#### Scenario: An aquatic animal
- **WHEN** a species declares `"aquatic": true` in its wildlife traits
- **THEN** it is loaded as aquatic; species without the property are not aquatic

#### Scenario: A non-boolean aquatic trait
- **WHEN** a species declares `"aquatic": "yes"`
- **THEN** content validation fails and names the species
