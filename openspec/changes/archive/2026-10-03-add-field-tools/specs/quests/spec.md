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

#### Scenario: Goal habitat too small
- **WHEN** a quest asks for 4 species of a habitat that lists 3
- **THEN** content validation fails and names the quest

#### Scenario: Quest from an unknown NPC
- **WHEN** a quest names giver `mojca` and no such NPC exists
- **THEN** content validation fails and names the quest and the NPC

#### Scenario: Missing dialogue state
- **WHEN** quest `eye_for_nature` has no Slovenian `ready` dialogue
- **THEN** content validation fails and names the quest

### Requirement: Talking to an NPC
`POST /api/save/conversations` with a map ID and an NPC ID SHALL return:
- the NPC's localized name
- the dialogue lines for the save's state of that NPC's quest
- the quest's resulting state: ID, title, summary, status, progress and goal
- the save's flags after the conversation
- the save's tools after the conversation, each with its ID and localized name and description

The server SHALL decide the dialogue and every quest change (D3). Quest progress SHALL be the number of species the save has identified, counting only species of the goal's habitat when the goal names one, capped at the goal, whenever those species were identified. The conversation SHALL depend on the quest's state:

| Quest state | Effect | Dialogue |
|---|---|---|
| Not started, goal not yet met | The quest starts | `offer` |
| Not started, goal already met | The quest starts and completes | `offer`, then `ready` |
| Active, goal not met | No change | `active`, with progress and goal filled in |
| Active, goal met | The quest completes; its reward flag is set and its reward tools are given | `ready` |
| Completed | No change | `completed` |

A request without a valid save token SHALL respond `401` with code `invalid_save_token`. A request without a map or NPC SHALL respond `400` with code `bad_request`. An NPC that is not on that map SHALL respond `404` with code `unknown_npc` and change nothing.

#### Scenario: Meeting Vera
- **WHEN** a new save talks to `vera` on the meadow
- **THEN** the response contains Vera's `offer` lines and quest `eye_for_nature` with status `active`, progress 0 and goal 3

#### Scenario: Not done yet
- **WHEN** a save with an active quest and one identified species talks to `vera`
- **THEN** the response contains the `active` lines with progress 1 of 3, and the quest stays active

#### Scenario: Completing the quest
- **WHEN** a save with an active quest and three identified species talks to `vera`
- **THEN** the response contains the `ready` lines, the quest has status `completed`, and the flags contain `hedgerow_open`

#### Scenario: Goal met before the first talk
- **WHEN** a save that already identified three species talks to `vera` for the first time
- **THEN** the response contains the `offer` lines followed by the `ready` lines, and the quest is completed

#### Scenario: Only the region's species count
- **WHEN** a save that identified five meadow species and one Kočevje species talks to `jure`
- **THEN** quest `in_the_shade_of_firs` has progress 1 of 3

#### Scenario: Unknown NPC
- **WHEN** a save talks to NPC `mojca` on the meadow
- **THEN** the response is `404` with code `unknown_npc`
