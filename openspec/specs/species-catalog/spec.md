# species-catalog Specification

## Purpose

Defines the real-world species content the game teaches from: stable language-independent identities, localized descriptions, and a source reference for every fact, validated so incorrect or unsourced content never reaches players.

## Requirements

### Requirement: Stable species identity
Each species SHALL have an ID of the form `genus_species` in lowercase ASCII (e.g. `salvia_pratensis`). IDs SHALL be unique and SHALL never change; the scientific name is a separate attribute that may be revised without changing the ID.

#### Scenario: Invalid ID
- **WHEN** content contains a species with ID `Salvia-Pratensis`
- **THEN** content validation fails and names the invalid ID

#### Scenario: Duplicate ID
- **WHEN** two species files declare the ID `salvia_pratensis`
- **THEN** content validation fails and names the duplicate

### Requirement: Every fact has a source
Every real-world fact of a species — common name, scientific name, family, habitat, distribution, flowering or activity period, and each identifying characteristic — SHALL reference at least one source. Each source SHALL record its title, publisher, URL, access date and licence or usage note.

#### Scenario: Unsourced characteristic
- **WHEN** a characteristic has no source reference
- **THEN** content validation fails and names the species and the fact

#### Scenario: Reference to an unknown source
- **WHEN** a fact references a source ID that the species does not define
- **THEN** content validation fails

### Requirement: Slovenian text is required
Every species SHALL have Slovenian (`sl`) text for all of its localized facts. Other languages are optional.

#### Scenario: Missing Slovenian habitat
- **WHEN** a species has no Slovenian habitat text
- **THEN** content validation fails

### Requirement: Invalid content blocks startup and CI
The API SHALL refuse to start when content is invalid, reporting every problem found. The automated test suite SHALL validate the repository's content, so invalid content fails CI.

#### Scenario: Broken content in a pull request
- **WHEN** a change adds a species file without sources
- **THEN** CI fails with the validation errors

#### Scenario: Valid repository content
- **WHEN** the API starts with the repository's content
- **THEN** startup succeeds and `salvia_pratensis` is available

#### Scenario: Hedgerow species
- **WHEN** the API starts with the repository's content
- **THEN** `crataegus_monogyna` (group `plant`, *enovrati glog*) and `lanius_collurio` (group `bird`, *rjavi srakoper*) are available, each with sourced Slovenian facts, three clues and a picture

### Requirement: Spots reference existing species
Every interactive spot in a map that names a species SHALL reference an existing species ID.

#### Scenario: Spot with unknown species
- **WHEN** a map spot references `vulpes_vulpes` but no such species exists
- **THEN** content validation fails and names the map and spot

### Requirement: Species group
Each species SHALL declare one group: `plant`, `mammal`, `bird` or `insect`. Any other value SHALL fail content validation.

#### Scenario: Unknown group
- **WHEN** a species declares group `fungus`
- **THEN** content validation fails and names the species and the group

### Requirement: Identification clues
Each species SHALL declare exactly three identification clues, each referring to a different one of its identifying characteristics. Clue choice and order are gameplay data; the clue text is the sourced characteristic itself.

#### Scenario: Clue pointing nowhere
- **WHEN** a species declares a clue for its fifth characteristic but has only four
- **THEN** content validation fails and names the species

#### Scenario: Too few clues
- **WHEN** a species declares two clues
- **THEN** content validation fails and names the species

### Requirement: Species picture
Each species SHALL have a picture at `content/species-pictures/<speciesId>.png`: a 32×32 pixel PNG. Pictures SHALL be original illustrations (D10). They are not facts and SHALL NOT be presented as such. Pictures SHALL be downloadable by clients under `/content/species-pictures/`. A missing picture, a file that is not a PNG, or a PNG of a different size SHALL fail content validation. The failure SHALL name the species.

#### Scenario: Missing picture
- **WHEN** content contains species `salvia_pratensis` but no file `content/species-pictures/salvia_pratensis.png`
- **THEN** content validation fails and names `salvia_pratensis`

#### Scenario: Wrong size
- **WHEN** the picture of `salvia_pratensis` is 64×64 pixels
- **THEN** content validation fails and names `salvia_pratensis`

#### Scenario: Picture download
- **WHEN** a client requests `/content/species-pictures/lepus_europaeus.png`
- **THEN** the response is `200` with a PNG image

### Requirement: Every species belongs to a habitat
Every species SHALL be listed in at least one habitat, so that it has a place in *Terenski dnevnik*. A species that is in no habitat SHALL fail content validation, and the failure SHALL name the species.

#### Scenario: Species without a habitat
- **WHEN** content contains species `vulpes_vulpes` that no habitat lists
- **THEN** content validation fails and names `vulpes_vulpes`
