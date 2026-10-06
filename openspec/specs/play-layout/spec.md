# play-layout Specification

## Purpose
Defines how the play screen is laid out around the world: the world view first, taking as much of the screen as its shape allows, with a compact HUD over it (conditions, quest, the game's buttons), the *Več* menu of secondary actions, and the keyboard hint.

## Requirements

### Requirement: Game-first layout
The world view SHALL take the largest area of its shape the screen allows (`game-viewport`), inside the screen's safe area. On desktops and on touch screens held sideways, no page element SHALL take space from it: indicators and buttons sit over it as a HUD. Upright touch screens follow the handheld layout (`touch-controls`). The play screen SHALL NOT scroll horizontally at any size.

#### Scenario: Full-HD desktop
- **WHEN** the game is played in a 1920×1080 CSS pixel window at device pixel ratio 1
- **THEN** the world view is 1920×1080 CSS pixels

#### Scenario: Laptop
- **WHEN** the game is played in a 1366×768 CSS pixel window at device pixel ratio 1
- **THEN** the world view is at least 1360×765 CSS pixels

#### Scenario: Phone held sideways
- **WHEN** the game is played on an 844×390 CSS pixel phone held sideways
- **THEN** the world view is 390 CSS pixels high and the page has no horizontal scroll

### Requirement: HUD
The play screen SHALL show a compact HUD:
- at the top left, the conditions indicator and, while a quest is active, the quest tracker
- at the top right, buttons for the torch (*Svetilka*), the bag (*Nahrbtnik*), the journal (*Dnevnik*) and more actions (*Več*), each with a pixel icon and its label

On touch screens held sideways, the buttons SHALL show only their icons; their labels SHALL still name them for screen readers. The quest tracker SHALL be collapsible to its title and progress line. HUD elements SHALL stay inside the safe area and SHALL NOT overlap one another. On touch screens every HUD button SHALL be at least 44 CSS pixels in both directions.

#### Scenario: Desktop HUD
- **WHEN** the game is played with a mouse and keyboard
- **THEN** the indicator is at the top left and *Svetilka*, *Nahrbtnik*, *Dnevnik* and *Več* at the top right, over the world

#### Scenario: Collapsing the quest
- **WHEN** the player clicks the quest tracker's title
- **THEN** the tracker shows only the title and progress, and clicking it again shows the summary

### Requirement: More actions
The *Več* button SHALL open a menu with the secondary actions: the sound settings (*Zvok*) and the mute button where sound is available, the fullscreen button where fullscreen is supported (`game-viewport`), and on keyboard devices the controls hint. The button SHALL report whether the menu is open. The menu SHALL close when the button is pressed again, when *Zvok* opens its dialog, when mute or fullscreen is toggled, on `Escape` (focus returns to *Več*), and on a press outside it. Where the menu would be empty, the *Več* button SHALL NOT be shown.

#### Scenario: Muting from the menu
- **WHEN** the player opens *Več* and presses *Utišaj*
- **THEN** the sound is muted, the menu closes and the game has focus again

#### Scenario: Leaving the menu with Escape
- **WHEN** the menu is open and the player presses `Escape`
- **THEN** the menu closes and *Več* has focus

### Requirement: Keyboard hint
On keyboard devices, the controls hint SHALL show over the bottom of the world view when the play screen opens and SHALL fade out after about 10 seconds without taking space from the world. It SHALL stay available in the *Več* menu. It SHALL NOT be shown while touch controls are shown (`touch-controls`).

#### Scenario: Starting a game on desktop
- **WHEN** a game starts on a desktop
- **THEN** the hint is shown over the bottom of the world and fades out after about 10 seconds
