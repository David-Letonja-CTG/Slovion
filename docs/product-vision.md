# Slovion — Product Vision

## Identity

Slovion (working title) is an original 2D exploration RPG set in a fictionalized Slovenia, inspired by the *structure and feel* of classic handheld creature-collection RPGs — but an original IP. Nothing from Pokémon (characters, names, creatures, sprites, maps, music, dialogue, data, ROM assets, proprietary mechanics) may be used, copied or closely imitated.

Trademark/name availability for "Slovion" must be checked separately before public release.

## Core concept

Instead of fictional monsters, the player discovers **real Slovenian nature**: animals, birds, insects, amphibians, reptiles, fish, plants, trees, flowers, fungi and other organisms. Discoveries are recorded in the **NatureDex** (internal name, see `decisions.md` D10).

Core loop: **Explore → Discover → Identify → Learn → Collect (observations) → Progress → Explore further**

The game must first be **fun to play**. Learning is woven into exploration, discovery, quests and progression — it must not feel like a school application. There is no combat and no capture (D2).

## World

A fictionalized RPG version of Slovenia with recognizable regional character, not an exact GIS map. Candidate regions: Alps, Gorenjska, Ljubljana Basin, Štajerska, Pohorje, Dravsko polje, Prekmurje, Dolenjska, Notranjska, Kras, the coast. Regions are added one at a time.

No GPS: the player's real location never affects gameplay.

## Systems (eventual)

| System | Notes |
|---|---|
| NatureDex | Per species: Slovenian and scientific name, sprite, habitat, region, season, time of day, identification characteristics, facts, discovery/identification status, research level. Information is revealed gradually: unknown → observation → discovery → identification → entry → further research. |
| Habitats | Forest, meadow, wetland, river, lake, mountain, cave, coast, field, urban. Data-driven, never hardcoded into maps. |
| Seasons | Spring, summer, autumn, winter; affect species availability. Not before a spec exists. |
| Time of day | Morning, day, evening, night; affects encounters. Deterministic and testable. |
| Weather | Affects encounters, visuals, quests, activity. Deterministic for tests. Not over-engineered. |
| Research stations | Original progression milestones built on observation challenges (trees, tracks, amphibians, alpine plants, birds, mushrooms). Not gym copies. |
| Quests, inventory, progression | Introduced only when a slice needs them. |

## Educational model

Real-world data (names, habitat, distribution, characteristics, diet, activity, seasonality, conservation) is strictly separated from gameplay data (rarity, difficulty, research level, requirements, rewards). Real-world data is sourced (D6); gameplay data is fictional and never presented as fact.

## Platforms and language

- Windows PC, Android, iOS — initially as a responsive web app / PWA; native wrappers only on concrete need.
- Primary language **Slovenian (`sl-SI`)** for all player-facing content; architecture ready for more languages (e.g. English).
- Audience: all ages. No personal data collected (D5).

## First playable experience

The player can:

1. Start a new game.
2. Enter a small Slovenian environment (Dravsko polje meadow).
3. Walk around and interact with the environment.
4. Discover a real Slovenian species and identify it.
5. Open the NatureDex and read Slovenian information about it.
6. Continue exploring and complete a small quest.
7. Save, reload, and retain progress.

## Roadmap — first vertical slice

Each step is one OpenSpec change and ends with something demonstrable.

| # | Change | Demonstrates |
|---|---|---|
| 1 | `bootstrap-solution` | Solution skeleton, Angular shell with sl-SI localization, framework-free engine drawing a scaled canvas, Postgres, CI. No gameplay. |
| 2 | `add-meadow-walking-skeleton` | New game → walk a small meadow with collision → interact with one species spot → server records discovery → NatureDex shows it in Slovenian → reload keeps it. |
| 3 | `add-habitat-discovery-and-identification` | 4–6 sourced species, habitat-based seeded encounter rolls, clue-based identification (D1), progressive NatureDex reveal. |
| 4 | `add-first-quest` | One NPC with dialogue, quest "observe 3 meadow species", progression flag unlocking a new path. |

Later candidates: world conditions (season/time/weather), inventory, research stations, additional regions, offline support, accounts/cloud save.

## Capabilities (OpenSpec specs)

First slice: `localization`, `game-viewport`, `input-actions`, `game-session`, `world-exploration`, `species-catalog`, `discovery`, `identification`, `naturedex`, `quests`, `player-progress`.

Later: `world-conditions`, `inventory`, `research-stations`, `regions`.
