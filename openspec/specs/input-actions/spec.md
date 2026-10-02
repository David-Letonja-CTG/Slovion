# input-actions Specification

## Purpose

Defines how physical input becomes logical game actions, so gameplay and UI never depend on specific keys or devices and new input methods can be added without changing game logic.

## Requirements

### Requirement: Logical action set
The game SHALL expose exactly these logical actions: `MoveUp`, `MoveDown`, `MoveLeft`, `MoveRight`, `Run`, `Interact`, `Confirm`, `Cancel`, `OpenMenu`. Gameplay and UI code SHALL react only to these actions, never to physical keys.

#### Scenario: Remapped key
- **WHEN** a test supplies a mapping that binds `K` to `MoveUp` and presses `K`
- **THEN** the player moves up exactly as with the default mapping, without any gameplay code change

### Requirement: Default keyboard mapping
The default keyboard mapping SHALL be: arrow keys and `W` `A` `S` `D` → movement; `Shift` → `Run`; `E`, `Enter` and `Space` → `Interact` and `Confirm`; `Escape` → `Cancel` and `OpenMenu`; `M` → `OpenMenu`. Mapping is by physical key position, so `W` `A` `S` `D` work on any keyboard layout.

#### Scenario: Arrow and letter keys are equivalent
- **WHEN** the player holds `ArrowRight` in one test and `D` in another
- **THEN** both produce `MoveRight`

#### Scenario: One key, two meanings
- **WHEN** `Enter` is pressed while the world is active
- **THEN** the world receives `Interact`
- **AND WHEN** `Enter` is pressed while a dialog is open
- **THEN** the dialog receives `Confirm`

### Requirement: Most recent direction wins
When several movement actions are held, the most recently pressed one SHALL be active. Releasing it SHALL fall back to the most recent direction that is still held.

#### Scenario: Overlapping directions
- **WHEN** the player holds `MoveRight`, then also holds `MoveUp`, then releases `MoveUp`
- **THEN** the active direction is right, then up, then right again

### Requirement: Key auto-repeat is ignored
Operating-system key auto-repeat SHALL NOT produce additional action presses.

#### Scenario: Holding Interact
- **WHEN** the player holds `E` long enough for the OS to auto-repeat it
- **THEN** exactly one `Interact` press is produced

### Requirement: Released on focus loss
When the page loses focus or becomes hidden, all held actions SHALL be released.

#### Scenario: Alt-Tab while walking
- **WHEN** the player is holding `MoveLeft` and the window loses focus
- **THEN** the player stops after completing the current step and does not keep walking

### Requirement: One consumer at a time
Actions SHALL be delivered either to the world or to the topmost open UI overlay (dialog, NatureDex), never to both. While an overlay is open the world SHALL receive no actions.

#### Scenario: Dialog open
- **WHEN** the discovery dialog is open and the player presses `ArrowUp`
- **THEN** the player character does not move
