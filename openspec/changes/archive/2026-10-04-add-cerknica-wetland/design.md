# Design

## Context

What exists today:
- Regions, habitats, species, NPCs, quests, areas and maps are content files. Content validation covers all of them, and the engine needs no code for a new region.
- The journey ends with Luka's quest on Triglav. Its reward flag `alps_explored` opens nothing yet.
- The tileset has 48 tiles (8 × 6). Tiles 46–47 are the wadeable stream, which a player with the boots can enter. Residents never enter wadeable tiles.
- Every player who reaches Triglav has the boots (Maja's reward).
- Notranjski regijski park's encyclopedia (`notranjski-park.si/odkrijte/enciklopedija/…`) has pages for every planned species. The three park pages we already cite redirect there from their old addresses.

The owner chose Cerkniško jezero, opened after Luka's quest, with shallows crossed using the boots.

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the five spec deltas.

## Goals / Non-Goals

**Goals:**
- A fifth region that plays differently: water to wade, a hidden bird to search for, species on an islet.
- Content only. No engine, client or API code.

**Non-Goals:** see proposal.

## Decisions

### 1. Species and sources (D6)

- **Primary source:** the park's encyclopedia page for each species, cited as one source entry per page, accessed when written. Each fact is paraphrased from page text checked with the exact wording.
- **Scientific names:** GBIF backbone, as for the other species.
- **Families and flowering months:** the park pages give few of them. They come from other sources already used, such as Botanični vrt UL, or from sl.wikipedia and GBIF where nothing else states them.
- **Availability**, following the existing rules (restrict only where a source says so):

  | Species | Planned availability | Source wording (park pages) |
  |---|---|---|
  | `ardea_cinerea` | all year | "v Sloveniji videvamo preko celega leta" |
  | `crex_crex` | spring, summer; evening and night | returns in spring, "gnezdi od maja do avgusta", leaves "zgodaj jeseni"; "čez dan nerad pokaže", feeds "v mraku" |
  | `hyla_arborea` | spring, summer, autumn | wakes from hibernation in spring, changes colour in summer and autumn |
  | `calopteryx_splendens` | spring, summer, autumn | flies "proti koncu aprila … vse do oktobra" |
  | the three plants | their flowering months, if a source states them | otherwise no limit (as with the swallowtail) |

  The final wording and any deviation are recorded in the implementation notes.
- **Wildlife traits** (fictional): heron `shy`, corncrake `shy`, tree frog `calm`, demoiselle `calm`.
- **Clues:** three characteristics each, from the park page's description of appearance.

### 2. The map `cerknica_lake` (26 × 20, like the other regions)

```text
north: forest edge (blocked)
  spawn (1, 9), signpost beside it, Neža at (3, 10); the shore path runs east
  wet meadow (searchable zone) north of the path: Siberian iris spot, the corncrake
  reed belt (blocked reeds inside the zone, searchable from the shore): yellow iris spot at its edge, tree frog
  shore: the heron
  shallows (wadeable stream tiles, inside the zone): white water lily spot 2+ tiles out
    a small islet in the shallows (walkable ground): the demoiselle
south: deep open water (blocked, not wadeable)
```

- **Wading:** the lily's spot is at least two tiles into the shallows, so it can only be faced from a wadeable tile. The islet is surrounded by shallows.
- **Zones:** one or more `wetland` zones cover the wet meadow, the reeds and the shallows. They don't cover the spawn, the signpost or the path between them (existing rule).
- **Area:** one area, `cerknica_lake` (*Cerkniško jezero*), covers every walkable tile.

### 3. Art (placeholder, original pixel art)

- **Tileset row 6 (tiles 48–55):**
  - 48: deep water, with 49 its ripple frame (600 ms)
  - 50: reeds (blocked)
  - 51: wet meadow ground
  - 52: yellow iris decor; 53: Siberian iris decor
  - 54: white water lily decor (lily pads, drawn over the shallow-water tile)
  - 55: muddy shore edge
- **Tileset size:** every map's embedded tileset entry grows to 56 tiles, with an image of 128 × 112, so all maps share one definition.
- **Pictures and sprites:** 32 × 32 pictures for the seven species and two-frame walk sprites for the four animals. Neža gets a four-facing NPC sheet.

### 4. Region, habitat, quest, NPC, weather

- **Region file `cerknica`:**
  - map `cerknica_lake`, order 5
  - position (30, 75), from the lake's real coordinates on the same scale as the other regions
  - unlock `{ "flag": "alps_explored" }`
  - locked hint *Pomagaj Luki na Triglavu.*
- **Weather weights** (fictional): rain and fog are more frequent in spring and autumn, and fog in winter. Snow appears only in winter (the weather spec's rule).
- **Habitat `wetland`:**
  - name *Mokrišče*, order 6, search chance 55%
  - weights: plants 20–25, animals 1–2 (fictional). Searches find only plants (existing rule); the animals are listed for the journal and the quest.
- **NPC `neza`:** *Neža*, a birdwatcher. Dialogue addresses the player without gendered forms.
- **Quest `vanishing_lake`:**
  - title *Presihajoče jezero*
  - goal: 3 species of `wetland`
  - reward flag `lake_explored`; no tool
  - the `ready` and `completed` lines close the journey
  - quest texts state no species facts beyond the sourced ones (existing rule)
- **Luka:** his `offer`, `ready` and `completed` lines stop saying the journey ends at Triglav and point to the lake. His quest's goal and reward are unchanged.

### 5. Tests

- **Content:**
  - the repository region, habitat, quest and seven species
  - the map's zones, spots and person (existing generic tests cover most of this)
- **Engine:**
  - **Map tests** (`tiled.spec.ts`): Neža at (3, 10); every spot reachable with the boots; the lily and demoiselle spots unreachable without them.
- **Integration:** a new save has four locked regions; after Luka's quest Cerkniško jezero is open; travelling there works.
- **Client:** the travel map lists five regions in the fixtures where it counts them.
- **E2E:** none added. The existing travel test covers the mechanism.

## Risks / Trade-offs

- **[The corncrake is rarely seen]** Its sourced availability (late spring and summer, evening and night) keeps it out of sight most of the time, as its sources describe.
- **[Plant flowering months]** If no reliable source gives them, the plants have no season limit, as with the swallowtail.
- **[Content volume]** Seven species, four sprites, a tileset row and a map make this the biggest content change so far. It ships as one PR because the quest needs the habitat and the habitat needs the species.

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the five spec deltas. Each scenario is covered by a content, integration or engine test. No non-goal was touched: no seasonal lake, no new tools or mechanics, no deep-water access, one area, and no engine, client or API code.

- **The corncrake lives in the wet meadow; it isn't found by searching.** The approved proposal said "only by searching", but the existing `habitat-search` rule finds only plants (animals are met). The manual check showed it: 60 searches, no corncrake. The owner chose a resident spot (2026-10-04). Its sourced availability keeps it rare: late spring and summer, at dusk and at night. Proposal, design and the `world-exploration` delta were corrected to match. Its habitat weight is 1, like the other animals.
- **Sources** (all read on 2026-10-04):
  - **Park pages:** the plants' families and flowering months: "Družina: perunikovke (Iridaceae) / lokvanjevke (Nymphaeaceae)", "Čas cvetenja: maj–junij" for both irises and "junij–september" for the lily.
  - **Animal families:** the park's group names (Čaplje, Tukalice, Drevesne žabe ali rege, Bleščavci) with the Latin family from GBIF.
  - **DOPPS:**
    - corncrake numbers: "V Sloveniji gnezdi med 300 in 400 koscev … sledijo Cerkniško jezero"
    - corncrake months: "pri nas od maja do avgusta"
    - heron distribution: "najpogostejša vrsta čaplje … na skoraj vsaki večji reki ali mokrišču"
  - **sl.wikipedia:** the demoiselle's distribution ("razširjen in zelo pogost po večini Evrope").
- **Corrected wording:** the heron's season first said it nests "pogosto v kolonijah". The park page says that in Slovenia it mostly nests in small groups or alone, so the fact now names only the months and the nest site.
- **Availability as built:**

  | Species | Availability |
  |---|---|
  | heron | all year ("v Sloveniji videvamo preko celega leta") |
  | corncrake | spring and summer, evening and night ("poje predvsem ponoči"; "čez dan se nerad pokaže") |
  | tree frog | spring to autumn, any time |
  | demoiselle | spring to autumn ("proti koncu aprila … vse do oktobra") |
  | irises | spring and summer |
  | water lily | summer and autumn |

  The tree frog has no time limit: the page says adults are active by day, but also that they mate after sunset.
- **No trees in the wet meadow.** The tree tiles have an opaque grass background that showed as squares on the wet meadow ground. The reeds are the zone's searchable blocked tiles.
- **The client's travel-map fixtures** needed no change; they don't depend on the repository's regions.
- **Manual check** (summer evening on a save with Maja's and Luka's quests done):
  - before Luka, the lake is locked with *Pomagaj Luki na Triglavu.*; travel works after
  - Neža's offer dialogue
  - wading through the gap in the reeds into the shallows, and the water lily encounter from the shallows
  - the demoiselle on the islet, and the corncrake in the meadow at dusk
  - three wetland species complete *Presihajoče jezero*, with flag `lake_explored` and Neža's closing lines
