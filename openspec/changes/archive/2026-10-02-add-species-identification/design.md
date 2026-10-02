# Design

## Context

This builds on `add-meadow-walking-skeleton`:
- spots in Tiled maps, decided by the server
- the `discoveries` table, written with `INSERT … ON CONFLICT`
- `DiscoveryService`
- the play screen with overlays and the one-consumer input routing
- the strict content validator

Motivation: see proposal.md. Requirements: the four spec deltas.

Relies on these decisions:
- **D1:** observation puzzle, 3 clues, 3–4 candidates, a wrong answer only loses the identification
- **D2:** no capture
- **D3:** the server decides the species and judges answers; the client is trusted for presentation (clues are sent together and revealed by the client)
- **D6:** sourced facts, with owner review
- **D7:** content as files

## Goals / Non-Goals

**Goals:** an identification loop that is server-authoritative, deterministic in tests, and reuses sourced facts as clues; and *Terenski dnevnik* stages (observed → identified) that later changes (habitat search, research levels) can extend.

**Non-Goals:** scoring, artwork, random encounters (see proposal).

## Decisions

### 1. Domain and state

- `SpeciesDiscovery` becomes the save's NatureDex record:
  - `ObservedAt`: renamed from `DiscoveredAt`
  - `IdentifiedAt?`: new, plus an idempotent `Identify(at)`
- `Encounter` (new): `Id`, `SaveSlotId`, `SpeciesId`, `MapId`, `SpotId`, `Candidates` (ordered species IDs), `CreatedAt`, `ClosedAt?`.
- `IRandomSource` (Application port: `Next(maxExclusive)`):
  - production: `Random.Shared`
  - tests: a seeded instance

### 2. Candidates

- Take every other species ID, sorted ordinally so the result doesn't depend on catalog order.
- Shuffle with Fisher–Yates using `IRandomSource` and take the first 3.
- Add the correct species and shuffle again.

With five species this always yields four candidates. "Prefer the same group" is not used yet, because there are too few species per group to matter. It can be revisited when the catalog grows.

### 3. Persistence

- **Migration `AddEncounters`:**
  - rename `discoveries.discovered_at` → `observed_at`
  - add `identified_at timestamptz NULL`, and **set it to `observed_at` for existing rows**: they were completed discoveries in the walking skeleton
  - create `encounters`:
    - `id uuid PK`
    - `save_slot_id FK → save_slots ON DELETE CASCADE`
    - `species_id`, `map_id`, `spot_id` (text)
    - `candidates text[]`
    - `created_at`, `closed_at NULL`
  - add a **partial unique index** on `save_slot_id WHERE closed_at IS NULL`, so the database guarantees at most one open encounter per save
- **Starting an encounter** happens in one transaction:
  1. close any open encounter
  2. insert the new one
  3. record the observation (existing `ON CONFLICT DO NOTHING`)

  If two concurrent starts collide on the partial index, the loser retries once.
- **Answering** closes atomically with `UPDATE encounters SET closed_at = … WHERE id = @id AND save_slot_id = @slot AND closed_at IS NULL`. Zero rows means `unknown_encounter`, which also prevents double answers. The candidate check happens before closing, so a `400` leaves the encounter open (spec).
- **Identifying** uses `UPDATE discoveries SET identified_at = @now WHERE … AND identified_at IS NULL`, so it is idempotent.

### 4. API

| Endpoint | Response |
|---|---|
| `POST /api/save/encounters` `{mapId, spotId}` | `201 {encounterId, group, clues[], candidates[{speciesId, name}]}` · `200 {alreadyIdentified: true, entry}` · `404 unknown_spot` |
| `POST /api/save/encounters/{id}/identification` `{speciesId}` | `200 {correct, species{speciesId, name}, entry?}` · `404 unknown_encounter` · `400 bad_request` |
| `GET /api/save/naturedex` | entries `{speciesId, group, status, observedAt, identifiedAt?, species?}` |

- `POST /api/save/discoveries` is removed; its integration tests move to the new endpoints.
- Content language negotiation is unchanged (clues and names use the negotiated language).

### 5. Content

- Each species gains a `group` and `"identification": { "clues": [i, j, k] }`, where the clues are 0-based indices into `characteristics`. The validator checks that there are exactly 3, that they are distinct, and that they are in range (species-catalog spec). The sage file gains these fields too.
- **Tileset:** grows to 8×2 tiles (128×32) with four new placeholder spot tiles: dandelion, hare, skylark and swallowtail. Map tile IDs for existing tiles don't change.
- **Map:** four new `spot` objects, each reachable on open ground and away from the sage. The E2E path (spawn → sage) doesn't change.

### 6. Client

- **`IdentificationDialog`** (input: the encounter; output: answer or leave). Its option list is `[Nov namig?] + candidates + [Odidi]`.
  - The play screen forwards UI actions: `MoveUp`/`MoveDown` move the selection, `Confirm` activates it, `Cancel` leaves.
  - Mouse and touch can click any option.
  - It reuses the existing overlay styles and focus handling.
- **Play-screen overlay states:** `encounter`, `result` (correct/wrong), `known` (already identified), `naturedex`, `error`.
- **`NatureDexPanel`** renders observed entries as *Neznana vrsta*. The season label key depends on the group.
- **E2E:** the demo path now answers the sage encounter by clicking *travniška kadulja*. A second E2E test answers wrongly and then checks the *Neznana vrsta* entry.

## Species content draft (for owner review — D6)

**Approved by the project owner on 2026-10-02**, together with the UI text below. The ⚠ items are accepted as drafted:
- the dandelion family follows the Slovenian source (*radičevke (Cichoriaceae)*)
- the hare family shows only the Latin *Leporidae*
- the hare activity combines both sources

The owner also decided to keep the current backend folder structure for now.

Facts are paraphrased in original Slovenian wording, never copied verbatim.

### New sources

All accessed 2026-10-02.

| ID | Source | Publisher | URL | Licence / use |
|---|---|---|---|---|
| `nrp-skrjanec` | Poljski škrjanec | Notranjski regijski park | https://www.notranjski-park.si/izobrazevalne-vsebine/zivalski-svet/ptici/skrjanci/poljski-skrjanec | © Notranjski regijski park; paraphrased |
| `nrp-lastovicar` | Lastovičar | Notranjski regijski park | https://notranjski-park.si/izobrazevalne-vsebine/zivalski-svet/metulji/lastovicarji/lastovicar | © Notranjski regijski park; paraphrased |
| `nrp-regrat` | Navadni regrat | Notranjski regijski park | https://notranjski-park.si/odkrijte/enciklopedija/rastlinski-svet/radicevke/navadni-regrat | © Notranjski regijski park; paraphrased |
| `dopps` | Ptice Slovenije – Škrjanci | DOPPS – BirdLife Slovenija | https://ptice.si/ptice-in-ljudje/ptice-slovenije/skrjanci/ | No licence stated; paraphrased |
| `lzs` | Poljski zajec | Lovska zveza Slovenije | https://www.lovska-zveza.si/prostozivece-zivali/sesalci/poljski-zajec/ | No licence stated; paraphrased |
| `gis` | Poljski zajec | Gozdarski inštitut Slovenije (zdravgozd.si) | https://www.zdravgozd.si/prirocnik/zapis.aspx?idso=778 | No licence stated; paraphrased |
| `bf-kzn` | Poljski zajec (Kmetovati z naravo) | Univerza v Ljubljani, Biotehniška fakulteta | https://kmetovati-z-naravo.si/narava_na_kmetiji/poljski-zajec/ | © kmetovati-z-naravo.si; paraphrased |
| `gbif-*` | GBIF Backbone Taxonomy entries 7952072, 8077224, 8225376, 5394163 | GBIF Secretariat | https://www.gbif.org/species/{key} | CC BY 4.0 |

### Navadni regrat — `taraxacum_officinale` (group `plant`)

| Fact | Slovenian text (draft) | Sources |
|---|---|---|
| Name | navadni regrat | `nrp-regrat` |
| Scientific name | Taraxacum officinale Weber ex F.H.Wigg. | `gbif-5394163` |
| Family | radičevke (Cichoriaceae) ⚠ | `nrp-regrat` |
| Habitat | Gojeni travniki, robovi poti, stari zidovi in obdelane površine; raste na svežih, z dušikom bogatih tleh. | `nrp-regrat` |
| Distribution | Raste po vsej Sloveniji. | `nrp-regrat` |
| Season (*Čas cvetenja*) | Cveti od marca do maja, včasih še oktobra. | `nrp-regrat` |
| Characteristic 0 | Zraste od 5 do 30 cm visoko. | `nrp-regrat` |
| Characteristic 1 | Listi rastejo v pritlični rozeti; so suličasti in globoko zarezani. | `nrp-regrat` |
| Characteristic 2 | Košek sestavljajo številni rumeni jezičasti cvetovi. | `nrp-regrat` |
| Characteristic 3 | Rastlina vsebuje bel sok. | `nrp-regrat` |
| Clues | 2, 1, 3 | — |

⚠ The park uses the older family *radičevke (Cichoriaceae)*. GBIF places the species in *Asteraceae*. The draft follows the Slovenian source. Please confirm, or I'll switch to the GBIF family once I have a Slovenian source for its name.

### Poljski zajec — `lepus_europaeus` (group `mammal`)

| Fact | Slovenian text (draft) | Sources |
|---|---|---|
| Name | poljski zajec | `lzs`, `gis` |
| Scientific name | Lepus europaeus Pallas, 1778 | `gbif-7952072` |
| Family | Leporidae ⚠ | `gbif-7952072`, `gis` |
| Habitat | Odprta kmetijska krajina z različnimi poljščinami, mejicami, travniškimi pasovi in ekstenzivnimi travniki. | `bf-kzn` |
| Distribution | Pri nas je splošno razširjen, razen v alpskem visokogorju; največ ga je v nižinah subpanonskega in subsredozemskega sveta. | `gis`, `lzs` |
| Season (*Aktivnost*) | Dejaven je predvsem ponoči in v mraku, pa tudi podnevi. ⚠ | `gis`, `lzs` |
| Characteristic 0 | Telo je dolgo od 50 do 70 cm, rep od 7 do 11 cm. | `gis` |
| Characteristic 1 | Hrbet je v sredini rjav, trebuh pa povsem bel. | `lzs` |
| Characteristic 2 | Rep je zgoraj črn in spodaj bel. | `lzs` |
| Characteristic 3 | Teče s hitrostjo do 72 km/h in dela več kot 3 m dolge skoke. | `gis` |
| Clues | 1, 2, 3 | — |

Notes for this species:
- ⚠ **Family:** I didn't find a source with the Slovenian family name, so only the Latin name is shown.
- ⚠ **Activity:** the sources disagree. `gis` says night and dusk, `lzs` says day and night, and the draft combines them.
- **Weight left out:** the sources also disagree on weight (`lzs` up to 5 kg, `gis` 2.5–6.5 kg).

### Poljski škrjanec — `alauda_arvensis` (group `bird`)

| Fact | Slovenian text (draft) | Sources |
|---|---|---|
| Name | poljski škrjanec | `nrp-skrjanec`, `dopps` |
| Scientific name | Alauda arvensis Linnaeus, 1758 | `gbif-8077224` |
| Family | škrjanci (Alaudidae) | `dopps`, `gbif-8077224` |
| Habitat | Odprta obdelana krajina: polja in travniki z nizko ali redko vegetacijo. | `nrp-skrjanec`, `dopps` |
| Distribution | V Sloveniji je pogost gnezdilec, vendar njegova populacija v zadnjih desetletjih močno upada. | `nrp-skrjanec`, `dopps` |
| Season (*Prisotnost v Sloveniji*) | Pri nas je stalnica; pred hudim mrazom se izjemoma umakne v kraje brez snega. | `nrp-skrjanec` |
| Characteristic 0 | Dolg je od 16 do 18 cm. | `nrp-skrjanec` |
| Characteristic 1 | Po trebuhu je umazano bel, po hrbtu sivkasto rjav in izrazito vzdolžno progast. | `nrp-skrjanec` |
| Characteristic 2 | Zunanji rob repa je bel. | `nrp-skrjanec` |
| Characteristic 3 | Poje med počasnim dviganjem v zrak in lahko lebdi tudi več kot 100 m visoko. | `nrp-skrjanec` |
| Characteristic 4 | Gnezdi na tleh. | `dopps`, `nrp-skrjanec` |
| Clues | 3, 1, 4 | — |

### Lastovičar — `papilio_machaon` (group `insect`)

| Fact | Slovenian text (draft) | Sources |
|---|---|---|
| Name | lastovičar | `nrp-lastovicar` |
| Scientific name | Papilio machaon Linnaeus, 1758 | `gbif-8225376` |
| Family | lastovičarji (Papilionidae) | `nrp-lastovicar`, `gbif-8225376` |
| Habitat | Glede življenjskega prostora ni izbirčen; pojavlja se na vlažnih in na suhih območjih. | `nrp-lastovicar` |
| Distribution | Je eden največjih metuljev v Sloveniji, vendar se nikjer ne pojavlja množično. | `nrp-lastovicar` |
| Season (*Čas letanja*) | Navadno ima dve generaciji: prva leta od aprila do junija, druga od julija do oktobra. | `nrp-lastovicar` |
| Characteristic 0 | Razpon kril meri od 55 do 70 mm. | `nrp-lastovicar` |
| Characteristic 1 | Telo in krila so rumeni z značilnim vzorcem črnih lis in črt. | `nrp-lastovicar` |
| Characteristic 2 | Na zadnjih krilih ima repke, temno modre lise in oranžno okroglo liso, ki skupaj delujejo kot lažne oči. | `nrp-lastovicar` |
| Characteristic 3 | Gosenica je zelena do skoraj bela, s prečnimi črnimi progami in oranžnimi pegami. | `nrp-lastovicar` |
| Characteristic 4 | Gosenice se hranijo s kobulnicami, na primer s korenjem in peteršiljem. | `nrp-lastovicar` |
| Clues | 1, 2, 3 | — |

### Travniška kadulja — `salvia_pratensis` (existing; gains group and clues)

Group `plant`. Clues: 3 (flowers), 1 (square stem), 2 (leaf rosette).

## UI text draft (`sl.json` additions and changes)

| Key | Text |
|---|---|
| `identification.heading.plant` / `.mammal` / `.bird` / `.insect` | Opaziš rastlino / Opaziš sesalca / Opaziš ptico / Opaziš žuželko |
| `identification.question` | Katera vrsta je to? |
| `identification.nextClue` | Nov namig |
| `identification.leave` | Odidi |
| `identification.correct` | Pravilno! Nov vnos v Terenskem dnevniku: {{name}} |
| `identification.wrong` | Žal ne – to je bila vrsta {{name}}. Opazuj jo znova in jo prepoznaj. |
| `species.group.plant` / `.mammal` / `.bird` / `.insect` | rastlina / sesalec / ptica / žuželka |
| `naturedex.unknown` | Neznana vrsta |
| `naturedex.observedAt` | Opaženo |
| `naturedex.observeAgain` | Opazuj jo znova in jo prepoznaj. |
| `naturedex.season.plant` / `.insect` / `.bird` / `.mammal` | Čas cvetenja / Čas letanja / Prisotnost v Sloveniji / Aktivnost (replaces `naturedex.season`) |
| `errors.unknown_encounter` | To opazovanje ni več veljavno. Poskusi znova. |

- `discovery.new` is removed; `discovery.known` stays, for species that are already identified.
- All copy is gender-neutral: second-person present ("Opaziš") or imperatives.

## Implementation notes (deviations recorded during apply)

- **Services:** `DiscoveryService` was split into `EncounterService` (start/answer) and `NatureDexService` (listing) instead of growing one class.
- **No single transaction for starting:** recording the observation and opening the encounter are two atomic steps, not one transaction (§3). If the second fails, the observation is still recorded and the next interaction opens the encounter, which is harmless. The "one open encounter" guarantee stays transactional inside `EncounterRepository`.
- **Group as a domain type:** `SpeciesGroup` is an enum with lowercase content/API names, and `Species.Clues` holds the clue indices (the only gameplay value on `Species`, as its doc comment notes).
- **`IRandomSource.NextIndex`:** named this way because `Next` is a reserved word in VB (analyzer CA1716).
- **Tileset:** declared as an 8×2 grid with 16 tiles, of which 12–15 are still empty.
- **UI text beyond the approved draft:** *Rastišče* is a plant term, so the habitat label is per group as well: `naturedex.habitat.plant` = *Rastišče*, and the animal groups use *Življenjski prostor*.
- **Dev tooling:** the dev proxy is now `proxy.conf.mjs`, which reads `SLOVION_API_URL`. The Playwright ports are configurable (`E2E_API_PORT`, `E2E_CLIENT_PORT`), and the E2E API builds in Release. Together these let the E2E tests run next to a developer's own Debug servers, which lock the Debug output folder.
- **Manual-check observation:** journal entries appeared out of order once during manual testing. The cause was a ~8-minute backwards correction of the Windows system clock in the middle of the run, not the code: entries are ordered by server timestamps, and that ordering is covered by unit tests.

## Risks / Trade-offs

- **[Revealing the right answer after a wrong guess makes the next try trivial]** → This is accepted for learning value: immediate, correct feedback. Habitat search (next change) adds variety, and scoring can reward first-try answers later.
- **[Names only, no pictures]** → The puzzle relies on reading the clues. Species art is a later content task.
- **[The client sees all clues at once (D3 trusted client)]** → This is single-player with nothing to gain by cheating. The answer itself is only revealed after a guess.
- **[Breaking API change]** → No public deployment exists, and the client and API ship together.
- **[Concurrent encounter starts]** → The partial unique index plus one retry; covered by an integration test.

## Open Questions

- The ⚠ items in the content draft (regrat family, hare family name, hare activity). They need an owner decision, but they don't change specs or tasks.
