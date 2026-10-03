# Design

## Context

Builds on:
- the encounter flow: spots and habitat searches in `EncounterService`, with server-side rolls (D3) and an injectable `TimeProvider` and `IRandomSource`
- species content with sourced season facts (`text.sl.season`)
- the engine's fixed-step game loop with an injectable clock
- the play screen's overlay and loading flow, which now loads the map and progress together

Saves already store `CreatedAt`.

D8 was deferred. The owner has now decided it:
- an **in-game clock**
- unavailable species are **not findable**
- **a night tint and an indicator**; no seasonal art

Motivation: see proposal.md. Requirements: the four spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- One clock rule, computed the same way on server and client, and fully deterministic in tests.
- Availability is content, based on sources; the server is the only judge of what can be found.
- Every current path still works at the start of a game: spring morning, where all 7 species are available.

**Non-Goals:** see proposal.

## Decisions

### 1. The clock rule

The rule, from the save's creation:
- `minutes = 480 + floor(realSecondsSinceCreation × 1)`
- `day = floor(minutes / 1440) + 1`
- `minuteOfDay = minutes mod 1440`
- `season = [spring, summer, autumn, winter][floor((day − 1) / 3) mod 4]`
- the time of day follows from `minuteOfDay`, using the table in the `world-conditions` spec

Seasons change at in-game midnight.

- **Domain:** `WorldTime` is a value record (`Minutes`, `Day`, `MinuteOfDay`, `Season`, `TimeOfDay`) with `WorldTime.Since(createdAt, now)` and `FromMinutes(minutes)`, plus the `Season` and `TimeOfDay` enums.
- **Client:** the engine has the same pure function in `engine/world/world-time.ts`.
- **Shared tests:** both are tested against the same table of cases: 0 s, 599 s, 600 s, 21:59/22:00, day 3 23:59 to day 4, and day 13. Nothing is stored. The time comes from `CreatedAt` and `TimeProvider`, so there is no migration.

**Why save age instead of a stored clock:** the clock always runs, which is what was decided. It needs no writes, and it can't drift between devices. The trade-off is that time passes while the player is away. That is accepted as part of a living world.

### 2. Availability content

```json
"availability": { "seasons": ["spring", "summer", "autumn"], "times": ["morning", "day"], "sources": ["nrp"] }
```

`times` is optional and means all times of day when absent. Validation follows the `species-catalog` delta. In the domain this becomes `Species.Availability(IReadOnlySet<Season> Seasons, IReadOnlySet<TimeOfDay> Times, IReadOnlyList<string> SourceIds)` with `IsAvailable(WorldTime)`.

Planned values. Each is checked against its source during apply, and a value no source supports is not used.

| Species | Seasons | Times | Basis (sourced fact) |
|---|---|---|---|
| skylark | all | all | resident all year (`nrp`) |
| hare | all | all | active mainly at night and dusk, *but also by day* (`gis`, `lzs`); no seasonal limit stated |
| swallowtail | spring, summer, autumn | morning, day | flies April–June and July–October (`nrp`). The day flight is to be sourced, e.g. as a day-flying butterfly; without a source it has no time limit. |
| meadow sage | spring, summer | all | flowers May–August (`nrp`) |
| dandelion | spring, autumn | all | flowers March–May, sometimes October (`nrp`) |
| hawthorn | spring, summer | all | flowers May–June (`nrp`) |
| shrike | spring, summer, autumn | all | returns late April or early May. The autumn departure (adults from August, young until the end of September) is to be sourced, e.g. DOPPS, Wikipedija sl or Eko Dežela. |

**Plants count as "available" while they flower.** The game observes them by their flowers, and their clues are mostly flowers. That is a gameplay reading of a sourced fact. The `species-catalog` delta and the README say so.

**What remains in each season:**

| Season | Available |
|---|---|
| winter | skylark, hare |
| spring | all seven |
| summer | skylark, hare, swallowtail, sage, hawthorn, shrike |
| autumn | skylark, hare, swallowtail, dandelion, shrike |

### 3. Encounters

`EncounterService` gets the save's world time from the save slot's `CreatedAt` and `TimeProvider.GetUtcNow()`. It already loads the slot through the token filter, and the application layer reads `CreatedAt` through `ISaveSlotRepository`.

- **Spot:** if the spot's species isn't available, the new result `StartEncounterResult.NotNow` answers `200 { found: false }`. Nothing is recorded and no encounter opens.
- **Search:** the chance roll comes first, as before, so outcome sequences stay deterministic. The weighted pick then runs over the available species only, and if there are none the search finds nothing.

### 4. API

`GET /api/save/time` responds `{ "minutes": 480, "day": 1, "season": "spring", "timeOfDay": "morning", "gameMinutesPerSecond": 1 }`. Season and time of day are included for convenience, so the client can show them without computing. The client uses `minutes` and `gameMinutesPerSecond` to advance.

### 5. Engine and client

- **Options:** `GameOptions.worldTime?: { minutes, gameMinutesPerSecond }` and `onConditionsChange?(season, timeOfDay)`.
- **Advancing the clock:** the world advances its minutes in each fixed update step (`stepMs / 1000 × rate`). When the season or time of day changes, it calls the host.
- **`Game.setWorldTime(minutes)`:** used for re-syncs.
- **Tint:** the renderer draws a full-screen tint after the player: morning `rgba(255, 196, 140, 0.10)`, day none, evening `rgba(255, 128, 48, 0.20)`, night `rgba(16, 24, 72, 0.45)`. The tint uses the logical resolution, so pixels stay crisp, and the engine stays framework-free.
- **Play screen:** loads the time together with the map and progress, and passes it to the game. On `visibilitychange` back to visible it re-fetches the time and calls `setWorldTime`, because the loop pauses while the page is hidden but the server clock doesn't. It keeps `season` and `timeOfDay` signals for the indicator.
- **`ConditionsIndicator` component:** top-right over the world. It shows *{season} · {timeOfDay}* in Slovenian and is announced politely to screen readers.
- **Spot `found: false`:** shows the new message `spot.notNow`. Searches keep `search.nothing`.

### 6. UI text (`sl.json`, for owner review)

| Key | Text |
|---|---|
| `time.season.spring` | *Pomlad* |
| `time.season.summer` | *Poletje* |
| `time.season.autumn` | *Jesen* |
| `time.season.winter` | *Zima* |
| `time.timeOfDay.morning` | *jutro* |
| `time.timeOfDay.day` | *dan* |
| `time.timeOfDay.evening` | *večer* |
| `time.timeOfDay.night` | *noč* |
| `time.label` | *Čas v igri* (accessible label) |
| `spot.notNow` | *Tukaj zdaj ni ničesar. Poskusi ob drugem času.* |

### 7. Decisions record

D8 becomes **Accepted (2026-10-03)** with the rule above: the in-game clock per save, unavailable species not findable, and the visuals limited to a tint and an indicator.

## Testing

| Level | What is tested |
|---|---|
| Domain | `WorldTime` table (shared cases); `Availability.IsAvailable` |
| Application | spot `NotNow` at night for the swallowtail and in winter for the sage; search over available species only; a search with nothing available finds nothing; determinism at a fixed time; the 3:1 weight test still holds when both species are available (the fake clock is set to spring day) |
| Integration | `GET /api/save/time` for a new save and after a fake clock advance; a spot at night answers `found: false` with nothing recorded; a search in winter at night finds only the hare or the skylark; validation cases for availability; repository content values |
| Engine | world-time table; advancing with the loop; `onConditionsChange` at 22:00; tint drawn after the player, and none by day |
| Client | the time loads with the world and is passed to the game; the indicator text; the indicator updates on change; re-sync on visibility; the spot *not now* message |
| E2E | the existing paths still pass, since a new save is spring morning; the indicator shows *Pomlad · jutro* |

The integration factory replaces `TimeProvider` with a `FakeTimeProvider`, as it already replaces `IRandomSource`.

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the four spec deltas. Each scenario is covered by a domain, application, content-validation, integration, engine, client or E2E test. No non-goal was touched: no weather, no real calendar, no seasonal art, and no rarity weighting.

**Sources** (checked 2026-10-03):
- **Shrike, autumn:** *Kmetovati z naravo* (University of Ljubljana, Biotehniška fakulteta) says adults leave in August and young birds can be seen until the end of September. It was added as source `bf-kzn`, and the shrike's season fact now includes the departure, so the journal shows why it is found in autumn.
- **Swallowtail, time of day:** no source was found that states it flies by day. Notranjski regijski park doesn't say so, and the *Metulji Slovenije* PDF couldn't be read. As planned, the swallowtail therefore has **no time-of-day limit**. No species has a sourced time-of-day limit yet. The mechanism is still in place: domain, validation, and tests with fixtures.
  - Two spec scenarios used "the swallowtail at night". They were rewritten as a general daytime-only example in `world-conditions` and as "the dandelion spot in summer" in `discovery`.
  - The proposal's demo text changed to match.

**Code changes:**
- **`EncounterService.StartAsync` and `SearchAsync` take the authenticated `SaveSlot`** instead of its ID, so the service computes the world time from `CreatedAt` and the injected clock. No repository lookup is needed.
- **`GET /api/save/time`** lives in `Api/World/TimeEndpoints.cs`. It computes the time with the domain function directly and needs no application service.
- **Availability in content** uses lowercase names. The validator looks them up exactly, so *Spring* is rejected.
- **Without a server clock the world stands still at noon:** daylight, no tint. This keeps engine tests and hosts that don't pass a clock unchanged.
- **The fake 2D context in engine tests** records the fill style, so the tint can be asserted. `FakeContentCatalog` gained `Replace`, so a test can give one species seasons.
- **Indicator position:** the indicator sits top-right over the play area, mirroring the quest tracker top-left.

**Manual check** at 1280×720, with no console errors. It shifted the save's creation time back in the dev database (real server behaviour) and saw:
- *Pomlad · jutro* at the start
- *Pomlad · večer* with the orange tint
- *Pomlad · noč* with the blue tint
- *Zima · jutro*, where the meadow sage spot answers *Tukaj zdaj ni ničesar. Poskusi ob drugem času.*

## Risks / Trade-offs

- **Time passes while away:** a player returning after a day may find winter. Accepted as a living world; the indicator shows the season at once.
- **Winter has only two species,** so the first quest (identify three) can't be finished in winter. It waits about 72 minutes for spring at most. Accepted, and the README documents it.
- **Two implementations of the clock rule** (C# and TypeScript) must agree. A shared case table tests both, the same approach as the habitat zones.
- **The client clock can drift** between syncs. It only affects the display; the server decides every encounter.
- **Spot art doesn't change with the seasons** (no seasonal art, as decided), so the sage tile still shows flowers in winter. The *not now* message explains it.

## Open Questions

None blocking. Two facts need a source during apply: the shrike's autumn departure and the swallowtail's day flight. Without a source they keep the looser value. The UI texts need owner review.
