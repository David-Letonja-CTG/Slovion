# Proposal

## Why

The first quest (`add-first-quest`) rewards the player with a path into a new area, and the owner decided that this area brings **two new real species**. Researching and sourcing species facts is a different kind of work, and a different kind of review, from building the quest system. This change therefore adds the content first: the species, their habitat, and the map area, still closed off. `add-first-quest` then only has to open the way.

The new area is a **hedgerow** (*mejica*), a typical element of the farmland on Dravsko polje. It has two species that belong together:
- **enovrati glog** (*Crataegus monogyna*), a thorny shrub of hedgerows
- **rjavi srakoper** (*Lanius collurio*), a bird of meadows with hedgerows that nests in thorny shrubs such as hawthorn

## What Changes

- **Two new species**, `crataegus_monogyna` (plant) and `lanius_collurio` (bird):
  - Slovenian facts, every one sourced (D6). Candidate sources: Notranjski regijski park, DOPPS (ptice.si), drava-natura.si, Wikipedija sl, GBIF.
  - Three identification clues each.
  - The owner reviews the facts.
- **Two new pictures** (32×32 original pixel art), reviewed by the owner.
- **New habitat `hedgerow`** (*Mejica*) with fictional gameplay values: a search chance and species weights.
- **Habitat order:** each habitat gets an **order** used to sort the journal's sections, so *Visoka trava* comes before *Mejica* instead of following alphabetical ID order.
- **Meadow map extended south** by a hedgerow strip:
  - hawthorn shrubs and a `hedgerow` habitat zone
  - a hawthorn spot
  - **still separated from the meadow by the existing hedge**, so it cannot be reached yet
- **New tiles** for the hawthorn shrub (original art).
- ***Terenski dnevnik*** shows two sections, *Visoka trava 0/5* and *Mejica 0/2*. The hedgerow silhouettes hint at what is still to come.

**Demo outcome:** start a new game → *Terenski dnevnik* shows *Visoka trava* and *Mejica 0/2* with two new silhouettes → the hedgerow strip is visible beyond the southern hedge but can't be reached.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `habitat-search`: habitat content gains a required order; the repository has the `hedgerow` habitat.
- `naturedex`: sections are sorted by habitat order, then ID; the repository journal has two sections.
- `species-catalog`: the repository content includes the two hedgerow species.
- `world-exploration`: the meadow map includes the hedgerow strip and its habitat zone, closed off from the meadow.

## Non-goals

- Opening the hedgerow, the NPC, quests or progress flags (all `add-first-quest`).
- New species groups (amphibians, reptiles, fungi …); both new species use existing groups.
- Map transitions or a second map. The strip is part of the meadow map.
- Seasonal behaviour (flowering, migration) affecting encounters; that belongs to `world-conditions`.
- Changing the existing five species or the `tall_grass` values.

## Impact

- **Content:**
  - `content/species/crataegus_monogyna.json` and `lanius_collurio.json`
  - two pictures in `content/species-pictures/`
  - `content/habitats/hedgerow.json`
  - `order` in both habitat files
  - the meadow map grows from 32×20 to 32×28 tiles
  - the tileset gains hawthorn tiles
- **Server:** `Habitat` gains `Order`; validation (required, positive); NatureDex section ordering.
- **Client:** none beyond what the content brings. The engine already reads larger maps and zones. Tests that assume the map size or the five species are updated.
- **No API shape change, no database change.**
