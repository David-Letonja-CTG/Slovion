## MODIFIED Requirements

### Requirement: Torch
The player SHALL be able to switch a torch (*svetilka*) on and off:
- with the `Torch` action while the world has input
- with an on-screen button that shows whether the torch is on, which works with mouse and touch

While the torch is on, the player SHALL be drawn holding a small lamp on the side they face, at any time of day. In the evening and at night, a lit torch SHALL also show a soft-edged circle around the player, with a radius of about three tiles, where the darkness tint is cleared. The circle SHALL follow the player as they move. By day and in the morning there is no circle; only the lamp is visible.

The torch SHALL start switched off when a game starts or continues. Its state SHALL stay on the client and SHALL NOT affect encounters. It MAY change how resident animals move (see `wildlife`).

#### Scenario: Lighting the way at night
- **WHEN** it is night and the player presses `L`
- **THEN** a circle of light appears around the player and moves with them, the player holds a lamp, and the torch button shows the torch as on

#### Scenario: Switching it off
- **WHEN** the torch is on and the player presses `L` again
- **THEN** the circle and the lamp disappear, and the whole map takes the night tint again

#### Scenario: Torch by day
- **WHEN** the player switches the torch on by day
- **THEN** the player holds the lamp, there is no circle, and the torch button shows the torch as on

#### Scenario: Not while a dialog is open
- **WHEN** a dialog is open and the player presses `L`
- **THEN** the torch does not change
