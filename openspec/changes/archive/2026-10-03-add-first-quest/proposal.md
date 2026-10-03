# Proposal

## Why

The first playable experience ends with *"continue exploring and complete a small quest"* (product vision, step 6), and roadmap step 4 is this change. A quest gives the player a goal beyond collecting, and it is the first place the game rewards learning. The owner decided:
- the quest asks the player to **identify 3 species**, not just observe them, so it rewards learning
- the reward **opens the path into the hedgerow area**, which `add-hedgerow-species` adds with two new species

The server owns quests and progression (D3), so progress survives reloads and can't be granted by the client.

## What Changes

- **An NPC on the meadow:** *Vera*, a nature conservationist (an original character). She stands next to the path near the spawn and is drawn as an original pixel-art tile. The player talks to her with `Interact` while facing her.
- **Dialogue:** Slovenian lines in content (D7), shown one at a time in a dialogue box. `Confirm` shows the next line, and `Cancel` skips the rest. Lines addressing the player are gender-neutral.
- **The quest *Oko za naravo*:** identify 3 species.
  - Talking to Vera the first time starts it.
  - Progress counts every species the save has identified, including ones identified before talking to her.
  - Talking to her again shows the progress. Once 3 species are identified, she completes the quest.
  - If the goal is already met on the first talk, the quest starts and completes in the same conversation.
- **A progress flag:** completing the quest sets the save's flag `hedgerow_open`. Flags are the rewards of completed quests and are stored on the server.
- **A gate in the southern hedge:** a closed gate tile blocks the way into the hedgerow strip. Once the save has `hedgerow_open`, the gate is gone and the strip is reachable. This holds immediately after the completing conversation, and after any reload.
- **A quest tracker:** a small Slovenian note over the game. While the quest is active it shows the quest title and progress (*1/3*). Once the goal is met it says to return to Vera.
- **New endpoints:**
  - `POST /api/save/conversations` talks to an NPC. The server decides the dialogue and any quest changes.
  - `GET /api/save/progress` returns the save's quests and flags, used when the game starts.
- **New content types:**
  - `content/npcs/<npcId>.json` (name)
  - `content/quests/<questId>.json` (giver, goal, reward flag, title, tracker texts, dialogue per quest state)
  - NPC and gate objects in Tiled maps
- **A database migration** adds quest progress per save slot.

**Demo outcome:** new game → talk to Vera → the tracker shows *Oko za naravo 0/3* → identify the sage, the dandelion and the hare → the tracker says to return to Vera → she congratulates the player and the gate in the southern hedge opens → walk into the hedgerow and search it → reload: the gate stays open and the quest stays done.

## Capabilities

### New Capabilities

- `quests`:
  - NPC and quest content, with its validation
  - conversations with NPCs and the dialogue box
  - the quest lifecycle (start, progress, complete)
  - the quest tracker
- `player-progress`: the save's progress flags (rewards of completed quests), `GET /api/save/progress`, and loading progress when the game starts.

### Modified Capabilities

- `world-exploration`:
  - maps may contain NPCs and gates
  - NPCs and closed gates block movement
  - `Interact` facing an NPC starts a conversation, and takes precedence over spots and searching

## Non-goals

- More than one quest, quest chains, quest choices or declining a quest.
- Rewards other than flags (items, points, badges), and an inventory.
- A quest log screen (the tracker is enough for one quest), or quest entries in *Terenski dnevnik*.
- Moving or animated NPCs, NPC schedules, NPCs without quests.
- Dialogue branches, player answers, voice, or typewriter effects.
- Map transitions or saving the player's position. The player still starts at the spawn after a reload.
- Content for the hedgerow itself (that is `add-hedgerow-species`, which must be applied first).

## Impact

- **Content:**
  - `content/npcs/vera.json`
  - `content/quests/eye_for_nature.json`
  - an NPC object and a gate object in the meadow map
  - NPC and gate tiles in the tileset
- **Domain:** `QuestProgress` (save slot, quest, started, completed); `Npc` and `Quest` content records.
- **Application:**
  - `QuestService` for conversations and completion
  - `ProgressService` for flags and quest views
  - a repository port for quest progress
- **Infrastructure:**
  - quest progress persistence (EF Core configuration and repository)
  - migration `AddQuests`
  - NPC, quest and map object validation in `FileContentCatalog`
- **API:**
  - `POST /api/save/conversations` and `GET /api/save/progress`
  - error code `unknown_npc`
- **Engine:**
  - the Tiled parser reads NPC and gate tile objects
  - `WorldMap` and `World` handle NPC and gate blocking, open flags and NPC interaction
  - the renderer draws NPCs and closed gates
- **Client:**
  - `GameApi.talk` and `GameApi.progress`
  - a dialogue box component
  - the quest tracker
  - the play screen loads progress and applies flags after conversations
  - new `sl.json` keys
- **Tests:** all layers, plus an E2E quest path.
- **Depends on:** `add-hedgerow-species`, which provides the hedgerow area, its species and the closed southern hedge.
