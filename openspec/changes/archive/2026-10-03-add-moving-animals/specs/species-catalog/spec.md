## ADDED Requirements

### Requirement: Wildlife traits and sprites
Every species that is not a plant SHALL declare:
- wildlife traits: a torch reaction of `curious`, `shy` or `calm`
- a walk sprite at `content/wildlife-sprites/<speciesId>.png`: a PNG of 32×16 pixels holding two 16×16 frames of the animal facing right, which is mirrored when it faces left

Wildlife traits are fictional gameplay data and SHALL NOT be presented as biological facts (D6). Sprites are original illustrations (D10) and SHALL be downloadable under `/content/wildlife-sprites/`. Plants SHALL NOT declare wildlife traits. Content validation SHALL reject the following, naming the species:
- missing or unknown traits on an animal
- traits on a plant
- a missing or wrongly sized sprite

#### Scenario: The hare is curious
- **WHEN** the API starts with the repository content
- **THEN** `lepus_europaeus` has torch reaction `curious` and a 32×16 walk sprite

#### Scenario: Animal without traits
- **WHEN** an animal species declares no wildlife traits
- **THEN** content validation fails and names the species

#### Scenario: Plant with traits
- **WHEN** `salvia_pratensis` declares wildlife traits
- **THEN** content validation fails and names the species
