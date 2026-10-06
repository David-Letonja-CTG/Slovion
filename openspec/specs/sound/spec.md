# sound Specification

## Purpose

Defines the game's sound: music, nature ambience and sound effects synthesized in the browser from original data, how they follow the region, time of day, weather and underground areas, and the player's sound settings.

## Requirements

### Requirement: Synthesized sound
All music, ambience and effects SHALL be synthesized in the browser with the Web Audio API from original data in the client (D10). The game SHALL NOT play recordings, and no sound SHALL be presented as the call of a specific species (D6). Sound SHALL start after the player's first click, tap or key press, and the audio SHALL be suspended while the page is hidden. Where Web Audio is unavailable, the game SHALL work without sound.

#### Scenario: Sound starts with the first interaction
- **WHEN** a player clicks *Nova igra*
- **THEN** sound starts, and before that click nothing played

#### Scenario: Hidden page
- **WHEN** the game's tab is hidden and shown again
- **THEN** sound stops while hidden and continues when shown

#### Scenario: No Web Audio
- **WHEN** the browser has no Web Audio API
- **THEN** the game runs without sound and without errors

### Requirement: Music
Each region SHALL have an original chiptune theme. At night the game SHALL play a quieter, slower arrangement of the region's theme, and in underground areas a cave theme. Changes between themes SHALL crossfade over about 2 seconds. While a dialog is open, music SHALL play at a reduced volume.

#### Scenario: Day and night
- **WHEN** the in-game time turns from evening to night in Dravsko polje
- **THEN** the meadow theme crossfades into its night arrangement

#### Scenario: Entering a cave
- **WHEN** the player walks into Zelške jame (an underground area)
- **THEN** the music crossfades into the cave theme, and back when the player walks out

#### Scenario: A dialog lowers the music
- **WHEN** an observation dialog opens
- **THEN** the music is quieter until the dialog closes

### Requirement: Ambience
Each region SHALL have an ambience of nature sounds for day and for night, defined in a soundscape file: e.g. wind, water, generic birdsong, crickets. Rain SHALL add the sound of rain and thin out birdsong. Snow SHALL remove birdsong and crickets. Underground areas SHALL replace the region's ambience with cave sounds. Every region in the content SHALL have a soundscape.

#### Scenario: The coast at night
- **WHEN** it is night in Portorož
- **THEN** waves and crickets are heard, and no birdsong

#### Scenario: Rain
- **WHEN** the weather of the current region is rain
- **THEN** rain is heard over the region's ambience

#### Scenario: A region without a soundscape
- **WHEN** a region exists in the content without a soundscape
- **THEN** the tests fail and name the region and its map

### Requirement: Sound effects
The game SHALL play a short sound effect when:
- an observation starts
- a species is identified, or a wrong name is picked (two clearly different sounds)
- a research level rises
- a quest is completed
- a tool is received
- a certificate is earned
- the player travels
- the torch is switched
- a search starts

#### Scenario: A correct identification
- **WHEN** the player picks the right name in an observation
- **THEN** the identification sound plays

#### Scenario: A wrong name
- **WHEN** the player picks a wrong name
- **THEN** a different, softer sound plays

### Requirement: Sound settings
The play screen SHALL offer:
- a mute button, labelled with the current state
- a *Zvok* button that opens a sound settings dialog, with separate volumes (0–100 %) for music, sound effects and nature sounds, a mute switch and a close button

Defaults are sound on, music 50 %, effects 70 % and nature 60 %. The settings SHALL apply at once and SHALL be remembered on the device across reloads, without any personal data (D5). The dialog SHALL be usable with keyboard, mouse and touch, and all its text SHALL come from the translation catalog.

#### Scenario: Muting is remembered
- **WHEN** the player mutes the sound and reloads the game
- **THEN** the game stays silent and the button shows that sound is off

#### Scenario: Changing a volume
- **WHEN** the player sets the music volume to 0 % in the dialog
- **THEN** music stops being heard while effects and nature sounds continue, and the value is kept after a reload
