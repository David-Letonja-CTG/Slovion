# Design

## Context

What exists today:
- The in-game clock is derived from a save's creation time (D8: 1 real second = 1 in-game minute, 3 days per season).
- `Availability` holds seasons and times of day, and the server checks it for encounters, searches and residents (D3).
- The renderer tints the map by time of day, and the torch clears a circle at night.
- The corner indicator shows season, time of day, clock and place.
- Regions are content with a map each; residents come from animal spots; groups are plant, mammal, bird and insect.

The owner chose weather shown on screen that also affects some species, decided per region.

Motivation: see proposal.md. Requirements: the four spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- Weather that is deterministic, testable and needs no storage: a pure function of region, in-game day and period.
- The server stays authoritative for anything that affects finding species. The client only draws what the server reports.
- Weather rules for species are sourced, opt-in, and only ever widen availability.

**Non-Goals:** see proposal.

## Decisions

### 1. The weather model (new D11)

- **Kinds:** `Weather` enum `Clear`, `Cloudy`, `Rain`, `Fog`, `Snow`.
- **Periods:** a weather period is 6 in-game hours; `period = MinuteOfDay / 360`, giving 0–3.
- **The pick:**
  - `WeatherPick.For(regionId, worldTime, weights)` hashes `"{regionId}:{day}:{period}"` with 32-bit FNV-1a (UTF-8).
  - It takes `hash % totalWeight` over the current season's weights, in the fixed enum order.
  - It is a pure function and needs no injected randomness, since the same input always gives the same weather.
  - Every save at the same in-game day and period sees the same weather per region. Saves are rarely at the same in-game time, so this feels per-save.
- **Next change:** the start of the next period, `(day - 1) * 1440 + (period + 1) * 360` minutes from day 1 00:00, in the same minute scale as `GET /api/save/time`.

### 2. Content

- **Region weights** — `"weather": { "spring": { "clear": 4, … }, "summer": { … }, "autumn": { … }, "winter": { … } }`. Fictional values, for owner review:

  | Region | Spring | Summer | Autumn | Winter |
  |---|---|---|---|---|
  | Dravsko polje | clear 4, cloudy 3, rain 2, fog 1 | clear 6, cloudy 2, rain 2 | clear 3, cloudy 3, rain 2, fog 2 | clear 3, cloudy 3, fog 2, snow 2 |
  | Kočevje | clear 3, cloudy 3, rain 3, fog 1 | clear 4, cloudy 3, rain 3 | clear 2, cloudy 3, rain 3, fog 2 | clear 2, cloudy 3, fog 2, snow 3 |
  | Pohorje | clear 3, cloudy 3, rain 2, fog 2 | clear 4, cloudy 2, rain 2, fog 2 | clear 2, cloudy 2, rain 2, fog 4 | clear 2, cloudy 2, fog 2, snow 4 |
  | Triglav | clear 3, cloudy 2, rain 1, fog 2, snow 2 | clear 4, cloudy 2, rain 2, fog 2 | clear 3, cloudy 2, rain 1, fog 2, snow 2 | clear 2, cloudy 2, fog 1, snow 5 |

- **Species:** `availability.alsoInWeather: ["rain"]` is optional and sourced like the rest of `availability`.
- **New species,** researched in this change. The plan below follows the summaries found while proposing; facts that can't be sourced are left out:
  - **`salamandra_salamandra`** (*navadni močerad*): group `amphibian`, torch `calm`, habitat `fir_beech_forest`, spot in Kočevje's forest.
    - Sources: CKFF, zdravgozd.si, GBIF.
    - Planned availability: the active seasons; times `night` (and `evening` if sourced); also in `rain`.
  - **`salamandra_atra`** (*planinski močerad*): group `amphibian`, torch `calm`, habitat `alpine_grassland`, spot on Triglav's grassland.
    - Sources: TNP *Triglavska zakladnica*, CKFF, GBIF.
    - Planned availability: the active seasons; times `morning` and `night`; also in `rain` and `fog`.
- **Art:** pictures (32×32) and walk sprites (32×16), drawn by script as before.
- **Group labels** for `amphibian` (translations):
  - group: *dvoživka*
  - observation heading: *Opaziš dvoživko*
  - season label: *Aktivnost*
  - habitat label: *Življenjski prostor*

### 3. Server

- **Domain:** `Availability.IsAvailableAt(WorldTime time, Weather weather)`. Existing callers pass the weather. `SpeciesGroup.Amphibian`.
- **Catalog:** `IContentCatalog.FindRegionOfMap(mapId)`. `Region` gains `WeatherWeights` (season → kind → weight).
- **`WeatherService`:**
  - `Current(save, mapId)` returns `(Weather, nextChangeMinutes)`, or null for an unknown map
  - `At(mapId, worldTime)` is used by encounters and wildlife
- **Callers:** `EncounterService` (spots and searches) and `WildlifeService` (`present`) pass the weather of the map's region.
- **API:** `GET /api/save/weather?mapId=` returns `{ weather: "rain", changesAtMinutes: 720 }`. Errors: `unknown_map`, `bad_request`, `invalid_save_token`.

### 4. Engine

- **Game API:** `GameOptions.weather` and `Game.setWeather(kind)`; `World` keeps the current weather.
- **Renderer:** after the time-of-day tint and torch, `drawWeather(context, weather, elapsedMs, view, reducedMotion)`. Positions come from the game clock, so drawing is deterministic.
  - **Rain:** about 120 short diagonal streaks (`rgba(180,200,230,0.55)`) falling; plus a blue-grey tint `rgba(40,60,90,0.15)`.
  - **Snow:** about 90 white 2×2 flakes drifting down with a slight sway.
  - **Fog:** a full overlay `rgba(220,226,232,0.35)` plus two soft horizontal bands moving slowly.
  - **Cloudy:** a tint `rgba(60,64,72,0.12)`.
- **Reduced motion:** `GameOptions.reducedMotion` comes from `prefers-reduced-motion`. With it, rain and snow particles stay in place and fog bands don't move.

### 5. Client

- **Loading:** `PlayScreen` loads the weather with the place: in `loadPlace` alongside the map and wildlife, and again on travel.
- **Refreshing:** it reloads the weather and the residents when the in-game time reaches `changesAtMinutes`, checked in `onTimeChanged`, on visibility re-sync, and after travel. A failed reload keeps the current weather.
- **Indicator:** the conditions indicator gets the weather word as a new input. Keys `weather.clear` and so on: *jasno*, *oblačno*, *dež*, *megla*, *sneg*.

### 6. Testing

- **Domain:**
  - `WeatherPick` is deterministic, respects season weights (never snow in a season without snow) and keeps within a period; the next-change minutes are right
  - availability with `alsoInWeather`
- **Content:**
  - region weights validation (missing season, unknown kind, non-positive weight) and repository weights
  - the salamanders and `amphibian`
- **Application:** encounters and wildlife with weather, via a test catalog whose weights force one kind.
- **Integration:** `GET /api/save/weather` with its errors and next change, using a fake clock.
- **Engine:** the renderer draws the overlay per kind and doesn't move particles with reduced motion; `setWeather`.
- **Client:** the indicator word; reload at the change minute; reload after travel.
- **E2E:** the indicator shows one of the five weather words.

## Risks / Trade-offs

- **[Weather is the same for all saves at the same in-game time]** It is still per region and changes often. Making it per save would need the save ID in the hash, which can be added later without content changes.
- **[Salamanders are rare in clear weather]** This is intended: rain becomes worth waiting for. Rain is common in Kočevje (weight 3 of 10 in spring) and fog on Triglav.
- **[Visual noise on phones]** Particle counts are fixed per view, and overlays are light. The manual check covers a phone viewport.

## Implementation notes and deviations

Recorded after implementing.

- **The alpine salamander comes out in rain only, not in fog.**
  - **Sources:** CKFF ("ponoči in po dežju", "zgodaj zjutraj … ponoči, pa tudi po dežju", "v vlažnih, senčnih legah ali ob dežju") and TNP ("podnevi pa le, kadar dežuje") support rain. Fog was only in a search summary I could not verify, so `alsoInWeather` is `["rain"]`. The proposal's demo line about fog does not hold.
  - **Availability:** `morning` and `night`; spring to autumn ("od konca aprila do začetka oktobra").
- **The fire salamander is available in every season.** No source found states its active months, and the availability rule only restricts where a source says so.
  - **Times:** `evening` and `night`. CKFF: "aktivni predvsem ponoči"; Notranjski park: "proti večeru ali v deževnih dneh".
  - **Weather:** also in `rain`.
- **Species placement:** the fire salamander's spot is at (6, 14) in Kočevje's southern forest, and the alpine salamander's at (20, 13) on Triglav's grassland.
- **Weather API failures:** the client starts with clear weather when the weather cannot be loaded. If a reload fails, it keeps the last weather and retries an in-game hour later.
- **Order of refreshes:** when the weather period ends, the client reloads the weather first and then the animals. When the page becomes visible again, it reloads the weather, which also reloads the animals, then re-syncs the clock.
- **Manual check:** I found moments with each weather by computing the same pick in a script, then moved only the test save's timestamps in the dev database. The game showed the same weather the script predicted.
