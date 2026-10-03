# Design

## Context

What exists after `add-regions-and-travel`:
- Kočevje, Pohorje and Triglav each have one map with a single area, one resident animal (bear, wolf, chamois), and a habitat (*Jelovo-bukov gozd*, *Gorski gozd*, *Visokogorje*) that lists only that animal.
- The region maps have no habitat zones, because searches only find plants (D8 availability applies).
- Content validation covers species, pictures, walk sprites, habitats, zones, spots and maps. The engine draws any decor tile and animates residents from animal spots.

So this change is mostly content: species, art and map data. The one code change is the owner's request that trees can be searched like tall grass (section 5). No server or client code is expected to change.

Motivation: see proposal.md. Requirements: the three spec deltas.

Approved by the project owner on 2026-10-03, with the request that trees can be searched like tall grass; trees and shrubs became species for that.

## Goals / Non-Goals

**Goals:**
- Every region gives something to find by searching and by walking: one more animal, two ground plants, and its trees or shrubs.
- Trees can be searched like tall grass, and what they reveal is the tree itself or another plant of the habitat.
- Every new fact is sourced (D6), preferring the Slovenian sources used so far: LZS, zdravgozd.si, TNP (*Triglavska zakladnica*), protected-area and park sites, and GBIF for names.
- Availability follows the existing rules: plants count while they flower; animals use seasons and times of day only where a source states them.

**Non-Goals:** see proposal.

## Decisions

### 1. Species

| ID | Group | Name | Planned availability (if sourced) | Torch |
|---|---|---|---|---|
| `cervus_elaphus` | mammal | *jelen* | all year | `shy` |
| `allium_ursinum` | plant | *čemaž* | flowering, spring | — |
| `galium_odoratum` | plant | *dišeča lakota* | flowering, spring–summer | — |
| `sciurus_vulgaris` | mammal | *navadna veverica* | all year, by day | `curious` |
| `drosera_rotundifolia` | plant | *okroglolistna rosika* | flowering, summer | — |
| `vaccinium_myrtillus` | plant | *borovnica* | flowering, spring–summer | — |
| `marmota_marmota` | mammal | *alpski svizec* | not in winter (true hibernation), by day | `shy` |
| `leontopodium_nivale` | plant | *planika* | flowering, summer | — |
| `potentilla_nitida` | plant | *triglavska roža* | flowering, summer | — |
| `abies_alba` | plant | *navadna jelka* | all year (a tree) | — |
| `fagus_sylvatica` | plant | *navadna bukev* | all year (a tree) | — |
| `picea_abies` | plant | *navadna smreka* | all year (a tree) | — |
| `pinus_mugo` | plant | *rušje* | all year (a shrub) | — |

- **Names:** the edelweiss's stable ID follows GBIF's accepted species, *Leontopodium nivale*. Its scientific name fact gives the subspecies (*subsp. alpinum*) if a source names it.
- **Trees and shrubs:** they are present all year. Their availability uses the existing rule's "presence period", backed by sources that describe them as long-lived trees or shrubs. Ground plants keep counting only while they flower.
- **Gaps:** if a fact cannot be sourced, it is left out or the availability is widened to all seasons or times. If a whole species cannot be sourced well, I'll raise it rather than invent anything.
- **Torch reactions:** gameplay data, for owner review.

### 2. Art

- **Pictures:** original 32×32 pixel art for all nine, drawn by script as before.
- **Walk sprites:** 32×16 for the deer, squirrel and marmot.
- **Plant tiles:** tileset row 5 (tiles 40–45) gets one decor tile per ground plant, drawn over a transparent background so they sit on any ground. The three maps' embedded tileset entries grow to 48 tiles (the meadow's too, so that all maps share one tileset definition).

### 3. Maps

Each region map gains, without changing its layout:
- **habitat zones** on walkable ground:
  - Kočevje: the forest floor north and south of the path
  - Pohorje: the bog's grassy edge and the forest floor
  - Triglav: the alpine grassland

  Zones include the trees, shrubs, rocks and bog pools within them, so these can be searched from outside. Zones don't cover the spawn, the signpost's tile or the path between them, so the player can still read the signpost without starting a search. Zones of one map don't overlap (existing rule).
- **one fixed spot per ground plant,** on a walkable tile with the plant's decor tile, reachable from the spawn. Trees and shrubs have no spots; they are found by searching.
- **one resident spot for the new animal,** in open ground away from the signature animal's home

### 4. Habitats

Each region habitat lists its animals (for the journal) and its plants with weights. Searches only ever find the plants. Planned fictional values:

| Habitat | Search chance | Weights |
|---|---|---|
| `fir_beech_forest` | 60 % | wild garlic 40, sweet woodruff 30, silver fir 15, beech 15 (bear and deer 1 each) |
| `mountain_forest` | 60 % | bilberry 40, Norway spruce 35, sundew 25 (wolf and squirrel 1 each) |
| `alpine_grassland` | 50 % | edelweiss 35, *triglavska roža* 35, mountain pine 30 (chamois and marmot 1 each) |

Only plants available at the save's time are drawn (existing rule), so outside summer the Triglav search finds mountain pine.

### 5. Searching at trees

- **Engine rule:** `World.interact` gains a step before the standing-in-zone search. If the faced tile is blocked and inside a habitat zone, it emits `{ kind: 'search', mapId, x, y }` with the faced tile.
- **"Blocked"** means the map's collision, not NPCs, residents, gates or the signpost. Those are matched earlier in the precedence or aren't in zones.
- **The server needs no change:** `POST /api/save/searches` already takes any tile and looks up its habitat zone (D3: the client is trusted for its position).
- **Facing walkable zone ground from outside does not search** (existing behaviour and test kept). Walkable ground is searched by standing on it.
- **Meadow effect:** the hawthorn bushes inside the hedgerow zones become searchable. This is consistent, and needs no content change.

### 6. Tests

- **Content:** a test for each of the nine species (group, name, clues, picture, sprite and traits); the region habitats' entries and orders; and zones and spots on the region maps through `FindHabitatAt` and `FindSpot`.
- **Engine:** searching a faced tree in a zone, not a faced tree outside zones, not faced walkable zone ground; the region map tests also check that every spot is reachable from the spawn and that the spawn, the signpost's neighbour and the path lie in no habitat zone.
- **E2E:** after travelling to Pohorje (unlocked through API identifications), search a zone tile next to the spawn until something is found, and identify it.
- **Existing tests:** NatureDex and habitat-order tests are updated for the new species counts.

## Risks / Trade-offs

- **[Few finds on Triglav outside summer]** Both alpine flowers bloom in summer only. Outside summer the search finds mountain pine, and the marmot and chamois are there.
- **[Thirteen sourced species in one change]** Larger than earlier content changes. The research is the main effort; the code effort is small.
- **[Protected plants]** The sundew, edelweiss and *triglavska roža* are protected in Slovenia. The game only lets the player observe and identify (D2), and a fact about their protection is included if the sources state it.

## Implementation notes and deviations

Recorded after implementing; none changes a requirement.

- **Names:** *navadni jelen* and *navadna borovnica* (not *jelen* and *borovnica*), as the sources name them. The spec table follows.
- **Sources:**
  - Botanični vrt Univerze v Ljubljani for every plant's name, family, range and flowering months
  - TNP's *Triglavska zakladnica* (deer, squirrel, marmot, edelweiss, *triglavska roža*)
  - LZS (squirrel, marmot) and zdravgozd.si (deer, squirrel)
  - Notranjski regijski park (čemaž, beech)
  - Lekarne Maribor (sundew), Biotehniški center Naklo (sweet woodruff), pater-simon-asic.si (bilberry)
  - the Slovenian Wikipedia for the trees' and the mountain pine's descriptions
  - GBIF for scientific names
- **Availability as built:**

  | Species | Seasons | Times | Source says |
  |---|---|---|---|
  | deer | all | evening, night | mostly active at night and at dusk (zdravgozd.si, TNP) |
  | squirrel | all | morning, day, evening | active by day, does not sleep through the winter (LZS, TNP) |
  | marmot | spring–autumn | morning, day, evening | a day animal that sleeps through the winter (LZS, TNP) |
  | edelweiss | summer, autumn | all | flowers July–September |
  | wild garlic | spring | all | flowers April–May |
  | sweet woodruff and bilberry | spring, summer | all | flower April–July |
  | sundew and *triglavska roža* | summer | all | flower in summer |
  | trees, mountain pine | all year | all | — |

- **Weights:**
  - forest: wild garlic 40, sweet woodruff 30, fir 15, beech 15
  - mountain forest: bilberry 40, spruce 35, sundew 25
  - alpine: edelweiss 35, *triglavska roža* 35, mountain pine 30
- **Search zones:**
  - Kočevje: forest north (y 1–7) and south (y 11–18)
  - Pohorje: forest north, a small west forest beside the path (x 3–6, y 5–8), the bog with its grassy edge, forest east and south. The west forest makes the spruce at (5, 8) searchable from the path at (5, 9).
  - Triglav: grassland north, middle and south
- **Spots:**

  | Region | Ground plants | Animal |
  |---|---|---|
  | Kočevje | wild garlic (5, 12), sweet woodruff (13, 4) | deer (12, 15) |
  | Pohorje | sundew (9, 7), bilberry (2, 12) | squirrel (21, 4) |
  | Triglav | edelweiss (6, 4) and *triglavska roža* (13, 3), both on scree | marmot (9, 12) |
