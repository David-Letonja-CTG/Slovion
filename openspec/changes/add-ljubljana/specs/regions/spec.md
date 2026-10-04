## MODIFIED Requirements

### Requirement: Region content
Each region SHALL be a content file with:
- a stable lowercase snake_case ID
- the ID of its map
- a localized name and a localized locked hint (Slovenian required)
- a position on the travel map, in percent of its width and height
- an order on the travel map's list
- an unlock rule: either none (always open), a progress flag, or a number of identified species
- weather weights per season (see `weather`)

Unlock rules are fictional gameplay data (D6). Content validation SHALL reject any of the following, naming the file:
- an unknown map
- a map that belongs to no region or to more than one
- a flag no quest rewards
- a non-positive species count
- a missing Slovenian text
- a position outside 0–100
- a duplicate ID

#### Scenario: Repository regions
- **WHEN** the API starts with the repository content
- **THEN** the regions form a journey, each opened by the quest of the region before:

  | Region | Map | Unlocked by |
  |---|---|---|
  | `dravsko_polje` | `dravsko_polje_meadow` | always open |
  | `kocevje` | `kocevje_forest` | flag `hedgerow_open` (Vera) |
  | `pohorje` | `pohorje_forest` | flag `pohorje_open` (Jure) |
  | `triglav` | `triglav_alps` | flag `triglav_open` (Maja) |
  | `cerknica` | `cerknica_lake` | flag `alps_explored` (Luka) |
  | `rakov_skocjan` | `rakov_skocjan_karst` | flag `lake_explored` (Neža) |
  | `ljubljana` | `ljubljana_park` | flag `caves_explored` (Tilen) |

#### Scenario: Region with an unknown flag
- **WHEN** a region requires flag `secret` and no quest rewards it
- **THEN** content validation fails and names the region

### Requirement: Current region
Every save SHALL have a current region, stored on the server, which is `dravsko_polje` for a new save. `GET /api/save/regions` SHALL return the current region and every region, each with:
- its ID, localized name and map ID
- its travel map position
- whether it is unlocked for the save
- for a species count rule: the save's identified count and the required count
- for a locked region: its localized locked hint

Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: A new save
- **WHEN** a new save requests its regions
- **THEN** the current region is `dravsko_polje`, Dravsko polje is unlocked, and the other six are locked

#### Scenario: After Vera's quest
- **WHEN** a save that completed Vera's quest requests its regions
- **THEN** Kočevje is unlocked, and Pohorje is locked with the hint to help Jure in Kočevje

#### Scenario: After Jure's quest
- **WHEN** a save that completed Jure's quest requests its regions
- **THEN** Pohorje is unlocked, and Triglav is locked with the hint to help Maja on Pohorje

#### Scenario: After Luka's quest
- **WHEN** a save that completed Luka's quest requests its regions
- **THEN** Cerkniško jezero is unlocked

#### Scenario: Before Luka's quest
- **WHEN** a save that completed Maja's quest but not Luka's requests its regions
- **THEN** Cerkniško jezero is locked with the hint to help Luka on Triglav

#### Scenario: After Neža's quest
- **WHEN** a save that completed Neža's quest requests its regions
- **THEN** Rakov Škocjan is unlocked

#### Scenario: After Tilen's quest
- **WHEN** a save that completed Tilen's quest requests its regions
- **THEN** Ljubljana is unlocked
