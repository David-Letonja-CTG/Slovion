# Proposal

## Why

Research levels (★☆☆ → ★★★) reward observing a species again at other times, but nothing asks the player to finish them. The product vision plans research stations as original progression milestones built on observation challenges. The owner chose:
- **Challenge:** a station's challenge is to fully research a themed set of species.
- **Reward:** finishing it gives a certificate in *Terenski dnevnik*.
- **Placement:** one station per region.

These are not gym copies: no leaders, battles or badges. The player's own observations in the field are the challenge.

## What Changes

- **Five research stations,** one per region, each a small field station (a tile object on the map like the signpost):

  | Region | Station | Theme | Species | Goal |
  |---|---|---|---|---|
  | Dravsko polje | `meadow_station` | *Travniki in mejice* | meadow sage, dandelion, hawthorn, Siberian iris | 3 of 4 at ★★★ |
  | Kočevje | `forest_station` | *Gozdna drevesa* | silver fir, beech, Norway spruce | 3 of 3 |
  | Pohorje | `mammal_station` | *Sesalci* | brown hare, brown bear, red deer, wolf, red squirrel, chamois, alpine marmot | 4 of 7 |
  | Triglav | `mountain_station` | *Gorski svet* | edelweiss, *triglavska roža*, *rušje*, alpine salamander | 3 of 4 |
  | Cerkniško jezero | `bird_station` | *Ptice* | skylark, red-backed shrike, grey heron, corncrake | 3 of 4 |

  A list may include species from other regions, so finishing a station means travelling. Goals are fictional gameplay values (D6).
- **At a station** (face it and press `Interact`), a dialog shows:
  - the station's name and theme
  - its species with their pictures and research stars; species not yet identified appear as silhouettes
  - the progress, e.g. *Popolnoma raziskane vrste: 2 od 3*
  - once complete, that the certificate is in the journal
- **Certificates (*potrdila*):** a new *Potrdila* page in *Terenski dnevnik* lists each finished station with its theme and the species researched.
- **New certificate notice:** when a sighting completes a station's goal, a notice appears: *Novo potrdilo: …*.
- **Server:**
  - station content files and their validation
  - `GET /api/save/stations`: every station with the save's progress
  - completion is derived from research levels, which are already stored, so there is no new table
- **Art:** one new tile, a field-station board (placeholder, original).

**Demo outcome:**
1. Read the station next to the Kočevje path: three trees, none researched.
2. Observe the fir, the beech and the spruce at different times until each has ★★★. The notice *Novo potrdilo: …* appears.
3. *Terenski dnevnik → Potrdila* shows the forest station's certificate.

## Capabilities

### New Capabilities

- `research-stations`: station content, placement, progress, the station dialog, certificates and their notice.

### Modified Capabilities

- `world-exploration`: maps may place stations; interacting with a station opens it; stations block movement.

## Non-goals

- Rewards with gameplay power (tools, unlocks), ranks or titles.
- Knowledge questions or harder identification at stations.
- Station people (NPCs) or dialogue trees; a station is a board with a dialog.
- Stations that need a quest or flag to use.
- New species.

## Impact

- **Content:**
  - `content/stations/<id>.json` (five)
  - a `station` object on each region map
  - the tileset's new row 7, with every map's embedded tileset entry growing to 64 tiles
- **Server:**
  - Domain: `Station`.
  - Content: loading and validation.
  - Application: station progress from discoveries.
  - API: `GET /api/save/stations`.
- **Engine:** station objects in the map parser; a station step in the interaction rule; stations block movement.
- **Client:**
  - the station dialog
  - the *Potrdila* page in *Terenski dnevnik*
  - the new-certificate notice
  - translations
- **Tests:**
  - domain, application, content and integration tests
  - engine tests for parsing, interaction and blocking
  - client tests for the dialog, page and notice
  - an E2E check of a station dialog
