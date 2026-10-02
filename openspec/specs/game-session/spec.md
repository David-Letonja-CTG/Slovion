# game-session Specification

## Purpose

Defines how a player starts and resumes the game: the title screen, anonymous save slots identified only by a token kept on the device, and recovery when a save cannot be used.

## Requirements

### Requirement: Title screen
The game SHALL open on a title screen offering *Nova igra*. It SHALL also offer *Nadaljuj* when this device holds a save token.

#### Scenario: First visit
- **WHEN** a player opens the game on a device with no save token
- **THEN** only *Nova igra* is offered

#### Scenario: Returning player
- **WHEN** a player opens the game on a device that holds a save token
- **THEN** both *Nadaljuj* and *Nova igra* are offered

### Requirement: Anonymous save slot
Starting a new game SHALL create a save slot on the server and return a random token of at least 128 bits, which the client stores on the device. The token SHALL be the only way to access the slot, SHALL be sent only in the `Authorization` header, and SHALL never appear in a URL. No personal data is requested or stored.

#### Scenario: New game
- **WHEN** the player chooses *Nova igra* on a device without a save
- **THEN** the server responds `201` with a new token
- **AND** the token is stored on the device
- **AND** the player enters the meadow at its starting point

#### Scenario: Tokens are unique
- **WHEN** two new games are started
- **THEN** they receive different tokens and separate, empty save slots

### Requirement: Replacing an existing save asks first
Choosing *Nova igra* on a device that already holds a save token SHALL ask for confirmation, because the device keeps only one save. Declining SHALL leave the existing save untouched.

#### Scenario: Player declines
- **WHEN** the player chooses *Nova igra*, is asked to confirm, and declines
- **THEN** the existing token is kept and no new save slot is created

#### Scenario: Player confirms
- **WHEN** the player confirms
- **THEN** a new save slot is created and its token replaces the old one on the device

### Requirement: Continue an existing save
Choosing *Nadaljuj* SHALL enter the meadow at its starting point with the saved progress (discoveries) of the slot identified by the stored token.

#### Scenario: Continue after reload
- **WHEN** a player who discovered a species reloads the page and chooses *Nadaljuj*
- **THEN** the NatureDex still lists that species

### Requirement: Unknown save token
When the server rejects the stored token as unknown, the client SHALL tell the player the saved game could not be found, remove the token from the device, and return to the title screen offering only *Nova igra*.

#### Scenario: Save no longer exists
- **WHEN** the player chooses *Nadaljuj* and the server responds `401` with code `invalid_save_token`
- **THEN** a Slovenian message explains the save was not found
- **AND** the title screen offers only *Nova igra*

### Requirement: Server unavailable
If the server cannot be reached when starting or continuing, the client SHALL show a Slovenian error message, stay on the title screen, and allow retrying. No token SHALL be stored for a failed new game.

#### Scenario: API down during new game
- **WHEN** the player chooses *Nova igra* and the request fails with a network error
- **THEN** an error message is shown, the title screen remains, and no token is stored

### Requirement: Device storage unavailable
If device storage cannot be read or written (e.g. a private window that blocks it), the game SHALL remain playable for the current visit. *Nadaljuj* is then simply not offered on later visits.

#### Scenario: Storage blocked
- **WHEN** writing the token to device storage throws an error during *Nova igra*
- **THEN** the player still enters the meadow and can discover species during this visit
