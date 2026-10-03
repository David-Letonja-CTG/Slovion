## MODIFIED Requirements

### Requirement: Identification dialog
The client SHALL show an observation dialog with a heading for the species group, the first clue (the first two for a plant or insect when the player has the magnifier, see `inventory`), a button revealing the next clue (until all are shown), the candidates by Slovenian name, and a way to leave. `MoveUp`/`MoveDown` SHALL move the selection, `Confirm` SHALL activate it and `Cancel` SHALL leave. Leaving abandons the encounter but keeps the observation. The world SHALL receive no input while the dialog is open.

#### Scenario: Revealing clues
- **WHEN** the dialog opens and the player chooses *Nov namig* twice
- **THEN** three clues are shown and *Nov namig* is no longer offered

#### Scenario: Choosing with the keyboard
- **WHEN** the player presses `ArrowDown` until a candidate is selected and presses `Enter`
- **THEN** that candidate is sent as the answer

#### Scenario: Leaving
- **WHEN** the player presses `Escape` in the dialog
- **THEN** the dialog closes without an answer and the player can move again
