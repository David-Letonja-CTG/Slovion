## 1. Synthesizer

- [x] 1.1 `AudioContextLike` interface and a recording fake for tests
- [x] 1.2 Voices (square, pulse, triangle) with envelopes; noise buffers and filters; the mixer (master, music, sounds, nature)
- [x] 1.3 Note parser and the look-ahead scheduler; looping; crossfades; the night arrangement
- [x] 1.4 Ambience layers (breeze, wind, stream, lake, waves, rain, birds, gulls-generic, crickets, drips, cave-air), seeded
- [x] 1.5 Effects (observe, correct, wrong, research, quest, tool, certificate, travel, torch, search)

## 2. Data

- [x] 2.1 Nine regional themes and the cave theme in `public/audio/music/`
- [x] 2.2 `public/audio/soundscapes.json` for all regions; scene rules for time, weather and underground
- [x] 2.3 Data test: every content region has a soundscape, every theme parses, every layer is known

## 3. Angular

- [x] 3.1 `AudioService`: unlock on the first gesture, load data, settings in `localStorage`, visibility, no Web Audio
- [x] 3.2 `SoundSettingsDialog` and the *Zvok* and mute buttons; `sl-SI` texts
- [x] 3.3 `PlayScreen` wiring: scenes, effects, ducking
- [x] 3.4 `ngsw-config.json` caches `/audio/**`

## 4. Tests and docs

- [x] 4.1 Unit and component tests; an E2E check of the settings surviving a reload
- [x] 4.2 Docs: gameplay (sound, controls), architecture (the audio module), content checklist (a soundscape for a new region)
- [x] 4.3 Run `npm run check`, `npm run e2e`, `dotnet test`; all succeed
- [ ] 4.4 Manual listening pass: every region by day and night, a cave, rain, every effect, desktop and phone; first-click start; hidden tab — **open:** needs a person listening; an instrumented Chromium check (context starts on the first click, themes load, notes keep being scheduled, no errors) is recorded in the design notes
- [x] 4.5 Run `openspec validate add-sound --strict`, push, and verify all CI jobs pass on the pull request
