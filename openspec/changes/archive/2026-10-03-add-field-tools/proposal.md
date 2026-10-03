# Proposal

## Why

Quest rewards only open places, and the player owns nothing they can see. The owner chose an inventory of field tools given as quest rewards, each changing how the player explores. The owner first also asked for food that brings animals closer, then a winter bird feeder instead, and finally left the feeder out of this change.

## What Changes

- **A bag (*Nahrbtnik*)** with field tools, owned by the save and decided by the server (D3):

  | Tool | How it is obtained | Effect |
  |---|---|---|
  | *svetilka* (lamp) | every save starts with it | the torch the player already has; now shown in the bag |
  | *daljnogled* (binoculars) | Vera's quest | animals can be identified from up to 3 tiles straight ahead, with a clear line of sight |
  | *povečevalno steklo* (magnifier) | Jure's quest | identifying a plant or insect starts with two clues instead of one |
  | *škornji* (rubber boots) | Maja's quest | the player can wade through shallow stream water |

- **Opening the bag:** a new logical action `Inventory` (key `I`) and a *Nahrbtnik* button open it. It lists the tools with a picture, name and description.
- **New tools are announced:** when a conversation gives a tool, a notice (*Novo v nahrbtniku: daljnogled*) appears once the dialogue closes.
- **Content:**
  - tools are content files with localized texts and 16×16 icons
  - quest rewards may name tools
- **A shallow forest stream in Kočevje:** crossable only with the boots. The fire salamander moves to its far bank; the sources place it near clean forest streams. The stream is the boots' use.
- **Luka's quest** gives no tool. It still ends the journey.

**Demo outcome:**
1. Finish Vera's quest; the notice shows the binoculars, and the bag lists the lamp and the binoculars.
2. Identify a hare from 3 tiles away.
3. With Jure's magnifier, plants show two clues at once. With Maja's boots, wade across the Kočevje stream to the fire salamander.

## Capabilities

### New Capabilities

- `inventory`: tool content, owned tools, the bag, new-tool notices, and the tools' effects.

### Modified Capabilities

- `input-actions`: the `Inventory` action and its key.
- `quests`: quest rewards may name tools; conversations report the save's tools.
- `player-progress`: progress lists the save's tools.
- `world-exploration`: wading with boots (collision), identifying animals from afar with binoculars (interaction).
- `identification`: two clues at the start with the magnifier.

## Non-goals

- The bird feeder, food, or any item that is used up.
- Collectible finds, trading, item counts, dropping or selling.
- Tools from places other than quests.
- New quests.
- Changing how the torch works.
- Equipment slots, or switching tools on and off.

## Impact

- **Content:**
  - `content/items/` (4 tools) and `content/item-icons/` (16×16)
  - `reward.items` in Vera's, Jure's and Maja's quests
  - stream tiles (with a ripple frame) and a `wadeable` tile property
  - Kočevje's stream and the salamander's new spot
- **Server:**
  - tool content loading and validation
  - owned tools derived from start tools and completed quests (no new table)
  - `items` in `GET /api/save/progress` and in conversation responses
- **Engine:**
  - the `Inventory` action and key
  - binoculars reach in the interaction rule
  - wadeable tiles for a player with boots; animals never wade
- **Client:**
  - the bag dialog and button
  - new-tool notices
  - the magnifier's second clue
  - tool state passed to the engine
  - translations
- **Tests:** in every layer, plus an E2E check of the bag.
