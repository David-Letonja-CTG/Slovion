# Spec Delta

## Purpose

Defines how Slovion presents player-facing text: Slovenian (sl-SI) by default, always sourced from localization data by stable keys, with missing translations detected automatically and room for additional languages without code changes.

## ADDED Requirements

### Requirement: Slovenian is the default locale
The client SHALL start in the `sl-SI` locale. The document language SHALL be declared as Slovenian, and locale-sensitive formatting (numbers, dates) SHALL use Slovenian conventions.

#### Scenario: First launch
- **WHEN** a player opens the game for the first time
- **THEN** all player-facing UI text is shown in Slovenian
- **AND** the document declares its language as `sl`

#### Scenario: Locale-sensitive formatting
- **WHEN** the client formats the number 1234.5 for display
- **THEN** it is shown using Slovenian separators (`1.234,5`)

### Requirement: Player-facing UI text comes from translation catalogs
Every player-facing UI string SHALL be resolved at runtime from a per-locale translation catalog using a stable, language-independent key. Player-facing text SHALL NOT be written literally in templates, TypeScript, C# or engine code.

#### Scenario: Text resolved by key
- **WHEN** the application shell renders its title
- **THEN** the displayed text is the value of the corresponding key in the `sl-SI` catalog
- **AND** changing that catalog value changes the displayed text without code changes

### Requirement: Missing translations are detected automatically
The build pipeline SHALL fail when code references a translation key that is absent from the `sl-SI` catalog. During development and automated tests, resolving a missing key at runtime SHALL be reported as an error rather than silently showing the key.

#### Scenario: Key missing from catalog
- **WHEN** a template references a key that does not exist in the `sl-SI` catalog
- **THEN** the CI localization check fails and names the missing key

#### Scenario: Missing key at runtime in tests
- **WHEN** a component test renders a key that is not in the catalog
- **THEN** the test fails with an error identifying the key

### Requirement: Additional languages need no code changes
Adding a new language SHALL require only a new translation catalog and registering its locale code. Keys SHALL be identical across catalogs.

#### Scenario: Second catalog in tests
- **WHEN** a test registers a second catalog for locale `en` containing the same keys and switches to it
- **THEN** the shell title is rendered from the `en` catalog without any component code change

### Requirement: Backend never returns player-facing UI prose
API error responses SHALL use the RFC 9457 problem-details format and carry a stable machine-readable `code`. The client SHALL map codes to translation keys. Free-text `title`/`detail` fields are developer diagnostics only and SHALL NOT be shown to players.

#### Scenario: Unknown API route
- **WHEN** a client requests a non-existent route under `/api`
- **THEN** the response status is 404 with content type `application/problem+json`
- **AND** the body contains `code` equal to `not_found`

### Requirement: Slovenian characters render correctly
Every font used for player-facing text SHALL contain glyphs for `č š ž ć đ Č Š Ž Ć Đ` so no fallback font or missing-glyph box is shown.

#### Scenario: Diacritics in UI text
- **WHEN** a catalog value containing `čšžćđČŠŽĆĐ` is rendered
- **THEN** every character is drawn with the game's UI font
