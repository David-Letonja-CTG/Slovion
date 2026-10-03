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

#### Scenario: Region with an unknown flag
- **WHEN** a region requires flag `secret` and no quest rewards it
- **THEN** content validation fails and names the region
