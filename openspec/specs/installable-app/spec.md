# installable-app Specification

## Purpose
Slovion as an installable web app (PWA): the web app manifest and icons, the service worker that caches the built app so the game opens without a connection, what is never cached (API and content), and notices offering new versions. Playing still needs the server (D3).

## Requirements

### Requirement: Web app manifest
The client SHALL publish a web app manifest linked from the page. It SHALL name the app *Slovion*, give a Slovenian description, set `lang` to `sl`, start at `/`, use `standalone` display, and use the game's backdrop color as background and theme color. It SHALL list PNG icons of 192×192 and 512×512 pixels and a 512×512 maskable icon. The page SHALL also link a 180×180 Apple touch icon and set the theme color.

#### Scenario: Browser reads the manifest
- **WHEN** the production build is opened in a browser
- **THEN** the page links `manifest.webmanifest`
- **AND** the manifest names *Slovion* with `display` `standalone` and the 192, 512 and maskable icons, each of which loads

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

### Requirement: Server data is never cached by the app
The service worker SHALL NOT cache or answer API requests (`/api`, `/health`) or content files (`/content`). They SHALL always go to the network, with content files keeping their HTTP caching (`no-cache` with revalidation).

#### Scenario: API offline
- **WHEN** the player chooses *Nadaljuj* with no network connection
- **THEN** the request fails as a network error and the existing Slovenian error message is shown

#### Scenario: New map on the server
- **WHEN** the server starts serving a changed map file
- **THEN** the next game start loads the changed map

### Requirement: New version notice
When the service worker has downloaded a new version of the game, the client SHALL show the notice *Na voljo je nova različica igre.* with an *Osveži* button on every screen, without interrupting play. *Osveži* SHALL reload the game into the new version. If the cached version can no longer be used, the client SHALL show the same notice.

#### Scenario: Update ready
- **WHEN** a new version is ready while the player is walking on a map
- **THEN** the notice appears and the game keeps running

#### Scenario: Player reloads
- **WHEN** the player chooses *Osveži*
- **THEN** the page reloads and the new version runs
