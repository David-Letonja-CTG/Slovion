# Proposal

## Why

*Terenski dnevnik* is currently one long scrolling column of text. It shows only what the player has already found, so it gives no sense of what is still left to discover, and it doesn't look like a collection the player wants to fill. The owner asked for a picture grid per habitat. Undiscovered species are greyed out and turn colour once found. Hovering a picture shows its name, or `???` if it isn't found yet, and clicking a found species opens its page. This makes the journal itself a reason to explore. It also prepares for `add-first-quest`, whose goal ("identify 3 species") the player will be able to follow in the journal.

## What Changes

- **Species pictures:** each species gets an original 32×32 pixel-art picture in `content/species-pictures/<speciesId>.png`, served at `/content/species-pictures/`. They are illustrations, not facts, and the owner reviews them. Content validation requires a picture for every species.
- **Habitat names:** each habitat file gets a localized display name (Slovenian required), e.g. *Visoka trava*. Every species must belong to at least one habitat, so every species has a place in the journal.
- **BREAKING** `GET /api/save/naturedex` returns the journal grouped by habitat. Each section has the habitat ID, its localized name, and **every** species of that habitat with its status `unknown`, `observed` or `identified`. Identified species include their localized information as today. Unknown species carry only their ID. The only consumer is our own client, which changes in the same change.
- **Grid view:** one section per habitat with a progress count (e.g. *2/5*), followed by a grid of pictures:
  - **unknown:** dark silhouette, label `???`, nothing to open
  - **observed:** greyscale picture, label `???`; opens the existing *Neznana vrsta* card (group, observation date, hint)
  - **identified:** full colour, label = Slovenian name; opens the species page (today's entry content: names, facts, characteristics, *Viri*)
- **Labels on hover and selection:** a picture's label appears while the pointer is over it or while it is selected with the keyboard.
- **Keyboard and touch:**
  - arrow keys (`Move*` actions) move the selection through the grid
  - `Confirm` opens the selected species
  - `Cancel` goes back from a species page to the grid, and from the grid closes the journal
  - tapping works like clicking
- **Empty journal:** the grid of silhouettes is shown with the encouraging message above it, instead of the message alone.

**Demo outcome:** open the journal on a new game, see five dark silhouettes under *Visoka trava 0/5* → identify the hare → the hare is in colour, hovering it shows *poljski zajec*, clicking it opens its sourced page, and `Esc` returns to the grid.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `naturedex`: grouped response with unknown species, the grid and its three picture states, labels, the species page and its navigation, and the empty state.
- `species-catalog`: every species requires a picture and must belong to at least one habitat.
- `habitat-search`: habitat content gains a required Slovenian display name.

## Non-goals

- Numbering species (no "#001"-style index), sorting or filtering options, search in the journal.
- Showing search chances or weights. Rarity stays hidden; only the habitat name is shown.
- Research levels, extra facts or further stages beyond observed → identified.
- Animated pictures, or reusing the pictures in the world (map art is unchanged).
- Quest progress in the journal (comes with `add-first-quest`).
- Real photographs (licensing and sourcing; pixel art fits the game).

## Impact

- **Content:**
  - 5 new PNGs in `content/species-pictures/`
  - `text.sl.name` added to `content/habitats/tall_grass.json`
  - new validation rules in `FileContentCatalog`
- **API:**
  - `GET /api/save/naturedex` response shape (breaking; client-only consumer)
  - static files under `/content/species-pictures/`
  - no new endpoints, no database change
- **Application:** `NatureDexService` builds habitat sections from content plus the save's discoveries.
- **Client:**
  - `naturedex-panel` is rewritten as grid, card and page views
  - keyboard handling via `play-screen`
  - new `sl.json` keys
  - Playwright and Vitest tests updated
- **Docs:** README content folder list; `docs/product-vision.md` unchanged (the NatureDex already lists "sprite").
