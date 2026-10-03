# Proposal

## Why

Kočevje, Pohorje and Triglav each have only one animal, and searching there finds nothing, because searches only find plants. The owner asked for more species in the new places, animals as well as flowers and other plants. This is the third of three back-to-back changes, after `add-moving-animals` and `add-regions-and-travel`.

## What Changes

- **Thirteen new sourced species:** in each region one more animal, two ground plants, and the region's trees or shrubs.

  | Region | Animal | Ground plants | Trees and shrubs |
  |---|---|---|---|
  | Kočevje | *jelen* (*Cervus elaphus*) | *čemaž* (*Allium ursinum*), *dišeča lakota* (*Galium odoratum*) | *navadna jelka* (*Abies alba*), *navadna bukev* (*Fagus sylvatica*) |
  | Pohorje | *navadna veverica* (*Sciurus vulgaris*) | *okroglolistna rosika* (*Drosera rotundifolia*), *borovnica* (*Vaccinium myrtillus*) | *navadna smreka* (*Picea abies*) |
  | Triglav | *alpski svizec* (*Marmota marmota*) | *planika* (*Leontopodium nivale* subsp. *alpinum*), *triglavska roža* (*Potentilla nitida*) | *rušje* (*Pinus mugo*) |

  Each species gets:
  - Slovenian facts with sources (D6)
  - three clues
  - an original 32×32 picture
  - availability from the sources: ground plants count while they flower, trees and shrubs all year (they are always there), and e.g. the marmot sleeps through the winter
  - animals also get a walk sprite and a torch reaction

  The planned torch reactions, for owner review: deer `shy`, squirrel `curious`, marmot `shy`.
- **Plants in the world:** each ground plant gets its own decor tile and one fixed spot on its region's map, so it can be seen and identified there. The trees and shrubs already stand on the maps.
- **Searching in the regions:** the three region maps get habitat zones, so searching the forest floor, the bog's edge or the alpine grassland can find the region's plants. Each region's habitat lists its new species. The search chances and weights are fictional gameplay data.
- **Trees can be searched like tall grass** (the owner's request): facing a tree, shrub or other blocked tile inside a habitat zone and pressing `Interact` searches that habitat. On the meadow this makes the hawthorn bushes in the hedgerow searchable too.
- **Animals:** the new animals live on their maps as residents, like the bear, wolf and chamois.
- ***Terenski dnevnik*** shows the new species in their habitat sections. The game then has 23 species, enough to open Triglav (8) through the meadow and the regions.

**Demo outcome:**
1. Travel to Pohorje, face a spruce and search: a spruce, sundew or bilberry turns up.
2. Identify it, and it appears in colour under *Gorski gozd*.
3. On Triglav, a marmot wanders the grassland, and edelweiss grows by the path in summer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `species-catalog`: the repository content includes the thirteen new species.
- `habitat-search`: the repository habitats include the three region habitats with their plants.
- `world-exploration`: the region maps have habitat zones and spots for their plants and animals, and facing a blocked tile in a habitat zone searches it.

## Non-goals

- New regions, maps, NPCs, quests or gates.
- Changes to unlock rules, travel or encounters, and to searches beyond searching at trees.
- Weather, region-specific seasons, or rarer finds by altitude.
- Better art for the existing species.

## Impact

- **Content:**
  - 13 species files with pictures, and 3 walk sprites
  - a new tileset row with 6 plant tiles
  - spots and habitat zones in the three region maps
  - updated region habitats
- **Server:** no code changes expected. Content validation already covers everything, and content tests are extended.
- **Engine:** the interaction rule searches a faced blocked tile in a habitat zone. **Client:** no changes expected.
- **Tests:** content tests for the new species, zones and spots; engine tests for searching at trees and for reachable spots; an E2E search in a region.
