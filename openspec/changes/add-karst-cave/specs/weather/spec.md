## MODIFIED Requirements

### Requirement: Weather on screen
The game SHALL show the current region's weather:
- in the corner indicator, as a Slovenian word after the clock: *jasno*, *oblačno*, *dež*, *megla* or *sneg*
- on the map:
  - rain as falling streaks with a cool tint
  - snow as drifting flakes
  - fog as a pale veil
  - cloudy as a slight grey tint
  - clear as no overlay

The weather overlay SHALL be drawn above the map and the time-of-day tint, and below the dialogs. No weather overlay SHALL be drawn while the player is in an underground area; the indicator still shows the region's weather. With reduced motion, rain and snow SHALL be drawn without movement. The client SHALL load the weather with the map, and reload it and the map's animals when the weather period ends, after travelling and when the page becomes visible again.

#### Scenario: Rain on screen
- **WHEN** the current region's weather is rain
- **THEN** the indicator ends with *dež* and rain streaks fall over the map

#### Scenario: The weather changes
- **WHEN** the in-game time reaches the next weather change while playing
- **THEN** the client reloads the weather and the animals, and the screen shows the new weather

#### Scenario: Rain does not fall in the cave
- **WHEN** it rains in Rakov Škocjan and the player walks into the cave
- **THEN** the rain streaks stop, and they return when the player walks back out
