# Design

## Context

What exists today:
- **The journey** ends with Tilen's quest (flag `caves_explored`).
- **Darkness** is a tint drawn over the map, by time of day or underground. The torch clears one soft circle around the player.
- **Tile objects** (signposts, stations) are parsed by server and engine, block movement, and are drawn over the map.
- **The corncrake** is sourced and lives at Cerkniško jezero. DOPPS names Ljubljansko barje as its main breeding site in Slovenia.
- **The tileset** has 128 tiles after the cave change.

The owner planned three more regions as a chain (Ljubljana → Murska Sobota → Portorož), each with a new mechanic. This change is Ljubljana, with street lamps.

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the seven spec deltas.

## Goals / Non-Goals

**Goals:**
- A first town region that still centres on nature: park, river and marsh.
- Lamps as a small, reusable map feature: any map can place them.

**Non-Goals:** see proposal.

## Decisions

### 1. Lamps

- **Map objects:**
  - a tile object of class `lamp` (no properties)
  - server: validated with the other tile objects (`gid`, inside the map)
  - engine: parsed into `WorldMap.lamps`; they block movement like signposts and stations
- **Rendering:** the darkness becomes a layer.
  - The renderer draws the tint (night, evening, or cave) into an offscreen layer the size of the view.
  - It then cuts soft circles out of the layer, with the `destination-out` compositing mode and the torch's radial gradient: one around the player when the torch is lit, and one around each lamp in the evening and at night.
  - Finally it draws the layer over the map.
  - The torch keeps its current look; lamps add more holes.
  - The offscreen layer comes from an injectable factory, so renderer tests can record the holes.
- **Animals:** they ignore lamps, as specified.

### 2. Species and sources (D6)

| Species | Planned sources | Notes |
|---|---|---|
| `apus_apus` | DOPPS *Hudourniki*; GBIF | Returns in April–May, leaves in midsummer → spring and summer. Torch `calm`. |
| `erinaceus_roumanicus` | Notranjski regijski park (*Beloprsi jež*); GBIF; a source on Slovenian hedgehog taxonomy | The park names it *Erinaceus concolor*. The ID follows whichever accepted name a source ties to Slovenia; if none, the page's name is used and the deviation recorded. Seen "v mraku", so evening and night. Torch `curious` (fictional). |
| `alcedo_atthis` | Notranjski regijski park (*Vodomec*); GBIF | Torch `shy`. |
| `fritillaria_meleagris` | Botanični vrt UL (flowering March–April); Ljubljansko barje or sl.wikipedia for habitat and distribution | Spring. |
| `alnus_glutinosa` | Notranjski regijski park (*Črna jelša*); GBIF | Replaces the lime: no lime page gave full facts. A tree: all year. Grows on river banks and marshes. |

Facts are paraphrased from the exact page text, and the implementation notes record the wording.

### 3. The map `ljubljana_park` (26 × 20)

```text
north: a street with houses (roofs and walls, blocked) and lamp posts along the pavement
spawn (1, 9), signpost (2, 8), Ana (3, 10), station (6, 8); a paved path runs east through the park
park: lawns with trees and hedges (city zone, searchable), lamp posts beside the paths; black alders along the river
east/south: the Ljubljanica (deep water, not wadeable) with a wooden bridge and a reedy bank
  (the kingfisher's resident spot on the bank)
beyond the bridge: a strip of Ljubljansko barje wet meadow (wetland zone) with the fritillary spot and a corncrake
```

- **Hedgehog and swift:** residents in the park; the swift's home is near the houses.
- **Area:** one area, `ljubljana` (*Ljubljana*). The barje strip is a second area, `ljubljansko_barje` (*Ljubljansko barje*), so the banner names it.

### 4. Region, habitat, quest, station

- **Region `ljubljana`:**
  - order 7, unlock `{ "flag": "caves_explored" }`, hint *Pomagaj Tilnu v Rakovem Škocjanu.*
  - position (40, 52) on the travel map
  - weather like the lowland regions
- **Habitat `city`:** *Mesto*, order 8, search chance 50%; plants 40, animals 1 (fictional). The fritillary joins `wetland` with weight 20.
- **NPC `ana` and quest `city_nature`:**
  - Ana is a park gardener; her quest is *Mestna narava*
  - goal: 3 species of `city`; reward flag `city_explored`
  - her `ready` line says the park is now in the journal; it promises no next region yet (Murska Sobota comes next)
  - her texts are gender-neutral
- **Tilen:** his lines send the player on to Ljubljana.
- **Station `city_station`:** *Raziskovalna postaja v Ljubljani*, theme *Mestna narava*, goal 3 of swift, hedgehog, kingfisher and black alder.

### 5. Art (art pass style)

- **Tiles 122–131** (built as 122–133, see the implementation notes):
  - paving (walkable)
  - house roof, and house wall with a window (both blocked)
  - wooden bridge (walkable)
  - lamp post (tile object)
  - fritillary decor
  - black alder and its sway frame (decor)
  - a hedge corner
- **Tileset size:** 136 tiles (128 × 272); every map's tileset entry matches.
- **Pictures** for the five species, **walk sprites** for the three animals, and Ana's sprite sheet.

## Testing

- **Content:**
  - region, habitat (incl. the fritillary in `wetland`), quest, station and species
  - lamp object validation (gid, bounds)
- **Engine:**
  - parsing lamps (and their problems); lamps block movement
  - the map: Ana at (3, 10), the station reachable, zones (`city`, `wetland`), lamps present, every spot reachable
- **Renderer:** at night the layer gets a hole per lamp, plus the torch hole when lit; by day there are no holes and no layer.
- **Integration:** regions (seven, Ljubljana after Tilen's quest); wildlife and stations include Ljubljana.
- **Manual:** the park by day and at night (lamps lit), the kingfisher, the hedgehog at night, the fritillary in spring, Ana's quest.

## Risks / Trade-offs

- **[Hedgehog taxonomy]** The park's page uses an older name. The ID is chosen from the sources, and the deviation is recorded.
- **[Offscreen layer]** One extra canvas, made once and reused, drawn only when a torch or lamp light is on screen.
- **[A town without a town]** No traffic or shops; the region stays a nature map with a town edge, which suits the game.

## Implementation notes

### Deviations from the plan

- **Tiles 122–133, not 122–131.** The street read as one long building, so two tiles were added: a house wall with a door (132) and a brown roof (133). The planned hedge corner became a trimmed park hedge (130, decor over the lawn), and 131 is a mown lawn. The tileset still has 136 tiles (128 × 272).
- **No fixed spot for the black alder.** Plant spots must lie on walkable tiles, and an alder blocks its tile. Like the forest trees in Kočevje, the alders on the bank and the other trees and hedges in the park are searched from the `city` zone, whose only plant is the black alder.
- **The `city` zone starts at x = 7**, so the spawn, the signpost, Ana (3, 10) and the station (6, 8) lie outside it, as on the other region maps. It covers the park and the bank (rows 6–13). The kingfisher's home is on the bank at (6, 13), outside the zone; residents don't depend on zones.
- **Seven lamp posts:** four on the street and three beside the park paths.

### Lamps and the darkness layer

- The renderer collects the lights: the player when the torch is on and it is dark, and every lamp in the evening and at night whose circle reaches into the view.
- **Without lights**, the tint is filled directly, as before. So by day no layer is made, and at night without the torch or lamps nothing changes.
- **With lights**, the tint is filled into the layer. Each light then cuts a radial gradient out of it, with `destination-out` (opaque within the torch's inner radius, fading out at its outer radius), and the layer is drawn over the view.
- `game.ts` makes the layer on first use from the canvas's document, sized to the canvas's backing store with the same transform, so the circles stay as smooth as the torch was.
- Lamps block movement for the player (with or without boots) and for animals, aquatic ones included. Facing a lamp does nothing.

### Species and source wording (D6)

- **Swift** (DOPPS *Hudourniki*):
  - "se že sredi poletja odseli v Afriko južno od Sahare, od koder se v Slovenijo vrača v aprilu in maju" → spring and summer
  - long, narrow sickle wings; all-black body with a lighter throat patch; feeds, sleeps and mates in flight; nests in holes in rock walls and stone buildings, so mostly seen in towns
  - "V Sloveniji je razširjen predvsem na Primorskem, Notranjskem in Štajerskem"
- **Hedgehog:** the ID is `erinaceus_roumanicus`, the accepted name in GBIF (key 5219618), with records from Slovenia. The park page and sl.wikipedia (*Beloprsi jež*) both name it *Erinaceus concolor*; the distribution fact says the older sources use that name.
  - Wikipedia: "Najbolj je aktiven ob mraku in ponoči" → evening and night (a judgement from that sentence); hibernates in winter → spring to autumn
  - Wikipedia: 225–275 mm, 400–1100 g; "V Sloveniji je splošno razširjen od nižin do približno 1000 m"
  - park page: "V mraku ga lahko marsikje srečamo v mestnem parku ali na domačem vrtu"
- **Kingfisher** (park page *Vodomec*): 17–19.5 cm; colours of crown, back, underside and throat; "Pri nas ga lahko opazujemo skozi vse leto, gnezdi pa navadno od aprila do junija" → all year; endangered on the Red List.
- **Fritillary:**
  - Wikipedia's page is titled *Močvirski tulipan*: lily family; nodding chequered bells, sometimes white; very wet sites; "Cvetijo konec marca in v začetku aprila"; "V Sloveniji raste močvirski tulipan le še na Ljubljanskem barju, v Krakovskem gozdu in na severovzhodu države"; protected, *prizadeta* on the Red List; poisonous
  - Botanični vrt UL: flowering "marec – april"
  - availability: spring
- **Black alder** (park page *Črna jelša*): Betulaceae; up to 25 m; bark; leaves; flowers in March–April before the leaves; monoecious; "raste na mokrih, z dušikom bogatih tleh po vsej Sloveniji". A tree: all year.
- Wildlife traits (fictional): swift `calm`, hedgehog `curious`, kingfisher `shy`.

### Other notes

- **Tilen's lines** now send the player to Ana in Ljubljana. Ana's lines promise no next region.
- **Winter:** only the kingfisher and the black alder are around in Ljubljana in winter (the swift is away, the hedgehog hibernates), so Ana's quest (3 of `city`) and the station (3 of 4) can't be finished in winter. This follows the sources, and a season lasts 72 real minutes.
- **The README's species count** was stale ("35"); it now says 42.
- **Local checks:**
  - .NET tests ran with `-c Release`, because a Debug `Slovion.Api` process, not started by this change, held the Debug output
  - API on 5180, client on 4300
  - E2E passed 10/10
- **Manual check:**
  - a new save with Tilen's quest done finds Ljubljana open and travels there
  - by day: Ana's dialogue; the kingfisher on the bank; the swift on the street; the bridge leads to the barje with the fritillaries in spring
  - at night: lamp circles in the tint and the hedgehog on the lawn (absent by day); the torch adds its own circle
  - no console errors in the final run. One earlier run hit "The map could not be loaded. EncodingError" once. It didn't recur, and every new image decoded in Chromium on three tries, so it was taken as a dev-proxy hiccup.
