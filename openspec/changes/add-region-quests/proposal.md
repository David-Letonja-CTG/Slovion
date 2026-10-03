# Proposal

## Why

Once Kočevje is open, the regions give the player nothing to aim for except collecting species. The owner chose a journey: a person in each region gives a quest about that region's nature, and finishing it opens the next region. This replaces the current rules of 6 and 8 identified species. This change also updates the product vision's roadmap, which still lists world conditions and regions as future work.

## What Changes

- **A person in each region**, standing beside the path near the spawn. Names and roles are for owner review:

  | Region | Person | Quest | Goal | Reward flag | Opens |
  |---|---|---|---|---|---|
  | Kočevje | *Jure*, forester | *V senci jelk* | identify 3 species of *Jelovo-bukov gozd* | `pohorje_open` | Pohorje |
  | Pohorje | *Maja*, nature warden | *Skrivnosti barja* | identify 3 species of *Gorski gozd* | `triglav_open` | Triglav |
  | Triglav | *Luka*, mountain guide | *Pod vrhovi* | identify 3 species of *Visokogorje* | `alps_explored` | — (the journey's end) |

- **Quests per habitat:** a quest goal may name a habitat. Then only identified species of that habitat count, whenever they were identified. Vera's quest keeps counting all species.
- **The journey:** Pohorje unlocks with `pohorje_open` and Triglav with `triglav_open`. Their locked hints name the person to help. The count rule stays supported for content, but no region uses it anymore.
- **The tracker stays correct:** after each identification the client reloads progress from the server instead of adding 1 itself, so a meadow species doesn't move Jure's quest.
- **Content:** three NPCs with original 32×64 sprite sheets, three quests with gender-neutral Slovenian dialogue, and the NPCs placed on the region maps.
- **Docs:** the product vision's roadmap lists what is built and the agreed order of the next changes: deeper journal entries, more habitats, weather, inventory.

**Demo outcome:**
1. Arrive in Kočevje; Jure stands by the path and asks for three forest species.
2. Identify them; Jure completes the quest, and the travel map shows Pohorje open.
3. Repeat with Maja on Pohorje to open Triglav, and with Luka there to finish the journey.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `quests`: quest goals may name a habitat; the repository has the three region quests; the tracker reloads progress after identifications.
- `regions`: Pohorje and Triglav unlock by the region quests' flags.
- `world-exploration`: each region map has its person near the spawn.

## Non-goals

- More than one quest per NPC, quest chains within a region, or quests with other goals (finding, searching, visiting).
- Rewards other than flags (items, badges).
- New maps or areas.
- Changes to the meadow or Vera's quest.
- The later topics (journal entries, habitats, weather, inventory); they get their own changes.

## Impact

- **Content:**
  - `content/npcs/` and `content/npc-sprites/` gain 3 entries each
  - `content/quests/` gains 3 quests
  - NPC objects on the 3 region maps
  - `pohorje.json` and `triglav.json` get flag unlocks and new hints
- **Server:**
  - `Quest` gains an optional habitat
  - quest loading validates it: the habitat must exist and hold at least the goal's number of species
  - `QuestService` counts per habitat
  - no API shape changes
- **Client:** after an identification the play screen reloads `GET /api/save/progress` for the tracker.
- **Tests:**
  - domain and application tests for habitat goals
  - content tests
  - integration tests for the journey's unlocks
  - client tracker tests
  - E2E updated for the new unlock rules
- **Docs:** `docs/product-vision.md` and the README.
