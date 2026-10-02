# discovery Specification

## Purpose

Defines how a save slot discovers a species: the player interacts with a spot in the world, the server decides which species that is, records the discovery once, and the player is told what they found.

## Requirements

### Requirement: The server decides what was discovered
A discovery request SHALL identify only the map and the spot. The server SHALL determine the species from map content; the client SHALL NOT name the species.

#### Scenario: Discovering the meadow sage
- **WHEN** a valid save sends `POST /api/save/discoveries` with map `dravsko_polje_meadow` and the meadow sage spot ID
- **THEN** the server records a discovery of `salvia_pratensis` for that save

### Requirement: First discovery is recorded with server time
The first discovery of a species by a save SHALL respond `201` with the species ID, `isNew: true`, the discovery time taken from the server clock, and the localized NatureDex entry.

#### Scenario: New species
- **WHEN** a save discovers `salvia_pratensis` for the first time at server time `2026-06-01T10:00:00Z`
- **THEN** the response is `201` with `isNew: true` and `discoveredAt` `2026-06-01T10:00:00Z`

### Requirement: Repeat discoveries are idempotent
Discovering an already discovered species SHALL respond `200` with `isNew: false` and the original discovery time. No duplicate SHALL be stored, including when identical requests arrive at the same time.

#### Scenario: Interacting again
- **WHEN** a save that already discovered `salvia_pratensis` interacts with the spot again
- **THEN** the response is `200` with `isNew: false` and the first `discoveredAt`

#### Scenario: Two requests at once
- **WHEN** two identical first-discovery requests for the same save arrive concurrently
- **THEN** exactly one discovery is stored, one response has `isNew: true` and the other `isNew: false`

### Requirement: Unknown spot
A request naming a map or spot that does not exist, or a spot without a species, SHALL respond `404` with code `unknown_spot` and record nothing.

#### Scenario: Made-up spot
- **WHEN** a save sends a discovery for spot `does_not_exist`
- **THEN** the response is `404` with code `unknown_spot`

### Requirement: Valid save required
Discovery requests without a token or with an unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Missing token
- **WHEN** a discovery request has no `Authorization` header
- **THEN** the response is `401` with code `invalid_save_token`

### Requirement: Discoveries are persisted immediately
A recorded discovery SHALL be stored durably before the response is sent, so it survives page reloads and server restarts.

#### Scenario: API restarted
- **WHEN** the API is restarted after a discovery
- **THEN** the save's NatureDex still contains the species

### Requirement: Player is told what was found
After a discovery the client SHALL show a dialog with the species' Slovenian name: one message for a new entry and another when the species is already recorded. Messages SHALL be gender-neutral. The world SHALL not receive input until the dialog is closed with `Confirm` or `Cancel`.

#### Scenario: New entry message
- **WHEN** the server responds `isNew: true` for `salvia_pratensis`
- **THEN** the dialog announces a new entry for *travniška kadulja* in *Terenski dnevnik*

#### Scenario: Already recorded
- **WHEN** the server responds `isNew: false`
- **THEN** the dialog says the species is already recorded

#### Scenario: Request fails
- **WHEN** the discovery request fails with a network error
- **THEN** a Slovenian error message is shown and, after closing it, the player can move and try again
