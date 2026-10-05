# Proposal

## Why

The game is silent. Sound is one of the strongest levers for how a game feels (the first priority is fun gameplay), and the owner chose to add it next:
- **Synthesized in the browser:** original by construction (D10), no licensing, tiny, works offline.
- **Soft chiptune** music that fits the pixel art.
- **Nature ambience** without claiming to be any real species.
- **On by default** at a moderate volume.

Real recordings of the actual species' calls are a separate, later feature, since they need licensed, sourced recordings (D6).

## What Changes

- **A sound engine in the client:** framework-free TypeScript on the Web Audio API, under `client/src/app/audio/`.
  - Simple voices: square, triangle and pulse waves with envelopes.
  - Filtered noise for wind, water, rain and waves.
  - A look-ahead scheduler that plays note sequences in time.
  - The audio context is injectable, so everything is tested without a browser's audio.
- **Music:** original chiptune themes, written as small JSON files of notes in `client/public/audio/music/`:
  - one theme per region
  - a quieter, slower night arrangement derived automatically from each theme
  - a low drone for underground areas
  - Music crossfades when the region changes, between day and night, and on entering or leaving a cave.
  - It is turned down while a dialog is open.
- **Ambience:** layers per place from `client/public/audio/soundscapes.json`:
  - wind, a stream, the lake or the sea
  - generic synthesized birdsong by day, crickets at night, dripping in caves
  - rain when it rains; snow muffles the wind
  - Birdsong is generic and never names or imitates a specific species.
- **Sound effects** for game moments:
  - an observation starts
  - a correct or a wrong identification
  - a new research star, a quest completed, a new tool, a certificate
  - travelling, the torch, searching the grass
- **Sound settings:**
  - a *Zvok* button on the play screen opens a dialog with volume sliders for music, sounds and nature, plus a mute switch
  - a quick mute button beside it
  - the settings are remembered on the device (local storage; no personal data, D5)
- **Browser rules:** sound starts with the player's first click or key press (*Nova igra* or *Nadaljuj*). It pauses when the page is hidden and resumes when it's visible.
- **The installed app** caches the audio files like the other app files, so the game also sounds right after opening offline.

## Capabilities

### New Capabilities

- **`sound`:** the sound engine, music, ambience, effects, sound settings, and their behaviour with dialogs, visibility and browser rules.

### Modified Capabilities

- **`installable-app`:** the cached app shell includes the audio files.

## Non-goals

- Recorded calls of real species, or any sound presented as a specific species (a later feature).
- Footsteps, positional (3D) audio, voices.
- Music on the title screen (browsers block sound before the first interaction).
- Changing gameplay, the API, the server or content files.
- A full settings menu beyond sound (language and others come with their own features).

## Impact

- **Client:**
  - `client/src/app/audio/`: the synthesizer, the music and ambience players, an Angular `AudioService`, and the sound settings dialog
  - wiring in the play screen: region, area, time, weather, dialogs, events
  - new Slovenian UI texts in `public/i18n/sl.json`
- **Assets:** `client/public/audio/` with the music and soundscapes as JSON (a few kilobytes); `ngsw-config.json` caches them.
- **No server, API, content or database changes.** A client test checks that every region in `content/regions/` has a soundscape and that every music file parses.
- **Docs:** gameplay (sound, controls), architecture (the audio module), and the content checklist (a new region gets a soundscape).
