# Proposal

## Why

The foundation (`bootstrap-solution`) proves every layer builds and runs, but nothing is playable yet. This change delivers the thinnest **playable** path through all layers — client engine, Angular UI, API, domain, database and content — so the core loop *explore → discover → record* works end to end before any system is made deep. Integration problems (asset loading, engine ↔ UI boundary, save identity, localized content) surface now, while they are cheap to fix.

## What Changes

- **Title screen** with *Nova igra* (new game) and *Nadaljuj* (continue, shown when this device has a save).
- **Anonymous save slots:** a new game creates a server-side save identified only by a random token kept on the device (decisions D4, D5). No accounts, no personal data.
- **Logical input actions** with a keyboard mapping (arrows/WASD, run, interact, confirm, cancel, open menu). Gameplay never sees raw keys.
- **A small Dravsko polje meadow map** (Tiled JSON in `content/`), drawn with original placeholder pixel art, replacing the checkerboard test pattern.
- **Grid-based movement** with walking and running, collision against map walls and edges, and a camera that follows the player within the map bounds.
- **One species spot** for *Salvia pratensis* (travniška kadulja). Interacting with it asks the server to record a **discovery**; the server decides which species the spot holds (D3).
- **NatureDex** (player-facing name *Terenski dnevnik*, D10) listing discovered species with Slovenian information and source attribution.
- **Species content** with a source reference for every real-world fact (D6), validated at startup and in CI.
- **Persistence:** discoveries are stored when they happen; reloading the page and choosing *Nadaljuj* shows them again.
- First **database tables and migration** (save slots, discoveries) and the first **gameplay endpoints**.
- First **end-to-end browser test** (Playwright) covering the demo path.

**Demo outcome:** start a new game → walk across the meadow → interact with the meadow sage → see the discovery message → open *Terenski dnevnik* and read about it in Slovenian → reload the page → *Nadaljuj* → the entry is still there.

## Capabilities

### New Capabilities

- `input-actions`: Mapping physical input to logical game actions and how UI and gameplay consume them.
- `game-session`: Title screen, starting a new game, continuing an existing save, and handling a save that no longer exists.
- `world-exploration`: Loading a map, grid movement, running, collision, camera, and interacting with the tile the player faces.
- `species-catalog`: Real-world species content — stable IDs, localized text, mandatory source references, and validation.
- `discovery`: Recording that a save slot has discovered a species through a world spot, decided and persisted by the server.
- `naturedex`: Showing the discovered species of a save slot with localized information and sources.

### Modified Capabilities

- `localization`: Adds the rule that localized **content** text (not UI text) is served by the API in the requested language, falling back to Slovenian.

## Non-goals

- **Identification** (clues, choosing among candidates — D1), staged information reveal, research levels: next change.
- Random encounters, habitats as encounter zones, rarity, multiple species.
- Quests, NPCs, dialogue, inventory, progression unlocks.
- **Saving the player's position.** After *Nadaljuj* the player starts at the meadow entrance; only discoveries persist.
- Touch / on-screen controls and gamepad (mappings come later; the action layer is designed for them).
- Seasons, time of day, weather, audio, animations beyond a basic walk cycle.
- Deleting saves, multiple save slots per device, accounts, cloud sync, offline play.
- Final art. All art in this change is original placeholder pixel art.

## Impact

- **New API endpoints:** `POST /api/saves`, `POST /api/save/discoveries`, `GET /api/save/naturedex`; static content under `/content/maps/` and `/content/tilesets/`.
- **Database:** first EF Core migration (`save_slots`, `discoveries`), applied at API startup.
- **New repository folder:** `content/` (species, maps, tilesets).
- **Engine:** input, map, movement, camera and tile/sprite rendering modules; the checkerboard placeholder is removed.
- **Client:** routing (title, game), save-token storage, API client, discovery dialog, NatureDex panel.
- **New dev dependency:** Playwright (E2E), plus a CI job that runs the E2E against PostgreSQL.
- **Decision D10** becomes final: the NatureDex is called *Terenski dnevnik* in the game.
