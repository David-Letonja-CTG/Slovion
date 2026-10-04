## 1. Server

- [x] 1.1 Domain `Station`, `StationText`, researched count and met; domain tests
- [x] 1.2 Station content loading and validation, map `station` objects, `AllStations`/`FindStation`; content tests
- [x] 1.3 `StationService`; `NewCertificates` on the sighting that meets a goal; application tests
- [x] 1.4 `GET /api/save/stations`; `newCertificates` in `AlreadyIdentifiedResponse`; integration tests

## 2. Content and art

- [x] 2.1 Five station files; a `station` object on each map
- [x] 2.2 Tile 56 (station board); every map's tileset entry at 64 tiles

## 3. Engine

- [x] 3.1 Station objects in the parser; blocking; interaction step 3; drawing; engine tests

## 4. Client

- [x] 4.1 API types; `StationDialog`; station interaction in the play screen; translations; tests
- [x] 4.2 *Potrdila* view in *Terenski dnevnik*; tests
- [x] 4.3 New-certificate notice after the research message; tests
- [x] 4.4 E2E: the meadow station dialog

## 5. Docs and validation

- [x] 5.1 README (stations, content notes); product vision roadmap
- [x] 5.2 Run `dotnet format --verify-no-changes`, `dotnet test --solution Slovion.slnx`, `npm run check` and `npm run e2e`; all succeed
- [x] 5.3 Manual check: a station dialog, finishing a station (notice), the *Potrdila* page; capture screenshots
- [x] 5.4 Review the changed files against non-goals and every spec scenario; record deviations in design.md
- [x] 5.5 Run `openspec validate add-research-stations --strict`, push, and verify all CI jobs pass on the pull request
