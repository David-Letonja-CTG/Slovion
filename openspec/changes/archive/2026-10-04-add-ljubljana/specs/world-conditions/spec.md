## MODIFIED Requirements

### Requirement: Conditions on screen
The game SHALL show the current season, time of day, in-game clock (`HH:MM`) and the current region's weather in Slovenian in a small indicator over the world, for example *Pomlad · jutro · 08:15 · jasno*. The map SHALL be tinted by time of day:
- a light warm tint in the morning
- no tint by day
- an orange tint in the evening
- a dark tint at night, dark enough that a lit torch makes a clear difference

While the player is in an area marked `underground` (see `world-exploration`), the map SHALL take a cave darkness at any time of day, at least as dark as the night tint. The indicator SHALL still show the in-game time.

In the evening and at night, every lamp post on the map SHALL clear a soft-edged circle of light around itself in the tint, of about the torch's size, whether the torch is on or not. Lamps SHALL NOT change encounters or how animals move.

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

#### Scenario: Lamps at night
- **WHEN** it is night in the Ljubljana park
- **THEN** a circle of light shows around every lamp post, and the rest of the park has the night tint

#### Scenario: Lamps by day
- **WHEN** it is day in the Ljubljana park
- **THEN** the lamp posts are drawn without circles of light
