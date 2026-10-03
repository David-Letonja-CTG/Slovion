## MODIFIED Requirements

### Requirement: Species availability
A species SHALL be available when the save's current season is one of its available seasons and either the current time of day is one of its available times of day or the weather of the region where it is sighted is one of its "also in weather" kinds (see `weather`). A species without a time-of-day restriction SHALL be available at every time of day. Encounters SHALL only ever involve available species. Availability is derived from sourced facts (D6).

#### Scenario: A species limited to daytime
- **WHEN** the save's time is night and a species is available only in the morning and by day
- **THEN** that species is not available

#### Scenario: Skylark in winter
- **WHEN** the save's season is winter
- **THEN** the skylark, which is resident all year, is available

#### Scenario: A fire salamander in the rain
- **WHEN** it rains in Kočevje by day
- **THEN** the fire salamander, which is otherwise found only at night, is available there

#### Scenario: A fire salamander on a clear day
- **WHEN** the weather in Kočevje is clear by day
- **THEN** the fire salamander is not available

### Requirement: Conditions on screen
The game SHALL show the current season, time of day, in-game clock (`HH:MM`) and the current region's weather in Slovenian in a small indicator over the world, for example *Pomlad · jutro · 08:15 · jasno*. The map SHALL be tinted by time of day:
- a light warm tint in the morning
- no tint by day
- an orange tint in the evening
- a dark tint at night, dark enough that a lit torch makes a clear difference

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
