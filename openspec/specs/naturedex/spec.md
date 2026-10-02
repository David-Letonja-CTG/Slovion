# naturedex Specification

## Purpose

Defines the NatureDex — shown to players as *Terenski dnevnik* — which lists the species a save has discovered together with sourced, localized information about each.

## Requirements

### Requirement: NatureDex entries from the server
`GET /api/save/naturedex` SHALL return the discovered species of the save, oldest discovery first. Each entry SHALL contain the species ID, discovery time, and localized species information with its sources. Requests with a missing or unknown token SHALL respond `401` with code `invalid_save_token`.

#### Scenario: One discovery
- **WHEN** a save that discovered only `salvia_pratensis` requests its NatureDex
- **THEN** the response contains exactly one entry with ID `salvia_pratensis`

#### Scenario: Fresh save
- **WHEN** a newly created save requests its NatureDex
- **THEN** the response contains no entries

### Requirement: Opening and closing
The player SHALL open *Terenski dnevnik* with `OpenMenu` from the world and close it with `Cancel`. While it is open the world SHALL receive no input.

#### Scenario: Open and close
- **WHEN** the player presses `M` in the world and then `Escape`
- **THEN** *Terenski dnevnik* opens and then closes, and the player can move again

### Requirement: Entry content
Each entry SHALL show the Slovenian common name, the scientific name in italics, the family, habitat, distribution, flowering or activity period, identifying characteristics, and a *Viri* (sources) section listing every source used with its title and publisher.

#### Scenario: Reading about the meadow sage
- **WHEN** the player opens *Terenski dnevnik* after discovering the meadow sage
- **THEN** the entry shows *travniška kadulja*, *Salvia pratensis*, and its Slovenian description
- **AND** a *Viri* section lists the sources of those facts

### Requirement: Empty state
When no species has been discovered, *Terenski dnevnik* SHALL show a Slovenian message encouraging the player to explore.

#### Scenario: Nothing discovered yet
- **WHEN** a new player opens *Terenski dnevnik*
- **THEN** an empty-state message is shown instead of a list
