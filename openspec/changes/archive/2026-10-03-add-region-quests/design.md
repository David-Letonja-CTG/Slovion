# Design

## Context

What exists today:
- Quests are content: one per NPC, a goal of N identified species (any species, whenever identified), and a reward flag. `QuestService` decides every conversation, and flags come from completed quests (D3).
- Regions unlock by `always`, a flag or a species count. Pohorje needs 6 identified species and Triglav 8.
- Vera is the only NPC. NPCs are map tile objects with 32×64 sprite sheets, and they turn to face the player.
- The play screen's tracker adds 1 to the active quest after each correct identification and trusts the server's numbers on the next load.

The owner decided that the region quests open the next region (a journey), replacing the count rules.

Motivation: see proposal.md. Requirements: the three spec deltas.

Approved by the project owner on 2026-10-03.

## Goals / Non-Goals

**Goals:**
- Each region has a goal, and the regions are played in order.
- Content only says which habitat a quest counts. No new endpoints or API fields.

**Non-Goals:** see proposal.

## Decisions

### 1. Habitat goals

- **Content:** `"goal": { "identifiedSpecies": 3, "habitat": "fir_beech_forest" }`. The habitat is optional; without it, all species count (Vera).
- **Domain:** `Quest` gains `string? GoalHabitatId`.
- **Validation:** in `FileContentCatalog.Quests.cs`, after habitats load. The habitat must exist and list at least `identifiedSpecies` species. Animals count, since they are identified too.
- **Progress:** `ProgressReader.IdentifiedCountAsync(saveSlotId, habitat?)` counts identified species, only those listed in the habitat when one is given. `QuestService` passes the quest's habitat. Region unlocks keep using the overall count, which no region uses now but stays supported.

### 2. Content

**People.** Names, roles and sprites are for owner review. Each sprite sheet is 32×64, original, in the style of Vera's sheet.

| NPC | Name | Role | Sprite |
|---|---|---|---|
| `jure` | Jure | forester (*gozdar*) | green jacket, brown hat |
| `maja` | Maja | nature warden on the bog | blue jacket, dark hair |
| `luka` | Luka | mountain guide | red jacket, grey cap |

**Quests.** All dialogue is game text, gender-neutral, and states no species facts beyond sourced content. Drafts for owner review follow.

- **`in_the_shade_of_firs`** — *V senci jelk*. Summary: *Prepoznaj tri vrste jelovo-bukovega gozda.* Return hint: *Vrni se k Juretu.*
  - offer:
    - *Živijo! Jaz sem Jure, gozdar v Kočevskem gozdu.*
    - *Tukaj rastejo jelke in bukve, med njimi pa živijo tudi velike živali.*
    - *Prepoznaj tri vrste tega gozda, pa ti povem, kako priti na Pohorje.*
  - active:
    - *Prepoznane vrste tega gozda: {identified} od {goal}.*
    - *Namig: preišči drevesa in gozdna tla, zvečer pa opazuj tudi živali.*
  - ready:
    - *Odlično! Ta gozd zdaj poznaš.*
    - *Pot na Pohorje je odprta. Tam te pričakuje Maja.*
  - completed:
    - *Kako je na Pohorju? Pozdravi Majo!*
- **`secrets_of_the_bog`** — *Skrivnosti barja*. Summary: *Prepoznaj tri vrste gorskega gozda.* Return hint: *Vrni se k Maji.*
  - offer:
    - *Živijo! Jaz sem Maja in skrbim za barje na Pohorju.*
    - *Barje je občutljivo, zato po njem hodimo previdno.*
    - *Prepoznaj tri vrste gorskega gozda, pa ti pokažem pot pod Triglav.*
  - active:
    - *Prepoznane vrste: {identified} od {goal}.*
    - *Namig: preišči smreke in rob barja.*
  - ready:
    - *Bravo! Zdaj veš, kaj skriva Pohorje.*
    - *Pot pod Triglav je odprta. Tam te čaka Luka, gorski vodnik.*
  - completed:
    - *Kako je pod Triglavom? Luka ti bo pokazal gore.*
- **`below_the_peaks`** — *Pod vrhovi*. Summary: *Prepoznaj tri vrste visokogorja.* Return hint: *Vrni se k Luki.*
  - offer:
    - *Živijo! Jaz sem Luka, gorski vodnik.*
    - *V gorah hodimo počasi in gledamo pozorno, saj se marsikaj skriva med skalami.*
    - *Prepoznaj tri vrste visokogorja, pa bo tvoja pot od Dravskega polja do Triglava končana.*
  - active:
    - *Prepoznane vrste: {identified} od {goal}.*
    - *Namig: gorske cvetlice cvetijo poleti, rušje in skale pa lahko preiščeš vedno.*
  - ready:
    - *Čestitam! Tvoj terenski dnevnik je zdaj pravi zaklad.*
    - *Pot od Dravskega polja do Triglava je za tabo.*
  - completed:
    - *Gore so vedno tu. Vrni se, kadar želiš.*

**Regions.**
- Pohorje: `"unlock": { "flag": "pohorje_open" }`, hint *Pomagaj Juretu v Kočevju.*
- Triglav: `"unlock": { "flag": "triglav_open" }`, hint *Pomagaj Maji na Pohorju.*

**Maps.** Each region's NPC is a tile object at (3, 10), beside the path near the spawn and outside the habitat zones, with its sheet's tile `gid` as the meadow uses for Vera.

### 3. Client

- **Tracker updates:** `PlayScreen.countIdentification` is replaced by a reload of `GET /api/save/progress` after a correct answer. A failed reload keeps the tracker as it is, and the server stays authoritative.
- **The tracker shows** the first active quest, as now. With the journey at most one quest is active at a time.

### 4. Tests

- **Domain and application:** a habitat goal counts only that habitat's identified species; Vera's goal still counts all.
- **Content:** the region quests and their goals; validation of an unknown or too small goal habitat; NPCs on the maps.
- **Integration:**
  - after Jure's quest, Pohorje is unlocked and Triglav locked with Maja's hint
  - a save with five meadow species and one Kočevje species has progress 1 of 3 with Jure
- **Client:** the tracker shows the server's progress after an identification, including a species that does not count.
- **E2E:** the travel path checks Pohorje's new hint; the Pohorje search test completes Jure's quest through the API before travelling.

## Risks / Trade-offs

- **[The Triglav quest in winter]** Only the chamois and the mountain pine are available on Triglav in winter. Species identified earlier still count, and seasons last three in-game days.
- **[Existing saves with 6+ species but no region quests]** These saves lose access to Pohorje and Triglav until they help Jure and Maja. Their current region stays as stored. If it is Pohorje or Triglav, the player continues there and can travel back.
- **[Dialogue tone]** The lines are drafts. The owner reviews them in the pull request, as with Vera.

## Implementation notes and deviations

Recorded after implementing; none changes a requirement.

- **Jure's sprite** has an olive jacket and a dark brown hat with a red band, instead of the planned green jacket and brown hat. The planned colours looked too much like Vera.
- **NPC tile objects** on the region maps use Vera's tile (`gid` 20) as their Tiled placeholder; the game draws each NPC's own sprite sheet.
- **One draft line was changed** to stay gender-neutral: Jure's hint now ends *… zvečer pa opazuj tudi živali.* instead of *… bodi pozoren na živali.*
- **Progress per habitat:** `ProgressReader.ProgressOf(quest, identifiedSpecies)` computes a quest's capped progress. `IdentifiedSpeciesAsync` loads the identified set once per request.
- **Integration tests** gained a helper that identifies a spot on any map. The shared `IdentifyAsync` only knows the meadow.
