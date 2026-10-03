# Proposal

## Why

The meadow is frozen at "summer, day" (D8). Every species can always be found in the same way, so after the first quest there is little reason to come back or look again. Real nature changes with the time of day and the seasons, and the species content already holds sourced facts about it: flowering times, flight periods, migration and activity.

The owner decided D8:
- an **in-game clock**
- species that are not active **cannot be found**
- time shown as a **night tint plus an indicator**

That makes the world feel alive, rewards coming back at another time, and teaches when species are around, all from the facts the journal already shows.

## What Changes

- **In-game clock, owned by the server per save** (D3, D8):
  - 1 real second is 1 in-game minute, so a day takes 24 real minutes.
  - Each season lasts 3 in-game days (72 real minutes), and the year cycles spring → summer → autumn → winter.
  - A new save starts on day 1 of **spring at 08:00**, so every current species can be found at the start.
  - The clock keeps running while the player is away.
  - The clock is injectable, so tests are deterministic.
- **Times of day:**

  | Time of day | Hours |
  |---|---|
  | *jutro* (morning) | 05:00–09:59 |
  | *dan* (day) | 10:00–17:59 |
  | *večer* (evening) | 18:00–21:59 |
  | *noč* (night) | 22:00–04:59 |

- **Species availability (content, sourced):** each species declares the seasons, and optionally the times of day, in which it can be found, with sources (D6). The values come from the species' sourced facts: flowering or flight months, migration, activity. A species with no sourced restriction is findable at all times.
- **Encounters follow the conditions:**
  - A search picks only among the habitat's species that are available now. If none are, the search finds nothing.
  - A spot whose species is not available answers *nothing here*, with a Slovenian hint to come back at another time.
- **New endpoint `GET /api/save/time`:** the save's current in-game time, so the client shows the correct conditions.
- **On screen:**
  - The map is tinted by time of day: warm in the morning, none by day, orange in the evening, dark blue at night.
  - A small indicator shows the season and time of day, e.g. *Pomlad · jutro*.
  - The engine advances the clock between server syncs.
- **D8 recorded as accepted** in `docs/decisions.md`.

**Demo outcome:** start a game → *Pomlad · jutro* → play on as the light turns to evening and night. In summer the dandelion disappears and its spot says to come back at another time; in winter only the skylark and the hare remain, until spring returns.

## Capabilities

### New Capabilities

- `world-conditions`: the in-game clock, seasons and times of day, `GET /api/save/time`, species availability as a concept, the night tint and the indicator.

### Modified Capabilities

- `species-catalog`: every species declares sourced availability (seasons, optional times of day).
- `habitat-search`: searches pick only among species available at the save's current time.
- `discovery`: a spot whose species is not available responds *nothing here*, records nothing and opens no encounter.

## Non-goals

- Weather, real calendar or real time, or the device clock affecting the world.
- Seasonal map art (snow, autumn colours), seasonal species pictures, or day/night variants of NPCs.
- Making species rarer instead of unavailable, or extra weighting by time of day.
- Sleeping, waiting or other player control of time.
- Quests, the journal or progress depending on time. The first quest keeps working, though it may have to wait for spring.
- New species or changes to habitat weights.

## Impact

- **Content:** `availability` in all 7 species files. The shrike's autumn departure and the swallowtail's day flight need an extra source each, checked during apply.
- **Domain:**
  - `WorldTime`: season, time of day, day and minute, computed from save age.
  - `Season`, `TimeOfDay`
  - `Species.Availability`
- **Application:** `EncounterService` filters spots and searches by availability at the save's world time (save creation time plus `TimeProvider`).
- **API:**
  - `GET /api/save/time`
  - `POST /api/save/encounters` may now answer `200 { found: false }`
- **Engine:** world time advanced by the game loop; time-of-day tint in the renderer; a host callback when the season or time of day changes.
- **Client:**
  - loads the time with the world and re-syncs when the page becomes visible
  - the indicator component
  - a *not now* message for spots
  - `sl.json` keys
- **Docs:** D8 accepted; README (time and seasons).
- **No database change:** the clock comes from the save's existing creation time.
