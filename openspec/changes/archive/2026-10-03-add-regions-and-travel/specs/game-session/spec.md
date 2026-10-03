## MODIFIED Requirements

### Requirement: Continue an existing save
Choosing *Nadaljuj* SHALL enter the spawn of the save's current region (see `regions`), with the saved progress of the slot identified by the stored token.

#### Scenario: Continue after reload
- **WHEN** a player who discovered a species reloads the page and chooses *Nadaljuj*
- **THEN** the NatureDex still lists that species

#### Scenario: Continue in another region
- **WHEN** a player who travelled to Kočevje reloads the page and chooses *Nadaljuj*
- **THEN** the game continues on the Kočevje map
