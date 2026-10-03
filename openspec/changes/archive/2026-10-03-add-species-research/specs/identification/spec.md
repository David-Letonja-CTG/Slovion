## MODIFIED Requirements

### Requirement: Starting an encounter
Interacting with a species spot SHALL send `POST /api/save/encounters` with the map and spot. For a species the save has not yet identified, the server SHALL respond `201` with an encounter ID, the species group, its clues and its candidates, without revealing which candidate is correct. For an identified species it SHALL respond `200` without an encounter, saying whether the sighting advanced the species' research (see `species-research`), with the species' NatureDex entry.

#### Scenario: Observing the dandelion
- **WHEN** a save that has not identified `taraxacum_officinale` starts an encounter at its spot
- **THEN** the response is `201` with an `encounterId`, group `plant`, three clues and four candidates
- **AND** the response does not say which candidate is `taraxacum_officinale`

#### Scenario: Species already identified
- **WHEN** a save that already identified `salvia_pratensis` interacts with the sage spot
- **THEN** the response is `200` with `alreadyIdentified: true`, `researched` true or false, and the species' NatureDex entry, and no encounter is opened
