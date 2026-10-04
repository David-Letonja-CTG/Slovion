## MODIFIED Requirements

### Requirement: NPC and quest content
Each NPC SHALL be a content file with a stable ID and a localized name, with Slovenian required.

Each quest SHALL be a content file with:
- a stable ID
- the ID of the NPC who gives it
- a goal: the number of species the save must have identified, a positive integer, and optionally a habitat whose species alone count
- a reward flag ID in lowercase snake_case, and optionally tools the reward gives (see `inventory`)
- localized texts, with Slovenian required:
  - a title
  - a summary for the tracker
  - a hint for returning to the giver
  - non-empty dialogue for each quest state: `offer`, `active`, `ready` and `completed`

In the current scope every NPC SHALL give exactly one quest. Content validation SHALL reject any of the following, naming the file:
- an unknown giver
- an NPC without a quest, or with more than one
- a missing Slovenian text or an empty dialogue state
- a non-positive goal
- a reward tool that does not exist
- a goal habitat that does not exist, or that lists fewer species than the goal
- duplicate IDs

Quest texts are game dialogue, not species facts. They SHALL NOT state biological facts about a species unless the same fact is sourced in that species' content.

#### Scenario: Valid repository quests
- **WHEN** the API starts with the repository content
- **THEN** NPC `vera` and quest `eye_for_nature` are available, with goal 3 and reward flag `hedgerow_open`

#### Scenario: Region quests
- **WHEN** the API starts with the repository content
- **THEN** the region quests are available:

  | NPC | Quest | Goal | Reward flag |
  |---|---|---|---|
  | `jure` | `in_the_shade_of_firs` | 3 species of `fir_beech_forest` | `pohorje_open` |
  | `maja` | `secrets_of_the_bog` | 3 species of `mountain_forest` | `triglav_open` |
  | `luka` | `below_the_peaks` | 3 species of `alpine_grassland` | `alps_explored` |
  | `neza` | `vanishing_lake` | 3 species of `wetland` | `lake_explored` |
  | `tilen` | `into_the_dark` | 3 species of `karst` | `caves_explored` |
  | `ana` | `city_nature` | 3 species of `city` | `city_explored` |
  | `stefan` | `under_the_storks_nest` | 3 species of `farmland` | `farmland_explored` |

#### Scenario: Goal habitat too small
- **WHEN** a quest asks for 4 species of a habitat that lists 3
- **THEN** content validation fails and names the quest

#### Scenario: Quest from an unknown NPC
- **WHEN** a quest names giver `mojca` and no such NPC exists
- **THEN** content validation fails and names the quest and the NPC

#### Scenario: Missing dialogue state
- **WHEN** quest `eye_for_nature` has no Slovenian `ready` dialogue
- **THEN** content validation fails and names the quest
