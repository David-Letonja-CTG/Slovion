## MODIFIED Requirements

### Requirement: Conditions on screen
The game SHALL show the current season, time of day and in-game clock (`HH:MM`) in Slovenian in a small indicator over the world, for example *Pomlad · jutro · 08:15*. The map SHALL be tinted by time of day:
- a light warm tint in the morning
- no tint by day
- an orange tint in the evening
- a dark tint at night, dark enough that a lit torch makes a clear difference

Between server syncs, the client SHALL advance the time at the rate the server reported. It SHALL re-sync when the game starts and whenever the page becomes visible again. The clock SHALL update every in-game minute. The season, time of day and tint SHALL update when they change. The indicator is text, so screen readers can read it. It SHALL NOT announce every minute.

#### Scenario: Starting a new game
- **WHEN** a new game starts
- **THEN** the indicator shows *Pomlad · jutro · 08:00* and the map has the morning tint

#### Scenario: The clock runs
- **WHEN** 15 real seconds pass while playing a new game
- **THEN** the indicator shows *08:15*

#### Scenario: Nightfall
- **WHEN** the in-game time reaches 22:00 while playing
- **THEN** the indicator changes to show *noč · 22:00* and the map takes the night tint

## ADDED Requirements

### Requirement: Torch
The player SHALL be able to switch a torch (*svetilka*) on and off:
- with the `Torch` action while the world has input
- with an on-screen button that shows whether the torch is on, which works with mouse and touch

In the evening and at night, a lit torch SHALL show a soft-edged circle around the player, with a radius of about three tiles, where the darkness tint is cleared. The circle SHALL follow the player as they move. By day and in the morning, a lit torch SHALL have no visible effect on the map. The torch SHALL start switched off when a game starts or continues. Its state SHALL stay on the client and SHALL NOT affect encounters.

#### Scenario: Lighting the way at night
- **WHEN** it is night and the player presses `L`
- **THEN** a circle of light appears around the player and moves with them, and the torch button shows the torch as on

#### Scenario: Switching it off
- **WHEN** the torch is on and the player presses `L` again
- **THEN** the circle disappears and the whole map takes the night tint again

#### Scenario: Torch by day
- **WHEN** the player switches the torch on by day
- **THEN** the map looks unchanged and the torch button shows the torch as on

#### Scenario: Not while a dialog is open
- **WHEN** a dialog is open and the player presses `L`
- **THEN** the torch does not change
