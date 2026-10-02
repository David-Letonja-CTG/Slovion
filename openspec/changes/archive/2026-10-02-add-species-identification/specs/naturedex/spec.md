# Spec Delta

## ADDED Requirements

### Requirement: Unidentified entries
An observed but not yet identified species SHALL appear in *Terenski dnevnik* as *Neznana vrsta* with its group (for example *sesalec*) and when it was first observed, plus a hint to observe it again. Its name, facts and sources SHALL NOT be shown.

#### Scenario: Hare observed, not identified
- **WHEN** the player opens *Terenski dnevnik* after answering the hare encounter wrongly
- **THEN** an entry shows *Neznana vrsta* and *sesalec*, but not *poljski zajec*

## MODIFIED Requirements

### Requirement: NatureDex entries from the server
`GET /api/save/naturedex` SHALL return every species the save has observed, oldest observation first. Each entry SHALL contain the species ID, its group, its status (`observed` or `identified`) and the observation time; identified entries SHALL also contain the identification time and the localized species information with its sources. Requests with a missing or unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: One discovery
- **WHEN** a save that identified only `salvia_pratensis` requests its NatureDex
- **THEN** the response contains exactly one entry with ID `salvia_pratensis` and status `identified`

#### Scenario: Observed only
- **WHEN** a save that observed but did not identify `lepus_europaeus` requests its NatureDex
- **THEN** the entry has status `observed`, group `mammal`, and no species information

#### Scenario: Fresh save
- **WHEN** a newly created save requests its NatureDex
- **THEN** the response contains no entries

### Requirement: Entry content
Each identified entry SHALL show the Slovenian common name, the scientific name in italics, the family, habitat, distribution, the seasonal fact labelled by the species group (*Čas cvetenja* for plants, *Čas letanja* for insects, *Prisotnost v Sloveniji* for birds, *Aktivnost* for mammals), identifying characteristics, and a *Viri* (sources) section listing every source used with its title and publisher.

#### Scenario: Reading about the meadow sage
- **WHEN** the player opens *Terenski dnevnik* after identifying the meadow sage
- **THEN** the entry shows *travniška kadulja*, *Salvia pratensis*, and its Slovenian description
- **AND** a *Viri* section lists the sources of those facts

#### Scenario: Label for an insect
- **WHEN** the player reads the identified swallowtail entry
- **THEN** its seasonal fact is labelled *Čas letanja*
