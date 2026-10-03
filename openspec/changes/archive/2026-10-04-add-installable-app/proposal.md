# Proposal

## Why

Slovion targets phones, tablets and desktops as a web app first (product vision). Today it only runs in a browser tab: it can't be added to a home screen, opens with the browser bar, and shows the browser's own error page when there is no connection. The owner chose an **installable** app. Offline play is not part of this change. The server stays the authority for encounters, discoveries and quests (D3), and D3's "online connectivity is required" still holds.

## What Changes

- **Install:** a web app manifest and app icons, so browsers offer *Install* / *Add to Home Screen*. Installed, Slovion opens full screen without the browser bar.
  - name *Slovion*, Slovenian description, standalone display
  - the game's dark colors
  - icons 192 and 512 px, a maskable icon, and an Apple touch icon
- **Fast, reliable start:** a service worker (Angular's own, `@angular/service-worker`) caches the built app: code, styles, fonts, translations, sprites and images. The game opens from the cache, even without a connection.
- **No connection:** with no network, the title screen opens and says so: *Ni internetne povezave. Za igranje jo potrebuješ.* *Nova igra* and *Nadaljuj* keep their current error handling.
- **Updates:** when a new version of the game has been downloaded, a notice offers to load it: *Na voljo je nova različica igre.* plus an *Osveži* button. The player chooses when, so a walk isn't interrupted. Progress is on the server, so nothing is lost.
- **Not cached:**
  - **API calls** (`/api`, `/health`): always go to the server.
  - **Content files** (`/content`: maps, tilesets, species pictures): keep today's browser caching with cheap revalidation. A cached map paired with a newer server could break the game, and without a connection the game can't be played anyway.

**Demo outcome:**
1. Open the production build in Chrome; the browser offers to install Slovion.
2. Installed, it opens in its own window with the Slovion icon.
3. Switch the network off and start it again: the title screen opens and says a connection is needed.
4. Deploy a new build: the open game offers *Osveži*.

## Capabilities

### New Capabilities

- `installable-app`: the manifest and icons, the cached app shell, what is never cached, and new-version notices.

### Modified Capabilities

- `game-session`: the title screen tells the player when there is no connection.

## Non-goals

- Playing, browsing the journal or the bag without a connection, or syncing later (D3 unchanged).
- An in-game *Install* button. Browsers offer installation themselves.
- Push notifications, background sync, app-store wrappers.
- Hosting or deployment. An installed PWA needs HTTPS; `localhost` works for development.
- A manifest per language. Only Slovenian exists today.

## Impact

- **Client:**
  - `@angular/service-worker` (new dependency, same version as Angular) and `ngsw-config.json`
  - `public/manifest.webmanifest` and icons; links in `index.html`
  - service worker registration in production builds only
  - the update notice in the app root and the offline notice on the title screen
  - translations
- **Server:** none.
- **Tests:**
  - unit tests for both notices, and a check of the manifest and service-worker config
  - an E2E test against the production build: manifest and service worker present, and an offline start shows the title screen with the notice
