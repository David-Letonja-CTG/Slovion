# Spec Delta

## Purpose

Defines how the game world is presented on screen: a fixed low-resolution pixel-art canvas that scales crisply across desktop, tablet and mobile, driven by a frame-rate-independent simulation clock that the host application can start and stop.

## ADDED Requirements

### Requirement: Fixed logical resolution
The game world SHALL be rendered at a fixed logical resolution of 320×180 pixels, independent of the screen or window size.

#### Scenario: Large window
- **WHEN** the game is shown in a 1920×1080 viewport
- **THEN** the game world still shows exactly 320×180 logical pixels of content

### Requirement: Integer scaling with letterboxing
When the available area is at least 320×180 CSS pixels, the viewport SHALL use the largest integer scale (in physical device pixels) that fits, preserve the 16:9 aspect ratio, and centre the result with the remaining area letterboxed.

#### Scenario: Exact multiple
- **WHEN** the available area is 1280×720 CSS pixels at device pixel ratio 1
- **THEN** the scale is 4 and the canvas fills the area exactly

#### Scenario: Non-multiple area
- **WHEN** the available area is 1000×700 CSS pixels at device pixel ratio 1
- **THEN** the scale is 3 (960×540) and the canvas is centred with letterbox bars

#### Scenario: High-density display
- **WHEN** the available area is 412×800 CSS pixels at device pixel ratio 2.625
- **THEN** each logical pixel maps to the same integer number of physical pixels
- **AND** the canvas fits within the available width

### Requirement: Downscaling on very small areas
When the available area is smaller than 320×180 CSS pixels in either dimension, the viewport SHALL scale down to fit while preserving aspect ratio.

#### Scenario: Tiny container
- **WHEN** the available area is 240×300 CSS pixels
- **THEN** the canvas is displayed at 240×135 CSS pixels and remains fully visible

### Requirement: Crisp pixel art
Rendering SHALL use nearest-neighbour sampling; image smoothing SHALL be disabled for both drawing and canvas scaling.

#### Scenario: Scaled sprite edges
- **WHEN** a 1-pixel-wide line is drawn and displayed at scale 4
- **THEN** it appears as a sharp 4-physical-pixel-wide line without blurring

### Requirement: Responds to resize and orientation changes
The viewport SHALL recompute its scale when the available area or device pixel ratio changes, before the next rendered frame.

#### Scenario: Device rotated
- **WHEN** a phone rotates from portrait to landscape
- **THEN** the next rendered frame uses the scale computed for the new area

### Requirement: Frame-rate-independent simulation
The game simulation SHALL advance in fixed steps of 1/60 second regardless of the display refresh rate. After a long pause between frames, the simulation SHALL catch up at most 250 ms of simulated time.

#### Scenario: Low refresh rate
- **WHEN** frames are rendered at 30 per second for one second of real time
- **THEN** the simulation has advanced exactly 60 steps

#### Scenario: High refresh rate
- **WHEN** frames are rendered at 144 per second for one second of real time
- **THEN** the simulation has advanced exactly 60 steps

#### Scenario: Long stall
- **WHEN** 2 seconds pass between two frames
- **THEN** the simulation advances by at most 15 steps for that frame

### Requirement: Simulation pauses when hidden
The simulation SHALL pause while the page is hidden and resume without catching up on the hidden time.

#### Scenario: Tab hidden and restored
- **WHEN** the page is hidden for 10 seconds and then shown again
- **THEN** the simulation resumes from where it paused without advancing for the hidden period

### Requirement: Host-controlled lifecycle
The hosting application SHALL be able to start and stop the game. After stopping, no further frames SHALL be scheduled and all listeners SHALL be released.

#### Scenario: Leaving the game screen
- **WHEN** the host stops the game
- **THEN** no further simulation steps or renders occur
- **AND** no resize, visibility or animation-frame callbacks remain registered
