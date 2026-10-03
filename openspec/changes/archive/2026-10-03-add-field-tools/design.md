# Design

## Context

What exists today:
- Flags are derived from completed quests: `ProgressReader.FlagsOf` uses the quest content's reward flag. `GET /api/save/progress` and conversation responses carry the flags.
- The torch is a client-side switch (`Torch` action, `L`, and a button).
- Interaction precedence lives in `World.interact`; collision lives in `World.isBlocked` and `WorldMap.isBlocked`. Residents move by checking the world's free tiles.
- The identification dialog shows the first clue and reveals more with *Nov namig*. The server sends all clues; the dialog paces them.
- The tileset is embedded per map, and Tiled supports per-tile `properties`.

The owner chose field tools as quest rewards (lamp, binoculars, magnifier, boots) and left the bird feeder out.

Motivation: see proposal.md. Requirements: the six spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- Tools need no new table: like flags, they are derived from completed quests plus start tools (D3).
- Each tool's effect is small, local and testable. The server stays authoritative for what the save owns.

**Non-Goals:** see proposal.

## Decisions

### 1. Content

- **Tool files:** `content/items/<id>.json`, for example:

  ```json
  { "id": "binoculars", "start": false, "text": { "sl": { "name": "daljnogled", "description": "…" } } }
  ```

- **Planned descriptions** (gameplay texts, no species facts):

  | Tool | Name | Description |
  |---|---|---|
  | `lamp` | *svetilka* | *Ponoči osvetli okolico.* |
  | `binoculars` | *daljnogled* | *Živali prepoznaš tudi do tri polja daleč, če ti nič ne zakriva pogleda.* |
  | `magnifier` | *povečevalno steklo* | *Pri rastlinah in žuželkah takoj vidiš dva namiga.* |
  | `boots` | *škornji* | *V njih lahko prebrodiš plitev potok.* |

- **Icons:** `content/item-icons/<id>.png`, 16×16, drawn by script. A new public content folder, served with `no-cache`.
- **Quest rewards:** `"reward": { "flag": "…", "items": ["binoculars"] }`, where `items` is optional:
  - Vera → binoculars
  - Jure → magnifier
  - Maja → boots
- **Validation** (`FileContentCatalog.Items.cs`): texts, icons, duplicate IDs, quests rewarding unknown tools, and tools with neither `start` nor a rewarding quest. Tools load before quests.

### 2. Server

- **Domain:** `Item(Id, IsStart, Text)`; `Quest` gains `RewardItems` (an optional last parameter, as with `GoalHabitatId`).
- **Ownership:**
  - `ProgressReader.ItemsOf(all QuestProgress)` returns the start tools, then the reward tools of completed quests ordered by completion time (then quest ID), without duplicates. Quests removed from content are skipped.
  - `IContentCatalog.AllItems` (content order) and `FindItem`.
- **Views:** `ItemView(ItemId, Name, Description)` in the requested language, falling back to Slovenian.
  - `PlayerProgress` gains `Items`.
  - `TalkResult.Conversation` gains `Items`.
  - The API adds `items: [{ itemId, name, description }]` to both responses.

### 3. Engine

- **Actions:** `Inventory` in `Action` and `I` in `DEFAULT_KEY_MAP`. The world reports it to the host like `OpenMenu`, through a new `onOpenInventory` callback.
- **Tools in the world:** `World.setTools(ids)`, through `GameOptions.tools` and `Game.setTools`, sets `hasBinoculars` and `hasBoots`.
- **Wading:**
  - The parser reads `properties` of tileset tiles into `Tileset.wadeable: Set<tileId>`.
  - `WorldMap.isWadeable(x, y)` checks whether any tile layer's tile at the cell is wadeable.
  - The player's movement uses `World.isBlockedForPlayer(x, y)`: wadeable map-blocked tiles are free with the boots, while NPCs, residents, gates and signposts still block.
  - Residents keep `isBlocked`, so they never wade.
- **Binoculars:** a step in `interact` after plant spots and before the searches. It walks 2 and 3 tiles ahead and stops at the first map-blocked tile (`WorldMap.isBlocked`, plus NPCs and the signpost). It interacts with the first resident it finds.

### 4. Client

- **State:** `PlayScreen` keeps `items` from progress, replaces them from conversations, and passes their IDs to the engine (`tools` input, then `setTools`).
- **New-tool notice:** when a conversation's items include IDs the save did not have, the notice appears after the dialogue closes, using the place banner with *Novo v nahrbtniku: {{name}}*.
- **The bag:** `InventoryPanel` (`play/inventory-panel.*`) is a dialog with a list (icon, name, description) and a close button.
  - It opens from the engine's `onOpenInventory` or a *Nahrbtnik* button next to *Svetilka*.
  - `Cancel` or `Inventory` closes it; `Inventory` reaches the UI through the existing routing.
  - Icons come from `/content/item-icons/<id>.png`.
- **Magnifier:** `IdentificationDialog` gets an `initialClues` input: 2 for plants and insects when the save has the magnifier, else 1.
- **Translations:** `inventory.title` (*Nahrbtnik*), `inventory.button`, `inventory.received`, `inventory.empty`, and the controls hint (*I: nahrbtnik*).

### 5. Kočevje's stream

- **New tiles:** tileset tiles 46 and 47 are a shallow stream (light water over pebbles) and its ripple frame. Tile 46 gets `{ "name": "wadeable", "type": "bool", "value": true }` and a 600 ms animation to 47. All maps keep the same tileset definition (48 tiles).
- **The stream:** Kočevje's row 16 (x 1–24) becomes stream, with collision blocked and the trees in that row removed. The far bank (rows 17–18) stays forest floor with trees.
- **The salamander** moves from (6, 14) to the far bank at (6, 17). Its sources place it near clean forest streams.
- **Searches:** the south forest zone still covers the stream and the far bank, so both are searchable once reached.

### 6. Testing

- **Domain and application:** item ownership order; start tools; quests removed from content.
- **Content:** tool validation (every rule); repository tools and rewards; the stream's wadeable tiles and the salamander's spot.
- **Integration:** progress and conversation responses carry the tools; Vera's completion adds the binoculars.
- **Engine:**
  - the `I` key gives the `Inventory` action
  - wading with and without boots, and residents never wading
  - binoculars at 2 and 3 tiles, blocked line of sight, nothing beyond 3 tiles, and no reach without binoculars
  - the parser reads wadeable tiles
- **Client:** the bag (list, opening by key and button, closing); the new-tool notice; the magnifier's two clues for plants only; tools passed to the engine.
- **E2E:** the bag lists the lamp on a new game; after Vera's quest (through the API), it lists the binoculars.

## Risks / Trade-offs

- **[The salamander needs the boots]** It is only reachable after Maja's quest, which means backtracking to Kočevje: a reason to revisit. Jure's quest doesn't need it, since Kočevje has six other species.
- **[A wide stream]** The stream crosses the whole map so the far bank can only be reached by wading. The map still reads as a forest with a brook.
- **[The magnifier helps only on the client]** The server already sends all clues, so this is pacing, not secrecy (D1 is unchanged).

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the six spec deltas. Each scenario is covered by a domain, application, content-validation, integration, engine, client or E2E test. No non-goal was touched: no bird feeder, food or used-up items; no counts, trading or selling; tools come only from quests (and the start lamp); no new quests; the torch works as before; and there are no equipment slots or switching. Nothing is stored for tools: they are derived from completed quests.

- **Start tools come in content file order.** Only the lamp is a start tool now, so this has no visible effect. Reward tools follow quest completion time, then quest ID, as designed.
- **The stream is in row 16, x 1–24.** Columns 0 and 25 are the forest border, which stays blocked. The south bank's open tiles at (2, 15) and (2, 17) are where the manual check crossed.
- **Facing a plant spot.** Plant spots don't block movement, so a player faces a plant by stepping towards it from the adjacent tile, as before this change. The magnifier check used the dandelion approached from the north.
- **Manual check.** Done on a new save in the browser, with the quests completed through the API: the bag with only the lamp, then all four tools; the notice *Novo v nahrbtniku: daljnogled* after Vera's conversation; two clues for the dandelion with the magnifier; wading into Kočevje's stream and out onto the far bank, with the fire salamander there in the rain. Binoculars at a distance were not caught on screen, because the residents wander; the engine tests cover reach, range and blocked views.
