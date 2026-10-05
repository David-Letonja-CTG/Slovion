## ADDED Requirements

### Requirement: Snorkel
Tiles whose tileset tile is marked `swimmable` (shallow sea) SHALL block movement, except for a player with the snorkel. The snorkel SHALL NOT let the player enter `wadeable` tiles, and the boots SHALL NOT let the player enter `swimmable` tiles. Deep sea is neither and SHALL stay closed. Portorož's shallow sea is swimmable, and the salema and the noble pen shell live there.

#### Scenario: Swimming in the shallows
- **WHEN** a player with the snorkel walks from Portorož's beach into the shallow sea
- **THEN** the player swims into the shallow sea tile

#### Scenario: Without the snorkel
- **WHEN** a player without the snorkel, but with the boots, walks into the shallow sea
- **THEN** the player stops on the beach

#### Scenario: Deep sea
- **WHEN** a player with the snorkel walks from the shallows towards the deep sea
- **THEN** the player stays in the shallows

## MODIFIED Requirements

### Requirement: Tool content
Each tool SHALL be a content file with:
- a stable lowercase snake_case ID
- a localized name and description (Slovenian required)
- whether every save starts with it
- a 16×16 PNG icon named after its ID

A tool that saves do not start with SHALL be the reward of at least one quest. Content validation SHALL reject any of the following, naming the file:
- a missing Slovenian text
- a missing or wrongly sized icon
- a duplicate ID
- a quest rewarding an unknown tool
- a tool that is neither a start tool nor any quest's reward

The tools' effects are gameplay rules, keyed by their IDs: `lamp`, `binoculars`, `magnifier`, `boots` and `snorkel`.

#### Scenario: Repository tools
- **WHEN** the API starts with the repository content
- **THEN** the tools are `lamp` (a start tool, *svetilka*), `binoculars` (*daljnogled*, from `eye_for_nature`), `magnifier` (*povečevalno steklo*, from `in_the_shade_of_firs`) `boots` (*škornji*, from `secrets_of_the_bog`) and `snorkel` (*maska z dihalko*, from `between_salt_and_sea`)

#### Scenario: Reward of an unknown tool
- **WHEN** a quest rewards tool `compass` and no such tool exists
- **THEN** content validation fails and names the quest and the tool
