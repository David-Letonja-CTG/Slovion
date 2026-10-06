import { Action } from '../../engine';

/** Pictures per row when the shown grid's layout can't be read (e.g. in tests). */
export const GRID_COLUMNS = 5;

/** A picture in *Terenski dnevnik*: its habitat section and its position in that section. */
export interface Selection {
  readonly section: number;
  readonly index: number;
}

/**
 * The selection after a movement action, given each section's picture count and the pictures per row. Left/right
 * follow reading order across sections (a section is a page, so this turns pages); up/down keep the column and
 * continue into the adjacent section. At the first and last picture the selection stays put; other actions don't
 * move it.
 */
export function moveSelection(
  sizes: readonly number[],
  current: Selection,
  action: Action,
  columns = GRID_COLUMNS,
): Selection {
  const { section, index } = current;
  const size = sizes[section] ?? 0;
  const column = index % columns;
  const row = (i: number) => Math.floor(i / columns);
  const next = adjacentSection(sizes, section, 1);
  const previous = adjacentSection(sizes, section, -1);

  switch (action) {
    case 'MoveRight':
      if (index + 1 < size) return { section, index: index + 1 };
      return next === undefined ? current : { section: next, index: 0 };
    case 'MoveLeft':
      if (index > 0) return { section, index: index - 1 };
      return previous === undefined ? current : { section: previous, index: sizes[previous] - 1 };
    case 'MoveDown':
      if (row(index) < row(size - 1)) {
        return { section, index: Math.min(index + columns, size - 1) };
      }
      return next === undefined
        ? current
        : { section: next, index: Math.min(column, sizes[next] - 1) };
    case 'MoveUp':
      if (row(index) > 0) return { section, index: index - columns };
      if (previous === undefined) return current;
      return {
        section: previous,
        index: Math.min(row(sizes[previous] - 1) * columns + column, sizes[previous] - 1),
      };
    default:
      return current;
  }
}

/** The nearest non-empty section before (-1) or after (+1) `section`, if any. */
function adjacentSection(
  sizes: readonly number[],
  section: number,
  step: 1 | -1,
): number | undefined {
  for (let s = section + step; s >= 0 && s < sizes.length; s += step) {
    if (sizes[s] > 0) return s;
  }
  return undefined;
}
