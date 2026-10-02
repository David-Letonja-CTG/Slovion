# Proposal

## Why

All five species currently sit on fixed spots: once the player has walked to each of them, the meadow has nothing left to find. Searching habitats brings back exploration and surprise. The player searches a patch of tall grass, and the server decides whether something is there and what it is. This is the "habitat-based encounters" part of the original roadmap step 3 (`add-species-identification` covered identification), and decisions D3 and D7 already describe it: encounters are rolled by the server on an explicit player action, never per step, and habitats are data.

## What Changes

- **Habitat zones** in maps: rectangles in the Tiled `objects` layer of class `habitat`, naming a habitat ID. The meadow gets two zones covering its tall-grass patches (habitat `tall_grass`).
- **Habitat content:** `content/habitats/<habitatId>.json` with **fictional gameplay values**: the chance that a search finds something, and weighted species (rarity). They are validated like species content and never presented as biology.
- **Searching:** pressing `Interact` while standing in a habitat zone, and not facing a spot, starts a search. The server finds nothing, or rolls a species from the habitat's weights using the seeded random source. A found species opens the same observation encounter as a spot (clues, candidates, identification), and an already identified one shows the "already recorded" message.
- **"Nothing here" message** in Slovenian, so searching always gives feedback.
- **Observations record where they happened:** a spot or a habitat. A database migration makes the spot optional and adds the habitat.
- New endpoint `POST /api/save/searches`.

**Demo outcome:** walk into the tall grass south of the path → press E a few times → sometimes *Tu ni ničesar …*, sometimes *Opaziš sesalca* → identify the hare found in the grass.

## Capabilities

### New Capabilities

- `habitat-search`: Habitat zones and habitat content, the search action, server-side rolls, outcomes and their messages.

### Modified Capabilities

- `world-exploration`: Maps may define habitat zones; `Interact` searches when the player stands in a habitat zone and faces no spot.

## Non-goals

- Showing rarity, habitat names or encounter chances to the player.
- Time of day, season or weather affecting rolls (they come with `world-conditions`).
- Cool-downs, depletion or limits on searching.
- Species that only appear through searching, or new species content.
- New art (the existing tall-grass tiles mark the zones).
- Searching while walking or automatic encounters per step (D3).

## Impact

- **Content:** `content/habitats/tall_grass.json`; two `habitat` objects in the meadow map.
- **API:** `POST /api/save/searches`.
- **Database:** migration `AddHabitatSearch`. `spot_id` becomes nullable and `habitat_id` is added, on both `discoveries` and `encounters`.
- **Domain:** encounters and observations carry an origin (spot or habitat).
- **Engine:** the map parser reads habitat zones, and interaction reports either a spot or a search.
- **Client:** search request and "nothing here" message. Found species reuse the identification dialog.
