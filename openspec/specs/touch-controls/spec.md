# touch-controls Specification

## Purpose

Defines how the game is played on touch screens: the on-screen D-pad and A and B buttons and the actions they send, when they are shown, the handheld layout held upright and sideways, and the on-screen journal button.

## Requirements

### Requirement: On-screen controls
On touch devices, the play screen SHALL show a D-pad, an A button and a B button. They SHALL send logical actions through the same routing as the keyboard (`input-actions`):
- the D-pad sends `MoveUp`, `MoveDown`, `MoveLeft` or `MoveRight`
- A sends `Interact` and `Confirm`
- B sends `Cancel` and `Run`

An action SHALL stay held while its finger stays on the control and SHALL be released when the finger lifts, the touch is cancelled, or the page loses focus. Sliding a finger across the D-pad SHALL change the direction without lifting. A touch near the D-pad's centre SHALL hold no direction. Several fingers SHALL work at once. While a dialog has input, the controls SHALL drive the dialog exactly as the matching keys do.

#### Scenario: Walking with the D-pad
- **WHEN** the player holds the right side of the D-pad for three steps' time and lifts the finger
- **THEN** the player walks right and stops after the step in progress

#### Scenario: Turning without lifting
- **WHEN** the player holds up on the D-pad and slides the finger to the left side
- **THEN** the player stops walking up and walks left

#### Scenario: Observing with A
- **WHEN** the player faces the meadow sage and taps A
- **THEN** the observation dialog opens, as with `E`

#### Scenario: Running
- **WHEN** the player holds B with one finger and a direction with another
- **THEN** the player runs

#### Scenario: Dialogs
- **WHEN** the travel map is open and the player taps down on the D-pad, then A
- **THEN** the next region is selected, then the player travels there

### Requirement: When the controls are shown
The touch controls SHALL be shown when the device's primary pointer is coarse (a touch screen), and from the first touch on any other device. Otherwise they SHALL NOT be shown. While they are shown, the keyboard hint SHALL be hidden. Pressing the controls SHALL NOT scroll, zoom, select text or open the browser's long-press menu. The controls SHALL have labels from the translation catalog for screen readers.

#### Scenario: Desktop
- **WHEN** the game is played with a mouse and keyboard
- **THEN** no touch controls are shown and the keyboard hint is

#### Scenario: Laptop with a touch screen
- **WHEN** a player first touches the screen of a laptop
- **THEN** the touch controls appear

### Requirement: Handheld layout
On touch devices held upright, the world view SHALL sit at the top of the screen at the full width its integer scaling allows, with nothing drawn over it. The clock and place, the quest tracker, the play screen's buttons and the touch controls SHALL sit below it. Held sideways, the world view SHALL use the whole screen, with the D-pad at the bottom left, A and B at the bottom right, both see-through, and the indicators and buttons at the top as on desktop. Controls SHALL stay inside the screen's safe area, and every button SHALL be at least 44 CSS pixels in both directions.

#### Scenario: Upright phone
- **WHEN** the game is played on a 412×915 CSS pixel phone held upright
- **THEN** the world view is at the top, at least 85 % of the screen width wide, and no control or indicator overlaps it

#### Scenario: Turning the phone
- **WHEN** the phone is turned sideways
- **THEN** the world view fills the height of the screen and the D-pad and buttons sit at the bottom corners

### Requirement: Journal button
The play screen SHALL have a *Dnevnik* button that opens *Terenski dnevnik*, like `M`, for mouse and touch players alike.

#### Scenario: Opening the journal by touch
- **WHEN** the player taps *Dnevnik*
- **THEN** *Terenski dnevnik* opens and takes input until closed
