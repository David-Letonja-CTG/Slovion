## MODIFIED Requirements

### Requirement: Species group
Each species SHALL declare one group: `plant`, `mammal`, `bird`, `insect`, `amphibian`, `fish` or `mollusc`. Any other value SHALL fail content validation.

#### Scenario: Unknown group
- **WHEN** a species declares group `fungus`
- **THEN** content validation fails and names the species and the group

#### Scenario: Sea life groups
- **WHEN** species declare groups `fish` and `mollusc`
- **THEN** they load, and the client shows them as *riba* and *mehkužec* (*Opaziš ribo*, *Opaziš mehkužca* when identifying)

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

#### Scenario: Prekmurje species
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `ciconia_ciconia` | `bird` | *bela štorklja* | Murska Sobota |
  | `upupa_epops` | `bird` | *smrdokavra* | Murska Sobota |
  | `lutra_lutra` | `mammal` | *vidra* | Murska Sobota |
  | `viola_arvensis` | `plant` | *njivska vijolica* | Murska Sobota |
  | `salix_purpurea` | `plant` | *rdeča vrba* | Murska Sobota |
- **AND** `ciconia_ciconia` is perched and `lutra_lutra` is aquatic

#### Scenario: Coast species
- **WHEN** the API starts with the repository's content
- **THEN** the following are available, each with sourced Slovenian facts, three clues and a picture, and the animals also with a walk sprite and wildlife traits:

  | Species | Group | Slovenian name | Region |
  |---|---|---|---|
  | `himantopus_himantopus` | `bird` | *polojnik* | Portorož |
  | `egretta_garzetta` | `bird` | *mala bela čaplja* | Portorož |
  | `salicornia_europaea` | `plant` | *navadni osočnik* | Portorož |
  | `aphanius_fasciatus` | `fish` | *solinarka* | Portorož |
  | `sarpa_salpa` | `fish` | *salpa* | Portorož |
  | `pinna_nobilis` | `mollusc` | *veliki leščur* | Portorož |
- **AND** `aphanius_fasciatus` and `sarpa_salpa` are aquatic, and `pinna_nobilis` is perched
