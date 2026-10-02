# Spec Delta

## ADDED Requirements

### Requirement: First observation is recorded
Starting the first encounter with a species SHALL record that the save has **observed** it, using the server clock. The species then appears in the save's NatureDex as observed until it is identified.

#### Scenario: Observing the hare for the first time
- **WHEN** a save starts its first encounter with `lepus_europaeus` at server time `2026-06-02T08:00:00Z`
- **THEN** the save's NatureDex lists `lepus_europaeus` as observed at `2026-06-02T08:00:00Z`

## MODIFIED Requirements

### Requirement: The server decides what was discovered
An encounter request SHALL identify only the map and the spot. The server SHALL determine the species from map content; the client SHALL NOT name the species, and responses SHALL NOT reveal which species it is until it has been identified or answered.

#### Scenario: Discovering the meadow sage
- **WHEN** a valid save sends `POST /api/save/encounters` with map `dravsko_polje_meadow` and the meadow sage spot ID
- **THEN** the server opens an encounter for `salvia_pratensis` without naming it in the response

### Requirement: Repeat discoveries are idempotent
Observing an already observed species SHALL NOT create a second record or change its first observation time, including when identical requests arrive at the same time. Identifying an already identified species SHALL NOT change its identification time.

#### Scenario: Interacting again
- **WHEN** a save that already observed `lepus_europaeus` starts another encounter with it
- **THEN** its first observation time is unchanged

#### Scenario: Two requests at once
- **WHEN** two first-encounter requests for the same species and save arrive concurrently
- **THEN** exactly one observation is stored

### Requirement: Unknown spot
An encounter request naming a map or spot that does not exist, or a spot without a species, SHALL respond `404` with code `unknown_spot` and record nothing.

#### Scenario: Made-up spot
- **WHEN** a save starts an encounter at spot `does_not_exist`
- **THEN** the response is `404` with code `unknown_spot`

### Requirement: Valid save required
Encounter and identification requests without a token or with an unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: Missing token
- **WHEN** an encounter request has no `Authorization` header
- **THEN** the response is `401` with code `invalid_save_token`

### Requirement: Discoveries are persisted immediately
Observations and identifications SHALL be stored durably before the response is sent, so they survive page reloads and server restarts.

#### Scenario: API restarted
- **WHEN** the API is restarted after a species was identified
- **THEN** the save's NatureDex still lists the species as identified

## REMOVED Requirements

### Requirement: First discovery is recorded with server time
**Reason**: Interacting with a spot no longer completes a discovery; it starts an observation encounter, and the species is only recorded as identified after a correct answer.
**Migration**: Use `POST /api/save/encounters` followed by `POST /api/save/encounters/{id}/identification` (see the `identification` capability). Existing discoveries are migrated to identified entries.

### Requirement: Player is told what was found
**Reason**: Replaced by the identification dialog and its result message.
**Migration**: See the requirements "Identification dialog" and "Result message" in the `identification` capability.
