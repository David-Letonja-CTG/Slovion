## 1. Install

- [x] 1.1 Icon generator (scratch script): 32×32 motif; 192, 512, maskable 512 and Apple 180 PNGs in `public/icons/`
- [x] 1.2 `public/manifest.webmanifest`; links and theme color in `index.html`

## 2. Service worker

- [x] 2.1 Add `@angular/service-worker`; `ngsw-config.json`; `serviceWorker` in the production build; `provideServiceWorker` registered only outside dev mode
- [x] 2.2 Manifest and service-worker config unit test

## 3. Notices

- [x] 3.1 `AppUpdates` service and `UpdateNotice` component in the app root; translations; unit tests
- [x] 3.2 `ConnectionStatus` service; offline notice on the title screen; translations; unit tests

## 4. E2E

- [x] 4.1 `e2e/serve-dist.mjs` (static production build plus API proxy); Playwright project `installable`
- [x] 4.2 E2E: service worker controls the page, manifest and icons load, an offline reload shows the title screen with the notice

## 5. Docs and validation

- [x] 5.1 README (installing, HTTPS note); product vision roadmap; D3 wording unchanged
- [x] 5.2 Run `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: DevTools manifest, install, installed window, offline start, update notice; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-installable-app --strict`, push, and verify all CI jobs pass on the pull request
