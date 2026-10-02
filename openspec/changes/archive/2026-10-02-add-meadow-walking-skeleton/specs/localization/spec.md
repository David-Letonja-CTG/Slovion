# Spec Delta

## ADDED Requirements

### Requirement: Localized content is served in the requested language
Content text (species information, and later dialogue and quests) SHALL be returned by the API in the language requested via `Accept-Language` when the content provides it, falling back to Slovenian otherwise. Responses carrying content text SHALL declare the language used in a `Content-Language` header.

#### Scenario: Slovenian requested
- **WHEN** the client requests the NatureDex with `Accept-Language: sl`
- **THEN** species text is Slovenian and `Content-Language` is `sl`

#### Scenario: Unsupported language requested
- **WHEN** the client requests the NatureDex with `Accept-Language: de`
- **THEN** species text is Slovenian and `Content-Language` is `sl`

#### Scenario: No language requested
- **WHEN** the request has no `Accept-Language` header
- **THEN** species text is Slovenian
