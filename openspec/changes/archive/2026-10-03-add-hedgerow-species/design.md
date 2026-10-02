# Design

## Context

Builds on:
- **`add-habitat-search`:** habitats as content, zones in maps, server-side search rolls.
- **`add-naturedex-habitat-grid`:** journal sections per habitat, species pictures, the rule that every species belongs to a habitat.

Species content follows the existing format (`content/species/<id>.json`): every fact sourced, three clues, and a 32×32 picture. The meadow map is a closed 32×20 map with a hedge border.

Motivation: see proposal.md. Requirements: the four spec deltas.

Relies on these decisions:
- **D6:** sourced facts, fictional gameplay values.
- **D7:** content as files.
- **D10:** original art.

The owner already decided the area and its two new species when choosing the quest reward.

Approved by the project owner on 2026-10-02.

## Goals / Non-Goals

**Goals:**
- Two correct, sourced, reviewable species entries.
- A hedgerow area that feels like a reward once opened.
- Journal sections in a sensible order.

**Non-Goals:** see proposal.

## Decisions

### 1. Species

| ID | Group | Slovenian name | Why it fits |
|---|---|---|---|
| `crataegus_monogyna` | plant | *enovrati glog* | A common thorny shrub of hedgerows and forest edges. *Navadni glog* is a different species (*C. laevigata*), so the name matters. |
| `lanius_collurio` | bird | *rjavi srakoper* | A bird of meadows with thorny hedgerows. It nests in shrubs such as hawthorn and is present on Dravsko polje. |

**Facts:** facts are researched during apply from Slovenian sources first. Candidates:
- Notranjski regijski park (already used for the sage)
- DOPPS / ptice.si
- drava-natura.si (Drava region)
- Wikipedija sl
- GBIF, for the scientific name and family

Each fact names its sources. A fact goes in only if a source states it; anything a source doesn't support stays out.

**Clues:** the three clues per species are the most recognizable sourced characteristics, chosen so the two species can't be confused with the existing five:
- hawthorn: deeply lobed leaves, white five-petalled flowers in clusters, red fruit with a single stone
- shrike: the male's grey head with a black eye mask, the reddish-brown back, the habit of impaling prey on thorns

The final choice depends on what the sources support.

**Season fact:** this is the *Čas cvetenja* of the hawthorn and the *Prisotnost v Sloveniji* of the shrike, a summer visitor. Both are taken from the sources.

### 2. Pictures and tiles

These are generated with the same throwaway pixel-art approach and palette as the existing art:
- **`crataegus_monogyna.png`:** a twig with lobed leaves, white blossom and red haws.
- **`lanius_collurio.png`:** a male perched side-on, with a grey head, black mask and rufous back.
- **Tileset:** `meadow.png` gains one row of 8 tiles. Two are hawthorn shrubs (blocking, one with blossom); the remaining slots stay transparent for `add-first-quest`, which needs a gate and an NPC.

The owner reviews all of the art in the PR.

### 3. Habitat order

Habitat files gain a required `order` (a positive integer). `Habitat` (domain) gets `Order`. `IContentCatalog.AllHabitats` sorts by order, then by ID; previously it sorted by ID only. Equal orders are allowed and fall back to ID order. Values:
- `tall_grass`: 1
- `hedgerow`: 2

### 4. Habitat `hedgerow` (gameplay data, for owner review)

`content/habitats/hedgerow.json`:
- name *Mejica*
- order 2
- search chance **60 %**
- weights: `lanius_collurio` **60**, `crataegus_monogyna` **40**

The hawthorn is also a fixed spot, so the bird is the more common search find.

### 5. Map extension

The meadow map grows from 32×20 to **32×28** by adding rows at the bottom. A script edits the Tiled JSON and appends to every tile layer, so existing tiles and object positions stay unchanged.

| Rows | Content |
|---|---|
| 19 | The existing southern border hedge. It stays fully blocking, which keeps the strip closed. `add-first-quest` places its gate here at x 20. |
| 20–26 | The hedgerow strip, laid out below. |
| 27 | A new blocking hedge border. |

The strip contains:
- grass ground
- a dirt track from x 20 (below the future gate) down to row 23, then running east–west along row 23
- hawthorn shrubs (blocking) scattered along rows 21 and 25
- a hawthorn spot `hedgerow_hawthorn_1`, on a shrub next to the track
- habitat zones of `hedgerow` covering the grass beside and between the shrubs. The track stays outside the zones, as on the meadow, and the zones don't overlap.

The exact tiles are drawn during apply. Both parsers' tests check the zone tiles of the new strip.

The strip is unreachable, but a curious player can still see it over the hedge: the camera shows the whole map within its bounds, so walking to the south edge reveals it. This is intended as a teaser.

### 6. Tests that change

| Area | Change |
|---|---|
| Content validation | the repository test also checks the hedgerow species, habitat, order and zones; new broken-content cases: missing order, non-positive order |
| Application | `NatureDexService` ordering by order, then ID (the fake catalog habitats get orders) |
| Integration | the fresh save sees two sections, in order (`NatureDexTests`) |
| Client | tests that load the real meadow JSON keep working: they assert behaviour, not size. The tiled parser test asserts the new size and the hedgerow zone. |
| E2E | the identification path checks the *Mejica 0/2* section; the walking paths are unchanged, because the spawn and the meadow stay where they are |

## Implementation notes (review, task 4.4)

**Facts:** I checked every fact against the source text, fetched on 2026-10-02.

| Species | Sources | How they are used |
|---|---|---|
| Hawthorn | Notranjski regijski park; GBIF; Wikipedija sl | Notranjski regijski park supports every fact. GBIF supports the scientific name and family. Wikipedija sl confirms only the name *enovrati glog*; its other figures weren't used, because the fetched text was unreliable. |
| Shrike | Notranjski regijski park; DOPPS (*Ptice Slovenije – Srakoperji*); Drava Natura 2000; GBIF | Every fact is backed by one or more of these. The impaling habit is stated by both DOPPS and Drava Natura 2000. |

The wording paraphrases the sources. One phrase was tightened so it adds nothing a source doesn't say: the hawthorn's distribution no longer says it *prefers* poor soils.

**Clues:**
- hawthorn: lobed leaves, then white flower clusters, then the single-stone red fruit
- shrike: perching and hunting insects, then the male's mask and colours, then impaling prey on thorns

The shrike's length (16–18 cm) is a characteristic but deliberately not a clue, because the skylark's length is the same.

**Map:**
- The strip has a track from x 20 down to row 23, then running along row 23 from x 2 to 29.
- There are 12 hawthorn shrubs in rows 21 and 25, half with blossom and half with haws. The shrub at (13, 21) is the spot.
- The three zones are `hedgerow_west`, `hedgerow_east` and `hedgerow_south`, plus a few wild-flower decor tiles.
- I checked that the original 32×20 tile data and objects are unchanged.

**Tileset:** row 3 holds the hawthorn with blossom (index 16) and with haws (index 17). Indices 18–23 stay transparent for `add-first-quest`.

**Tests:**
- The client test "every spot is reachable" became "every meadow spot is reachable", plus a new test that no tile of the strip or the southern hedge can be reached from the spawn. That test covers the *closed off* scenario.
- The E2E identification path checks *Mejica 0/2*.

**Manual check:** at 1280×720 the journal shows *Visoka trava 0/5* and then *Mejica 0/2*. From the southern hedge the strip is visible and blocked. There were no console errors.

No non-goal was touched.

## Risks / Trade-offs

- **Too few good sources for a fact:** that fact is left out. If a clue can't be sourced, a different sourced characteristic is used. If either species can't be sourced well enough, apply pauses and proposes another hedgerow species. Candidates are *črni trn* (blackthorn) and *repaljščica* (whinchat).
- **A visible area that can't be reached** may confuse players until `add-first-quest`. This is accepted, because the two changes ship close together, and the journal's *Mejica 0/2* explains it.
- **Map growth** makes the camera able to scroll further south. The camera already clamps to map bounds, so nothing changes in the engine.

## Open Questions

None. The facts, pictures, tiles and gameplay values are reviewed by the owner in the PR.
