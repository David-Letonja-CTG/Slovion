## MODIFIED Requirements

### Requirement: Reading progress
`GET /api/save/progress` SHALL return:
- the save's flags
- the save's tools (see `inventory`), each with its ID and localized name and description
- every quest the save has started, each with its ID, localized title, summary and return hint, status (`active` or `completed`), progress and goal

Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Active quest
- **WHEN** a save that started `eye_for_nature` and identified two species requests its progress
- **THEN** the quest is listed as `active` with progress 2 and goal 3, the flags are empty, and the tools are only the lamp

#### Scenario: Progress survives a reload
- **WHEN** a save that completed `eye_for_nature` continues the game after a reload
- **THEN** its progress lists the quest as `completed` and its flags contain `hedgerow_open`
