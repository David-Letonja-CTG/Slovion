## ADDED Requirements

### Requirement: Fullscreen
Where the browser supports fullscreen for the page, the play screen SHALL offer a button that switches the whole game, dialogs included, to fullscreen and back. The button SHALL show whether fullscreen is on, as the torch button does. Leaving fullscreen with the browser's own means, such as `Esc`, SHALL update the button. Where fullscreen is not supported, as in Safari on iPhone, the button SHALL NOT be shown. The viewport SHALL rescale to the new area as for any resize.

#### Scenario: Fullscreen on PC
- **WHEN** the player clicks the fullscreen button on a desktop browser
- **THEN** the game fills the screen, rescaled, and the button shows fullscreen as on

#### Scenario: Leaving with Esc
- **WHEN** the player presses `Esc` in fullscreen
- **THEN** the browser leaves fullscreen and the button shows fullscreen as off

#### Scenario: Not supported
- **WHEN** the browser does not support fullscreen
- **THEN** no fullscreen button is shown
