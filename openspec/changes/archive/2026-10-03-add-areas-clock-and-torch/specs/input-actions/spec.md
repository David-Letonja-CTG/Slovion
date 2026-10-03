## MODIFIED Requirements

### Requirement: Logical action set
The game SHALL expose exactly these logical actions: `MoveUp`, `MoveDown`, `MoveLeft`, `MoveRight`, `Run`, `Interact`, `Confirm`, `Cancel`, `OpenMenu`, `Torch`. Gameplay and UI code SHALL react only to these actions, never to physical keys.

#### Scenario: Remapped key
- **WHEN** a test supplies a mapping that binds `K` to `MoveUp` and presses `K`
- **THEN** the player moves up exactly as with the default mapping, without any gameplay code change

### Requirement: Default keyboard mapping
The default keyboard mapping SHALL be:
- arrow keys and `W` `A` `S` `D` → movement
- `Shift` → `Run`
- `E`, `Enter` and `Space` → `Interact` and `Confirm`
- `Escape` → `Cancel` and `OpenMenu`
- `M` → `OpenMenu`
- `L` → `Torch`

Mapping is by physical key position, so `W` `A` `S` `D` work on any keyboard layout.

#### Scenario: Arrow and letter keys are equivalent
- **WHEN** the player holds `ArrowRight` in one test and `D` in another
- **THEN** both produce `MoveRight`

#### Scenario: One key, two meanings
- **WHEN** `Enter` is pressed while the world is active
- **THEN** the world receives `Interact`
- **AND WHEN** `Enter` is pressed while a dialog is open
- **THEN** the dialog receives `Confirm`

#### Scenario: Torch key
- **WHEN** `L` is pressed while the world is active
- **THEN** the world receives `Torch`
