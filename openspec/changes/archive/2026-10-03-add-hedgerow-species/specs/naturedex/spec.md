## MODIFIED Requirements

### Requirement: NatureDex entries from the server
`GET /api/save/naturedex` SHALL return the journal grouped by habitat. It SHALL contain one section per habitat, sorted by habitat order and then by habitat ID. Each section SHALL contain the habitat ID, its localized name, and every species of that habitat, in the order the habitat's content lists them.

Each species SHALL have its ID and a status: `unknown`, `observed` or `identified`.
- Unknown species SHALL carry nothing else, so no group, name or information is revealed.
- Observed and identified species SHALL also carry their group and observation time.
- Identified species SHALL also carry the identification time and the localized species information with its sources.

A species listed in several habitats SHALL appear in each of their sections. Requests with a missing or unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: One discovery
- **WHEN** a save that identified only `salvia_pratensis` requests its NatureDex
- **THEN** the section `tall_grass`, named *Visoka trava*, lists all five meadow species
- **AND** `salvia_pratensis` has status `identified` with its species information
- **AND** the other four have status `unknown` and carry no group, name or information

#### Scenario: Sections in habitat order
- **WHEN** any save requests its NatureDex
- **THEN** the first section is `tall_grass` (*Visoka trava*) and the second is `hedgerow` (*Mejica*), which lists `crataegus_monogyna` and `lanius_collurio`

#### Scenario: Observed only
- **WHEN** a save that observed but did not identify `lepus_europaeus` requests its NatureDex
- **THEN** that species has status `observed`, group `mammal`, and no species information

#### Scenario: Fresh save
- **WHEN** a newly created save requests its NatureDex
- **THEN** every species in every section has status `unknown`

### Requirement: Empty state
When the save has not observed any species, *Terenski dnevnik* SHALL show the grid with every species as a silhouette. Above the grid it SHALL show a Slovenian message encouraging the player to explore.

#### Scenario: Nothing discovered yet
- **WHEN** a new player opens *Terenski dnevnik*
- **THEN** an encouraging message is shown above the sections *Visoka trava 0/5* and *Mejica 0/2*, with every picture a silhouette
