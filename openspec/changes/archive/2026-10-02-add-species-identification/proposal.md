# Proposal

## Why

The walking skeleton proves the loop runs end to end, but "discovering" is a single key press: the player learns nothing and decides nothing. The core of Slovion is **identifying** real species by observing them (decision D1). This change turns discovery into a short observation puzzle and adds enough species for it to be a real choice, while keeping the slice small. Habitat-based random encounters follow in the next change (`add-habitat-search`).

## What Changes

- **Observation encounters:** interacting with a species spot starts an *encounter*. The server records that the species was **observed** and sends:
  - up to three clues: sourced identifying characteristics, revealed one at a time
  - four candidate species: the right one plus three others, shuffled with injectable randomness
- **Identification:** the player picks a candidate (one guess per encounter, decided by the server).
  - **Right:** the species becomes **identified** and its full entry appears in *Terenski dnevnik*.
  - **Wrong:** the right species is revealed and nothing else changes (D1: losing the identification is the only consequence). The player can observe again.
- **Staged *Terenski dnevnik*:** observed-but-unidentified species appear as *Neznana vrsta* with their group (plant, mammal, bird, insect). Full sourced information appears only once identified.
- **Four new species with sourced facts:** *poljski zajec* (Lepus europaeus), *poljski škrjanec* (Alauda arvensis), *lastovičar* (Papilio machaon), *navadni regrat* (Taraxacum officinale). Each gets a spot in the meadow with original placeholder art.
- **Content:** species declare their group and which characteristics serve as identification clues. Labels for the season field depend on the group (*Čas cvetenja*, *Čas letanja*, *Prisotnost v Sloveniji*, *Aktivnost*).
- **BREAKING (API, pre-release):** `POST /api/save/discoveries` is replaced by:
  - `POST /api/save/encounters`
  - `POST /api/save/encounters/{id}/identification`

  The client is updated in the same change.
- **Data migration:** existing discoveries become identified entries, so saves from the walking skeleton keep the meadow sage.

**Demo outcome:** walk to the dandelion → observe → read the clues one by one → choose *navadni regrat* → full entry appears. Walk to the hare, guess wrong on purpose → the right answer is shown → *Terenski dnevnik* lists it as *Neznana vrsta (sesalec)* → observe again and identify it.

## Capabilities

### New Capabilities

- `identification`: Observation encounters, clues, candidates, guessing and results, including the identification dialog.

### Modified Capabilities

- `discovery`: Interacting with a spot now starts an observation encounter and records an observation instead of a finished discovery; the old discovery endpoint and its direct "new entry" dialog are removed.
- `naturedex`: Entries are *observed* or *identified*; observed entries hide species information; the season label depends on the species group.
- `species-catalog`: Species have a validated group and identification clues.

## Non-goals

- Habitat zones, searching tall grass, random encounters and rarity (next change, `add-habitat-search`).
- Scoring, research levels, rewards for using fewer clues.
- Species artwork in the identification dialog (placeholder map tiles only).
- More than one species per spot, moving animals, time of day or season affecting what is seen.
- Touch controls, audio.

## Impact

- **API:** two new endpoints, one removed; NatureDex entries gain `status`, `observedAt`, `identifiedAt` and `group`.
- **Database:** new `encounters` table; `discoveries` gains `identified_at` (migration marks existing rows identified).
- **Content:** four species files, updated sage file (group and clues), map spots, tileset grows to two rows.
- **Engine:** none beyond reading the larger tileset; interaction is unchanged.
- **Client:** identification dialog with keyboard and mouse selection, staged NatureDex, new UI text.
- **Docs:** roadmap in `docs/product-vision.md` splits the old step 3 into this change and `add-habitat-search`.
