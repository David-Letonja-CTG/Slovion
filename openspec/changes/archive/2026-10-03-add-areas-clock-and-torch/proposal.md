# Proposal

## Why

Since `add-world-conditions`, time passes in the game, but the player only sees the season and the time of day, not the clock. The player also never learns *where* they are: the meadow and the hedgerow behind Vera's gate feel like one undifferentiated map.

The owner asked for three things:
- a clock on screen
- the name of the current location, with an animation when moving from one place to another
- a torch for walking in the dark that lights a circle around the player

The torch also prepares a later step the owner has in mind: species that move and react to the light, for example a hare coming closer while a fox runs away. That step is a separate future change.

## What Changes

- **Clock:** the indicator shows the in-game time as `HH:MM` next to the season and time of day, e.g. *Pomlad · jutro · 08:15*. It updates every in-game minute.
- **Areas (locations):**
  - Maps can define **area zones**: rectangles of class `area` naming an area ID.
  - Areas are content with a localized name in `content/areas/<areaId>.json`, served to the client like maps.
  - The meadow map gets two areas: *Travnik na Dravskem polju*, which is the meadow including its southern hedge and gate, and *Južna mejica*, the hedgerow strip.
- **Current location:** the name of the area the player stands in is shown under the indicator.
- **Entering an area:** when the player steps from one area into another, a **location banner** with the new area's name slides in at the top centre, stays about 2.5 seconds and slides out. The banner also appears when the game starts.
- **Torch** (*svetilka*), switched on and off by the player:
  - A new logical action `Torch` is bound to `L` (for *luč*), with an on-screen button for mouse and touch.
  - In the evening and at night, the torch lights a soft circle with a radius of about 3 tiles around the player.
  - Nights become darker, so the torch matters.
  - By day it has no visible effect. The button and its pressed state show whether it is on.
  - The torch state is client-side only and starts off. Nothing on the server depends on it yet.
- **Docs:** CLAUDE.md lists `Torch` among the logical actions. The README covers controls and areas.

**Demo outcome:**
1. Start a game. The banner shows *Travnik na Dravskem polju* and the indicator reads *Pomlad · jutro · 08:00*.
2. Play into the night, press `L`, and a circle of light follows the player through the dark meadow.
3. Walk through Vera's gate and the banner shows *Južna mejica*.

## Capabilities

### New Capabilities

- `map-areas`: area content and area zones, the current location display, and the location banner on entering an area.

### Modified Capabilities

- `world-conditions`: the indicator includes the clock; nights are darker; a new torch requirement covers toggling it and its lit circle in the dark.
- `input-actions`: the logical action set gains `Torch`, and the default mapping binds it to `L`.
- `world-exploration`: maps may define area zones, and the meadow has two areas.

## Non-goals

- **Species that move or react to the torch** (attracted or fleeing). This is a planned follow-up and needs its own spec: server-side behaviour and new content values such as how a species responds to light.
- Torch batteries, fuel, items, or an inventory.
- Saving the torch state, or the server knowing about it.
- Moving between maps, or doors and warps.
- New sprites (a player holding a torch), sound, or particle effects.
- Weather, or any change to the clock rule or availability.

## Impact

- **Content:**
  - `content/areas/meadow.json` and `content/areas/south_hedgerow.json`
  - two area zones in the meadow map
  - `areas` served as a public content folder
- **Server:** content validation for areas. Validation requires:
  - an ID and a Slovenian name
  - zones that name known areas, lie inside the map and don't overlap
  - every walkable tile of a map inside some area

  No API or database change.
- **Engine:**
  - the Tiled parser reads area zones
  - `World` reports area changes and minute ticks to the host
  - torch state and the `Torch` action
  - darkness with a lit circle in the renderer
  - the `L` key mapping
- **Client:**
  - loads the area names for the map
  - the location banner component with its animation; the reduced-motion preference is respected
  - the clock in the indicator
  - the location line
  - the torch button
  - new `sl.json` keys
- **Docs:** CLAUDE.md (logical actions), README.
