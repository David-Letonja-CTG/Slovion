## 1. Server

- [x] 1.1 Domain: `Weather`, `WeatherPick` (deterministic pick, next change), `Availability` with `alsoInWeather`, `SpeciesGroup.Amphibian`; domain tests
- [x] 1.2 Content: region weather weights and `alsoInWeather` loading and validation; `FindRegionOfMap`; content tests
- [x] 1.3 `WeatherService`; encounters, searches and wildlife use the region's weather; `GET /api/save/weather`; application and integration tests

## 2. Content

- [x] 2.1 Weather weights for the four regions
- [x] 2.2 Research and write `salamandra_salamandra` and `salamandra_atra` with sources; pictures and walk sprites; habitats; resident spots on the Kočevje and Triglav maps

## 3. Engine and client

- [x] 3.1 Engine: `setWeather`, weather overlays (rain, snow, fog, cloudy), reduced motion; engine tests
- [x] 3.2 Client: load and refresh the weather (change minute, travel, visibility), the indicator word, amphibian translations; client tests
- [x] 3.3 E2E: the indicator shows the weather

## 4. Docs and validation

- [x] 4.1 D11 in `docs/decisions.md`; README; product vision roadmap
- [x] 4.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 4.3 Manual check: each weather on screen (desktop and phone), a salamander in rain; capture screenshots
- [x] 4.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [ ] 4.5 Run `openspec validate add-weather --strict`, push, and verify all CI jobs pass on the pull request
