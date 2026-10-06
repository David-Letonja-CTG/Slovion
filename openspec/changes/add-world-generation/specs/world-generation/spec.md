## ADDED Requirements

### Requirement: A world seed per save
A new save SHALL get a world seed and the current generation version. The seed SHALL come from an injectable seed source, so tests can fix it; development and E2E MAY configure a fixed seed, and production SHALL NOT. Saves created before this change SHALL get a seed derived from their ID and version 1. A save's seed and version SHALL never change.

#### Scenario: New saves differ
- **WHEN** two new saves are created with the production seed source
- **THEN** they have different world seeds

#### Scenario: An existing save
- **WHEN** the migration runs on a save created before this change
- **THEN** the save gets the seed derived from its ID and version 1, and keeps its region, discoveries, quests and research

### Requirement: Deterministic generation
A natural region's map SHALL be a pure function of its template, its biome, the save's world seed, the map ID and the generation version. Generation SHALL use only a seeded pseudo-random generator, never a global random source or a clock. The same inputs SHALL always give the same terrain, paths, vegetation, habitat zones, objects and spots; different seeds SHALL give visibly different layouts.

#### Scenario: The same inputs
- **WHEN** the Kočevje template is generated twice with world seed 482913 and version 1
- **THEN** both results are identical, tile for tile and object for object

#### Scenario: Different seeds
- **WHEN** it is generated with world seeds 1 and 2
- **THEN** at least a quarter of the generated cells differ

### Requirement: Templates
Every region's map SHALL be a template: a Tiled map with one or more rectangles of class `generated`, each naming its biome, its area (optionally `underground`) and the species it holds, and optional `connector` points on their edges. The spawn, signpost, person and station SHALL stay authored, with their names and places. Inside `generated` rectangles the generator SHALL produce the terrain, collision, habitat zones, vegetation and spots; outside them the template SHALL stay exactly as authored. Content validation SHALL reject a template whose biome is unknown, whose authored objects lie inside a `generated` rectangle, whose connectors are not on a rectangle's edge, or whose listed species cannot be placed in its biome.

#### Scenario: Authored parts stay
- **WHEN** any save loads `kocevje_forest`
- **THEN** columns 0–7 (spawn, signpost, Jure, station) are exactly as in the template

#### Scenario: A misplaced station
- **WHEN** a template's station lies inside a `generated` rectangle
- **THEN** the content fails validation, naming the map and the station

### Requirement: Biomes are data
Biomes SHALL be content files under `content/biomes/` describing a base terrain, terrain layers (density and clumping), openings, water (`stream`, `pond`, `lake`, `sea`, `shallows`), paths, habitat zone kinds with the habitat each belongs to and how it derives from the terrain, and the tiles that draw each terrain. The generator SHALL interpret only these generic rules; it SHALL contain no rule specific to one biome. There SHALL be biomes for the meadow, hedgerow, fir-beech forest, mountain forest, alpine, wetland, karst, cave, coast, city park and village, so that every region's map is generated. A zone kind MAY have no habitat; it then serves species placement only and is not searchable.

#### Scenario: A new biome
- **WHEN** a developer adds a biome file and a template that names it
- **THEN** maps for it are generated without changes to the generator code

#### Scenario: An unknown habitat
- **WHEN** a biome's zone kind names a habitat that does not exist
- **THEN** the content fails validation

### Requirement: Gated barriers
A `generated` rectangle MAY have a barrier on an edge: a blocking terrain and the flag of a gate. The generator SHALL draw the barrier along the whole edge and place exactly one gate requiring that flag at a cell of it, chosen per seed, walkable on both sides and connected to paths on both sides. Without the flag nothing behind the barrier SHALL be reachable from the spawn; with it, everything there SHALL be reachable through the gate only. A template MAY mark a species as near the spawn; its spot SHALL then be reachable within 6 steps of the spawn.

#### Scenario: Vera's gate, anywhere along the hedge
- **WHEN** `dravsko_polje_meadow` is generated for two saves
- **THEN** the hedge row and its gate lie in different places, and in both the hedgerow strip is closed until the save has flag `hedgerow_open` and then open through the gate only

#### Scenario: The first sage
- **WHEN** `dravsko_polje_meadow` is generated for any seed
- **THEN** the meadow sage's spot can be reached within 6 steps of the spawn, so a new player meets it first

### Requirement: The cave
The cave of Rakov Škocjan SHALL be generated per save as its own underground area, entered from the generated gorge, with cave floor and cave water. It SHALL hold exactly the species its template lists, as today: the olm in cave water, and the cave beetle and the bat on the cave floor. It SHALL have no habitat zone, as today.

#### Scenario: Two saves, two caves
- **WHEN** two saves with different world seeds load `rakov_skocjan_karst`
- **THEN** their caves differ in shape, both are dark (underground), both can be entered from the gorge, and each holds exactly the olm in water and the cave beetle and the bat on the floor

### Requirement: Structures
Buildings and other made things SHALL be structures: authored prefabs under `content/structures/` with their tiles, collision, optional perch cells and an optional door. A biome SHALL list the structures it uses with a count range, a minimum spacing and placement rules (door on a path, on a terrain, in a row along a path). The generator SHALL place structures only inside `generated` rectangles, never overlapping each other, the template's authored parts or paths, and every door SHALL be reachable from the spawn. A biome MAY place lamp posts along its paths at an interval; a lamp SHALL never block the only way through.

#### Scenario: A random village
- **WHEN** `murska_sobota_village` is generated for two saves
- **THEN** both have houses and a farmhouse with a chimney, in different places, every door reachable from the spawn

#### Scenario: The stork on a chimney
- **WHEN** `murska_sobota_village` is generated for any seed
- **THEN** the stork's spot lies on a chimney perch cell that can be faced from a walkable tile

#### Scenario: Lamps in the park
- **WHEN** `ljubljana_park` is generated for any seed
- **THEN** lamp posts stand along its paths, and the player can still reach every spot, the signpost and the station

### Requirement: Coherent terrain
Generated terrain SHALL form clusters and regions with natural edges, not tiles scattered independently: terrain layers SHALL be grown from smoothed noise, openings and water SHALL be contiguous shapes, and edges between terrains SHALL use edge tiles where the tileset has them. Every generated tile SHALL be one the biome lists for its terrain.

#### Scenario: A forest, not noise
- **WHEN** the fir-beech forest is generated for 500 seeds
- **THEN** on average at least 85 % of forest cells have at least two forest neighbours (of four), and no generated tile is outside the biome's tile lists

#### Scenario: A stream
- **WHEN** a generated map has a stream
- **THEN** its water cells form one connected line that crosses the generated area from edge to edge, and a path crosses it on a ford or bridge tile

### Requirement: Playable maps
Every generated map SHALL be playable without tools from the spawn: the player SHALL reach every connector, person, signpost, station and gate approach, every land spot (and a tile beside every aquatic or perched spot, except spots that the region's content marks as needing a tool), and every path end; paths SHALL not end in nothing; water SHALL not cut the map apart; blocking decor SHALL never lie on a path. The generator SHALL validate each result, retry deterministically with a new sub-seed when it fails, and after a bounded number of retries apply a deterministic fallback that carves the missing connections. The served map SHALL also pass the existing map validation (areas cover every walkable tile, zones of a kind do not overlap, every object inside the map).

#### Scenario: Always playable
- **WHEN** each natural template is generated for 2,000 seeds
- **THEN** every result passes validation, and the fallback is needed for fewer than 1 % of them

#### Scenario: Tool spots stay tool spots
- **WHEN** `cerknica_lake` is generated for any seed
- **THEN** the white water lily's and the banded demoiselle's spots lie on wadeable water, reachable with the boots but not without them

### Requirement: Habitat zones
The generator SHALL derive zone kinds (for example dense forest, forest edge, clearing, stream bank; open water, shallows, reed bed, mud edge, wet meadow) from the terrain by the biome's rules. Each zone kind SHALL belong to a habitat, and the served map SHALL carry habitat zones as non-overlapping rectangles naming that habitat, so searches, the journal and stations keep working by habitat. Paths SHALL belong to no habitat zone.

#### Scenario: A forest's zones
- **WHEN** the fir-beech forest is generated
- **THEN** the forest edge lies between dense forest and openings or paths, and every zone names habitat `fir_beech_forest`

### Requirement: Species placement
Species MAY carry gameplay placement data: preferred zone kinds in order, and whether they live in or near water. Without it, a species SHALL be placeable in any zone kind of a habitat that lists it, aquatic animals in water and perched animals on a perch. The generator SHALL give every species listed by a template exactly one spot, with ID `<mapId>_<speciesId>_1`, on a cell whose zone kind is compatible, chosen by weighted preference among reachable candidates and spaced from other spots. It SHALL never place a species where its data does not allow it. Placement data is fictional gameplay data (D6) and SHALL never be shown to players.

#### Scenario: The deer at the edge
- **WHEN** the fir-beech forest is generated for 500 seeds and the red deer prefers forest edge, then clearings
- **THEN** its spot lies in a forest edge or clearing zone every time, and in a forest edge more often than in a clearing

#### Scenario: Adding a species
- **WHEN** a developer adds a species to a habitat and to a template's species list, with or without placement data
- **THEN** it gets a spot in generated maps without changes to the generator code

### Requirement: Encounters stay dynamic
The generated world SHALL be static for a save, while encounters SHALL keep depending on the in-game time, season and weather exactly as before (`habitat-search`, `wildlife`, `world-conditions`, `weather`): searching a generated habitat zone SHALL use that habitat's weights and availability, and a resident SHALL be present only while its species is available.

#### Scenario: Searching a generated clearing
- **WHEN** the player searches a cell of a generated zone of habitat `fir_beech_forest`
- **THEN** the search behaves as a search of that habitat does today

### Requirement: The save's maps
`GET /api/save/maps/{mapId}` SHALL return the map for the requesting save as Tiled JSON: an authored map as it is, a natural one generated from its template. It SHALL send an `ETag` and answer `304` to a matching `If-None-Match`. An unknown map SHALL respond `404` with code `unknown_map`; requests without a valid save token SHALL respond `401` with code `invalid_save_token`. The server SHALL cache generated maps (bounded) and SHALL generate a map at most once per cache entry; generation SHALL take under 50 ms per map on the CI machine.

#### Scenario: Loading a region
- **WHEN** a save travels to Kočevje
- **THEN** the client loads `GET /api/save/maps/kocevje_forest` and shows that map

#### Scenario: Unchanged map
- **WHEN** the client requests the same map again with the ETag it received
- **THEN** the server responds `304`

### Requirement: Debug view
Development builds SHALL offer a debug view of the world, enabled with `?debug=world`: an overlay of habitat zones (by zone kind), collision, water, paths, spots and the spawn, and a panel with the seed, biome and generation version. Production builds SHALL NOT include it, and the server SHALL send generation details only in development.

#### Scenario: Debugging a forest
- **WHEN** a developer opens `/?debug=world` on the development server and enters Kočevje
- **THEN** the zones, collision, paths and spots are drawn over the world, and the panel shows the seed, `fir_beech_forest` and `v1`

#### Scenario: Production
- **WHEN** a player opens `/?debug=world` on the production site
- **THEN** nothing changes
