# Design

## Context

What exists today:
- The game has one map, `dravsko_polje_meadow`. The client hardcodes it as `START_MAP` in `play-screen.ts`.
- The server owns encounters, searches, quests and flags (D3). Flags are derived from completed quests. The identified count is derived from discoveries.
- Residents come from a map's animal spots via `GET /api/save/wildlife?mapId=`, so a new map with animal spots gets moving animals without new engine work.
- NPCs and gates are tile objects in the map's `objects` layer. Gates block movement while closed.
- Habitats group species in the *Terenski dnevnik*. Searches only ever find plants.

The owner decided:
- three PRs, of which this is the second
- travel by a **signpost with a travel map**
- regions **unlocked by progress**
- animals **visible and moving**

Motivation: see proposal.md. Requirements: the four spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- New places that only need content: a region file, a map, an area, a habitat and species. PR 3 then adds species and plants without new code.
- The server decides whether a region may be entered and remembers where the player is (D3).
- Travel is quick and readable: one dialog, one fade, one banner.

**Non-Goals:** see proposal.

## Decisions

### 1. Region content

`content/regions/<regionId>.json`:

```json
{
  "id": "kocevje",
  "mapId": "kocevje_forest",
  "position": { "x": 52, "y": 78 },
  "unlock": { "flag": "hedgerow_open" },
  "text": { "sl": { "name": "Kočevje", "lockedHint": "Pomagaj Veri na Dravskem polju." } }
}
```

- **`unlock`:** either `{}` (always open), `{ "flag": "<flag>" }` or `{ "identifiedSpecies": <n> }`. Only one rule per region. Rules don't combine, since no region needs that.
- **Position:** in percent of the travel map image, computed from the places' approximate coordinates with the same projection as the outline:

  | Region | x | y |
  |---|---|---|
  | `dravsko_polje` | 74 | 35 |
  | `pohorje` | 62 | 27 |
  | `kocevje` | 45 | 84 |
  | `triglav` | 15 | 35 |

- **Order:** the travel list orders regions by an `order` field, as habitats do: Dravsko polje 1, Kočevje 2, Pohorje 3, Triglav 4.
- **Domain:** `Region` with an `UnlockRule` closed hierarchy (`Always`, `Flag`, `IdentifiedSpecies`). `Region.IsUnlockedFor(flags, identifiedCount)` is pure and unit tested.
- **Validation** (in a new `FileContentCatalog.Regions.cs` partial, collecting errors like the others):
  - the map exists
  - every map belongs to exactly one region
  - the flag is some quest's reward
  - the count is positive
  - `sl` name and hint are present, the hint even for the always-open region (it is simply never shown)
  - x and y are within 0–100
  - IDs are unique
  - `dravsko_polje` exists, because new saves start there
- **Catalog:** `IContentCatalog` gains `AllRegions` (ordered) and `FindRegion(id)`.

### 2. The current region

- **Storage:** `SaveSlot` gains `RegionId` (string, max 64) and `TravelTo(regionId)`. Migration `AddCurrentRegion` adds `region_id` to `save_slots`, not null, default `'dravsko_polje'`, so existing saves start in the meadow.
- **Removed regions:** if content no longer has the save's region, `GET /api/save/regions` reports `dravsko_polje` as current. The stored value is kept, like quest records whose content was removed.
- **Encounters are not tied to the current region:** encounter, search, wildlife and conversation requests keep naming their map. The client is trusted for its position, as it is for searches (D3). A check here would add no gameplay value now.

### 3. Server

- **`TravelService`** (`Application/Travel`):
  - `ListAsync(save, language)` returns the current region and every region's view.
  - `TravelAsync(save, regionId, language)` returns `Travelled(view)`, `Locked` or `UnknownRegion`.
- **Shared progress inputs:** the flags and the identified count. The flag derivation now in `QuestService.FlagsOf` moves to a small `ProgressReader` (`Application/Quests`), which `QuestService` and `TravelService` share. This avoids a third copy of the identified count.
- **Persistence:** `ISaveSlotRepository` gains `UpdateAsync(slot)`.
- **Endpoints** (`Api/Travel`):

  | Endpoint | Body | Responses |
  |---|---|---|
  | `GET /api/save/regions` | — | `200 { currentRegionId, regions: [{ regionId, name, mapId, x, y, unlocked, identified?, required?, lockedHint? }] }` |
  | `POST /api/save/travel` | `{ regionId }` | `200` region view; `400 bad_request`; `404 unknown_region`; `409 region_locked` |

  `identified` and `required` appear only for count rules. `lockedHint` appears only when locked. Both endpoints answer `401 invalid_save_token` without a valid token. The new error codes go in the existing error code list.

### 4. Maps, tiles and signposts

- **Tileset:** `content/tilesets/meadow.png` gains rows 3–4 for the new tiles: fir, beech, forest floor, moss, rock, scree, snow, alpine grass, dwarf pine and the signpost. All maps keep embedding the same tileset image. Renaming the image would break the stable meadow map, so it keeps its name. Tree tiles get sway animations like the meadow tree.
- **Maps:** each is 26×20, hand-laid in Tiled JSON by a generator script kept outside the repository, like the meadow:
  - `kocevje_forest`: a fir-beech forest with a clearing and a path. The bear's home is in the clearing.
  - `pohorje_forest`: a spruce forest with a peat bog (*barje*) clearing. The wolf's home is at the forest edge.
  - `triglav_alps`: alpine grassland, scree and snow fields, with dwarf pines along the path. The chamois's home is on the grassland.

  Each has its spawn at the path end, with the signpost one tile beside it, and one area zone covering every walkable tile.
- **Areas:**

  | Area | Name |
  |---|---|
  | `kocevje_forest` | *Kočevski gozd* |
  | `pohorje_forest` | *Pohorski gozd* |
  | `triglav_slopes` | *Pod Triglavom* |

- **Habitats** (journal sections; fictional search values; listed after *Mejica*):

  | Habitat | Name | Order | Species |
  |---|---|---|---|
  | `fir_beech_forest` | *Jelovo-bukov gozd* | 3 | bear |
  | `mountain_forest` | *Gorski gozd* | 4 | wolf |
  | `alpine_grassland` | *Visokogorje* | 5 | chamois |

  The new maps get **no habitat zones** in this change. With only animals in them, searches there could never find anything, since searches only find plants. PR 3 adds plants and the zones together.
- **Signposts:** a tile object of class `signpost` in the `objects` layer, with the signpost tile as its `gid`. The meadow's signpost stands at (12, 9), above the path two tiles right of the spawn; (11, 8) is hedge. Validation: exactly one per map, inside the map.
- **Engine:**
  - `tiled.ts` parses signposts like gates.
  - `WorldMap` gains `signpost`.
  - `World.isBlocked` includes it.
  - Interaction precedence becomes NPC → signpost → resident → plant spot → search, emitting `{ kind: 'signpost' }`.
  - The renderer draws the signpost tile as it draws closed gates.

### 5. Species

- **Bear, wolf, chamois:** `ursus_arctos`, `canis_lupus`, `rupicapra_rupicapra`. Each has:
  - sourced Slovenian name, family, description and clues
  - availability seasons and times only where a source states them, e.g. the bear's winter rest
  - GBIF for the scientific name
- **Candidate sources** (verified when writing, and only facts they state are used):
  - Zavod za gozdove Slovenije (bear, wolf)
  - LIFE Lynx and LIFE WolfAlps EU (wolf)
  - Triglavski narodni park (chamois)
  - Lovska zveza Slovenije (chamois, bear)
- **Torch traits** (gameplay, owner review): bear `shy`, wolf `shy`, chamois `calm`.
- **Pictures and walk sprites:** original pixel art in the existing style, generated by script. Sizes are 32×32 and 32×16.
- **Wolf on Pohorje:** most of Slovenia's wolves live in the Dinaric forests, but wolves are also recorded in the Alpine part, including Pohorje. The game places the wolf there for gameplay, and its NatureDex facts describe its real range from the sources. If the sources don't support wolves on Pohorje at all, I'll raise it before implementing that map rather than invent it.

### 6. Client

- **Entering:** `PlayScreen` first requests `GET /api/save/regions` and loads the current region's map, replacing `START_MAP`. Wildlife, conversations and searches use the loaded map's ID. `openPlay` in the specs flushes `regions` first.
- **Travel map:** `TravelMapDialog` (`play/travel-map.*`), opened by the `signpost` interaction. It shows:
  - the schematic map `client/public/images/slovenia.svg`: an original simplified outline with no text, drawn for this change
  - a marker per region
  - the list of regions

  Keyboard: `MoveUp`/`MoveDown` select and `Confirm` travels, through the existing UI action routing. `Cancel` closes the dialog. Locked and current regions are shown but disabled. Texts come from Transloco; region names and hints come from the API. For count rules, the remaining number is shown with a pluralized Slovenian key (*Prepoznaj še {{count}} vrsto/vrsti/vrste/vrst*).
- **Travelling:**
  1. `POST /api/save/travel`
  2. fade out (a 300 ms CSS opacity transition on a full-screen overlay)
  3. `loadPlace(mapId)`
  4. the game host starts a new `Game` for the new place; the old one is disposed and the clock, torch and flags are carried over
  5. fade in
  6. the banner fires from the first `onAreaChange`

  With `prefers-reduced-motion`, no fades. Errors: `region_locked` (e.g. when progress changed in another tab) refreshes the list; any other error shows the existing error overlay.

### 7. Testing

- **Domain:** unlock rules.
- **Application:** `TravelService` covers listing, travelling, locked, unknown and removed regions.
- **Infrastructure/content:** region validation (each rule) and the repository content scenarios.
- **Integration:** both endpoints with their codes, persistence across a new `DbContext`, and the migration default.
- **Engine:** signpost parsing, blocking and precedence.
- **Client:** the dialog (selection, disabled entries, hint counts), travel and reload, the fade skipped with reduced motion, and *Nadaljuj* entering the current region.
- **E2E:** after Vera's quest, travel to Kočevje, see the banner, reload and continue in Kočevje.

## Risks / Trade-offs

- **[Three maps of hand-made content]** → Kept small (26×20) with one area each. Map generation scripts stay outside the repository, as before.
- **[Empty searches in new regions until PR 3]** → No habitat zones there yet (see section 4). Interact on open ground does nothing, which is the existing behavior outside zones.
- **[Travel map art accuracy]** → It is schematic by design, and the proposal says so. No real map data is copied.
- **[Wolf placement]** → Raised in section 5, for owner review.

## Implementation notes and deviations

Recorded after implementing; none changes a requirement.

- **Wolf on Pohorje:** the sources support it. RTV Slovenija (5 December 2024) reports a pack filmed by the Slovenian Forest Service's camera traps on Pohorje, after wolves spread into the Alps in 2018–2019. The wolf's distribution fact cites this.
- **Availability,** each sourced:

  | Species | Seasons | Times | Source says |
  |---|---|---|---|
  | bear | spring, summer, autumn | all | it sleeps through the winter (LZS) and is mainly nocturnal but often seen by day |
  | wolf | all | evening, night | mostly active at night and at dusk (zdravgozd.si) |
  | chamois | all | morning, day, evening | active by day (zdravgozd.si) |

- **Tiles:** rows 3–4 of the tileset (tiles 24–39) hold:
  - forest floor and leaf litter
  - fir and beech, each with a sway frame (900 and 1100 ms)
  - the signpost
  - dense forest
  - boulder, scree, snow, alpine grass and dwarf pine
  - cliff, bog pool and spruce

  The meadow map's tileset entry grows to 40 tiles.
- **Maps:** all three put the spawn at (1, 9) and the signpost at (2, 8). The animals' homes are:
  - the bear in the Kočevje clearing at (17, 10)
  - the wolf at the Pohorje bog's edge at (17, 11)
  - the chamois on the Triglav grassland at (16, 10)
- **`WorldMap.signposts`** is a list like `gates`, not a single `signpost`. The parser rejects anything but exactly one, as the server does.
- **`ISaveSlotRepository.UpdateAsync`** writes only the region (`ExecuteUpdate`), since saves are read untracked by the token filter.
- **Locked hints:** the count regions have descriptive hints. The client adds the remaining number (*Prepoznaj še …*) from `identified` and `required`, using Slovenian plural forms.
- **Starting a new game for a new place:** `GameCanvas` stops its engine and starts a new one whenever its `world` input changes. Arriving also gives the world input back, keeps the torch lit and focuses the canvas.
- **Travel map art:** `client/public/images/slovenia.svg` is a polygon traced from approximate border coordinates. It has no text and no copied map data.
