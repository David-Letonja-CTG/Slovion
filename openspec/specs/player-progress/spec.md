# player-progress Specification

## Purpose

Defines a save's progression: progress flags earned as quest rewards and stored on the server, reading progress, and loading it together with the world so gates match the save from the first frame.

## Requirements

### Requirement: Progress flags
A save's progress flags SHALL be the reward flags of its completed quests. Flags SHALL be stored on the server with the save (D3, D4). They SHALL never be set by the client, and SHALL never be removed in the current scope.

#### Scenario: Flag from a completed quest
- **WHEN** a save completes quest `eye_for_nature`
- **THEN** its flags contain `hedgerow_open`

#### Scenario: No flags on a new save
- **WHEN** a new save requests its progress
- **THEN** its flags are empty

### Requirement: Reading progress
`GET /api/save/progress` SHALL return:
- the save's flags
- every quest the save has started, each with its ID, localized title, summary and return hint, status (`active` or `completed`), progress and goal

Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Active quest
- **WHEN** a save that started `eye_for_nature` and identified two species requests its progress
- **THEN** the quest is listed as `active` with progress 2 and goal 3, and the flags are empty

#### Scenario: Progress survives a reload
- **WHEN** a save that completed `eye_for_nature` continues the game after a reload
- **THEN** its progress lists the quest as `completed` and its flags contain `hedgerow_open`

### Requirement: Progress is loaded with the world
When a game starts or continues, the client SHALL load the save's progress before the player can move. It SHALL apply the progress to the world (open gates) and to the quest tracker. If progress can't be loaded, the client SHALL show the existing Slovenian error handling for the failure (a missing save or an unreachable server) instead of starting with wrong progress.

#### Scenario: Gate open after continuing
- **WHEN** a player who completed the quest continues the game
- **THEN** the southern gate is open from the start

#### Scenario: Server unreachable
- **WHEN** progress can't be loaded because the server is unreachable
- **THEN** the game shows the Slovenian network error and the player can't move
