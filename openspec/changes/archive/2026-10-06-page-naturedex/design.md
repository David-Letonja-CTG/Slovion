# Design

## Context

- `NatureDexPanel` renders every habitat section in one scrolling dialog (`overflow-y: auto`, 40 rem wide).
- `moveSelection` moves a `{ section, index }` selection with a fixed `GRID_COLUMNS = 5`. Left and right move across sections in reading order; up and down continue into the adjacent section.
- Focus follows the selection through a flat index over all rendered pictures.
- Approved by the owner on 2026-10-06 from a prototype; motivation in proposal.md.

## Decisions

### 1. The page is the selected section

The page shown is `selected().section`. No new state:
- **Arrows:** moving the selection into another section turns the page, which is exactly the existing reading-order and adjacent-section rules.
- **Index and page buttons:** they set the selection to `{ section, index: 0 }`.
- **Focus:** only the shown page's pictures are rendered, so focus uses the index within the page.

### 2. Two layouts, chosen by CSS

Both the index and the page buttons are in the DOM; media queries show one.

| Screen | Habitats | Columns | Pictures | Panel |
|---|---|---|---|---|
| ≥ 640×544 (desktop, tablets) | index beside the page | 4, or 5 from 960 px wide | 64 px; 96 px from 960 px wide; 128 px from 1200×720 | 90 % of the width, up to 80 rem; text grows with the screen; height from the index |
| narrower than 640 (upright phones) | ◀ name ▶ under the title | 3 | 64 px | fills the space above the touch controls |
| ≥ 640 wide, < 544 high (sideways phones) | ◀ name ▶ in the header row | 5 | 64 px | fills the height |

- **Short screens use the header row.** A sideways phone is 390 px high, so the page buttons share the header row to leave room for two rows of pictures.
- **No panel jumps.** A page's height doesn't change it: the index sets the panel's height on wide screens, and the panel fills the space otherwise.

### 2a. Sizes and labels

- **Grows with the screen:** the first build was 32 rem wide on a PC (the shared `.dialog` caps every dialog at that; the journal lifts the cap) and the owner found it too small.
  - On wide screens the panel is `min(80rem, 90vw)`, and its font size is `clamp(1rem, 0.5rem + 0.6vw, 1.3rem)`; the journal's parts size in `em`, so they grow with it.
  - Pictures stay whole multiples of their 32 pixels: 64, 96 or 128 px, chosen by media query so they always fit their column.
- **Names always shown:** labels were visible only on hover or for the selected picture. The owner wanted them always shown: every picture shows its name, or a dimmed `???`.
- **New saves on phones:** the "journal is empty" message is smaller, and the gaps are tighter, so the largest page still fits upright on 390×844.

### 3. Columns come from the layout

- `moveSelection(sizes, current, action, columns)` takes the column count.
- The panel reads it from the shown grid: the number of tracks in its computed `grid-template-columns`. If the layout can't be read (jsdom), it falls back to 5.
- So the D-pad's up and down always match what the player sees, without the component duplicating the media queries.

### 4. Even padding

- The prototype's missing right padding came from switching the panel to a CSS grid, whose column grew to the header's width.
- The panel keeps its flex column, its children get `min-width: 0`, and the header wraps on narrow screens.
- The E2E test measures the grid's left and right gaps at each size.

### 5. Accessibility

- **Index:** a `nav` with a catalog label; each habitat is a button, and the shown one has `aria-current="page"`.
- **Page buttons:** CSS triangles, with catalog labels (*Prejšnji življenjski prostor*, *Naslednji življenjski prostor*), disabled at the ends.
- **Page marks:** decorative (`aria-hidden`). The habitat's name is the page's heading.

## Risks / Trade-offs

- **The overview of all pictures at once is gone.** The index gives the overall progress instead; the owner chose this.
- **Reading columns from the layout couples keyboard movement to CSS.** That is intended: it keeps them in sync. Tests cover the fallback.
