# Gameplay

Slovion is about **observing real Slovenian nature**: walk through a region, meet animals and plants, identify them from sourced clues, and fill a field journal. There is no combat and no capture (D2); the player collects observations.

> **Explore → Discover → Identify → Learn → Collect → Progress → Explore further**

![Walking across the Dravsko polje meadow](images/hero.gif)

## The core loop

1. **Explore** a region on foot: tile by tile, with keyboard, mouse or touch.
2. **Discover** species:
   - **Animals** live in the world as residents: they wander near home, wait when the player comes close, and react to the torch at night.
   - **Plants** are found by searching tall grass, a tree or a shrub inside a habitat.
   - What can be found depends on the **season, the time of day and the weather**, all decided by the server and backed by sources (a winter meadow is quiet; salamanders come out in the rain).
3. **Identify** the species from clues: one clue at a time, then pick the right name. A wrong guess teaches the name without counting it, and the species can be observed again.
4. **Learn** on its page in *Terenski dnevnik* (the journal, D10): Slovenian facts, each with its source.
5. **Research** further: seeing a species again at another time of day, or on another day, raises its research level up to ★★★ and reveals more of its page.
6. **Progress:** people in each region give a quest. Finishing it opens the next region, and some quests give a field tool.

| Observing a species | The journal | A species page |
|---|---|---|
| ![The observation dialog](images/identify.png) | ![Terenski dnevnik](images/journal.png) | ![A species page with sources](images/species-page.png) |

## Time, seasons and weather

- **One real second is one in-game minute.** A day has a morning, day, evening and night; a season lasts three in-game days. The clock belongs to the save and runs on the server (D8).
- **Darkness:** evenings and nights are tinted, and caves are dark at any time. The torch (*svetilka*, key L) lights a circle; street lamps light their own.
- **Weather** (clear, cloudy, rain, fog, snow) is decided per region every six in-game hours and drawn over the map (D11).

![Ljubljana at night: street lamps and the torch](images/night.gif)

## The journey

A signpost (*kažipot*) by every arrival point opens the travel map. Regions open one after another, each through the quest of the region before. The game continues in the region where the player last was.

![Every region at noon](images/regions.png)

| # | Region | Person | Quest | Opened by | What is special |
|---|---|---|---|---|---|
| 1 | Dravsko polje | Vera | *Oko za naravo* | always open | the meadow and a hedgerow behind a gate |
| 2 | Kočevje | Jure | *V senci jelk* | Vera's quest | fir and beech forest, the brown bear, a stream to wade |
| 3 | Pohorje | Maja | *Skrivnosti barja* | Jure's quest | mountain forest and a bog, the wolf |
| 4 | Triglav | Luka | *Pod vrhovi* | Maja's quest | alpine grassland, the chamois and the marmot |
| 5 | Cerkniško jezero | Neža | *Presihajoče jezero* | Luka's quest | a wetland with shallows, the corncrake at dusk |
| 6 | Rakov Škocjan | Tilen | *V temo* | Neža's quest | a karst gorge and a dark cave with the olm |
| 7 | Ljubljana | Ana | *Mestna narava* | Tilen's quest | a city park with street lamps, the Ljubljanica, the barje |
| 8 | Murska Sobota | Štefan | *Pod štorkljinim gnezdom* | Ana's quest | a Prekmurje village, the stork on a chimney |
| 9 | Portorož | Nina | *Med solinami in morjem* | Štefan's quest | the Sečovlje salt pans and the sea |

![The travel map](images/travel-map.png)

| A dark cave with the torch | A stork on its chimney | Swimming with the snorkel |
|---|---|---|
| ![Rakov Škocjan's cave](images/cave.png) | ![Murska Sobota](images/stork.png) | ![Portorož](images/snorkel.gif) |

## Field tools

The bag (*Nahrbtnik*, key I) holds the tools a save has; each one opens a new way to observe.

| Tool | From | What it does |
|---|---|---|
| *svetilka* (lamp) | the start | lights a circle in the dark; animals react to it |
| *daljnogled* (binoculars) | Vera | identify animals from up to three tiles away |
| *povečevalno steklo* (magnifier) | Jure | see two clues at once for plants and insects |
| *škornji* (rubber boots) | Maja | wade through streams and shallows |
| *maska z dihalko* (snorkel) | Nina | swim in shallow sea and meet the life there |

## Sound

Every region has its own soft chiptune theme and a bed of nature sounds: wind, water, generic birdsong, crickets at night. At night the theme plays slower and quieter; caves have their own theme with dripping water. Rain is heard over the ambience and thins out the birds; snow silences them. Short sounds mark an observation, a right or wrong name, research, a finished quest, a new tool, a certificate, travel, the torch and a search. Everything is synthesized in the browser, and no sound stands for a particular species.

Sound starts with the first click or key press. *Utišaj* mutes it; *Zvok* opens separate volumes for music, sounds and nature. Both are remembered on the device.

## Research stations

Every region has a research station (*raziskovalna postaja*) with a themed list of species, such as forest trees, birds or the sea and salt pans. Fully researching enough of them (★★★) earns a certificate (*potrdilo*) on the journal's *Potrdila* page.

## Controls

| Action | Keys |
|---|---|
| Walk / run | arrow keys or WASD / hold Shift |
| Interact: talk, observe, search, read the signpost | E, Enter or Space |
| Torch | L |
| Bag | I |
| Journal (*Terenski dnevnik*) | M |
| Close, go back | Esc |

The sound settings (*Zvok*) use up and down to choose a volume, left and right to change it, and Enter to mute. Dialogs use the arrows and Enter. Mouse and touch work everywhere: tap to walk, tap a dialog's buttons.

## Where gameplay is defined

- **Behaviour:** the capability specs in [`openspec/specs/`](../openspec/specs/), e.g. [`identification`](../openspec/specs/identification/spec.md), [`wildlife`](../openspec/specs/wildlife/spec.md), [`regions`](../openspec/specs/regions/spec.md).
- **Species, regions, quests and tools:** content files, described in [content.md](content.md).
- **The ideas ahead:** [product-vision.md](product-vision.md).
