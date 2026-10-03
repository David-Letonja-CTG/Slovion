## ADDED Requirements

### Requirement: Species availability content
Each species SHALL declare its availability:
- the seasons in which it can be found: a non-empty subset of `spring`, `summer`, `autumn` and `winter`
- optionally, the times of day in which it can be found: a non-empty subset of `morning`, `day`, `evening` and `night`
- the sources the availability is based on, which SHALL be sources the species defines

Seasons are derived from sourced months, where spring is March–May, summer June–August, autumn September–November and winter December–February. A season is included when a sourced active, flowering or presence period covers at least one of its months. Times of day are restricted only where a source states it.

Content validation SHALL reject any of the following, naming the species:
- missing availability
- empty or unknown seasons or times of day
- availability without sources, or with unknown sources

#### Scenario: Availability of the repository species
- **WHEN** the API starts with the repository content
- **THEN** the skylark and the hare are available in every season, and the dandelion is available in spring and autumn

#### Scenario: Unknown season
- **WHEN** a species declares the season `monsoon`
- **THEN** content validation fails and names the species and the season

#### Scenario: Unsourced availability
- **WHEN** a species declares availability without sources
- **THEN** content validation fails and names the species
