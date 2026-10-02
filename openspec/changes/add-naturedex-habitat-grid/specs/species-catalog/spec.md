## ADDED Requirements

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
