## MODIFIED Requirements

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

### Requirement: Empty state
When the save has not observed any species, *Terenski dnevnik* SHALL show its pages with every species as a silhouette. Above the page it SHALL show a Slovenian message encouraging the player to explore.

#### Scenario: Nothing discovered yet
- **WHEN** a new player opens *Terenski dnevnik*
- **THEN** an encouraging message is shown above the *Visoka trava 0/5* page, with every picture a silhouette

### Requirement: Picture labels
Every picture SHALL show its label below it at all times: the Slovenian common name for an identified species, a dimmed `???` otherwise. Screen readers SHALL get the name for identified species and a Slovenian "unknown species" text otherwise. Unknown species SHALL NOT open anything. Observed and identified species SHALL open on click, tap or `Confirm`.

#### Scenario: Hovering an identified species
- **WHEN** the player opens *Terenski dnevnik* after identifying the hare, and points at it or not
- **THEN** the label *poljski zajec* is shown under its picture

#### Scenario: Hovering an unknown species
- **WHEN** the save has not observed the skylark, and the player points at its picture or not
- **THEN** its picture is labelled `???` and clicking it opens nothing
