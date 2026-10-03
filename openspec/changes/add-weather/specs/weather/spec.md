## ADDED Requirements

### Requirement: Weather per region
Every region SHALL have a weather at every in-game moment of a save: `clear`, `cloudy`, `rain`, `fog` or `snow`. The weather SHALL stay the same within each 6-hour period of an in-game day (00:00–05:59, 06:00–11:59, 12:00–17:59, 18:00–23:59). It SHALL be picked deterministically from the region ID, the in-game day and the period, weighted by the region's weights for the current season. The same region, day and period SHALL always give the same weather. The server SHALL decide the weather (D3). Weights are fictional gameplay data (D6).

#### Scenario: Stable within a period
- **WHEN** a save's in-game time moves from 06:00 to 11:59 on one day
- **THEN** each region's weather stays the same

#### Scenario: Only weathers the season allows
- **WHEN** a region's weights for summer list no snow
- **THEN** that region never has snow in summer

#### Scenario: Deterministic
- **WHEN** two saves are at the same in-game day and period
- **THEN** each region has the same weather in both

### Requirement: Weather content
Each region file SHALL have weather weights per season: for each of `spring`, `summer`, `autumn` and `winter`, positive integer weights for one or more weather kinds. Content validation SHALL reject any of the following, naming the region:
- a missing season
- an unknown weather kind
- a non-positive weight
- a season without any weight

#### Scenario: Repository weather
- **WHEN** the API starts with the repository content
- **THEN** every region has weights for every season, snow appears only in winter except on Triglav, and Triglav has snow in spring, autumn and winter

#### Scenario: Unknown weather kind
- **WHEN** a region lists the weather `hail`
- **THEN** content validation fails and names the region

### Requirement: Reading the weather
`GET /api/save/weather?mapId=` SHALL return the current weather of the region of that map for the save's in-game time, and the in-game minute at which it next changes. An unknown map SHALL respond `404` with code `unknown_map`. A missing map ID SHALL respond `400` with code `bad_request`. A request without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Reading Kočevje's weather
- **WHEN** a save at 08:00 on day 1 reads the weather of `kocevje_forest`
- **THEN** the response has Kočevje's weather for day 1, 06:00–11:59, and says it changes at 12:00

### Requirement: Weather on screen
The game SHALL show the current region's weather:
- in the corner indicator, as a Slovenian word after the clock: *jasno*, *oblačno*, *dež*, *megla* or *sneg*
- on the map:
  - rain as falling streaks with a cool tint
  - snow as drifting flakes
  - fog as a pale veil
  - cloudy as a slight grey tint
  - clear as no overlay

The weather overlay SHALL be drawn above the map and the time-of-day tint, and below the dialogs. With reduced motion, rain and snow SHALL be drawn without movement. The client SHALL load the weather with the map, and reload it and the map's animals when the weather period ends, after travelling and when the page becomes visible again.

#### Scenario: Rain on screen
- **WHEN** the current region's weather is rain
- **THEN** the indicator ends with *dež* and rain streaks fall over the map

#### Scenario: The weather changes
- **WHEN** the in-game time reaches the next weather change while playing
- **THEN** the client reloads the weather and the animals, and the screen shows the new weather
