# research-stations Specification

## Purpose
Research stations: one per region, each a themed list of species with a goal of how many to fully research (research level 3). Progress is derived from research levels; meeting a goal earns a certificate shown on the *Potrdila* page of *Terenski dnevnik*. Original milestones, not gym copies (no leaders, battles or badges).

## Requirements

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

### Requirement: Station progress
`GET /api/save/stations` SHALL return every station in region order, each with:
- its ID, localized name and theme, and the ID of its map
- its goal and how many of its species the save has at research level 3
- whether the goal is met
- each species with its ID, research level (0 when not identified) and, once identified, its localized name

Progress SHALL be derived from the save's research levels (see `species-research`); nothing else is stored. Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: A new save
- **WHEN** a new save requests its stations
- **THEN** every station has 0 researched species and its goal is not met, and no species has a name

#### Scenario: Partly researched
- **WHEN** a save has the silver fir at level 3, the beech at level 2 and has not identified the spruce
- **THEN** the forest station reports 1 of 3, the beech with level 2 and its name, and the spruce with level 0 and no name

#### Scenario: Goal met
- **WHEN** a save has the silver fir, the beech and the spruce at level 3
- **THEN** the forest station's goal is met

### Requirement: Station dialog
Interacting with a station SHALL open a dialog with:
- the station's name and theme
- its species as pictures with research stars, with unidentified species as silhouettes labelled *Neznana vrsta*
- the progress, e.g. *Popolnoma raziskane vrste: 1 od 3*
- once the goal is met, *Potrdilo je v terenskem dnevniku.*

`Cancel` or `Confirm` SHALL close it, and world input SHALL be blocked while it is open.

#### Scenario: Reading the forest station
- **WHEN** a player with the fir at level 3 faces the Kočevje station and presses `Interact`
- **THEN** the dialog shows *Gozdna drevesa*, the fir with ★★★, and *Popolnoma raziskane vrste: 1 od 3*

#### Scenario: A finished station
- **WHEN** the player opens a station whose goal is met
- **THEN** the dialog says *Potrdilo je v terenskem dnevniku.*

### Requirement: Certificates in the journal
*Terenski dnevnik* SHALL have a *Potrdila* page listing each station whose goal is met, with its name, its theme and the names of its species at research level 3. Without any, the page SHALL say that certificates are earned at research stations.

#### Scenario: One certificate
- **WHEN** a save that met the forest station's goal opens *Potrdila*
- **THEN** the page shows the forest station with *Gozdna drevesa* and the fir, the beech and the spruce

#### Scenario: No certificates
- **WHEN** a new save opens *Potrdila*
- **THEN** the page explains that certificates come from research stations

### Requirement: New certificate notice
When a sighting raises a species' research level and a station's goal becomes met because of it, the game SHALL show the notice *Novo potrdilo: {station name}* after the research message.

#### Scenario: Finishing the forest station
- **WHEN** a save with the fir and the beech at level 3 raises the spruce to level 3
- **THEN** the notice *Novo potrdilo:* followed by the forest station's name appears
