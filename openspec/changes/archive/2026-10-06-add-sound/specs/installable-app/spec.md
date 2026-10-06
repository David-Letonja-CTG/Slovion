## MODIFIED Requirements

### Requirement: Cached app shell
Production builds SHALL register a service worker that caches the built app: scripts, styles, `index.html`, fonts, translation catalogs, sprites, images, icons, and the music and soundscape files. Once cached, the game SHALL open from the cache without a network connection. Development builds SHALL NOT register it.

#### Scenario: Starting without a connection
- **WHEN** a player who opened the game once before starts it with no network connection
- **THEN** the title screen opens in Slovenian, instead of the browser's error page

#### Scenario: Development server
- **WHEN** the game runs from the development server
- **THEN** no service worker is registered

#### Scenario: Sound data offline
- **WHEN** the installed app opens without a connection
- **THEN** the music and soundscape files load from the cache
