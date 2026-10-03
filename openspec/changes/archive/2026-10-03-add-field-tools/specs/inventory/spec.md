## ADDED Requirements

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

The tools' effects are gameplay rules, keyed by their IDs: `lamp`, `binoculars`, `magnifier` and `boots`.

#### Scenario: Repository tools
- **WHEN** the API starts with the repository content
- **THEN** the tools are `lamp` (a start tool, *svetilka*), `binoculars` (*daljnogled*, from `eye_for_nature`), `magnifier` (*povečevalno steklo*, from `in_the_shade_of_firs`) and `boots` (*škornji*, from `secrets_of_the_bog`)

#### Scenario: Reward of an unknown tool
- **WHEN** a quest rewards tool `compass` and no such tool exists
- **THEN** content validation fails and names the quest and the tool

### Requirement: Owned tools
A save's tools SHALL be the start tools plus the tools rewarded by the quests it completed, in content order: start tools first, then by quest completion time. The server SHALL derive them; nothing else adds or removes tools (D3).

#### Scenario: A new save
- **WHEN** a new save reads its progress
- **THEN** its tools are only the lamp

#### Scenario: After Vera's quest
- **WHEN** a save completes Vera's quest
- **THEN** its tools are the lamp and the binoculars

### Requirement: The bag
The `Inventory` action and a *Nahrbtnik* button over the world SHALL open the bag: a dialog listing the save's tools, each with its icon, name and description. `Cancel`, `Inventory` or a close button SHALL close it. World input SHALL be blocked while it is open.

#### Scenario: Opening the bag
- **WHEN** a player with the lamp and the binoculars presses `I`
- **THEN** the bag lists *svetilka* and *daljnogled* with their descriptions

### Requirement: New tool notice
When a conversation gives the save a tool it did not have, the game SHALL show a notice naming the tool, for example *Novo v nahrbtniku: daljnogled*, once the dialogue box closes.

#### Scenario: Receiving the binoculars
- **WHEN** Vera completes her quest and the player closes the dialogue
- **THEN** the notice *Novo v nahrbtniku: daljnogled* appears

### Requirement: Binoculars
With the binoculars, interacting while facing a resident animal up to 3 tiles straight ahead SHALL start an interaction with that animal's spot, as if it stood on the faced tile. This applies when no tile between the player and the animal blocks movement, and nothing nearer applies (see `world-exploration`). Without the binoculars, only the faced tile counts.

#### Scenario: A hare at a distance
- **WHEN** a player with the binoculars faces a hare 3 tiles ahead over open ground and presses `Interact`
- **THEN** an interaction with the hare's spot is started

#### Scenario: Something in the way
- **WHEN** a tree stands between the player and the hare
- **THEN** no interaction with the hare is started

### Requirement: Magnifier
With the magnifier, the identification dialog for a plant or an insect SHALL open with the first two clues shown. Other groups, and players without the magnifier, SHALL start with one clue.

#### Scenario: Two clues for a plant
- **WHEN** a player with the magnifier observes the meadow sage
- **THEN** the dialog opens with two clues and *Nov namig* offers the third

### Requirement: Boots
Tiles whose tileset tile is marked `wadeable` SHALL block movement, except for a player with the boots. Resident animals SHALL never enter them. Kočevje's forest stream is wadeable, and the fire salamander lives on its far bank.

#### Scenario: Wading the stream
- **WHEN** a player with the boots walks into Kočevje's stream
- **THEN** the player wades across to the far bank

#### Scenario: Without boots
- **WHEN** a player without the boots walks into the stream
- **THEN** the player stops at the bank
