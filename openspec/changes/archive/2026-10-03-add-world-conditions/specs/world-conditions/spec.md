## ADDED Requirements

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
A species SHALL be available when the save's current season is one of its available seasons and the current time of day is one of its available times of day. A species without a time-of-day restriction SHALL be available at every time of day. Encounters SHALL only ever involve available species. Availability is derived from sourced facts (D6).

#### Scenario: A species limited to daytime
- **WHEN** the save's time is night and a species is available only in the morning and by day
- **THEN** that species is not available

#### Scenario: Skylark in winter
- **WHEN** the save's season is winter
- **THEN** the skylark, which is resident all year, is available

### Requirement: Conditions on screen
The game SHALL show the current season and time of day in Slovenian in a small indicator over the world, for example *Pomlad · jutro*. The map SHALL be tinted by time of day:
- a light warm tint in the morning
- no tint by day
- an orange tint in the evening
- a dark blue tint at night

Between server syncs, the client SHALL advance the time at the rate the server reported. It SHALL re-sync when the game starts and whenever the page becomes visible again. The indicator and the tint SHALL update when the season or time of day changes. The indicator SHALL NOT be the only way information is conveyed: it is text, so screen readers can read it.

#### Scenario: Starting a new game
- **WHEN** a new game starts
- **THEN** the indicator shows *Pomlad · jutro* and the map has the morning tint

#### Scenario: Nightfall
- **WHEN** the in-game time reaches 22:00 while playing
- **THEN** the indicator changes to show *noč* and the map takes the night tint
