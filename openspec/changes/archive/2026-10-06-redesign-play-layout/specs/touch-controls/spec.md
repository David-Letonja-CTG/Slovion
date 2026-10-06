## MODIFIED Requirements

### Requirement: Handheld layout
On touch devices held upright, the world view (zoomed in, `game-viewport`) SHALL fill the screen from below the top safe area down to the conditions indicator, at the full width of the screen. Only the quest tracker SHALL lie over it, in its top-left corner, and it SHALL fold to one line. Below the world SHALL follow the conditions indicator, then one row with the play screen's buttons (`play-layout`), then the touch controls at the bottom. Held sideways, the world view SHALL fill the height of the screen's safe area, with the D-pad at the bottom left and A and B at the bottom right, both see-through, and the HUD at the top corners (`play-layout`). The controls SHALL look like part of the game's HUD. Controls SHALL stay inside the screen's safe area, and every button SHALL be at least 44 CSS pixels in both directions.

#### Scenario: Upright phone
- **WHEN** the game is played on a 390×844 CSS pixel phone held upright
- **THEN** the world view is at the top at the full width, 390×520 CSS pixels (3:4), the conditions sit directly below it and above the buttons, and no control or indicator overlaps it

#### Scenario: Turning the phone
- **WHEN** the phone is turned sideways (844×390 CSS pixels)
- **THEN** the world view fills the height of the screen and the D-pad and buttons sit at the bottom corners
