## MODIFIED Requirements

### Requirement: Station content
Each research station SHALL be a content file with:
- a stable lowercase snake_case ID
- localized texts, with Slovenian required: a name and a theme
- a list of species IDs, without repeats
- a goal: how many of those species must be fully researched (research level 3), from 1 to the length of the list

The goal is fictional gameplay data (D6); the theme is a game label, not a biological fact. Every station SHALL be placed on exactly one map. Content validation SHALL reject any of the following, naming the file:
- an unknown or repeated species
- a goal outside 1 to the number of species
- a missing Slovenian name or theme
- a station placed on no map or on more than one
- a duplicate ID

#### Scenario: Repository stations
- **WHEN** the API starts with the repository content
- **THEN** the stations are available:

  | Station | Map | Theme | Species | Goal |
  |---|---|---|---|---|
  | `meadow_station` | `dravsko_polje_meadow` | *Travniki in mejice* | `salvia_pratensis`, `taraxacum_officinale`, `crataegus_monogyna`, `iris_sibirica` | 3 |
  | `forest_station` | `kocevje_forest` | *Gozdna drevesa* | `abies_alba`, `fagus_sylvatica`, `picea_abies` | 3 |
  | `mammal_station` | `pohorje_forest` | *Sesalci* | `lepus_europaeus`, `ursus_arctos`, `cervus_elaphus`, `canis_lupus`, `sciurus_vulgaris`, `rupicapra_rupicapra`, `marmota_marmota` | 4 |
  | `mountain_station` | `triglav_alps` | *Gorski svet* | `leontopodium_nivale`, `potentilla_nitida`, `pinus_mugo`, `salamandra_atra` | 3 |
  | `bird_station` | `cerknica_lake` | *Ptice* | `alauda_arvensis`, `lanius_collurio`, `ardea_cinerea`, `crex_crex` | 3 |
  | `cave_station` | `rakov_skocjan_karst` | *Podzemlje* | `proteus_anguinus`, `leptodirus_hochenwartii`, `rhinolophus_ferrumequinum` | 2 |
  | `city_station` | `ljubljana_park` | *Mestna narava* | `apus_apus`, `erinaceus_roumanicus`, `alcedo_atthis`, `alnus_glutinosa` | 3 |
  | `farmland_station` | `murska_sobota_village` | *Kulturna krajina* | `ciconia_ciconia`, `upupa_epops`, `lutra_lutra`, `viola_arvensis`, `salix_purpurea` | 3 |

#### Scenario: A goal larger than the list
- **WHEN** a station lists 3 species with goal 4
- **THEN** content validation fails and names the station

#### Scenario: A station on no map
- **WHEN** a station file exists but no map places it
- **THEN** content validation fails and names the station
