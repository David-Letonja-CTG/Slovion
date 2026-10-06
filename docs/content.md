# Content

Everything the player can meet is content: versioned files in [`content/`](../content/), not database rows and not code (D7). The API loads and validates all of it at startup and refuses to start on any error; `dotnet test` runs the same validation, so a broken file fails CI with a message that names it.

- [Rules for every file](#rules-for-every-file)
- [File reference](#file-reference)
- [Maps](#maps)
- [Sound](#sound)
- [Checklist: a new species](#checklist-a-new-species)
- [Checklist: a new region](#checklist-a-new-region)

## Rules for every file

- **Stable IDs:** lowercase `snake_case`, never changed once used. Species use `genus_species` (`vulpes_vulpes`), even if the scientific name is later revised.
- **Slovenian first:** player-facing text lives in a `text.sl` block; other languages may be added beside it.
- **Facts need sources (D6):** every real-world fact about a species names one or more sources in the same file. Gameplay values (rarity, search chances, goals, weather weights, torch reactions) are fictional and never shown as facts.
- **Original art (D10):** pictures, sprites and tiles are original pixel art in the shared palette.
- **Gender-neutral dialogue:** people address the player without gendered forms.

## File reference

| Folder | One file per | Holds | Notes |
|---|---|---|---|
| `species/` | species (`<genus_species>.json`) | group, scientific name, sources, Slovenian name, family, habitat, distribution, season, characteristics, availability, identification clues; for animals also wildlife traits | see below |
| `species-pictures/` | species (`.png`, 32 × 32) | the journal picture | required |
| `wildlife-sprites/` | animal (`.png`, 32 × 16) | two 16 × 16 walking frames facing right | required for animals |
| `habitats/` | habitat | Slovenian name (a journal section), `order`, search chance, species weights | every species is in at least one habitat |
| `regions/` | region | map, travel-map position (percent of `client/public/images/slovenia.svg`), `order`, name and locked hint, unlock rule, weather weights per season | `{}`, `{ "flag": "…" }` or `{ "identifiedSpecies": n }`; new saves start in `dravsko_polje` |
| `areas/` | named place | Slovenian name for the corner indicator and the arrival banner | referenced by map area zones |
| `npcs/` | person | Slovenian name | sprite sheet in `npc-sprites/` (4 facings × 2 frames, 32 × 64) |
| `quests/` | quest | giver, goal (species count, optionally of one habitat), reward flag and tools, title, tracker texts, dialogue per state | every person gives exactly one quest; `{identified}` and `{goal}` are filled in |
| `items/` | field tool | name, description, whether every save starts with it | icon in `item-icons/` (16 × 16); effects are keyed by ID in the engine |
| `stations/` | research station | name, theme, species list, goal (how many at ★★★) | placed on exactly one map |
| `maps/` | map (Tiled JSON) | layers and objects, see [Maps](#maps) | belongs to exactly one region |
| `tilesets/` | tileset image | all tiles (`meadow.png`) | every map's tileset entry states the same tile count and image height |

### Species details

- **`group`:** `plant`, `mammal`, `bird`, `insect`, `amphibian`, `fish` or `mollusc`. It selects labels such as *Opaziš ptico* and *Čas cvetenja*.
- **`availability`:** the seasons, and optionally the times of day, when the species can be found, with sources.
  - Seasons come from sourced months (spring = March–May, …). Plants count while they flower; trees and shrubs all year.
  - Times of day are restricted only where a source says so.
  - `alsoInWeather` lists weathers in which the species is also found at any time of day, again only where a source says so.
- **`identification.clues`:** three indexes into `characteristics`, in the order they are revealed.
- **`wildlife`** (animals only, fictional gameplay data):
  - `torch`: `curious`, `shy` or `calm`, for the reaction to a lit torch nearby
  - `aquatic: true`: the animal lives and wanders on water tiles only
  - `perched: true`: the animal stays on its home tile, which may be blocked (a nest on a roof), and is met by facing it
  - an animal cannot be both aquatic and perched

## Maps

Maps are [Tiled](https://www.mapeditor.org/) JSON: orthogonal, 16 × 16 tiles, with the layers `ground`, `decor`, `collision` and `objects`. They can be edited in Tiled.

**Objects** (by class):

| Class | Shape | Properties | Meaning |
|---|---|---|---|
| `spawn` | point | `facing` | where the player arrives (exactly one) |
| `spot` | point | `spotId`, `speciesId` | a plant to observe, or an animal's home |
| `habitat` | rectangle | `habitatId` | where searching finds that habitat's plants (zones must not overlap) |
| `area` | rectangle | `areaId`, optional `underground` (bool) | a named place; every walkable tile lies in one; underground is dark all day |
| `npc` | tile object | `npcId` | a person |
| `gate` | tile object | `requiresFlag` | blocks until the save has the flag |
| `signpost` | tile object | — | opens the travel map (exactly one) |
| `station` | tile object | `stationId` | a research station |
| `lamp` | tile object | — | a street lamp: blocks its tile, lights a circle in the evening and at night |

**Tile properties** in the map's tileset entry:

| Property | Meaning |
|---|---|
| `wadeable` | blocked water the player can enter with the boots; aquatic animals live there |
| `swimmable` | blocked shallow sea the player can enter with the snorkel; aquatic animals live there |
| `animation` | frames for swaying grass and trees and moving water |

By convention a region map is 26 × 20 tiles (the larger first meadow is the exception), with the spawn at (1, 9), the signpost at (2, 8), the region's person at (3, 10) and the station at (6, 8), all outside the habitat zones.

### Generated maps (templates)

A region's natural parts are generated per save (docs/decisions.md D13). Its map is then a **template**: everything outside its `generated` rectangles is authored and kept, everything inside is generated.

| Class | Shape | Properties | Meaning |
|---|---|---|---|
| `generated` | rectangle | `biome`, `areaId`, optional `underground` (bool), `species` (comma-separated IDs) | filled from the biome; becomes the area; holds one spot of each species |
| `connector` | point | — | on a generated rectangle's edge, where an authored path comes in; generated paths start there |

Rules:
- No authored object (spot, habitat or area zone, person, station…) may lie inside a `generated` rectangle; validation names any that does.
- The authored path tile next to a connector must be open towards it.
- The server generates every template with a few seeds at startup, so content that cannot be placed fails early.
- To turn an authored map into a template, run `node client/scripts/make-template.mjs <config.json>` (see the script's header for the config).
- The client's engine tests use the server's maps for world seed 1 (`client/src/engine/testing/maps/`). After changing a template, a biome or the generator, rewrite them with `SLOVION_UPDATE_FIXTURES=1 dotnet test --project tests/Slovion.IntegrationTests`.

**Biomes** (`biomes/<id>.json`) are gameplay data (D6). Tiles are tileset indices (Tiled GID − 1).

| Field | Meaning |
|---|---|
| `floor` | the base ground tiles |
| `pathSet` | first tile of a 16-tile path set: +1/+2/+4/+8 when the north/east/south/west side is closed; without it (a cave) paths keep the floor |
| `border` | blocking tiles where the area meets the map's edge |
| `layers` | terrains grown from smoothed noise: `id`, `coverage` (0–1), `scale` (blob size in tiles), `smooth` (passes), optional `floor`, `blocking` (reeds, cliffs, cave rock) and `bias` (`north`, `east`, `south` or `west`) with `biasStrength` (0–1) to gather it towards that edge |
| `openings` | clearings that paths lead to: `count` and `radius` ranges, `floor`, optional `pathSet` |
| `water` | `kind` (`stream`, `pond` or `shore`), `chance`, `size` (a shore's deep rows), `tiles` (`wadeable` tiles let the boots through), optional `bank`; a shore lies along its `edge` with `shallowWidth` rows of `shallow` tiles on the land side |
| `decor` | `tiles`, `blocking`, `density` and `where` |
| `zones` | in order, the first match wins: `kind`, `where` and the `habitat` it belongs to (none: placement only, not searchable) |

`where` selects cells: `any`, `floor`, `opening`, `water`, `layer:<id>`, `edge:<id>[:distance]` (both sides of a layer's boundary), `near:water[:distance]`.

**Placement** in a species file, gameplay data never shown (D6):
- `zones`: preferred zone kinds, best first; without it, every zone kind whose habitat lists the species
- `water`: `in` (aquatic, on water beside land), `near`, or `wade` (on wadeable water away from the shore, reached only with the boots)
- `tile`: for a plant, the decoration drawn at its spot (required)
- `blocking`: the plant blocks its tile, like a shrub

## Sound

Music and nature sounds are synthesized in the browser (no recordings), so they are client data rather than `content/`: small JSON files in [`client/public/audio/`](../client/public/audio/), cached by the installed app. No sound stands for a particular species (D6); species calls are a later feature.

| File | Holds | Notes |
|---|---|---|
| `soundscapes.json` | per map ID: its theme (`music`) and its ambience layers by `day` and at `night` | every region's map needs an entry (`dotnet test` checks); no birdsong at night (client test) |
| `music/<id>.json` | one looping theme: `tempo` (quarter notes per minute) and channels | `cave` plays in every underground area; the night arrangement is derived, not written |

**Channels** have a `wave` (`pulse12`, `pulse25`, `square`, `triangle`, `sine`), a `volume` (keep it under about 0.15) and `notes`: space-separated `<pitch><octave>:<eighths>` tokens (`C#5:2`, `Bb3:4`) or rests (`-:2`). All channels of a theme must have the same length in eighths; a parse error names the theme, the channel and the token.

**Ambience layers:** `breeze`, `wind`, `stream`, `lake`, `waves`, `rain`, `birds`, `birds-sparse`, `gulls-generic`, `crickets`, `drips`, `cave-air`. The weather adjusts them on its own: rain adds `rain` and thins `birds` to `birds-sparse`, snow silences birds and crickets, fog softens everything.

## Checklist: a new species

1. Gather sources and save the exact wording you paraphrase. Record the scientific name with GBIF.
2. Write `content/species/<genus_species>.json`: facts with sources, availability with sources, three clues, and wildlife traits for an animal.
3. Draw `species-pictures/<id>.png` and, for an animal, `wildlife-sprites/<id>.png`.
4. Add it to a habitat in `habitats/`, and give it a spot on a map: a plant on a walkable decor tile inside a habitat zone, an animal's home where it can wander.
5. Run `dotnet test`: content validation names anything missing. Add the species to the content tests that list a region's species.

## Checklist: a new region

1. **Map:** `content/maps/<map>.json` with the conventional spawn, signpost, person and station positions, habitat and area zones, and spots. If you add tiles, extend `tilesets/meadow.png` and update every map's tileset entry (tile count, image height).
2. **Region:** `regions/<id>.json`, unlocked by the flag of the previous region's quest; update that quest's last lines to point onward.
3. **Places and habitats:** `areas/` for the place names; `habitats/` if the region brings a new habitat.
4. **People:** `npcs/<id>.json`, a sprite sheet in `npc-sprites/`, `quests/<id>.json` with a new reward flag, and a station in `stations/`.
5. **Sound:** an entry for the map in `client/public/audio/soundscapes.json`, using an existing theme or a new one in `client/public/audio/music/` (see [Sound](#sound)).
6. **Species:** see the checklist above.
7. **Tests and docs:** extend the content, travel and station tests that list regions; add the region to the table in [gameplay.md](gameplay.md); rerun the [docs media capture](../client/scripts/docs-media/capture.mjs) (add the region to its `regions` scene and to `JOURNEY`).

Each region so far was one OpenSpec change. The archived changes in [`openspec/changes/archive/`](../openspec/changes/archive/) (e.g. `*-add-portoroz`) show a complete example: proposal, design with source notes, tasks and spec deltas.
