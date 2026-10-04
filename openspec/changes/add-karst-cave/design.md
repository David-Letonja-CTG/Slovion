# Design

## Context

What exists today:
- **Darkness and the torch:** the time-of-day tint, and the torch circle in the evening and at night, live in the renderer. The torch is a client-side switch.
- **Torch reactions:** residents react to a lit torch in the evening and at night.
- **Areas:** area zones are map rectangles naming an area. The world reports area changes (the place banner), so it always knows the player's current area.
- **Water:** residents treat wadeable tiles as blocked, and players with the boots wade through them.
- **Wildlife traits:** a torch reaction only. The wildlife response carries it to the client.
- **The journey:** it ends with Neža's quest; its flag `lake_explored` opens nothing yet.
- **Research stations:** every region map has one, as the `world-exploration` spec requires.
- **The tileset:** 112 tiles after the art pass.

The owner chose a karst cave, opened after Neža's quest.

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the nine spec deltas.

## Goals / Non-Goals

**Goals:**
- One region with a daylit gorge and a dark cave on one map, so the lamp matters underground.
- Two small, reusable engine rules: `underground` areas and `aquatic` residents.

**Non-Goals:** see proposal.

## Decisions

### 1. Underground areas

- **Marking:** an area zone in Tiled gets the boolean property `underground`.
  - Engine: the map parser reads it into `AreaZone.underground`. `World.isUnderground` is true while the player's tile lies in such an area.
  - Server: area zones are validated as today, plus the property must be a boolean.
- **Renderer:**
  - while `isUnderground`, the tint is `CAVE_TINT`, darker than the night tint
  - the torch circle is drawn as at night
  - the weather overlay is skipped
- **Residents:** they react to the torch while it is evening, night, or the player is underground. A residents' "dark" check gains the underground case.
- **Not affected:** encounters, the clock and the server's weather are unchanged (D3: darkness is presentation and client-side behaviour only).

### 2. Aquatic residents

- **Content:** a species' wildlife traits become `{ "torch": "shy", "aquatic": true }`. `aquatic` is an optional boolean, false by default. Validation rejects non-booleans.
- **Server:** `WildlifeTraits(Torch, Aquatic)`. `GET /api/save/wildlife` adds `aquatic` to each resident.
- **Engine:** an aquatic resident's free tiles are wadeable tiles that are not occupied by the player, an NPC, a gate or another resident. Its home spot must be on one; the engine map test checks the olm's.
- **The player** can still face the olm from the bank, or wade in with the boots, as at the lake.

### 3. Species and sources (D6)

| Species | Main source | Notes |
|---|---|---|
| `proteus_anguinus` | Notranjski regijski park, *Človeška ribica* | Family Proteidae from the page; all year, any time. Torch `shy` (fictional), `aquatic`. |
| `leptodirus_hochenwartii` | sl.wikipedia *Drobnovratnik* | First described cave beetle, found in Postojnska jama in 1831; cave endemic of the western Dinarides; all year (no sourced limit). Torch `calm`. |
| `rhinolophus_ferrumequinum` | sl.wikipedia *Veliki podkovnjak* | Active at night; "zime preživi v hibernaciji v jamah", so in the cave in **winter only**. Torch `shy`. |
| `saxifraga_rotundifolia` | Notranjski regijski park | Family Saxifragaceae; flowers June–August; grows on rocks, scree, in forests and dwarf pine. |
| `chrysosplenium_alternifolium` | Notranjski regijski park | Family Saxifragaceae; flowers March–June; shaded damp forests and by streams. |

- **Further sources:** scientific names and families come from GBIF. Gaps in Wikipedia's facts are filled from another Slovenian source, or the fact is left out. The implementation notes record the exact wording.

### 4. The map `rakov_skocjan_karst` (26 × 20)

```text
west: spawn (1, 9), signpost (2, 8), Tilen (3, 10), station (6, 8); the path runs east along the gorge floor
gorge (area rakov_skocjan, daylight):
  rock walls along the top and bottom
  a searchable rocky slope (karst zone)
  a stream crossing the gorge (wadeable)
  saxifrage spots on the rocks and by the stream
cave mouth at x ≈ 17; beyond it the cave (area zelske_jame, underground):
  cave floor and walls; the beetle and the bat on the floor
  an underground pool of water tiles with the olm
```

- **Zones:** the karst zones lie in the gorge only; there is no searching underground.
- **Area names:** *Rakov Škocjan* for the gorge and *Zelške jame* for the cave, after the real caves in Rakov Škocjan.

### 5. Region, habitat, quest, station

- **Region `rakov_skocjan`:**
  - order 6, unlock `{ "flag": "lake_explored" }`, locked hint *Pomagaj Neži ob Cerkniškem jezeru.*
  - position (26, 71): the real place sits next to Cerknica (30, 75) on the travel map, so it is nudged a little north-west to keep both markers readable
  - weather weights like Cerknica's
- **Habitat `karst`:** *Kras*, order 7, search chance 50%; plants weighted 30/30 and animals 1 (fictional).
- **NPC `tilen` and quest `into_the_dark`:**
  - Tilen is a cave researcher; his quest is *V temo*
  - goal: 3 species of `karst`; reward flag `caves_explored`
  - his texts are gender-neutral towards the player and state no species facts
- **Neža:** her `ready` and `completed` lines send the player on to Rakov Škocjan.
- **Station `cave_station`:** *Raziskovalna postaja v Rakovem Škocjanu*, theme *Podzemlje*, with the three cave animals and goal 2.

### 6. Art (in the art pass style)

- **Tiles 112–119:**
  - limestone rock wall (blocked)
  - cave floor
  - cave wall (blocked)
  - cave mouth (blocked)
  - underground pool (wadeable) with a ripple frame
  - gorge scree
- **Tileset size:** 120 tiles (128 × 240); every map's tileset entry matches.
- **Pictures** (32 × 32) for the five species, and **walk sprites** for the three animals. The bat hangs from the cave roof and spreads its wings in the second frame; the olm wriggles.
- **Tilen:** a sprite sheet with a caver's helmet and headlamp.

## Testing

- **Content:**
  - region, habitat, quest, station and species
  - the `aquatic` trait, and its validation
  - the `underground` property's validation
- **Engine:**
  - parsing `underground`, and `World.isUnderground`
  - aquatic wandering: only water tiles, never leaving the pool
  - torch reactions underground by day
  - the map: Tilen at (3, 10), the station reachable, the olm's spot on water inside the cave, zones in the gorge only
- **Renderer:** cave tint and torch circle underground by day; no weather underground, with a test of the drawing decisions.
- **Integration:**
  - the regions list and its locks, and Rakov Škocjan opening after Neža's quest
  - the wildlife response carries `aquatic`
- **Client:** residents' aquatic trait passed to the engine.
- **Manual:** walking into the cave by day (darkness, torch, no rain), the olm in its pool, the beetle, and the bat in winter.

## Risks / Trade-offs

- **[The bat only in winter]** The bat follows its source; the station's goal of 2 of 3 keeps it from blocking progress.
- **[Darkness is client-only]** Residents in the cave are still served as present by day. That is right: they live there, and the darkness is how the player experiences it.
- **[Travel map position nudged]** A small fictionalisation for readability, recorded here.

## Implementation notes (review, task 5.5)

I reviewed every changed file against the non-goals and every scenario in the nine spec deltas. Each scenario is covered by a content, integration, engine, renderer or E2E test. No non-goal was touched: no cave mechanics beyond darkness, no searching underground, no other underground maps, and no fish.

- **Tileset at 128 tiles, not 120.** Plant spots are only visible through a decor tile, so the two saxifrages got tiles 120 and 121. The manual check showed the gorge without them.
- **The insect season label is now *Aktivnost*** (was *Čas letanja*), like mammals and amphibians. The cave beetle does not fly; the swallowtail's and the demoiselle's facts read well under the new label.
- **Sources** (read on 2026-10-04):
  - **Olm:** Notranjski park's page throughout: family Proteidae, "živi izključno v podzemeljskih vodah", "endemit dinarskega krasa", Rdeči seznam (V).
  - **Cave beetle:** sl.wikipedia *Drobnovratnik*. The family is "Leiodidae" from the page's taxobox and GBIF; no Slovenian family name was found, so the value is the Latin name only.
  - **Greater horseshoe bat:**
    - sl.wikipedia *Veliki podkovnjak* for the facts and "zime preživi v hibernaciji v jamah", hence winter only
    - its distribution comes from CKFF's list of Slovenian bats, which lists it among three living horseshoe bats (Blasius' horseshoe bat is extinct)
  - **Saxifrages:** the park pages give family, flowering months, size and habitat.
- **No other availability limits:** the olm and the beetle are found all year, at any time, because no source limits them.
- **Underground in the engine:**
  - `AreaZone.underground`, `WorldMap.isUnderground`, and `World.isUnderground` / `isDark`
  - the renderer uses `CAVE_TINT` and the torch circle there, and skips the weather overlay
  - residents react to the torch when `isDark`
- **Aquatic in the engine:** an aquatic resident's free tiles are wadeable tiles without an NPC, signpost, station or gate. The client passes `aquatic` from the wildlife response unchanged, since `ResidentInfo` is the API shape.
- **Manual check:**
  - **Setup:** a save with Maja's and Neža's quests done, travelled to Rakov Škocjan at noon in spring.
  - **The gorge:** the fog veil, the saxifrages on the slope and the bank, Tilen and the station.
  - **Walking into the cave:** the map went dark; the torch lit a circle showing the beetle and the olm in the pool.
  - **In winter:** the wildlife response listed the bat as present and the olm as aquatic, and the bat hung in the cave.
- **Not checked by hand:**
  - Tilen's quest was not played through; its content (giver, goal, reward flag) is covered by the content tests, and the travel test covers the flag that opens the region.
  - The weather during the manual check was fog, not rain, so "no rain in the cave" rests on the renderer test (cave tint, weather skipped underground).
