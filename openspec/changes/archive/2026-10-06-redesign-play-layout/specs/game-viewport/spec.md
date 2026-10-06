## ADDED Requirements

### Requirement: Filling scale with letterboxing
When the available area is at least the view's size in CSS pixels, the viewport SHALL show the world at the largest size of the view's shape that fits the area, each side rounded down to whole physical device pixels, and centre it with the remaining area letterboxed. The horizontal and vertical scale SHALL be equal to within one physical pixel: the world is never stretched. The world SHALL be drawn at the smallest integer scale (in physical pixels) at which it is at least as large as the shown size.

#### Scenario: Exact multiple
- **WHEN** the available area is 1280×720 CSS pixels at device pixel ratio 1
- **THEN** the world is drawn at scale 4 and the canvas fills the area exactly

#### Scenario: Full-HD desktop
- **WHEN** the available area is 1920×1080 CSS pixels at device pixel ratio 1
- **THEN** the world is drawn at scale 6 and the canvas fills the area exactly

#### Scenario: Non-multiple area
- **WHEN** the available area is 1000×700 CSS pixels at device pixel ratio 1
- **THEN** the canvas is shown at 1000×562 CSS pixels, centred with letterbox bars above and below
- **AND** the world is drawn at scale 4 (1280×720)

#### Scenario: High-density display
- **WHEN** the available area is 412×800 CSS pixels at device pixel ratio 2.625
- **THEN** the canvas is shown 1081×608 physical pixels large, within the available width
- **AND** the world is drawn at the integer scale 4

## MODIFIED Requirements

### Requirement: Fixed logical resolution
The game world SHALL be rendered at a fixed logical resolution of 320×180 pixels (16:9), independent of the screen or window size. On touch screens held upright, it SHALL instead be zoomed in: 180 pixels wide and as tall as the space allows, from 180 up to 240 pixels (3:4), so it fills the space at the full width; or 240×180 pixels (4:3) where that shows the world as large or larger. Of the two, the one whose game pixels are shown largest in the space SHALL be used. Turning the device SHALL switch views before the next rendered frame, without restarting the game.

#### Scenario: Large window
- **WHEN** the game is shown in a 1920×1080 viewport
- **THEN** the game world still shows exactly 320×180 logical pixels of content

#### Scenario: Upright phone
- **WHEN** the game is played on a 390×844 CSS pixel touch screen held upright at device pixel ratio 3
- **THEN** the game world shows 180×240 logical pixels, 390×520 CSS pixels large

#### Scenario: Less height
- **WHEN** the space for the world on an upright phone is 412×521 CSS pixels (a browser's address bar takes some height)
- **THEN** the game world shows 180×227 logical pixels at the full width of the screen

#### Scenario: Space wider than tall
- **WHEN** the space for the world on an upright touch screen is 375×250 CSS pixels
- **THEN** the game world shows 240×180 logical pixels

#### Scenario: Turning the phone
- **WHEN** the phone is turned sideways
- **THEN** the game world shows 320×180 logical pixels from the next frame, and the player keeps their place

### Requirement: Crisp pixel art
Drawing SHALL use nearest-neighbour sampling with image smoothing disabled, at an integer scale, so every game pixel has the same size. When the shown size is that integer scale, the canvas SHALL be displayed with nearest-neighbour sampling. Otherwise it SHALL be resampled smoothly to the shown size, which is less than one scale step smaller, so game pixels stay even and only their edges blend.

#### Scenario: Scaled sprite edges
- **WHEN** a 1-pixel-wide line is drawn and displayed at scale 4
- **THEN** it appears as a sharp 4-physical-pixel-wide line without blurring

#### Scenario: Between two scales
- **WHEN** the shown size is 3.65 physical pixels per game pixel
- **THEN** the world is drawn at scale 4 with nearest-neighbour sampling and resampled smoothly to the shown size

## REMOVED Requirements

### Requirement: Integer scaling with letterboxing
**Reason**: Whole multiples left up to a third of the screen empty (an upright 390 px phone showed the world 320 px wide; a full-HD desktop 1600×900). Replaced by *Filling scale with letterboxing*.
**Migration**: None; the world keeps its 16:9 shape and logical resolution, only its shown size grows.
