## MODIFIED Requirements

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
