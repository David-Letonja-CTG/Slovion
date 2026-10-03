# Design

## Context

What exists today:
- `SpeciesDiscovery` holds one save's record of a species: first observation (spot or habitat) and identification time.
- `EncounterService` answers a sighting of an identified species (spot, resident or search) with `AlreadyIdentified(entry)` and opens no encounter.
- `NatureDexService.ToEntry` builds entries. Identified entries carry every localized fact (`SpeciesView`) and all sources.
- In-game time is derived from the save's creation time (`WorldTime.Since`, D8).
- The client shows *Ta vrsta je že zapisana …* for already identified species. The journal page lists every fact.

The owner chose research by observing again, with existing facts unlocked by level.

Motivation: see proposal.md. Requirements: the three spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- A reason to revisit species at different times of day, with no new content.
- The server decides levels and never sends hidden facts (D3).
- The time rule is deterministic and testable with a fake clock.

**Non-Goals:** see proposal.

## Decisions

### 1. Domain

- **New state:** `SpeciesDiscovery` gains `ResearchLevel` (0 until identified) and `ResearchedAt` (time of the last research step), plus `MaxResearchLevel = 3`.
- **`Identify(at)`:** also sets level 1 and `ResearchedAt = at` the first time.
- **`Research(DateTimeOffset at, DateTimeOffset saveCreatedAt)`** returns whether the level rose. It requires the species to be identified, the level below 3, and `WorldTime.Since(saveCreatedAt, at)` to differ in day or time of day from `WorldTime.Since(saveCreatedAt, ResearchedAt)`. When all hold, it raises the level and sets `ResearchedAt = at`.

### 2. Persistence

- **Migration `AddResearch`:** adds `research_level` (int, not null, default 0) and `researched_at` (timestamptz, null) to `discoveries`. It then runs `UPDATE discoveries SET research_level = 1, researched_at = identified_at WHERE identified_at IS NOT NULL`.
- **Repository:** `IDiscoveryRepository.ResearchAsync(saveSlotId, speciesId, at, saveCreatedAt)` loads the tracked row, calls `Research` and saves. It returns the discovery and whether research advanced. `IdentifyAsync` keeps its shape; the entity sets the level.

### 3. Application and API

- **Encounters:** `EncounterService`, where it returns `AlreadyIdentified`, first calls `ResearchAsync` with the current time and the save's creation time. The result becomes `AlreadyIdentified(NatureDexEntry Entry, bool Researched)`. Spot, resident and search sightings all pass through this point.
- **Revealed facts:** `NatureDexService.ToEntry` builds `SpeciesView` from the facts revealed at the entry's level:
  - `Habitat` and `Distribution` are null below 2
  - `Season` is null below 3
  - `Sources` are the sources cited by the revealed facts, including the scientific name's sources

  `NatureDexEntry` gains `int? ResearchLevel`, null unless identified.
- **API:**
  - `alreadyIdentified` responses gain `researched: bool`
  - entries gain `researchLevel`
  - `species.habitat`, `species.distribution` and `species.season` become nullable

  These are additive or relaxing changes. The repository's only client is updated in the same change.

### 4. Client

- **Types:** `NatureDexEntry.researchLevel`; nullable `habitat`, `distribution` and `season`; `AlreadyIdentified.researched`.
- **Messages** (the `known` overlay, now with the level and the outcome):

  | Key | Text |
  |---|---|
  | `research.advanced` | *Raziskava napreduje: {{name}} ({{level}}/3). V Terenskem dnevniku je nov zapis.* |
  | `research.later` | *Ta vrsta je že zapisana v Terenskem dnevniku: {{name}}. Več izveš, če jo opaziš ob drugem času dneva.* |
  | `research.complete` | *Ta vrsta je v Terenskem dnevniku v celoti raziskana: {{name}}* |

  `discovery.known` is removed. Its wording lives on in `research.later`, so the E2E search test's pattern still matches.
- **Journal:**
  - identified pictures show the level as three small stars (★ filled, ☆ empty), with an accessible label *Raziskano: 2/3*
  - the page shows *Raziskano: {{level}}/3* and, below 3, *Opazuj to vrsto ob drugem času dneva, da izveš več.*
  - facts that aren't revealed are left out

### 5. Testing

- **Domain:** `Identify` sets level 1; `Research` covers the same time of day, another time of day, the next day at the same time, the maximum level, and an unidentified species.
- **Application** (with `FakeTimeProvider`): the spot sighting the same morning and in the evening; a search sighting; `ToEntry` filtering by level, including sources.
- **Integration:** the API fields; persistence across requests; the migration upgrade from `AddQuests`-era data with identified rows.
- **Client:**
  - the three messages
  - the stars and their label
  - the page at levels 1 and 3
- **E2E:** after identifying the sage, interacting again shows the "come back later" message. A time-of-day change cannot be waited for in E2E; integration tests cover it.

## Risks / Trade-offs

- **[Pages are shorter right after identifying]** This is intended. The hint explains how to see more.
- **[Animals only present at some times]** For example, the wolf is out only in the evening and at night. Its two later research steps can still come from evening and night, or from another day.
- **[Quest progress]** It is unchanged, since it counts identified species.

## Implementation notes and deviations

Recorded after implementing; none changes a requirement.

- **The private sighting method** is named `EncounterService.SightAsync(save, …)`. It takes the save, because research needs the save's creation time. It was renamed from `StartAsync` to avoid clashing with the public overload.
- **Stars:**
  - grid pictures show the stars in a small top corner, with empty stars dimmed so the level reads at that size
  - the accessible name of an identified picture is *{name} – Raziskano: {level}/3*
- **The manual check simulates time passing** by moving all of the test save's timestamps back in the development database (creation, observation, identification, research). Moving only the creation time would move the last research step's in-game time too.
