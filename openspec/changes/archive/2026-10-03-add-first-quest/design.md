# Design

## Context

Builds on everything up to `add-hedgerow-species`, which must be merged first:
- the meadow with its hedgerow strip, closed off by the southern hedge
- discoveries and identification, which are the source of "identified species"
- the play screen's overlay state machine and its UI action routing
- the Tiled parsers, which currently read spawn, spots and habitat zones
- save-slot authentication (`SaveTokenFilter`)
- the problem-details error codes

Motivation: see proposal.md. Requirements: the three spec deltas.

Approved by the project owner on 2026-10-02, with the NPC named *Vera* instead of the drafted *Vesna*.

Relies on these decisions:
- **D3:** the server owns quests and progression; the client owns movement and collision.
- **D4:** anonymous save slots.
- **D5:** no personal data. Dialogue never asks for a name.
- **D7:** dialogue and quests are content.
- **D10:** original characters and art.

## Goals / Non-Goals

**Goals:**
- One complete quest loop, built so the next quests are mostly content: the giver, the goal type and the reward flag are data.
- The server is authoritative: the client only reads flags and shows dialogue.
- Progress is deterministic in tests: injectable clock, no randomness.

**Non-Goals:** see proposal.

## Decisions

### 1. Content

`content/npcs/vera.json`:

```json
{ "id": "vera", "text": { "sl": { "name": "Vera" } } }
```

`content/quests/eye_for_nature.json`:

```json
{
  "id": "eye_for_nature",
  "giver": "vera",
  "goal": { "identifiedSpecies": 3 },
  "reward": { "flag": "hedgerow_open" },
  "text": { "sl": {
    "title": "Oko za naravo",
    "summary": "Prepoznaj tri vrste.",
    "returnHint": "Vrni se k Veri.",
    "dialogue": { "offer": [ … ], "active": [ … ], "ready": [ … ], "completed": [ … ] }
  } }
}
```

- **Return hint as content:** the return hint is a content string rather than generated from the NPC's name, because Slovenian declension (*k Veri*) can't be built from a name.
- **Placeholders in `active` lines:** they may use `{identified}` and `{goal}`, which the server fills in. Validation rejects any other `{…}` placeholder.
- **Goal type:** the goal object has a single type now, `identifiedSpecies`. It is still an object so later goal types don't change the file format, without building any other type now.

**Validation** (in `FileContentCatalog`, all errors collected):
- IDs are snake_case and unique.
- The giver exists.
- Every NPC gives exactly one quest.
- Slovenian text is complete, and dialogue states are non-empty.
- The goal is positive.
- Flags are snake_case.
- Map NPCs exist and gate flags are rewarded by a quest. Both must be inside the map.

### 2. Dialogue draft (`sl`, for owner review)

Vera speaks in the first person. Lines addressing the player avoid gendered past-tense forms. No species are named in the dialogue, so the identification puzzles stay intact (D1).

| State | Lines |
|---|---|
| `offer` | 1. *Živijo! Jaz sem Vera in skrbim za travnike in mejice na Dravskem polju.*<br>2. *Za južno mejico živita ptica in grm, ki ju na tem travniku ne najdeš.*<br>3. *Pot tja odprem, ko vidim, da znaš opazovati naravo: prepoznaj tri vrste in se vrni k meni.* |
| `active` | 1. *Prepoznane vrste: {identified} od {goal}. Kar tako naprej!*<br>2. *Namig: išči v visoki travi in natančno beri znake v dnevniku.* |
| `ready` | 1. *Odlično! Tri vrste, prepoznane po pravih znakih.*<br>2. *Vrata v južni mejici so odprta. Poglej, kdo živi tam!* |
| `completed` | 1. *Kako je pri mejici? Ne pozabi pogledati v grmovje.* |

**Quest title:** *Oko za naravo*. **Tracker texts:** *Prepoznaj tri vrste.* and *Vrni se k Veri.*

### 3. Domain and persistence

**Domain:**
- Content: `Npc(Id, Names)` and `Quest(Id, GiverId, IdentifiedSpeciesGoal, RewardFlag, Texts)`, where `QuestText` holds the title, summary, return hint and dialogue per state.
- Player state: `QuestProgress(SaveSlotId, QuestId, StartedAt, CompletedAt?)` with `Complete(at)`, which throws if the quest is already completed.

**Table `quest_progress`:**
- primary key `(save_slot_id, quest_id)`
- a foreign key to `save_slots` with cascade delete
- `started_at` and `completed_at` (nullable), both `timestamptz`

The migration is `AddQuests`.

**Flags are derived, not stored separately:** they are the reward flags of the save's completed quests, looked up from content. There is no separate flags table, because no flag exists without a quest yet.

**Starting a quest is idempotent:** `IQuestRepository.AddIfAbsentAsync` uses insert-on-conflict-do-nothing, like discoveries. A double request can't create two rows or fail.

### 4. Application services

- **`QuestService.TalkAsync(saveSlotId, mapId, npcId, language)`** returns `UnknownNpc` or `Conversation(NpcName, Lines, QuestView, Flags)`:
  - `NpcName` is the NPC's localized name.
  - `Lines` is the dialogue for the quest's state, with placeholders filled in.
  - `QuestView` is `(QuestId, Title, Summary, ReturnHint, Status, Progress, Goal)`.

  It applies the state table in the `quests` spec. The identified count comes from `IDiscoveryRepository.ListAsync` (identified entries). Completion uses `TimeProvider`.
- **`ProgressService.GetAsync(saveSlotId, language)`** returns the flags and the views of started quests.
- **Map NPCs:** `IContentCatalog` gains `FindNpcOnMap(mapId, npcId)`, `FindQuestByGiver(npcId)` and `FindQuest(questId)`.

### 5. API

- **`POST /api/save/conversations`** takes `{ mapId, npcId }` and responds `200`:

  ```json
  { "npcName": "Vera", "lines": ["…"],
    "quest": { "questId": "eye_for_nature", "title": "Oko za naravo", "summary": "Prepoznaj tri vrste.",
               "returnHint": "Vrni se k Veri.", "status": "active", "progress": 0, "goal": 3 },
    "flags": [] }
  ```

  Errors: `400 bad_request`, `401 invalid_save_token`, `404 unknown_npc`.
- **`GET /api/save/progress`** responds `{ "flags": [...], "quests": [ <same quest object> ] }`.
- **Language:** both use the existing content-language negotiation (`Content-Language: sl`).

### 6. Maps and engine

**NPCs and gates are Tiled tile objects:** objects with a `gid` whose position is their bottom-left corner, the Tiled convention.
- class `npc` with property `npcId`
- class `gate` with property `requiresFlag`

Each object covers the one tile above its anchor. Both parsers read them, and the C# validator checks them as listed above.

**Meadow placement:**
- *Vera* at tile (7, 9), north of the path, three tiles west of the spawn
- the gate at (20, 19) in the southern hedge, which `add-hedgerow-species` left blocking. Making that tile walkable and adding the gate object together form the only opening.

**Tileset:** the row reserved by `add-hedgerow-species` gets a wooden gate tile and Vera (16×16, facing down).

**Engine:**
- `WorldMap` gains `npcs` and `gates`.
- `World.setOpenFlags(flags)`: `isBlocked` also returns true for NPC tiles and for gate tiles whose flag isn't open.
- `Interaction` gains `{ kind: 'npc', mapId, npcId }`. The precedence is NPC, then spot, then search.
- The renderer draws the NPCs and closed gates as tiles after the map layers and before the player.

The engine stays framework-free, and flags are plain strings.

### 7. Client

- **`GameApi`:** `talk(mapId, npcId)` and `progress()`.
- **Loading:** `WorldLoader` loads the map and the progress in parallel. The world starts only when both have succeeded. A failure uses the existing error paths: an invalid token returns to the title screen, a network failure shows the error.
- **`DialogueBox` component:**
  - shows the NPC name and the current line
  - `handleAction`: `Confirm` advances, `Cancel` closes; click and tap advance
  - announced with `aria-live`
- **After a conversation:** the play screen applies the response's flags to the world **when the dialogue box closes**, so the gate opens as the player turns back to the world. It also updates the tracker.
- **`QuestTracker` component:** positioned over the canvas corner.
  - It shows the active quest's title and `progress/goal`, or the return hint once the goal is met.
  - Its data comes from progress, conversation responses and correct identifications. A correct answer increments the progress locally. That count only drives the display: the server stays authoritative and confirms it on the next talk or load.
- **UI keys:** `quest.progress` (`{{progress}}/{{goal}}`), `quest.trackerLabel` (*Naloga*), `errors.unknown_npc` (*Tukaj ni nikogar.*).

## Testing

| Level | What is tested |
|---|---|
| Domain | `QuestProgress` (complete once; started before completed) |
| Application | `QuestService` state table: all five rows; progress capped; counts identifications made before the quest; `unknown_npc`; placeholder filling. `ProgressService` flags and views |
| Integration: content | validation cases for NPCs, quests, gates and map NPCs; repository content |
| Integration: API | conversation lifecycle against PostgreSQL (start, progress, complete, completed); reload keeps the flag; `400`, `401` and `404`; OpenAPI lists both endpoints |
| Engine | parser for NPC and gate tile objects; NPC and closed-gate blocking; open flags; interaction precedence; draw order |
| Client | dialogue box (advance, skip, input blocking); tracker states; flags applied on close; progress loaded before start, with error paths |
| E2E | identify three species, talk to Vera, walk through the gate into the hedgerow, reload with the gate still open. The path is deterministic: the sage, dandelion and hare spots are identified by name |

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the three spec deltas. Each scenario is covered by a domain, application, content-validation, API integration, engine, client or E2E test. The E2E test plays the whole demo outcome:
1. Talk to Vera.
2. Identify the sage, the dandelion and the hare.
3. Return to her.
4. Walk through the gate and search the hedgerow.
5. Reload and walk through again.

No non-goal was touched: there is one quest, flags are the only reward, there is no quest log, and Vera doesn't move.

Deviations and additions:
- **One `QuestService`** handles both conversations (`TalkAsync`) and progress (`GetProgressAsync`), instead of a separate `ProgressService`. Both share the identified count, the flags and the quest views. A second service would only forward calls.
- **Validation lives in a partial file:** NPC, quest and map-actor validation is in `FileContentCatalog.Quests.cs`, so the catalog file stays readable. `TiledObjectFile` gains `Gid`.
- **Tile position of NPCs and gates:** both parsers take the tile under the object's centre (`x + w/2`, `y − h/2`), matching how spots and zones already work.
- **Obstacles in the engine:** `Player` now asks an `Obstacles` interface whether a tile is blocked. `World` implements it from the map collision, the NPCs and the closed gates. `WorldMap.isBlocked` stays purely about the map. The test that the strip is closed off now walks through the `World`, because the hedge tile at (20, 19) is passable in the collision layer and only the gate blocks it. A second test checks the strip is reachable with `hedgerow_open`.
- **Initial flags:** `GameOptions.openFlags` passes the flags at creation, so a continued game shows the gate open from the first frame. `Game.setOpenFlags` handles later changes.
- **Tile positions in tests:** the renderer tests compare positions relative to the first map tile, because the camera centres maps smaller than the view.
- **Load errors:** the play screen shows a progress-load failure the same way as a map failure: `errors.<code>`, or a return to the title screen for an unknown save.
- **Controls hint (new text, for owner review):** *E: razišči, pogovori se ali išči v visoki travi*.
- **Dialogue button:** it reads *Naprej*, and *Zapri* on the last line (`dialogue.next` and `common.close`).
- **Art:** the gate (tile 18) is a wooden field gate set in the hedge. Vera (tile 19) faces down and wears a wide-brimmed hat and a green vest. Both are original pixel art. Under the gate the map has path ground and no hedge decor, so the opening looks like a path once the gate is open.

**Manual check** at 1280×720 and 390×844, with no console errors:
- The offer lines come one by one.
- After the offer the tracker shows *Oko za naravo, Prepoznaj tri vrste., 0/3*; after a reload with three species identified it shows *Vrni se k Veri.*
- The gate blocks, then opens after the `ready` dialogue.
- The completed line shows, and the tracker disappears once the quest is complete.

## Risks / Trade-offs

- **The tracker's local increment can drift from the server:** it only affects the display. Conversations and loads always replace it with server state.
- **Derived flags** stop being enough once flags come from elsewhere, such as items or events. A flags table can be added then. This follows "no speculation".
- **One quest per NPC** is a simplification. Relaxing it changes the conversation rule and is left for a later change.
- **Trusted client for movement (D3):** a modified client could walk through the gate. Single-player, nothing to gain, so this is accepted.
- **Map coupling with `add-hedgerow-species`:** the gate tile at (20, 19) is coordinated through that change's design. If the strip layout changes there, the gate position follows it.

## Open Questions

None blocking. The NPC name *Vera*, the dialogue, the quest title and the tracker texts need owner review, which can happen during approval or in the PR.
