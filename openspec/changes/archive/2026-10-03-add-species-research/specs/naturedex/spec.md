## MODIFIED Requirements

### Requirement: NatureDex entries from the server
`GET /api/save/naturedex` SHALL return the journal grouped by habitat. It SHALL contain one section per habitat, sorted by habitat order and then by habitat ID. Each section SHALL contain the habitat ID, its localized name, and every species of that habitat, in the order the habitat's content lists them.

Each species SHALL have its ID and a status: `unknown`, `observed` or `identified`.
- Unknown species SHALL carry nothing else, so no group, name or information is revealed.
- Observed and identified species SHALL also carry their group and observation time.
- Identified species SHALL also carry the identification time, their research level (see `species-research`), and the localized species information revealed at that level with the sources of those facts.

A species listed in several habitats SHALL appear in each of their sections. Requests with a missing or unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: One discovery
- **WHEN** a save that identified only `salvia_pratensis` requests its NatureDex
- **THEN** the section `tall_grass`, named *Visoka trava*, lists all five meadow species
- **AND** `salvia_pratensis` has status `identified` with its research level and species information
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

### Requirement: Entry content
Opening an identified species SHALL show its page. The page SHALL show:
- the species picture in colour
- the research level (for example *Raziskano: 2/3*) and, below level 3, a hint that observing the species at another time of day reveals more
- the Slovenian common name and the scientific name in italics
- the family
- the habitat and distribution, once revealed
- the seasonal fact, once revealed, labelled by the species group: *Čas cvetenja* for plants, *Čas letanja* for insects, *Prisotnost v Sloveniji* for birds, *Aktivnost* for mammals
- the identifying characteristics
- a *Viri* (sources) section listing every source of the facts shown, with its title and publisher

The page SHALL have a control that returns to the grid.

#### Scenario: Reading about the meadow sage
- **WHEN** the player opens the identified meadow sage in *Terenski dnevnik*
- **THEN** its page shows *travniška kadulja*, *Salvia pratensis*, and its Slovenian description
- **AND** a *Viri* section lists the sources of those facts

#### Scenario: A page with hidden facts
- **WHEN** the player opens the sage at research level 1
- **THEN** the page shows *Raziskano: 1/3* and the hint to observe it at another time of day, and no habitat, distribution or seasonal fact

#### Scenario: Label for an insect
- **WHEN** the player opens the identified swallowtail's page at research level 3
- **THEN** its seasonal fact is labelled *Čas letanja*
