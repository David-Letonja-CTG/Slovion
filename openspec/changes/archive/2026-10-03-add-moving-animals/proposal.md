# Proposal

## Why

The world is still: animals are drawn as fixed tiles, trees never move, and Vera stands frozen. The owner asked for:
- animals that are visible and move around
- reactions to the torch, with curious animals coming closer and shy ones running away
- a torch the player can be seen holding
- small animations for trees and for Vera

This is the first of three back-to-back changes the owner requested. The next two add regions with travel (Kočevje, Pohorje, Triglav), then more species for them. Doing the living world first means the new regions are built on moving animals from the start.

## What Changes

- **Resident animals:**
  - Every map spot whose species is an animal (any group except `plant`) becomes a **resident**. It is drawn as an animated sprite and wanders on walkable tiles within 3 tiles of its home spot.
  - The meadow keeps its hare, skylark and swallowtail. The hedgerow gets a new shrike resident.
  - The static animal pictures in the map's decor layer are removed.
- **Talking to animals:** facing a resident and pressing `Interact` starts the usual encounter for its spot, through the same API (D3). Residents block movement like NPCs. The interaction precedence becomes NPC → animal → plant spot → search.
- **Present only when available:** a resident is shown only while its species is available at the save's in-game time (D8). The new endpoint `GET /api/save/wildlife?mapId=` lists the residents present now. The client refreshes the list when the time of day changes.
- **Torch reactions:**
  - With the torch lit in the evening or at night, residents within 4 tiles react according to a **gameplay trait** in the species content:
    - `curious` animals walk towards the player and stop next to them (the hare, as the owner's example)
    - `shy` animals move away (the shrike)
    - `calm` animals ignore the light (the skylark and the swallowtail)
  - Once the light is gone, residents return to wandering around home.
  - The trait is fictional gameplay data (D6) and is never shown as a biological fact.
- **Searching finds plants only:** animals are found by meeting them, so a habitat search picks only among the habitat's available **plants**. If none are available, it finds nothing.
- **Visible torch:** while the torch is on, the player is drawn holding a small lamp on the side they face. This is new original art.
- **Animations:**
  - Trees and tall grass sway gently, using Tiled animated tiles in the meadow tileset. The engine plays tile animations.
  - Vera has a sprite with four facings. She looks around from time to time and turns to face the player when talked to.
  - Residents have a two-frame walk cycle.
- **New art (original pixel art):**
  - 16×16 walk sprites for the hare, skylark, swallowtail and shrike
  - Vera's 4-facing sprite sheet
  - sway frames for trees and tall grass
  - the lamp

**Demo outcome:**
1. Start a game. The hare hops around its corner of the meadow, the swallowtail flutters, the trees sway, and Vera looks around.
2. At night, light the torch near the hare: it comes closer.
3. Behind the gate, the shrike flies off when the light approaches.
4. Walk up to the hare and press `E`: the identification starts as before.

## Capabilities

### New Capabilities

- `wildlife`:
  - resident animals: which are present, the wildlife endpoint, wandering, blocking, interaction
  - torch reactions
  - the wildlife traits in species content and the animal sprites

### Modified Capabilities

- `habitat-search`: a search picks only among available plants.
- `species-catalog`: every animal species declares wildlife traits (torch reaction) and has a walk sprite.
- `world-exploration`:
  - maps may animate tiles
  - NPCs have facings and look around
  - the interaction precedence includes animals
  - the draw order includes residents and the lamp
- `world-conditions`: a lit torch is visible as a lamp in the player's hand.

## Non-goals

- New regions, travel, or new species. Those come in the next two changes.
- Animals spawning randomly anywhere, flocks, herds, or animals interacting with each other.
- Animals following the player across the map, or animals the player can feed, catch or harm (D2).
- Persisting animal positions. The client simulates them; only encounters reach the server (D3).
- Sound, particles, weather or day/night variants of sprites.
- Changing the NatureDex, quests or time rules.

## Impact

- **Content:**
  - a `wildlife` block (`torch`) in the 4 animal species files
  - a new shrike spot in the hedgerow
  - map decor without animal tiles
  - animated tiles in the tileset (`tiles[].animation` in the map's tileset)
  - new public folders `content/wildlife-sprites/` (one sheet per animal species) and `content/npc-sprites/` (`vera.png`)
- **Server:**
  - `GET /api/save/wildlife`
  - searches filter to plants
  - validation: wildlife traits and sprite for animals, sprite for NPCs, animated tile frames
  - no database change
- **Engine:**
  - a tile animation clock
  - residents: wandering, torch reactions, blocking and interaction, with a seeded random source per resident so tests are deterministic
  - NPC facing and idle turns
  - drawing residents, NPC sprites and the lamp
- **Client:**
  - loads the wildlife list and the sprites
  - refreshes on time-of-day change and when the page becomes visible
- **Tests:** in all layers. The long quest E2E identifies the hare without walking to a moving target (it opens the encounter through the API). The animals are covered by deterministic engine tests and the manual check.
