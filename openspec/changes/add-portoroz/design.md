# Design

## Context

What exists today:
- **The journey** ends with Štefan's quest in Murska Sobota (flag `farmland_explored`).
- **Tools** are content files with an icon; their effects are keyed by ID in the engine.
  - The boots let the player enter tiles marked `wadeable` (a tileset tile property), which otherwise block movement.
  - Aquatic residents wander on `wadeable` tiles only.
  - The binoculars see 2–3 tiles ahead, unless a blocked tile is in between.
- **Perched residents** (stork) stay on their home tile, which may be blocked.
- **Species groups:** `plant`, `mammal`, `bird`, `insect`, `amphibian`. Each has Slovenian labels in the client catalog: the group name, the identification heading, and the journal's habitat and season headings.
- **Lamp posts** and Ljubljana's house tiles can be reused on any map.
- **The tileset** has 144 tiles (134–141 for Murska Sobota; 142–143 unused).

The owner chose the snorkel mask as Portorož's mechanic: "a new tool (quest reward) that lets the player identify sea life from shallow sea tiles".

Approved by the project owner on 2026-10-05.

Motivation: see proposal.md. Requirements: the eight spec deltas.

## Goals / Non-Goals

**Goals:**
- An ending region where the last quest's reward opens a new layer of the same map, the sea.
- The snorkel as a small rule parallel to the boots: a tile property and a tool.

**Non-Goals:** see proposal.

## Decisions

### 1. The snorkel and swimmable tiles

- **Content:**
  - tool `snorkel`: *maska z dihalko*, "Z njo lahko plavaš v plitvem morju in opazuješ življenje pod gladino."; not a start tool; a 16×16 icon
  - the reward of Nina's quest, together with the flag `coast_explored`
- **Tileset:** a tile property `swimmable` (bool), next to `wadeable`. The shallow sea tile and its ripple frame carry it.
- **Engine:**
  - the tileset parser reads `swimmable` into `Tileset.swimmable`, and `WorldMap.isSwimmable(x, y)` mirrors `isWadeable`
  - `isBlockedForPlayer`: with the snorkel, a swimmable tile is enterable on the same terms as a wadeable tile with the boots (NPCs, signposts, stations, lamps, closed gates and residents still block)
  - aquatic residents may step onto open water, which is now a wadeable or swimmable tile
  - deep sea (tile 48) carries neither property and stays closed
- **Drawing:** unchanged. The player is drawn as on land (no swimming animation; a non-goal).
- **Binoculars:** unchanged. Shallow sea is blocked in the collision layer, so the binoculars don't see across it: sea life is met by swimming.
- **Server:** nothing beyond content. Tools are already derived from quest rewards, and tool effects are client-side (D3: movement belongs to the engine).

Alternative considered: one generic "water" property with a depth level per tool. Rejected for now: two booleans are simpler, and the boots' rule stays untouched.

### 2. Species groups `fish` and `mollusc`

- **Domain:** `SpeciesGroup` gains `Fish` and `Mollusc`; the parser accepts `fish` and `mollusc`, and the error message lists all seven.
- **Client:** `SpeciesGroup` gains both, with Slovenian labels:

  | Key | `fish` | `mollusc` |
  |---|---|---|
  | `species.group` | *riba* | *mehkužec* |
  | `identification.heading` | *Opaziš ribo* | *Opaziš mehkužca* |
  | `naturedex.habitat` | *Življenjski prostor* | *Življenjski prostor* |
  | `naturedex.season` | *Aktivnost* | *Aktivnost* |

- **Wildlife:** both are animals, so they need wildlife traits and a walk sprite. The pen shell's two frames show it closed and slightly open.

### 3. Species and sources (D6)

| Species | Sources | Notes |
|---|---|---|
| `himantopus_himantopus` | KPSS (*Polojnik*, text and observation calendar); sl.wikipedia (*Polojnik*); GBIF | The calendar shows it from March to October → spring, summer, autumn. Sečovlje is its most important breeding site in Slovenia. Torch `shy`. |
| `egretta_garzetta` | KPSS (*Mala bela čaplja*); sl.wikipedia; GBIF | "Tu se zadržuje vse leto" → all year; the most common of three herons there. Torch `shy`. |
| `salicornia_europaea` | KPSS (*Navadni osočnik*); GBIF | "Cveti od julija do septembra" → summer, autumn. The most widespread annual salt plant in the salt pans; eaten as salad (*sburjon*). |
| `aphanius_fasciatus` | KPSS (*Solinarka*); GBIF | Up to 5 cm, striped; lives in salt pans, ditches by the sea and river mouths; hundreds of thousands in summer; "Zimo preživijo zarite v mehkem solinskem blatu" → spring, summer, autumn. Aquatic, in the salt-pan channel (wadeable); torch `shy`. |
| `sarpa_salpa` | sl.wikipedia (*Salpa*); GBIF | Common in the Adriatic; grazes in large shoals; coastal waters, usually to 20 m. No seasonal restriction → all year. Aquatic; torch `calm`. |
| `pinna_nobilis` | Krajinski park Strunjan (*Popis velikega leščurja*); GBIF | Endemic Mediterranean bivalve, up to 120 cm, over 40 years; soft bottoms among seagrass at 0.5–60 m; critically endangered after mass deaths since 2016. All year. Perched (it lives fixed in the sea floor); torch `calm`. |

Facts are paraphrased from the exact page text, and the implementation notes record the wording.

### 4. The map `portoroz_coast` (26 × 20)

```text
north: a promenade of houses (roofs and walls), lamp posts on the paving
spawn (1, 9), signpost (2, 8), Nina (3, 10), station (6, 8); a paved path runs east
west/middle: a pebble beach, then 3 rows of shallow sea (swimmable) with the salema's home
  and the pen shell's home in the second row, then the deep sea along the bottom
east: the salt pans — salt fields (walkable), dykes and a channel (wadeable) — with glasswort,
  the stilt's and the egret's homes, and the killifish's home in the channel (the saltpan zone)
```

- **Zones:** `saltpan` covers the salt pans, leaving the spawn, signpost, Nina and the station outside. The shallows get no zone: searches find plants only, and the sea has none.
- **Areas:** `portoroz` (*Portorož*) for the promenade, beach and sea; `secoveljske_soline` (*Sečoveljske soline*) for the salt pans.
- **Reachability:** every land spot can be reached without tools. The pen shell can be faced only from a swimmable tile, so only with the snorkel. The salema wanders in the shallows and can sometimes be faced from the beach (a fish near the shore).

### 5. Region, habitats, quest, station

- **Region `portoroz`:**
  - order 9, unlock `{ "flag": "farmland_explored" }`, hint *Pomagaj Štefanu v Murski Soboti.*
  - a position on the coast in the south-west of the travel map (about 8, 86; tuned on the map)
  - Mediterranean weather: sunnier, rarely snow (fictional)
- **Habitats:**
  - `saltpan`: *Soline*, order 10, chance 55%; glasswort 40, stilt 1, egret 1, killifish 1
  - `sea`: *Morje*, order 11, chance 50%; salema 1, pen shell 1 (no zone on the map)
- **NPC `nina` and quest `between_salt_and_sea`:**
  - Nina is a marine biologist; her quest is *Med solinami in morjem*
  - goal: 3 species of `saltpan`; rewards: the snorkel and the flag `coast_explored`
  - her `ready` lines give the snorkel and say the journey across Slovenia is complete
  - her `completed` lines point to the sea
  - texts are gender-neutral
- **Štefan:** his lines send the player on to Portorož.
- **Station `coast_station`:** *Raziskovalna postaja v Portorožu*, theme *Morje in soline*, goal 3 of stilt, egret, glasswort, killifish, salema and pen shell.

### 6. Art (art pass style)

- **Tiles 142–147:**
  - 142 pebble beach (walkable)
  - 143 / 144 shallow sea and its ripple frame (swimmable, animated)
  - 145 salt field (walkable)
  - 146 earthen dyke (walkable)
  - 147 glasswort (decor)
- **Tileset size:** 152 tiles (128 × 304); every map's tileset entry matches. The salt-pan channel reuses the wadeable stream tile (46).
- **Also:** the snorkel's icon, pictures for the six species, walk sprites for the five animals, and Nina's sprite sheet.

## Testing

- **Content:**
  - groups `fish` and `mollusc` accepted, others still rejected
  - region, habitats, quest (both rewards), station, species and the snorkel tool
- **Engine:**
  - swimmable tiles parsed
  - with the snorkel the player enters them, without it the player stops
  - the boots don't swim and the snorkel doesn't wade
  - aquatic residents may swim
  - the map: Nina at (3, 10), the station reachable, the `saltpan` zone, every land spot reachable without tools, the pen shell faceable only with the snorkel
- **Integration:**
  - regions (nine, Portorož after Štefan's quest)
  - Nina's quest rewards the snorkel
  - wildlife lists the salema as aquatic and the pen shell as perched
  - stations include Portorož
- **Manual:**
  - the promenade and the salt pans by day; the lamps at night
  - Nina's quest giving the snorkel
  - swimming to the salema and the pen shell
  - the travel map marker

## Risks / Trade-offs

- **[Two species groups]** Each needs four client labels and the domain value. This is the minimum for correct identification headings (*Opaziš ribo*).
- **[The pen shell is critically endangered]** The game shows a living one, as surveys still find a few. The facts state the mass deaths and its status.
- **[The last region]** `coast_explored` opens nothing yet. It stays as the flag a future chapter can use.
- **[Winter]** In winter only the little egret is around in the salt pans (the stilt is away, glasswort doesn't flower, the killifish is buried in the mud), so Nina's quest waits for spring, as in the other new regions. In spring, summer and autumn at least three `saltpan` species are present.

## Implementation notes

### Deviations from the plan

- **The killifish is a sixth species,** added before approval so Nina's quest isn't limited to summer and autumn (see Risks).
- **Portorož gets rare snow** (winter weight 1). A repository test requires winter snow in every region except the alpine one, and the design already said "rarely snow".
- **Nina's ready lines and the new-tool notice weren't seen in the browser.** Her quest was completed in the database. The browser showed her offer, the bag with the snorkel, and the swim; the reward itself is covered by the content tests and the existing quest flow.

### The snorkel and swimmable tiles

- **Parser:** `Tileset.swimmable` is read by a shared helper `tilesWith(tiles, name)`, which also reads `wadeable`.
- **Map:** `WorldMap.isSwimmable` shares a private lookup with `isWadeable`.
- **`World.isBlockedForPlayer`:** water is enterable with the boots on wadeable tiles or with the snorkel on swimmable tiles; NPCs, signposts, stations, lamps, closed gates and residents still block.
- **Aquatic residents:** they may step onto wadeable or swimmable tiles.
- **Map entry:** only `portoroz_coast` marks tile 143 as `swimmable`, as only maps with streams mark 46 `wadeable`.
- **Region map test:** the generic test walks with both tools; the dedicated test checks that the pen shell can be faced with the snorkel but not on foot, and that deep sea stays closed.

### Species groups

- `fish` and `mollusc` were added to the domain, the parser's error message, the client type, and the four Slovenian label sets: *riba* / *mehkužec*; *Opaziš ribo* / *Opaziš mehkužca*; *Življenjski prostor*; *Aktivnost*.
- A domain test covers parsing and printing.

### Map

- **Promenade:** two houses, the paving and 3 lamps.
- **Beach:** rows 11–12; **shallows:** rows 13–15 (tile 143); **deep sea:** rows 16–19.
- **Salt pans:** x 15–25, rows 0–11. Basins of salt fields (145) between dykes (146), and a wadeable channel (46) at x 24 that reaches the beach.
- **Homes:** pen shell (6, 14), salema (11, 14), killifish (24, 6) in the channel, stilt (17, 6), egret (21, 1); glasswort on two salt fields.
- **Zones and areas:**
  - `saltpan` zone over the salt pans; no zone in the sea
  - areas `portoroz` (promenade, beach, sea) and `secoveljske_soline`
- **Paths:** they join the dykes without an edge.
- **Travel map position:** (9, 90), on the south-west coast.

### Species and source wording (D6)

- **Stilt:**
  - KPSS: "V Sloveniji je redek, lokalno razširjen gnezdilec… gnezdenje potrjeno šele po letu 1990… Sečoveljske soline so polojnikovo najpomembnejše gnezdišče v Sloveniji. Tu gnezdi v solnih poljih ali na manjših nasipih, ki jih preraščajo slanuše"
  - KPSS observation calendar (an image): present March to October, most April–August → spring, summer, autumn
  - Wikipedia: 33–36 cm; legs 17–24 cm, reddish pink; needle-thin straight bill; black back and wings; "kek … kek"; European birds winter in Africa
- **Little egret:**
  - KPSS: "V Sloveniji ne gnezdi… Je najpogostejša od treh čapelj… Tu se zadržuje vse leto… Še posebej veliko jih je v septembru… Prezimuje le ob našem morskem obrežju" → all year
  - Wikipedia: 55–65 cm, wingspan 88–106 cm; all white; black legs with yellow feet; slender black bill; two neck plumes when breeding
- **Glasswort** (KPSS): "najbolj razširjena slanuša enoletnica… Steblo osočnika je mehko in sočno… solato, ki so ji rekli sburjon… Cveti od julija do septembra" → summer, autumn. Habitat from KPSS's habitat page (muddy flats under the influence of seawater).
  - Scientific name: KPSS names it *Salicornia europaea*. GBIF's backbone lists "Salicornia europaea L." (9823570) as doubtful and matches another authorship as accepted; the file cites both and keeps the Linnaean name.
  - Family: given as *Amaranthaceae* (GBIF) without a Slovenian name, since no source gave one.
- **Killifish** (KPSS): up to 5 cm, transversely striped; "živi v solinah, pa tudi v jarkih ob morju in na izlivnih delih rek"; feeds on brine shrimp; males colourful with yellow fins and a dark band on the tail fin; hundreds of thousands in summer; "Zimo preživijo zarite v mehkem solinskem blatu" → spring, summer, autumn. Family *Cyprinodontidae* (GBIF).
- **Salema** (Wikipedia):
  - "pogosta tudi v Jadranu"; a family of breams (*špari*)
  - 10–11 golden stripes, a black spot at the pectoral fins, yellow eyes, a forked tail; usually about 30 cm
  - grazes in large shoals; coastal waters, usually to 20 m
  - no seasonal restriction → all year
- **Noble pen shell** (Strunjan park):
  - "endemitska vrsta školjke v Sredozemlju… največja školjka v Sredozemskem morju… do 120 cm in živi preko 40 let… 0,5 do 60 m… na mehkem sedimentnem dnu sredi morskih travnikov… morska svila"
  - the parasite since 2016, a decline of more than 90 %, critically endangered
  - family *Pinnidae* (GBIF); all year
- **Wildlife traits** (fictional):
  - stilt, egret and killifish `shy`; salema and pen shell `calm`
  - killifish and salema aquatic; pen shell perched

### Other notes

- **Dialogue:** Štefan's lines now send the player to Nina in Portorož. One draft line for Nina, "Si že plaval…", was grammatically masculine; it became "Plitvina te čaka: …".
- **Local checks** (Release build, API on 5180, client on 4300):
  - .NET 490 passed
  - client 361 passed, plus lint, i18n and build
  - E2E 10/10
- **Manual check** (no console errors):
  - Portorož opens after Štefan, and the travel works
  - Nina's offer; the salt pans with the stilt, the killifish in the channel and glasswort
  - the player stops on the beach without the snorkel (with the boots)
  - the bag shows the snorkel after Nina's quest; the player swims into the shallows and meets the pen shell ("Opaziš mehkužca")
  - the salema in the shallows; the promenade lamps at night
  - the travel map shows Portorož on the south-west coast
