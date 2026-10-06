# naturedex Specification

## Purpose

Defines the NatureDex — shown to players as *Terenski dnevnik* — a picture grid per habitat of every species, showing which ones the save has not found, observed or identified, with sourced, localized information about each identified species.

## Requirements

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

### Requirement: Empty state
When the save has not observed any species, *Terenski dnevnik* SHALL show its pages with every species as a silhouette. Above the page it SHALL show a Slovenian message encouraging the player to explore.

#### Scenario: Nothing discovered yet
- **WHEN** a new player opens *Terenski dnevnik*
- **THEN** an encouraging message is shown above the *Visoka trava 0/5* page, with every picture a silhouette

### Requirement: Unidentified entries
An observed but not yet identified species SHALL appear in the grid as a greyscale picture labelled `???`. Opening it SHALL show a card with *Neznana vrsta*, its group (for example *sesalec*), when it was first observed, and a hint to observe it again. The card SHALL NOT show its name, facts or sources.

#### Scenario: Hare observed, not identified
- **WHEN** the player opens the hare's picture after answering the hare encounter wrongly
- **THEN** a card shows *Neznana vrsta* and *sesalec*, but not *poljski zajec*

### Requirement: Habitat grid
*Terenski dnevnik* SHALL show one habitat at a time, as a page, in the order the server returns the habitats. When the journal opens, the first habitat's page SHALL be shown. A page SHALL show the habitat's name and how many of its species are identified out of its total (for example *Visoka trava 1/5*), and a grid of the habitat's species pictures, where each picture shows the species' status:
- **unknown:** a dark silhouette
- **observed:** a greyscale picture
- **identified:** the picture in full colour

The player SHALL reach every habitat without scrolling:
- **Where there is room** (at least 640×544 CSS pixels): an index beside the page lists every habitat with its progress and marks the one shown. Choosing a habitat in it SHALL show its page. A habitat whose species are all identified SHALL stand out in the index.
- **Otherwise** (upright phones, phones held sideways): previous and next buttons beside the habitat's name turn the pages, and a row of marks shows which page of how many is shown.

On desktops from 1024×600, tablets, phones held upright from 390×844 and phones held sideways from 844×390, every page SHALL fit on screen without scrolling, with even space on both sides of the grid; smaller screens MAY scroll. Where there is room the journal SHALL grow with the screen, up to 80 rem wide, with pictures at whole multiples of their pixels (64, 96 or 128 CSS pixels). Every button SHALL be at least 44 CSS pixels in both directions on touch screens.

#### Scenario: Identifying the hare colours it
- **WHEN** the player identifies the hare and opens *Terenski dnevnik*
- **THEN** the *Visoka trava* page shows *1/5*
- **AND** the hare picture is in colour while the four unknown species are silhouettes

#### Scenario: Choosing a habitat in the index
- **WHEN** the player opens *Terenski dnevnik* on a 1366×768 screen and clicks *Mokrišče* in the index
- **THEN** the *Mokrišče* page with its ten species is shown, and the index marks *Mokrišče*

#### Scenario: Turning pages on a phone
- **WHEN** the player opens *Terenski dnevnik* on a phone held upright and taps the next button
- **THEN** the *Mejica* page is shown, and the marks show the second page

#### Scenario: No scrolling
- **WHEN** the largest habitat's page (*Mokrišče*, ten species) is shown on a 1366×768 screen, a 390×844 phone held upright or an 844×390 phone held sideways
- **THEN** the whole page fits on screen without scrolling

### Requirement: Picture labels
Every picture SHALL show its label below it at all times: the Slovenian common name for an identified species, a dimmed `???` otherwise. Screen readers SHALL get the name for identified species and a Slovenian "unknown species" text otherwise. Unknown species SHALL NOT open anything. Observed and identified species SHALL open on click, tap or `Confirm`.

#### Scenario: Hovering an identified species
- **WHEN** the player opens *Terenski dnevnik* after identifying the hare, and points at it or not
- **THEN** the label *poljski zajec* is shown under its picture

#### Scenario: Hovering an unknown species
- **WHEN** the save has not observed the skylark, and the player points at its picture or not
- **THEN** its picture is labelled `???` and clicking it opens nothing

### Requirement: Keyboard navigation in the grid
When the journal opens, the first picture of the first page SHALL be selected:
- `MoveLeft` and `MoveRight` SHALL select the previous or next picture in reading order. Past the first or last picture of a page, they SHALL turn to the previous or next page and select its last or first picture.
- `MoveUp` and `MoveDown` SHALL select the picture one row above or below in the same column, by the columns the page shows. When there is no such row on the page, they SHALL turn to the adjacent page and select the nearest picture of that column.
- At the first picture of the first page and the last picture of the last page, the selection SHALL stay where it is.
- `Confirm` SHALL open the selected species when it is observed or identified.

Choosing a habitat in the index or turning a page with the buttons SHALL select that page's first picture. The touch controls SHALL drive the selection exactly as the keys do (`touch-controls`).

#### Scenario: Opening a species with the keyboard
- **WHEN** the player selects the identified hare with the arrow keys and presses `Enter`
- **THEN** the hare's page opens

#### Scenario: Selection stops at the edge
- **WHEN** the first picture is selected and the player presses `MoveLeft`
- **THEN** the first picture stays selected

#### Scenario: Turning the page with the arrows
- **WHEN** the last picture of the *Visoka trava* page is selected and the player presses `MoveRight`
- **THEN** the *Mejica* page is shown with its first picture selected
