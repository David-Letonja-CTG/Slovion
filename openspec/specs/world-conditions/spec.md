# world-conditions Specification

## Purpose

Defines the in-game world conditions (docs/decisions.md D8): a per-save in-game clock owned by the server, seasons and times of day, species availability as a rule for encounters, reading the time, and how the conditions are shown (indicator and time-of-day tint).

## Requirements

### Requirement: In-game clock per save
Each save SHALL have an in-game time that the server derives from the save's age, using the server clock:
- one real second is one in-game minute
- day 1 starts at 08:00 on the save's creation
- each season lasts three in-game days, in the order spring, summer, autumn, winter, and then repeats

The clock SHALL keep running while the player is away. The server clock SHALL be injectable so that tests are deterministic.

The times of day SHALL be:

| Time of day | Hours |
|---|---|
| `morning` | 05:00–09:59 |
| `day` | 10:00–17:59 |
| `evening` | 18:00–21:59 |
| `night` | 22:00–04:59 |

#### Scenario: A new save
- **WHEN** a save is created
- **THEN** its in-game time is day 1, spring, 08:00, morning

#### Scenario: Evening of the first day
- **WHEN** 10 real minutes (600 in-game minutes) have passed since the save was created
- **THEN** its in-game time is 18:00 on day 1, evening

#### Scenario: Summer begins
- **WHEN** 72 real minutes have passed since the save was created
- **THEN** its in-game time is day 4, summer, 08:00

#### Scenario: The year repeats
- **WHEN** 288 real minutes have passed since the save was created
- **THEN** its in-game time is day 13, spring, 08:00

### Requirement: Reading the time
`GET /api/save/time` SHALL return the save's in-game time:
- the total in-game minutes since day 1 00:00
- the day number
- the season
- the time of day
- how many in-game minutes pass per real second

Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Time of a new save
- **WHEN** a newly created save requests its time
- **THEN** the response has minutes 480, day 1, season `spring`, time of day `morning`, and 1 in-game minute per real second

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
