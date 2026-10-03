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
| Seasons | Spring, summer, autumn, winter; affect species availability (implemented: D8, `world-conditions`). |
| Time of day | Morning, day, evening, night; affects encounters. Deterministic and testable (implemented: D8). |
| Weather | Per region, drawn over the map; widens availability where sourced (implemented: D11, `weather`). |
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
| 3a | `add-species-identification` | Four more sourced species, clue-based identification with candidates (D1), *Terenski dnevnik* stages (observed → identified). |
| 3b | `add-habitat-search` | Searching habitat patches, habitat-based seeded random encounters and rarity. |
| 4 | `add-first-quest` | One NPC with dialogue, quest "observe 3 meadow species", progression flag unlocking a new path. |

Steps 1–4 are implemented (see `openspec/changes/archive/`). Step 4 asks the player to *identify*, not just observe, three species (owner decision), and its new path leads into a hedgerow with two new species (`add-hedgerow-species`).

## Roadmap — after the first slice

Implemented:

| Change | Demonstrates |
|---|---|
| `add-naturedex-habitat-grid` | *Terenski dnevnik* as a picture grid per habitat. |
| `add-world-conditions` | In-game clock, times of day and seasons (D8) deciding which species are around. |
| `add-areas-clock-and-torch` | Named places with a banner, a corner clock, and a torch at night. |
| `add-moving-animals` | Animals wander and react to the torch; trees, grass and Vera move. |
| `add-regions-and-travel` | Kočevje, Pohorje and Triglav, reached through a signpost's travel map. |
| `add-region-species` | Animals, flowers and trees per region; trees can be searched. |
| `add-region-quests` | A person and a quest per region; the quests open the regions in turn (a journey). |
| `add-species-research` | Research levels: seeing a species again at other times reveals more of its journal page. |
| `add-weather` | Weather per region, drawn over the map; salamanders come out in the rain. |
| `add-field-tools` | A bag of field tools from quests: lamp, binoculars, magnifier, rubber boots. |
| `add-installable-app` | An installable app (PWA) that opens without a connection and offers new versions. |

Next candidates, each as its own change once the owner chooses:

1. **More habitats:** e.g. wetland, river, cave, coast, town.

Later candidates: research stations, offline play (needs D3 revisited), English, accounts/cloud save.

## Capabilities (OpenSpec specs)

First slice: `localization`, `game-viewport`, `input-actions`, `game-session`, `world-exploration`, `species-catalog`, `discovery`, `identification`, `naturedex`, `quests`, `player-progress`.

Added since: `habitat-search`, `world-conditions`, `map-areas`, `wildlife`, `regions`.

Later: `research-stations`.
