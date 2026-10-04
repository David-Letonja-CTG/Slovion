# Design

## Context

What exists today:
- **The journey** ends with Ana's quest in Ljubljana (flag `city_explored`).
- **Residents** wander within 3 tiles of their home spot. Aquatic residents wander on wadeable tiles only. Every resident blocks its tile, and facing one starts its spot's encounter.
- **Interaction precedence:** NPC → signpost → station → resident → plant spot → binoculars → blocked tile in a zone → standing in a zone. A resident standing on a blocked tile would therefore be met before the tile is searched.
- **The tileset** has 136 tiles (122–133 for Ljubljana; 134–135 unused).
- **The skylark** is sourced as living in "odprta obdelana krajina: polja in travniki z nizko ali redko vegetacijo".

The owner chose this chain (Ljubljana → Murska Sobota → Portorož) and these mechanics. For Prekmurje the chosen mechanic was "a stork on a chimney: a resident animal that stays on a rooftop nest (an animal on a blocked tile)".

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the seven spec deltas.

## Goals / Non-Goals

**Goals:**
- A village region whose signature animal stands on a chimney, in keeping with the sources.
- `perched` as a small, reusable trait: any map can give an animal a fixed home, blocked or not.

**Non-Goals:** see proposal.

## Decisions

### 1. Perched animals

- **Content:** wildlife traits gain an optional boolean `perched` (default false).
  - Content validation rejects a non-boolean value (as for `aquatic`), and an animal that is both `aquatic` and `perched`, naming the species.
  - Like the torch reaction, it is fictional gameplay data.
- **Server:** `GET /api/save/wildlife` adds `perched` to every resident, next to `aquatic`. Presence follows availability as before.
- **Engine:**
  - a perched resident is created on its home tile and never steps: no wandering, no torch reaction, no return home
  - it may stand on a blocked tile (its home is not checked for walkability)
  - it still occupies its tile, so it blocks movement and is met by facing it, through the existing resident interaction
  - since residents come before "blocked tile in a zone", facing the nest meets the stork rather than searching the roof
- **Rendering:** unchanged. The resident's sprite is drawn over the map, so the stork stands on the nest tile.
- **Binoculars:** unchanged. The view to a resident 2–3 tiles ahead must not be blocked, so the stork is met from beside the house, not across it.

Alternative considered: a special "nest" tile object that starts the stork's encounter. Rejected, because it would duplicate the resident logic (presence, sprite, research) for one animal.

### 2. Species and sources (D6)

| Species | Sources | Notes |
|---|---|---|
| `ciconia_ciconia` | Notranjski regijski park (*Bela štorklja*); DOPPS (*Štorklje*); sl.wikipedia (*Bela štorklja*); GBIF | Leaves from August, returns "zgodaj spomladi" → spring, summer. "Aktivna je podnevi" → morning, day, evening. Nests "na slemenih streh, na dimnikih" (park), "na strešnih slemenih, dimnikih, električnih drogovih" (DOPPS). "Največ štorkelj gnezdi v severovzhodnem delu države… simbol Prekmurja" (wikipedia). Vulnerable on the Red List. Perched; torch `calm`. |
| `upupa_epops` | Notranjski regijski park (*Smrdokavra*); sl.wikipedia; GBIF | Returns mostly in April, leaves in September → spring, summer, autumn. "podnevi aktiven ptič" → morning, day, evening. Cultural landscape, old orchards; nests in tree holes. Torch `shy`. |
| `lutra_lutra` | Notranjski regijski park (*Vidra*); sl.wikipedia (*Vidra*); GBIF | All year. Times only if a source says so (checked when building). Wikipedia: "najdemo jih predvsem na Goričkem in Štajerskem". Aquatic; torch `shy`. |
| `viola_arvensis` | Notranjski regijski park (*Njivska vijolica*); GBIF | Flowers April–October → spring, summer, autumn. Field edges; "splošno razširjena… izogiba se le Julijskim Alpam". |
| `salix_purpurea` | Notranjski regijski park (*Rdeča vrba*); GBIF | A shrub up to 6 m on banks and gravel bars; "razširjena po vsej Sloveniji". Shrub: all year. |

Facts are paraphrased from the exact page text, and the implementation notes record the wording. The summer snowflake was considered and rejected: its source says it does not grow in the north of the country.

### 3. The map `murska_sobota_village` (26 × 20)

```text
north: a village street with houses (Ljubljana's roof and wall tiles), with yards between them;
  one house's roof end carries the chimney with the stork's nest, next to a yard tile, so it can be faced
spawn (1, 9), signpost (2, 8), Štefan (3, 10), station (6, 8); a dirt road runs east
middle: ploughed and crop fields with field pansies at their edges; an old orchard with fruit trees
  (the hoopoe's home) — the farmland zone, which leaves the spawn, signpost, Štefan and the station outside
east: an oxbow (mrtvica) of shallow, wadeable water with reeds (the otter's home; wetland zone)
south: the Mura's gravel bank with purple willows (wetland zone), then the Mura (deep water)
```

- **Areas:** `murska_sobota` (*Murska Sobota*) for the village and fields; `mura` (*Mura*) for the bank, the river and the oxbow.
- **The skylark** also gets a resident spot in the fields.

### 4. Region, habitat, quest, station

- **Region `murska_sobota`:**
  - order 8, unlock `{ "flag": "city_explored" }`, hint *Pomagaj Ani v Ljubljani.*
  - a position in the north-east of the travel map (about 86, 20; tuned on the map)
  - weather like the lowland regions, a little drier in summer (fictional)
- **Habitat `farmland`:** *Kulturna krajina*, order 9, search chance 55%. Field pansy 40; stork, hoopoe and skylark 1 each (fictional). The otter (1) and the purple willow (20) join `wetland`.
- **NPC `stefan` and quest `under_the_storks_nest`:**
  - Štefan is a farmer who watches the village's storks; his quest is *Pod štorkljinim gnezdom*
  - goal: 3 species of `farmland`; reward flag `farmland_explored`
  - his `ready` line promises no next region yet (Portorož comes next)
  - his texts are gender-neutral
- **Ana:** her lines send the player on to Murska Sobota.
- **Station `farmland_station`:** *Raziskovalna postaja v Murski Soboti*, theme *Kulturna krajina*, goal 3 of stork, hoopoe, otter, field pansy and purple willow.

### 5. Art (art pass style)

- **Tiles 134–141:**
  - 134 a house roof end with a chimney and a stork's nest (blocked)
  - 135 a ploughed field and 136 a crop field (walkable ground)
  - 137 field pansy (decor)
  - 138 purple willow (decor, blocked)
  - 139 a gravel bank (walkable)
  - 140 / 141 an old fruit tree and its sway frame (decor, blocked)
- **Tileset size:** 144 tiles (128 × 288); every map's tileset entry matches.
- **Pictures** for the five species, **walk sprites** for the three animals (the stork's two frames show it standing and clattering its bill), and Štefan's sprite sheet.

## Testing

- **Content:**
  - region, habitat (incl. the skylark in `farmland`, the otter and the willow in `wetland`), quest, station and species
  - `perched`: loaded, a non-boolean value rejected, aquatic and perched together rejected
- **Engine:**
  - a perched resident never moves (also with the torch at night) and can stand on a blocked tile
  - facing it starts its encounter
  - the map: Štefan at (3, 10), the station reachable, zones (`farmland`, `wetland`), the nest's tile blocked and faceable from a walkable tile, every other spot reachable
- **Integration:**
  - regions (eight, Murska Sobota after Ana's quest)
  - the wildlife list says the stork is perched, present on a spring morning, absent at night and in winter
  - stations include Murska Sobota
- **Manual:**
  - the village in spring with the stork on the chimney, met from beside the house
  - the hoopoe in the orchard, the field pansy, the otter in the oxbow
  - Štefan's quest
  - the stork stays put at night with the torch

## Risks / Trade-offs

- **[A stork on a blocked tile]** Tests and validation assume residents walk. Only perched residents skip the walkability check, and only on the engine side; the server doesn't check spots against collision.
- **[Winter]** Only the skylark is around in winter, so Štefan's quest can't be finished until spring. This follows the sources, as in Ljubljana.
- **[Stork at night]** "Aktivna je podnevi" makes the stork absent at night, although it would sleep on its nest. This follows the rule that times come from the source text; showing it asleep would be a new feature.

## Implementation notes

### Deviations from the plan

- **The skylark shows twice in the journal**, once in *Visoka trava* and once in *Kulturna krajina*, because the journal lists species per habitat. An E2E locator that assumed one picture per species now takes the first.
- **The manual check covered the stork in the evening, not at night.** The stork is absent at night (see Risks), so the "stays put with the torch" check ran at 19:00.
- **Štefan's dialogue was not opened in the browser.** His quest is covered by the content tests, which check the giver, goal, habitat and reward, and by the generic quest flow.

### Perched animals

- **Server:**
  - `WildlifeTraits` gains `Perched`, and `GET /api/save/wildlife` returns `perched` next to `aquatic`
  - a non-boolean value is invalid JSON
  - aquatic plus perched is rejected with "an animal cannot be both aquatic and perched"
- **Engine:**
  - `Resident.update` returns at once for a perched resident, so it never wanders, reacts or returns home
  - its home isn't checked for walkability; it still occupies its tile, so the existing resident interaction meets it before "blocked tile in a zone"
- **Region map test:** the generic test now accepts a spot on a blocked tile when it can be faced from a reachable tile.

### Map

- **The nest:** at (7, 1), at the west end of a red-roofed house, beside a yard (x 5–6) that opens onto the road.
- **Zones:**
  - `farmland`: the fields (x 7–18, rows 4–12) and the orchard (x 19–25, rows 4–8)
  - `wetland`: the oxbow (x 19–25, rows 9–13) and the gravel bank (row 14)
  - the nest, the spawn, the signpost, Štefan and the station lie outside the zones
- **Areas:** `murska_sobota` (two rectangles) and `mura` (the oxbow and the river).
- **Region position** on the travel map: (85, 18), in the Prekmurje lobe.

### Species and source wording (D6)

- **Stork:**
  - park page: "se na prezimovanje v tropsko Afriko odpravi… Jate se lahko na jug začnejo seliti že avgusta… Z območij prezimovanja se vrne zgodaj spomladi. Pri nas navadno gnezdi od marca do junija" → spring, summer
  - park page: "Aktivna je podnevi" → morning, day, evening
  - park page: 95–110 cm, wingspan 180–220 cm; white with black flight feathers, red bill and legs; "rada 'ropota' s kljunom"; vulnerable on the Red List
  - DOPPS: "Gnezdi na strešnih slemenih, dimnikih, električnih drogovih…"; nests can exceed 500 kg
  - Wikipedia: "Največ štorkelj gnezdi v severovzhodnem delu države… Štorklja je simbol Prekmurja"
- **Hoopoe** (park page):
  - "septembra odleti… K nam se vrne spomladi, največkrat aprila" → spring, summer, autumn
  - "Vodeb je podnevi aktiven ptič" → morning, day, evening
  - 25–29 cm, bill 4–5 cm; crest; "up-up-up"; old orchards, nests in tree holes
  - Wikipedia: "V Sloveniji je pogosta poletna vrsta"
- **Otter:**
  - park page: over a metre with the tail; dense dark brown fur; webbed feet; mostly fish; protected, on the red list
  - Wikipedia: "V Sloveniji naj bi živelo okoli 120 vider, najdemo pa jih predvsem na Goričkem in Štajerskem"
  - no source restricts the time of day → all times
- **Field pansy** (park page): "Čas cvetenja: april–oktober" → spring, summer, autumn; 10–40 cm; "obdelana tla", field edges; "splošno razširjena… izogiba pravzaprav le Julijskim Alpam".
- **Purple willow** (park page): "Čas cvetenja: marec–april", up to 6 m; banks and gravel bars; "razširjena po vsej Sloveniji"; a shrub, so all year.
- **Wildlife traits** (fictional): stork `calm` and perched; hoopoe `shy`; otter `shy` and aquatic.

### Other notes

- **Ana's lines** now send the player to Štefan in Murska Sobota. Štefan's lines promise no next region.
- **Local checks** (Release build, API on 5180, client on 4300):
  - .NET 467 passed
  - client 356 passed, plus lint, i18n and build
  - E2E 10/10
- **Manual check** (no console errors):
  - Murska Sobota opens after Ana and the travel works
  - the stork stands on its nest, and facing it from the yard opens the identification dialogue ("Opaziš ptico")
  - the hoopoe in the orchard, the skylark on the ploughed field, the otter in the oxbow, the field pansies
  - in the evening with the torch the stork stays on the nest
  - the travel map shows Murska Sobota in the north-east
