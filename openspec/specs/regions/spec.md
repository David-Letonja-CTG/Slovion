# regions Specification

## Purpose

Defines the places the player can travel to: regions as content with their maps and unlock rules (fictional gameplay data), the save's current region kept by the server, the travel map opened at a signpost, and arriving in a region.

## Requirements

### Requirement: Region content
Each region SHALL be a content file with:
- a stable lowercase snake_case ID
- the ID of its map
- a localized name and a localized locked hint (Slovenian required)
- a position on the travel map, in percent of its width and height
- an order on the travel map's list
- an unlock rule: either none (always open), a progress flag, or a number of identified species

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
- **THEN** the current region is `dravsko_polje`, Dravsko polje is unlocked, and the other three are locked

#### Scenario: After Vera's quest
- **WHEN** a save that completed Vera's quest requests its regions
- **THEN** Kočevje is unlocked, and Pohorje is locked with the hint to help Jure in Kočevje

#### Scenario: After Jure's quest
- **WHEN** a save that completed Jure's quest requests its regions
- **THEN** Pohorje is unlocked, and Triglav is locked with the hint to help Maja on Pohorje

### Requirement: Travelling
`POST /api/save/travel` with a region ID SHALL make that region the save's current region when the region is unlocked for the save, and respond `200` with the region. A locked region SHALL respond `409` with code `region_locked`. An unknown region SHALL respond `404` with code `unknown_region`. A missing region SHALL respond `400` with code `bad_request`. In all error cases the current region SHALL stay unchanged.

#### Scenario: Travelling to Kočevje
- **WHEN** a save with flag `hedgerow_open` travels to `kocevje`
- **THEN** the response is `200` and the save's current region is `kocevje`, also after an API restart

#### Scenario: A locked region
- **WHEN** a new save travels to `triglav`
- **THEN** the response is `409` with code `region_locked` and the current region is still `dravsko_polje`

### Requirement: Travel map
Interacting with a signpost SHALL open the travel map, a dialog with:
- a schematic map of Slovenia showing every region at its position
- a list of the regions, each marked as current, open or locked; a locked region shows its hint, and for a species count rule the remaining number, e.g. *Prepoznaj še 2 vrsti*

`MoveUp` and `MoveDown` SHALL select a region in the list. `Confirm`, a click or a tap SHALL travel to the selected open region. `Cancel` SHALL close the dialog. Locked regions and the current region SHALL NOT be travelled to. World input SHALL be blocked while the dialog is open.

#### Scenario: Reading the travel map
- **WHEN** a player who finished Vera's quest opens the travel map at the meadow's signpost
- **THEN** Dravsko polje is marked current, Kočevje open, and Pohorje and Triglav locked with their hints

#### Scenario: Choosing a locked region
- **WHEN** the player selects a locked region and presses `Enter`
- **THEN** nothing is travelled to and the dialog stays open

### Requirement: Arriving in a region
After a successful travel, the game SHALL:
1. fade the screen out
2. load the region's map with the player on its spawn tile, together with its resident animals
3. fade back in
4. show the place banner for the area the player stands in

The fades SHALL be skipped for players who prefer reduced motion. If the map can't be loaded, the game SHALL show the existing Slovenian error.

#### Scenario: Arriving in Kočevje
- **WHEN** the player travels to Kočevje
- **THEN** the forest map is shown with the player on its spawn, and the banner shows *Kočevski gozd*
