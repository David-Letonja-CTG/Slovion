# Proposal

## Why

*Terenski dnevnik* lists all 11 habitat sections (53 species) one under another in a narrow column, five pictures per row. It scrolls at every screen size. Measured on 2026-10-06 with a save of 19 finds:

| Screen | Content below the fold |
|---|---|
| 1366×768 desktop | 1,418 px |
| 390×844 phone, upright | 1,035 px |

Even a 1080p desktop scrolls about twice. The column stays 40 rem wide on any screen, so the pictures stay small. The scrolling list also hides the overall progress.

The owner asked for this and approved a prototype on 2026-10-06 (index and pages on desktop, page turning on phones). They also asked for even padding: the prototype's phone page had no space on the right.

## What Changes

- **One habitat per page:** the journal shows one habitat at a time and never scrolls for its grid.
- **Wide screens** (at least 640×544 CSS px):
  - an index of all habitats with their progress (*Mokrišče 4/10*) beside the page
  - finished habitats stand out
  - clicking one opens its page
  - the panel grows with the screen (up to 80 rem), and the pictures grow to 96 or 128 px (3× or 4× their pixel art)
- **Upright phones and phones held sideways:** ◀ and ▶ beside the habitat's name turn the pages, with marks for the page shown. Upright, three bigger pictures per row; sideways, five, with the page buttons in the header row so it fits the 390 px height.
- **Keyboard and touch controls:** the arrows still move in reading order and by rows; past a page's edge they turn to the next or previous page. The rows follow the columns the page shows.
- **Layout:** even padding on both sides at every size; touch targets at least 44 px.
- **Names always shown:** every picture shows its name under it, or a dimmed ??? until identified, instead of only on hover or when selected. The owner asked for this on 2026-10-06.
- **Grows with the screen:** on desktops the journal grows up to 80 rem wide with the screen, and its text with it. Pictures are 128 px on screens from 1200×720, after the owner found the first build too small on a PC.

## Capabilities

### Modified Capabilities

- **`naturedex`:** *Habitat grid* (pages, index, page turning, no scrolling, size), *Keyboard navigation in the grid* (turning pages, columns by layout), *Empty state* (above the page), *Picture labels* (always shown).

## Non-goals

- No changes to the API, the data, species pages, cards or *Potrdila*.
- No search, filters or sorting.
- No pages within a habitat: the largest habitat (10 species) fits on one page.

## Impact

- **Client:**
  - `NatureDexPanel` template, styles and component: the index, the page buttons and marks, focus
  - `moveSelection` takes the column count
  - three new `sl-SI` texts (index label, previous and next habitat)
- **Tests:** selection, panel and play-screen tests; E2E: no scrolling and even padding at desktop, upright and sideways sizes, page turning by touch.
- **Docs:** gameplay (the journal), docs media.
