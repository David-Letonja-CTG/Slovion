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

## D8 — Time and seasons (Accepted, 2026-10-03)

Time of day and seasons follow an **in-game clock per save**, owned by the server (D3) and derived from the save's age: one real second is one in-game minute, day 1 starts at 08:00 when the save is created, and each season lasts three in-game days (spring → summer → autumn → winter). The clock keeps running while the player is away; the real calendar, real time and the device clock never affect the world. Species that are not available in the current season or time of day **cannot be found** (availability is sourced content, D6). The client shows the conditions with a time-of-day tint and a small indicator only (no seasonal map art). The server clock is injected so behaviour stays deterministic in tests. *(Previously deferred; the first slice was fixed to summer, day.)*

## D9 — OpenSpec tooling (Accepted, 2026-10-02)

The project uses the OpenSpec CLI (`@fission-ai/openspec`, `spec-driven` schema). Specs are organized by **capability** under `openspec/specs/`; work is done as **changes** under `openspec/changes/` and archived to `openspec/changes/archive/`.

## D10 — In-game naming of the NatureDex (Accepted, 2026-10-02)

"NatureDex" is the internal/code name only. The player-facing name is **Terenski dnevnik** (confirmed by the project owner with the first NatureDex change, `add-meadow-walking-skeleton`) — Slovenian and original, to avoid imitating existing franchises.

## D11 — Weather (Accepted, 2026-10-03)

Each region has its own weather: `clear`, `cloudy`, `rain`, `fog` or `snow` (*jasno*, *oblačno*, *dež*, *megla*, *sneg*). It stays the same within each 6-hour in-game period (00:00, 06:00, 12:00, 18:00) and is picked deterministically from the region ID, the in-game day and the period: a 32-bit FNV-1a hash, modulo the region's weights for the current season. It needs no storage and no injected randomness, and every save at the same in-game moment sees the same weather per region. The weights live in the region content and are fictional gameplay data (D6). The server decides the weather (D3); the client only draws what `GET /api/save/weather` reports and reloads it when the period ends.

Weather affects species only where a source supports it: a species' availability may list weathers in which it is also found at any time of day (`alsoInWeather`), for example the salamanders in rain. Weather never hides a species, and has no other gameplay effect yet.

## D12 — Hosting (Accepted, 2026-10-05)

Slovion runs on **one Oracle Cloud Always Free Arm VM** (Ubuntu 24.04) as a Docker Compose stack: Caddy (TLS, the built client, a reverse proxy), the API with the content baked in, and PostgreSQL with its data on a volume. Only ports 80 and 443 are public.

- **Images** are built for `arm64` and `amd64` and stored in the GitHub Container Registry.
- **Deploys:** publishing a GitHub Release (a `vMAJOR.MINOR.PATCH` tag on a commit that passed CI on `main`) deploys it over SSH, behind a health check with an automatic rollback. Merges to `main` only run CI. A container smoke test runs in CI on every pull request.
- **Address:** `<ip>.sslip.io` with a real certificate until a domain is bought; then only the `SITE_ADDRESS` variable changes.
- **Backups:** a daily `pg_dump` goes to OCI Object Storage through a write-only pre-authenticated URL and is kept 14 days.
- **Secrets** live only in the GitHub `production` environment.
- **VM setup:** a runbook and one bootstrap script; no infrastructure-as-code yet.

Details and operations: [hosting.md](hosting.md).
