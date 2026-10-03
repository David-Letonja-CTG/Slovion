# Design

## Context

What exists today:
- The Angular client is built with `@angular/build`. `public/` is copied as-is: fonts, translations (`i18n/sl.json`, loaded by Transloco at runtime), sprites and images.
- Maps, tilesets, species pictures, area names and sprites for wildlife, NPCs and items come from the API under `/content`, with `Cache-Control: no-cache` and ETags. The dev server proxies `/api`, `/content`, `/health` and `/openapi` to the API.
- Network failures become the `network` error code with a Slovenian message (`errors.network`). The title screen shows it and stays.
- No hosting exists yet. CI builds the client and runs Playwright against the dev server.

The owner chose an installable app without offline play.

Approved by the project owner on 2026-10-04.

Motivation: see proposal.md. Requirements: the two spec deltas.

## Goals / Non-Goals

**Goals:**
- Installable on Android, iOS and desktop browsers with the game's own icon and colors.
- Opening never shows the browser's error page. A stale app is never paired silently with a newer server.

**Non-Goals:** see proposal.

## Decisions

### 1. Angular's service worker

- **Package:** `@angular/service-worker`, pinned like the other Angular packages. It is first-party, hashes every built file, and updates atomically. A hand-written worker would need its own versioning and tests.
- **Registration:** `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`. Registering after the app is stable keeps the first start fast. The dev server (`npm start`, E2E) doesn't register it.
- **`ngsw-config.json`:**
  - `app`, prefetch: `index.html`, `manifest.webmanifest`, `*.js`, `*.css`
  - `assets`, lazy with update prefetch: `fonts/**`, `i18n/**`, `sprites/**`, `images/**`, `icons/**`
  - **no `dataGroups`:** nothing under `/api`, `/content` or `/health` is cached
  - `navigationUrls` excludes `/api/**`, `/content/**`, `/health` and `/openapi/**`, so they are never answered with `index.html`
- **Why content isn't cached:** content belongs to the server's version. A cached old map with a new server could put spots where the server has none. Browser revalidation with ETags is already cheap. Without a connection the game can't be played, so a cached map wouldn't help.

### 2. Manifest and icons

- `public/manifest.webmanifest`:

  ```json
  {
    "name": "Slovion", "short_name": "Slovion", "lang": "sl",
    "description": "Raziskuj naravo Slovenije in spoznavaj prave vrste.",
    "start_url": "/", "scope": "/", "display": "standalone",
    "background_color": "#11161c", "theme_color": "#11161c",
    "icons": [
      { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
  ```

- **Localization:** the manifest is a static Slovenian file, like `<html lang="sl">` and `<title>` in `index.html`. A second language would add a manifest per locale (non-goal now).
- **`index.html`:** links the manifest, `<meta name="theme-color" content="#11161c">`, `<link rel="icon" href="icons/icon-192.png">` and `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`.
- **Icon art (placeholder, original):** a 32×32 pixel-art motif drawn by a generator script, scaled by whole numbers with nearest-neighbour: 6× for 192, 16× for 512. The motif is a green linden leaf with a small magnifier, on the backdrop color. The maskable icon keeps the motif inside the central 80% safe zone. The Apple icon is 180×180 with a solid background. The owner reviews the art in the PR.

### 3. Update notice

- **`AppUpdates` service:** wraps `SwUpdate`.
  - `available` signal: true on `VERSION_READY` or `unrecoverable`
  - `reload()`: calls `document.location.reload()`, injectable for tests
  - when the worker is disabled (`SwUpdate.isEnabled` false), it stays false
- **`UpdateNotice` component** in `app.html`, beside `<router-outlet />`: a small fixed panel at the bottom centre with the text and *Osveži*. It isn't modal and takes no game input. The world keeps running, and the button is clickable or tappable.
- **Checking for updates:** Angular checks on every start and navigation. No timer is added.

### 4. Offline notice on the title screen

- **`ConnectionStatus` service:** an `online` signal from `navigator.onLine` plus the `online` and `offline` window events. It is injectable, so tests can drive it.
- **The title screen** shows the notice above the buttons while `online()` is false. The buttons and their error handling are unchanged.

### 5. Translations

`sl.json`:
- `app.updateReady`: *Na voljo je nova različica igre.*
- `app.reload`: *Osveži*
- `title.offline`: *Ni internetne povezave. Za igranje jo potrebuješ.*

## Testing

- **Client unit tests:**
  - **`UpdateNotice`:** hidden without an update; shown on `VERSION_READY` and on unrecoverable state; *Osveži* calls reload.
  - **Title screen:** offline notice shown and hidden by `ConnectionStatus`; buttons still offered.
  - **Manifest and config:** the manifest has the required fields and icons, and each icon's PNG has the stated size. `ngsw-config.json` has no data groups and excludes `/api`, `/content` and `/health` from navigation.
- **E2E (new Playwright project `installable`):**
  - **Server:** the production build is served by a small Node script (`e2e/serve-dist.mjs`), with the same proxy to the API as the dev server.
  - **Test:** wait until the service worker controls the page, then check the manifest link and icons. Go offline and reload: the title screen and the offline notice show.
- **Manual:**
  - Chrome DevTools: Application → Manifest shows no errors, and the install prompt is offered.
  - Installed window: screenshot.
  - Update notice: build twice with a change and check that *Osveži* appears.

## Risks / Trade-offs

- **[An old app for one start after an update]** Angular serves the cached app and downloads the new one in the background. If the API changed incompatibly, that one start may hit errors until *Osveži*. Acceptable for now. Once hosting exists, API changes should stay backward compatible for one release.
- **[iOS]** Safari installs through *Share → Add to Home Screen* only, and ignores parts of the manifest. The Apple touch icon and theme color cover the basics.
- **[`navigator.onLine` is unreliable]** It can report online behind a dead network. The notice is a hint only; the real errors still come from requests.

## Implementation notes (review, task 5.4)

I reviewed every changed file against the non-goals and every scenario in the two spec deltas. Each scenario is covered by a client unit test or the new E2E test. No non-goal was touched: no offline play or journal, no install button, no push or background sync, no hosting, and one Slovenian manifest.

- **One prefetch group instead of `app` plus a lazy `assets` group.** Fonts, translations, sprites, images and icons are about 120 KB together. The title screen needs the font and the catalog on an offline start even when they were never fetched before, so everything is cached at install.
- **Gateway errors count as network errors.** Offline, Angular's service worker answers a request it can't send with `504 Gateway Timeout` instead of failing it. The client showed *Nekaj je šlo narobe* instead of the connection message, which broke "Server unavailable". The E2E test caught it. `apiErrorCode` now maps 0, 502 and 504 to `network`; 503 and other statuses are unchanged.
- **Manifest and icon sizes are checked in the E2E test, not a unit test.** The unit-test bundler can't import a `.webmanifest` or read PNGs. The E2E test fetches the manifest from the production build and decodes every icon in the browser. The unit test checks `ngsw-config.json`.
- **The E2E server** (`e2e/serve-dist.mjs`) builds and serves `dist/slovion/browser`, proxying the paths listed in `proxy.conf.mjs`. Its port is `E2E_DIST_PORT`, by default the client port + 1.
- **Manual check** (production build on `localhost:4301`, Chromium via Playwright):
  - **Install:** Chrome's installability report (DevTools protocol `Page.getInstallabilityErrors`) has no errors, and the manifest parses without errors. An installed window can't be opened headless, so there is no screenshot of it.
  - **Offline:** with the network cut, a reload opens the title screen with the notice.
  - **Update:** a second build with a changed tagline made the open game show *Na voljo je nova različica igre.* over the map while the player kept walking. *Osveži* loaded the new version.
  - **Two tool quirks**, neither a defect in the app: a Chrome profile under the very long scratch path couldn't open CacheStorage, which put the worker into safe mode; and a CDP session stops Playwright's offline emulation from reaching `navigator.onLine`. Both checks ran in separate contexts.
- **The update notice covers the controls hint** at the bottom of the play screen until the player reloads. The top centre is taken by the place banner.
