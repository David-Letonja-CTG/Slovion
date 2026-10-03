# Proposal

## Why

A species is identified in one go, and its *Terenski dnevnik* page then shows everything at once, so there is no reason to look at it again. The product vision describes information revealed step by step, with a research level. The owner chose:
- **Researching by observing again:** each later sighting of an identified species raises its research level, up to 3.
- **Existing sourced facts unlock by level.** No new facts are needed for the 23 species.

This is the first of the agreed next topics (deeper journal entries, habitats, weather, inventory).

## What Changes

- **Research levels:** identifying a species gives it level 1 of 3.
- **Observing it again** at its spot, as a wandering animal or in a search raises the level by one, at most once per in-game time of day. A sighting counts only if it happens on another in-game day or at another time of day than the last research step. Coming back to the same plant in the evening, or the next morning, counts; pressing E again at once does not. The server decides and stores the level (D3).
- **The journal reveals facts by level.** The server only sends what is revealed:

  | Level | Shows |
  |---|---|
  | 1 (identified) | picture, name, scientific name, family, identifying characteristics |
  | 2 | + habitat and distribution |
  | 3 | + the seasonal fact (*Čas cvetenja*, *Aktivnost* …) |

  Sources are always listed for the facts shown (D6).
- **Feedback:**
  - The message after a sighting says whether research advanced: *Raziskava napreduje: travniška kadulja (2/3).*
  - If it didn't, the message says when to come back: *… Več izveš, če jo opaziš ob drugem času dneva.*
  - A fully researched species gets its own message.
  - Identified pictures in the grid show the level (★★☆).
  - A species page shows the level and a hint where facts are still hidden.
- **Existing saves:** a migration gives every identified species level 1.

**Demo outcome:**
1. Identify the meadow sage in the morning; its page shows the name, family and characteristics (★☆☆).
2. Press E at the sage again: *Več izveš, če jo opaziš ob drugem času dneva.*
3. Come back in the evening: research advances to ★★☆, and the page now shows its habitat and distribution.

## Capabilities

### New Capabilities

- `species-research`: research levels, researching by observing again, facts revealed by level, research feedback.

### Modified Capabilities

- `naturedex`: identified entries carry their research level and only the revealed facts; the page shows the level.
- `identification`: interacting with an identified species reports whether its research advanced.

## Non-goals

- New species facts or sources.
- Research quizzes, research stations or rewards for research.
- Research for observed but unidentified species.
- Quest goals based on research.
- Field notes (where and when a species was seen).

## Impact

- **Database:** migration `AddResearch`, which adds `research_level` and `researched_at` to `discoveries`. Identified rows get level 1, researched at their identification time.
- **Server:**
  - `SpeciesDiscovery.Research(at, worldTime…)`
  - `EncounterService` (spot and search sightings of identified species)
  - `NatureDexService` filters facts by level
  - API: `researchLevel` on entries, `researched` on already-identified results
- **Client:**
  - the API types and the result messages
  - research stars in the grid
  - the page's level line and hidden-facts hint
  - translations
- **Tests:** domain, application (with a fake clock), integration (API and migration), client, and an E2E check of the "come back later" message.
