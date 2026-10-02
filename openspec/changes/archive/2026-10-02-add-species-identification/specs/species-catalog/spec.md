# Spec Delta

## ADDED Requirements

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
