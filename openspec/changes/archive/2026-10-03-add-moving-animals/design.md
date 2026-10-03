# Design

## Context

What exists today:
- Animals are map **spots** drawn as static decor tiles: hare (24, 12), skylark (17, 5) and swallowtail (28, 8).
- The server decides encounters per spot, respecting availability (D3, D8).
- The engine owns movement and collision and draws everything on canvas.
- NPCs (Vera) and gates are tile objects.
- The torch is client-only and clears a circle in the dark.
- Searches roll over all species of a habitat.

The owner decided:
- **three PRs**, one per change, of which this is the first
- **visible, moving animals**
- a **visible lamp**
- **animations** for trees and grass, Vera, and the animals

Motivation: see proposal.md. Requirements: the five spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- A meadow that feels alive with the least new machinery: animal spots become residents, and the encounter API stays as it is.
- Deterministic in tests: a seeded random sequence per resident and NPC, and animation by the game clock.
- Animals and their art become content, so the next changes (regions, more species) only add data.

**Non-Goals:** see proposal.

## Decisions

### 1. Residents come from animal spots

- **Which spots:** a spot whose species group isn't `plant` is a resident. The server knows the groups, so it decides this. The client learns it from `GET /api/save/wildlife?mapId=`, which returns `{ "animals": [ { "spotId", "speciesId", "torch", "present" } ] }`.
- **`present`:** this is the species' availability at the save's world time (D8). Absent residents are listed too, so the client can exclude their spots from fixed-spot interaction.
- **Encounters:** they keep using `POST /api/save/encounters { mapId, spotId }`. The server doesn't check where the animal stands, because the client is trusted for positions (D3, like searches).
- **New hedgerow spot:** `hedgerow_shrike_1` at tile (8, 24), on the grass south of the track.
- **Map decor:** the decor tiles of the three meadow animal spots are removed (`decor` set to 0 at those tiles), so the sprite is the only picture of the animal.

### 2. Content

- **Species `wildlife` block:** `"wildlife": { "torch": "curious" | "shy" | "calm" }`. It is required for animals and forbidden for plants, and is gameplay data, so it needs no sources. Planned values:

  | Species | Torch reaction | Reason |
  |---|---|---|
  | hare | `curious` | the owner's example |
  | shrike | `shy` | |
  | skylark | `calm` | |
  | swallowtail | `calm` | |

- **Walk sprites:** `content/wildlife-sprites/<speciesId>.png` is 32×16: two 16×16 frames facing right, mirrored for left. Up and down use the same frames, which is enough in this pixel style.
- **NPC sprites:** `content/npc-sprites/<npcId>.png` is 32×64, with the same layout as the player sprite. The NPC's map tile object keeps its `gid`, so Tiled still shows it.
- **Public folders:** `wildlife-sprites` and `npc-sprites` are added to the public content folders. Both are sent with `no-cache`, like all content.
- **Tile animations:** the map's embedded tileset gains Tiled `tiles: [{ "id": 5, "animation": [{ "tileid": 5, "duration": 900 }, { "tileid": 20, "duration": 900 }] }, …]` for the tree (tile 5 ↔ new tile 20) and the tall grass (tile 3 ↔ new tile 21). The server validates that frame tile IDs are inside the tileset and durations are positive.
- **Lamp:** `client/public/sprites/lamp.png` (8×8) is a UI sprite like the player's, not content.
- **Validation:** sprite and traits rules as in `species-catalog`; NPC sprites must exist with size 32×64. The existing PNG header reader is reused.

### 3. Server

- **`WildlifeService.ListAsync(save, mapId)`:** lists the map's animal spots with their availability at the save's world time. `IContentCatalog` gains `SpotsOn(mapId)`. An unknown map gives `unknown_map`.
- **Searches:** `EncounterService.SearchAsync` filters the habitat's entries to plants before weighting.
- **New:** error code `unknown_map` and the endpoint in `Api/Discovery`.

### 4. Engine

- **Seeded random:** `engine/world/random.ts` provides `seededRandom(seed: string)`, a small mulberry32 seeded by an FNV-1a hash of the string, with no dependency.
- **`Resident`** (`world/resident.ts`) holds the spot, species, home, tile, facing, a step in progress, the torch reaction and its random sequence.
  - **Movement:** a resident decides at random intervals of 0.8–2.4 s and steps one tile over 300 ms. It moves only into free tiles: walkable, and without the player, an NPC, a closed gate or another resident. While a step is in progress, both the current and the target tile count as taken.
  - **Each decision, in order:**
    1. If the torch is lit, it is evening or night, and the player is within 4 tiles: `curious` steps to reduce the distance and stops when next to the player; `shy` steps to increase it.
    2. Else, if the resident is next to the player, it waits.
    3. Else, if it is more than 3 tiles from home, it steps towards home.
    4. Else it steps to a random free neighbour or idles, at 50/50.
- **`World`:**
  - `setResidents(list)` adds new residents at home, keeps positions of those still present, and removes absent ones.
  - `isBlocked` includes residents.
  - Interaction precedence is NPC → resident (as `{ kind: 'spot', spotId }`) → plant spot → search. All animal spot IDs are excluded from fixed spots.
- **NPCs:** each NPC gets a facing and a seeded idle timer (3–6 s, picking down, left or right). When a conversation starts, the NPC turns to face the player.
- **Animated tiles:**
  - The parser reads `tilesets[0].tiles[].animation` into `Tileset.animations: Map<tileIndex, { tile, ms }[]>`.
  - The world keeps `elapsedMs`, advanced per step.
  - The renderer draws the frame for `elapsedMs mod cycle`.
- **Renderer:** draws residents after NPCs. Each uses its sprite's walk frame (frame 1 during the second half of a step, else frame 0), mirrored with `save/translate/scale(-1, 1)/restore` when facing left. After the player it draws the lamp at a facing-dependent offset when the torch is on, then the tint or the light.
- **`LoadedWorld`** gains `npcSprites`, `wildlifeSprites` and `lampSprite`. `GameOptions` gains `residents`, and `Game.setResidents` handles refreshes.

### 5. Client

- **Loading:** the play screen loads the wildlife list together with the time and progress. `WorldLoader` loads the NPC sprites (from the map's NPCs) and the wildlife sprites (from the list's species).
- **Refreshing:** on a time-of-day change (`onTimeChange` with a different `timeOfDay`) and when the page becomes visible, the play screen re-fetches the list and calls `game.setResidents`.

### 6. Art (original pixel art, for owner review)

| Sprite | Content |
|---|---|
| Hare | brown, long black-tipped ears, two hop frames |
| Skylark | streaked brown with a crest, two hop frames |
| Swallowtail | yellow and black, wings up and down |
| Shrike | grey head with a black mask, rufous back, two frames |
| Vera | 4 facings × 2 frames: hat, green vest |
| Tree | sway frame with the crown shifted a pixel |
| Tall grass | sway frame with the blades bent |
| Lamp | a small lantern with a warm glass |

## Testing

| Level | What is tested |
|---|---|
| Content | traits and sprite rules, NPC sprite rule, tile-animation frames, repository content (residents, the shrike spot) |
| Application | the wildlife list (presence by season, plants excluded); a search picks only plants (the 3:1 weight test moves to dandelion and sage) |
| Integration | `GET /api/save/wildlife` (spring: 4 present; winter: swallowtail and shrike absent; `400` and `404` `unknown_map`; `401`); OpenAPI; sprites served |
| Engine | seeded random; resident wandering stays within 3 tiles; waits next to the player; curious, shy and calm with the torch at night and not by day; blocking; interaction precedence; `setResidents` refresh keeps positions; NPC idle turns and facing the player; tile animation frames by time; drawing residents (mirrored), the NPC sprite and the lamp |
| Client | the wildlife list loaded and passed to the game; refresh on time-of-day change and on visibility |
| E2E | the existing paths still pass. The quest path identifies the hare through the API instead of walking to a moving animal. |

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the five spec deltas. Each scenario is covered by a content-validation, application, integration, engine, client or E2E test. No non-goal was touched: no new regions or species, no animals following across the map or interacting with each other, no persisted positions, no sound.

Deviations and additions:
- **Image validation:** one generic `ValidateImages` check now covers species pictures (32×32), walk sprites (32×16) and NPC sprites (32×64). The picture messages are unchanged.
- **Map known:** `IContentCatalog.SpotsOn(mapId)` returns `null` for an unknown map (`unknown_map`). A map counts as known when it was loaded.
- **Resident decisions:** the engine follows the design. One refinement: while reacting to the torch, a resident decides every 400 ms instead of every 0.8–2.4 s, so the reaction looks responsive.
- **Mirroring:** residents keep facing their last horizontal direction when stepping up or down, so the sprite doesn't flip on vertical steps.
- **NPC idle turns:** after facing the player, an NPC holds that facing for 6 s before looking around again.
- **Resident refresh on page return:** the visibility re-sync also refreshes the residents, not only the time. The client also refreshes them on every time-of-day change.
- **Sprite loading:** the play screen loads the wildlife list in parallel with the map, then the walk sprites of every listed species, present or not. A species that appears later already has its sprite.
- **Renderer tests:** a new `world-renderer.spec.ts` drives `renderWorld` directly with a recording context, covering the NPC sheet row, mirrored residents and the lamp order. `animatedTile` is tested as a pure function.
- **E2E:** the quest path identifies the hare through the API, as planned, and walks back to Vera from the dandelion.

**Manual check** at 1280×720, with no console errors:
- Vera faces the player when spoken to.
- By day the player holds the lamp, the hare wanders near its home, and the swallowtail flutters near its own.
- At 22:00 in the dev database, with the torch lit 3 tiles from the hare's home, the curious hare came up to the player within a few seconds.
- Trees and tall grass sway.

## Risks / Trade-offs

- **The quest E2E no longer walks to the hare,** because moving targets make walking flaky. The quest flow is unchanged, and residents are covered by deterministic engine tests and the manual check.
- **Mirroring needs canvas transforms.** The test fake context gains `save`, `restore`, `translate` and `scale`.
- **Trusted positions (D3):** a modified client could interact with an animal from anywhere. This is accepted as before: single-player, nothing to gain.
- **Torch traits look like behaviour** but are gameplay. They are never shown in the journal (D6), and README and design say so.
- **Up and down use the side frames** for animals, a simplification that suits the art style. Real 4-direction sprites can come later.

## Open Questions

None. The art and the torch reactions need owner review.
