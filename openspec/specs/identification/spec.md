# identification Specification

## Purpose

Defines how a player identifies a real species by observing it: an encounter offers sourced clues and a choice of candidate species, the server judges the answer, and a correct identification unlocks the species' full entry in *Terenski dnevnik*.

## Requirements

### Requirement: Starting an encounter
Interacting with a species spot SHALL send `POST /api/save/encounters` with the map and spot. For a species the save has not yet identified, the server SHALL respond `201` with an encounter ID, the species group, its clues and its candidates, without revealing which candidate is correct.

#### Scenario: Observing the dandelion
- **WHEN** a save that has not identified `taraxacum_officinale` starts an encounter at its spot
- **THEN** the response is `201` with an `encounterId`, group `plant`, three clues and four candidates
- **AND** the response does not say which candidate is `taraxacum_officinale`

#### Scenario: Species already identified
- **WHEN** a save that already identified `salvia_pratensis` interacts with the sage spot
- **THEN** the response is `200` with `alreadyIdentified: true` and the species' NatureDex entry, and no encounter is opened

### Requirement: Clues are sourced characteristics
An encounter's clues SHALL be the species' identifying characteristics declared as clues in its content, in their declared order and in the requested language. Clues SHALL never contain the species' name.

#### Scenario: Clue text
- **WHEN** an encounter for `taraxacum_officinale` is started in Slovenian
- **THEN** every clue equals one of its sourced Slovenian characteristics

### Requirement: Candidates
An encounter SHALL offer four candidates (or every species, if fewer than four exist): the correct species exactly once and the others chosen from the catalog without duplicates, in an order determined by the server's random source. Each candidate SHALL carry its species ID and localized name.

#### Scenario: Four distinct candidates
- **WHEN** an encounter is started while five species exist
- **THEN** it offers four different species, one of them correct

#### Scenario: Deterministic with a fixed random source
- **WHEN** two encounters for the same species are started with identically seeded random sources
- **THEN** both offer the same candidates in the same order

### Requirement: One open encounter per save
A save SHALL have at most one open encounter. Starting a new encounter SHALL close any open one, which can then no longer be answered.

#### Scenario: Walking away and observing something else
- **WHEN** a save opens an encounter at the hare spot and then starts one at the skylark spot
- **THEN** answering the hare encounter responds `404` with code `unknown_encounter`

### Requirement: Answering an encounter
`POST /api/save/encounters/{id}/identification` with a candidate's species ID SHALL close the encounter and respond `200` with whether the answer is correct and the correct species' ID and name. A correct answer SHALL mark the species identified at the server's current time and include its NatureDex entry. A wrong answer SHALL change nothing else.

#### Scenario: Correct answer
- **WHEN** the save answers `taraxacum_officinale` for the dandelion encounter at server time `2026-06-02T09:00:00Z`
- **THEN** the response has `correct: true` and the entry is identified at `2026-06-02T09:00:00Z`

#### Scenario: Wrong answer
- **WHEN** the save answers `lepus_europaeus` for the dandelion encounter
- **THEN** the response has `correct: false` and names `taraxacum_officinale` as the correct species
- **AND** the dandelion stays observed but not identified

#### Scenario: Answering twice
- **WHEN** the save answers the same encounter a second time
- **THEN** the response is `404` with code `unknown_encounter`

### Requirement: Invalid answers
An answer for an encounter that does not exist, is closed, or belongs to another save SHALL respond `404` with code `unknown_encounter`. An answer naming a species that is not among the encounter's candidates SHALL respond `400` with code `bad_request` and leave the encounter open. Requests without a valid save token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Another save's encounter
- **WHEN** a save answers an encounter opened by a different save
- **THEN** the response is `404` with code `unknown_encounter`

#### Scenario: Species that was not offered
- **WHEN** the save answers with a species ID that was not a candidate
- **THEN** the response is `400` with code `bad_request` and the encounter can still be answered

### Requirement: Identification dialog
The client SHALL show an observation dialog with a heading for the species group, the first clue, a button revealing the next clue (until all are shown), the candidates by Slovenian name, and a way to leave. `MoveUp`/`MoveDown` SHALL move the selection, `Confirm` SHALL activate it and `Cancel` SHALL leave. Leaving abandons the encounter but keeps the observation. The world SHALL receive no input while the dialog is open.

#### Scenario: Revealing clues
- **WHEN** the dialog opens and the player chooses *Nov namig* twice
- **THEN** three clues are shown and *Nov namig* is no longer offered

#### Scenario: Choosing with the keyboard
- **WHEN** the player presses `ArrowDown` until a candidate is selected and presses `Enter`
- **THEN** that candidate is sent as the answer

#### Scenario: Leaving
- **WHEN** the player presses `Escape` in the dialog
- **THEN** the dialog closes without an answer and the player can move again

### Requirement: Result message
After answering, the client SHALL tell the player the result in gender-neutral Slovenian: a correct answer announces the new *Terenski dnevnik* entry; a wrong answer names the correct species and invites observing it again. Closing the message SHALL return input to the world. A failed request SHALL show a Slovenian error message and return input to the world after closing.

#### Scenario: Correct
- **WHEN** the server responds `correct: true` for `taraxacum_officinale`
- **THEN** the message announces a new entry for *navadni regrat* in *Terenski dnevnik*

#### Scenario: Wrong
- **WHEN** the server responds `correct: false` naming `taraxacum_officinale`
- **THEN** the message says the species was *navadni regrat* and suggests observing it again
