# Proposal

## Why

The world has seasons and times of day (D8) but always the same sky. The owner chose weather that is shown on screen and affects some species, per region. This makes the world feel alive and gives a reason to return in other conditions. It also fits the research levels: species can be seen again in other weather.

## What Changes

- **Weather per region:** five kinds: *jasno*, *oblačno*, *dež*, *megla*, *sneg*.
  - Each region's weather changes every 6 in-game hours (at 00:00, 06:00, 12:00 and 18:00).
  - It is picked deterministically from the region, the in-game day and the 6-hour period.
  - The odds come from fictional weights per region and season in the region's content, for example more fog on Pohorje, snow on Triglav in winter and often in spring and autumn, and snow on the lowlands only in winter.
  - The server decides the weather (D3).
- **Weather on screen:**
  - **Rain:** falling streaks and a cooler tint.
  - **Snow:** drifting flakes.
  - **Fog:** a pale veil.
  - **Cloudy:** a slight grey tint.

  The corner indicator names the weather (*Pomlad · jutro · 08:15 · dež*). With reduced motion, rain and snow are drawn still.
- **Species that come out in certain weather:** availability may name weathers in which a species is also found at any time of day, sourced like every availability rule (D6).
- **Two new sourced species** that use this, in a new group *dvoživke* (amphibians):
  - *navadni močerad* (*Salamandra salamandra*) in Kočevje: active at night, and by day too in rain
  - *planinski močerad* (*Salamandra atra*) on Triglav: out in the early morning and at night, and by day too after rain or in fog

  Both are calm resident animals with sourced facts, clues, pictures and walk sprites.
- **API:** `GET /api/save/weather?mapId=` returns the region's current weather and when it next changes. The client refreshes it, and the map's animals, at each change.
- **Decision:** a new D11 in `docs/decisions.md` records the weather model.

**Demo outcome:**
1. On a rainy day in Kočevje, rain falls over the forest and the indicator says *dež*.
2. A fire salamander crawls across the forest floor in daylight; in clear weather it only comes out at night.
3. On Triglav it snows in winter, and in the fog an alpine salamander appears.

## Capabilities

### New Capabilities

- `weather`: weather per region, its content, the weather API, and weather on screen.

### Modified Capabilities

- `world-conditions`: species availability includes weather; the indicator shows the weather.
- `species-catalog`: the new group `amphibian`; availability content may name weathers; the repository has the two salamanders.
- `regions`: region content has weather weights.

## Non-goals

- Weather that hides species. Only "also in this weather" is supported.
- Gameplay effects beyond availability: no slower walking, no torch changes, no quests about weather.
- Wind, storms, lightning, temperature, or weather forecasts.
- Weather sounds.
- Weather effects for existing species without a source for them.

## Impact

- **Content:**
  - `weather` weights in the 4 region files
  - 2 species with pictures and walk sprites
  - `availability.alsoInWeather` for the 2 salamanders
  - habitats list the salamanders
  - resident spots on the Kočevje and Triglav maps
- **Server:**
  - domain `Weather` and a deterministic weather pick
  - `Availability.IsAvailableAt(time, weather)`
  - catalog lookup of a map's region
  - `WeatherService` and `GET /api/save/weather`
  - encounters, searches and wildlife use the region's weather
  - `SpeciesGroup.Amphibian`
- **Engine:** `setWeather`; weather overlays in the renderer (animated by the game clock, still with reduced motion).
- **Client:**
  - loads and refreshes the weather
  - the indicator shows it
  - translations for the weather words and the amphibian group
- **Docs:** D11 in `docs/decisions.md`, the README, and the product vision's roadmap.
