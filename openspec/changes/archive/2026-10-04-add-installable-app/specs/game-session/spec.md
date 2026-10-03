## ADDED Requirements

### Requirement: No connection on the title screen
While the browser reports no network connection, the title screen SHALL show *Ni internetne povezave. Za igranje jo potrebuješ.* The notice SHALL disappear when the connection returns. *Nova igra* and *Nadaljuj* SHALL stay offered, with their existing handling of a server that can't be reached (the browser's report can be wrong).

#### Scenario: Offline title screen
- **WHEN** the title screen opens while the browser is offline
- **THEN** the no-connection notice is shown above the buttons

#### Scenario: Connection returns
- **WHEN** the browser comes back online while the title screen is open
- **THEN** the notice disappears
