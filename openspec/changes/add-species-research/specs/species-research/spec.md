## ADDED Requirements

### Requirement: Research levels
Every species a save has identified SHALL have a research level from 1 to 3, stored on the server (D3). Identifying a species SHALL set its level to 1. Observed but unidentified species SHALL have no research level. Saves created before research existed SHALL have level 1 for every identified species.

#### Scenario: A new identification
- **WHEN** a save identifies `salvia_pratensis`
- **THEN** its NatureDex entry has research level 1

#### Scenario: Older saves
- **WHEN** the database of a save with identified species is migrated
- **THEN** each of those species has research level 1

### Requirement: Researching by observing again
A sighting of an identified species SHALL raise its research level by one, up to 3, when the sighting's in-game day or time of day (D8) differs from that of the last research step. The identification counts as the first research step. A sighting is:
- interacting with the species' spot or its resident animal
- a search that finds the species

Any other sighting SHALL leave the level unchanged. The response to a sighting SHALL say whether the research advanced and carry the species' NatureDex entry with its new level.

#### Scenario: Pressing again at once
- **WHEN** a save that identified the sage this morning interacts with the sage spot again the same morning
- **THEN** the response says the research did not advance, and the level stays 1

#### Scenario: Coming back in the evening
- **WHEN** the same save interacts with the sage spot in the evening of the same day
- **THEN** the response says the research advanced, and the level is 2

#### Scenario: Fully researched
- **WHEN** a save whose sage has level 3 sights it at another time of day
- **THEN** the response says the research did not advance, and the level stays 3

#### Scenario: Found in a search
- **WHEN** a search finds an identified species at another time of day than its last research step
- **THEN** its research level rises by one

### Requirement: Facts revealed by level
The server SHALL only send the facts revealed at a species' research level:

| Level | Revealed |
|---|---|
| 1 | name, scientific name, family, identifying characteristics |
| 2 | also habitat and distribution |
| 3 | also the seasonal fact |

The sources sent SHALL be those cited by the revealed facts. Facts not yet revealed SHALL NOT be sent.

#### Scenario: Level 1
- **WHEN** a save with the sage at level 1 requests its NatureDex
- **THEN** the sage's entry has name, scientific name, family and characteristics, but no habitat, distribution or seasonal fact

#### Scenario: Level 3
- **WHEN** a save with the sage at level 3 requests its NatureDex
- **THEN** the sage's entry has every fact, and its sources include those of the seasonal fact

### Requirement: Research feedback
After a sighting of an identified species, the game SHALL show a gender-neutral Slovenian message:
- when research advanced: the species name and the new level, e.g. *Raziskava napreduje: travniška kadulja (2/3)*
- when it did not and the level is below 3: that the species is already recorded and more is learned by observing it at another time of day
- at level 3: that the species is fully researched

In *Terenski dnevnik*, identified pictures SHALL show their level as stars (★★☆), and a species page SHALL show the level and, below level 3, a hint that observing the species at another time of day reveals more.

#### Scenario: The message after advancing
- **WHEN** a sighting advances the sage to level 2
- **THEN** the message names *travniška kadulja* and *2/3*

#### Scenario: Stars in the grid
- **WHEN** the journal opens with the sage at level 2
- **THEN** the sage's picture shows two of three stars
