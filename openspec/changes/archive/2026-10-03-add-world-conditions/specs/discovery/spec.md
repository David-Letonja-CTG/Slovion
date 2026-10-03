## ADDED Requirements

### Requirement: Spots follow the conditions
When the species of a spot is not available at the save's current in-game time, an encounter request for that spot SHALL respond `200` with `found: false`. It SHALL record nothing and open no encounter. The client SHALL then show a gender-neutral Slovenian message that nothing is here right now, with a hint to come back at another time. That message SHALL be closable with `Confirm` or `Cancel`.

#### Scenario: Dandelion spot in summer
- **WHEN** a save interacts with the dandelion spot while its in-game season is summer
- **THEN** the response is `200` with `found: false` and the save's NatureDex is unchanged

#### Scenario: Message for an empty spot
- **WHEN** the server answers a spot interaction with `found: false`
- **THEN** a Slovenian message says that nothing is here right now and to try again at another time, and after closing it the player can move again

#### Scenario: Same spot in spring
- **WHEN** a save interacts with the dandelion spot in spring
- **THEN** an encounter opens as usual
