# naturedex Specification

## Purpose

Defines the NatureDex — shown to players as *Terenski dnevnik* — a picture grid per habitat of every species, showing which ones the save has not found, observed or identified, with sourced, localized information about each identified species.

## Requirements

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

### Requirement: Opening and closing
The player SHALL open *Terenski dnevnik* with `OpenMenu` from the world. `Cancel` SHALL close an open species page or card and return to the grid. From the grid, `Cancel` SHALL close the journal. While the journal is open the world SHALL receive no input.

#### Scenario: Open and close
- **WHEN** the player presses `M` in the world and then `Escape`
- **THEN** *Terenski dnevnik* opens and then closes, and the player can move again

#### Scenario: Back from a species page
- **WHEN** the player opens an identified species' page and presses `Escape`
- **THEN** the grid is shown again and the journal stays open

### Requirement: Entry content
Opening an identified species SHALL show its page. The page SHALL show:
- the species picture in colour
- the Slovenian common name and the scientific name in italics
- the family, habitat and distribution
- the seasonal fact, labelled by the species group: *Čas cvetenja* for plants, *Čas letanja* for insects, *Prisotnost v Sloveniji* for birds, *Aktivnost* for mammals
- the identifying characteristics
- a *Viri* (sources) section listing every source used, with its title and publisher

The page SHALL have a control that returns to the grid.

#### Scenario: Reading about the meadow sage
- **WHEN** the player opens the identified meadow sage in *Terenski dnevnik*
- **THEN** its page shows *travniška kadulja*, *Salvia pratensis*, and its Slovenian description
- **AND** a *Viri* section lists the sources of those facts

#### Scenario: Label for an insect
- **WHEN** the player opens the identified swallowtail's page
- **THEN** its seasonal fact is labelled *Čas letanja*

### Requirement: Empty state
When the save has not observed any species, *Terenski dnevnik* SHALL show the grid with every species as a silhouette. Above the grid it SHALL show a Slovenian message encouraging the player to explore.

#### Scenario: Nothing discovered yet
- **WHEN** a new player opens *Terenski dnevnik*
- **THEN** an encouraging message is shown above the sections *Visoka trava 0/5* and *Mejica 0/2*, with every picture a silhouette

### Requirement: Unidentified entries
An observed but not yet identified species SHALL appear in the grid as a greyscale picture labelled `???`. Opening it SHALL show a card with *Neznana vrsta*, its group (for example *sesalec*), when it was first observed, and a hint to observe it again. The card SHALL NOT show its name, facts or sources.

#### Scenario: Hare observed, not identified
- **WHEN** the player opens the hare's picture after answering the hare encounter wrongly
- **THEN** a card shows *Neznana vrsta* and *sesalec*, but not *poljski zajec*

### Requirement: Habitat grid
*Terenski dnevnik* SHALL show one section per habitat, in the order the server returns them. Each section SHALL have a heading with the habitat's name and how many of its species are identified out of its total (for example *Visoka trava 1/5*). Below the heading SHALL be a grid of the habitat's species pictures, where each picture shows the species' status:
- **unknown:** a dark silhouette
- **observed:** a greyscale picture
- **identified:** the picture in full colour

#### Scenario: Identifying the hare colours it
- **WHEN** the player identifies the hare and opens *Terenski dnevnik*
- **THEN** the *Visoka trava* section shows *1/5*
- **AND** the hare picture is in colour while the four unknown species are silhouettes

### Requirement: Picture labels
While the pointer is over a picture, or the picture is selected with the keyboard, its label SHALL be shown: the Slovenian common name for an identified species, `???` otherwise. Screen readers SHALL get the name for identified species and a Slovenian "unknown species" text otherwise. Unknown species SHALL NOT open anything. Observed and identified species SHALL open on click, tap or `Confirm`.

#### Scenario: Hovering an identified species
- **WHEN** the player points at the identified hare
- **THEN** the label *poljski zajec* is shown

#### Scenario: Hovering an unknown species
- **WHEN** the player points at a species that the save has not observed
- **THEN** the label `???` is shown and clicking it opens nothing

### Requirement: Keyboard navigation in the grid
When the journal opens, the first picture SHALL be selected:
- `MoveLeft` and `MoveRight` SHALL select the previous or next picture in reading order, across sections.
- `MoveUp` and `MoveDown` SHALL select the picture one row above or below in the same column. When there is no such row in the section, they SHALL select the nearest picture of that column in the adjacent section.
- At the first and last picture of the journal, the selection SHALL stay where it is.
- `Confirm` SHALL open the selected species when it is observed or identified.

#### Scenario: Opening a species with the keyboard
- **WHEN** the player selects the identified hare with the arrow keys and presses `Enter`
- **THEN** the hare's page opens

#### Scenario: Selection stops at the edge
- **WHEN** the first picture is selected and the player presses `MoveLeft`
- **THEN** the first picture stays selected
