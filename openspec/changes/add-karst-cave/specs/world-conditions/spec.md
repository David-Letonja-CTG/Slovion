## MODIFIED Requirements

### Requirement: Conditions on screen
The game SHALL show the current season, time of day, in-game clock (`HH:MM`) and the current region's weather in Slovenian in a small indicator over the world, for example *Pomlad · jutro · 08:15 · jasno*. The map SHALL be tinted by time of day:
- a light warm tint in the morning
- no tint by day
- an orange tint in the evening
- a dark tint at night, dark enough that a lit torch makes a clear difference

While the player is in an area marked `underground` (see `world-exploration`), the map SHALL take a cave darkness at any time of day, at least as dark as the night tint. The indicator SHALL still show the in-game time.

Between server syncs, the client SHALL advance the time at the rate the server reported. It SHALL re-sync when the game starts and whenever the page becomes visible again. The clock SHALL update every in-game minute. The season, time of day and tint SHALL update when they change. The indicator is text, so screen readers can read it. It SHALL NOT announce every minute.

#### Scenario: Starting a new game
- **WHEN** a new game starts
- **THEN** the indicator shows *Pomlad · jutro · 08:00* followed by the meadow's weather, and the map has the morning tint

#### Scenario: The clock runs
- **WHEN** 15 real seconds pass while playing a new game
- **THEN** the indicator shows *08:15*

#### Scenario: Nightfall
- **WHEN** the in-game time reaches 22:00 while playing
- **THEN** the indicator changes to show *noč · 22:00* and the map takes the night tint

#### Scenario: Into the cave by day
- **WHEN** the player walks from the gorge into the cave at 12:00
- **THEN** the map takes the cave darkness, and it returns to no tint when the player walks back out

### Requirement: Torch
The player SHALL be able to switch a torch (*svetilka*) on and off:
- with the `Torch` action while the world has input
- with an on-screen button that shows whether the torch is on, which works with mouse and touch

While the torch is on, the player SHALL be drawn holding a small lamp on the side they face, at any time of day. In the evening, at night and in underground areas, a lit torch SHALL also show a soft-edged circle around the player, with a radius of about three tiles, where the darkness tint is cleared. The circle SHALL follow the player as they move. By day and in the morning above ground there is no circle; only the lamp is visible.

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

#### Scenario: Lighting the cave
- **WHEN** the player is in the cave by day and switches the torch on
- **THEN** a circle of light appears around the player and moves with them
