# Decision Log

Cross-cutting product and architecture decisions. Each OpenSpec change may refine these in its own `design.md`; when a decision changes, update the entry here and note the date.

Status values: **Accepted**, **Superseded**, **Deferred**.

---

## D1 — Identification mechanic (Accepted, 2026-10-02)

Identification is an observation puzzle, not a quiz screen:

1. During an encounter the player gathers up to three **clues** (observable characteristics, e.g. colour, shape, sound, habitat).
2. The player then picks the species from **3–4 candidates**.
3. A correct choice identifies the species and creates/advances its NatureDex entry. A wrong choice is not punished beyond losing the identification for this encounter.

Clue texts and candidate sets are content data, sourced like all species facts (see D6). Exact rules are specified in the `identification` capability.

## D2 — No combat, no capture (Accepted, 2026-10-02)

There are no battles. Players never capture, own or harm organisms. "Collect" means collecting **observations** in the NatureDex. Progression comes from discovery, identification, quests and research stations.

## D3 — Authority model (Accepted, 2026-10-02)

| Concern | Authority |
|---|---|
| Movement, collision, camera, animation | Client (game engine) |
| Encounter rolls | Server, triggered by explicit player actions (e.g. searching a habitat patch), never per step |
| Discoveries, identification results, NatureDex, quests, progression | Server, persisted when they happen |
| Player position | Client-reported, persisted by the server at checkpoints |

The client is **trusted** (single-player, no competitive features); the server validates inputs for consistency, not for anti-cheat. Online connectivity is required for the first slice; offline support is deferred.

Consequence for saving: game-state changes are persisted as they happen (no "unsaved progress" for discoveries/quests). "Save" in the UI means a position checkpoint.

## D4 — Player identity (Accepted, 2026-10-02)

No accounts and no login. A new game creates an **anonymous save slot** identified by a random, unguessable token stored on the device. The token is the only key to that save. Losing the token means losing access to the save — acceptable for now.

## D5 — Audience and privacy (Accepted, 2026-10-02)

- The game is for **all ages**. Content and language must be suitable for children.
- **No personal data is collected or stored** (for now): no names, e-mail, accounts, analytics, tracking or third-party trackers.
- The save-slot token (D4) is random and not linked to any identity. Application logs must not persist IP addresses or the save token alongside gameplay data.
- Device storage is used only for what is strictly necessary to provide the game (the save-slot token, local settings).

## D6 — Species facts and sources (Accepted, 2026-10-02)

- Every real-world fact (names, habitat, distribution, characteristics, diet, activity, seasonality, conservation) MUST carry a **source reference**.
- Facts are never invented. The agent may draft species content only from a cited source; the project owner reviews species content before it ships.
- Source licences are recorded. Share-alike sources (e.g. Wikipedia, CC BY-SA) are avoided for verbatim text; facts are rewritten in original wording with attribution.
- Gameplay values (rarity, difficulty, rewards) are fictional and never shown as biological facts.
- Species IDs are stable slugs (e.g. `vulpes_vulpes`). The ID **never changes** if the scientific name is later revised; the scientific name is a separate attribute.

## D7 — Content storage (Accepted, 2026-10-02)

- Game content (species, habitats, maps, quests, dialogue, localized content text) lives as **versioned data files in the repository** under `content/`, validated in CI.
- Maps are authored in **Tiled** and stored as Tiled JSON; collision and habitat zones are layers in the same map so client and server read one source.
- The backend loads content at startup and serves it; PostgreSQL stores **player state only**, not content.
- UI strings (menus, buttons, system messages) live in the Angular translation catalog. Content text (species facts, dialogue, quest text) lives with the content, keyed by locale.
- The API never returns player-facing prose for UI messages; it returns stable codes and content IDs.

## D8 — Time and seasons (Deferred)

Whether time of day and seasons follow an in-game clock or the real calendar is undecided. The first vertical slice is fixed to **summer, day**. Any clock is injected so behaviour stays deterministic in tests.

## D9 — OpenSpec tooling (Accepted, 2026-10-02)

The project uses the OpenSpec CLI (`@fission-ai/openspec`, `spec-driven` schema). Specs are organized by **capability** under `openspec/specs/`; work is done as **changes** under `openspec/changes/` and archived to `openspec/changes/archive/`.

## D10 — In-game naming of the NatureDex (Accepted, 2026-10-02)

"NatureDex" is the internal/code name only. The player-facing name is **Terenski dnevnik** (confirmed by the project owner with the first NatureDex change, `add-meadow-walking-skeleton`) — Slovenian and original, to avoid imitating existing franchises.
