import { Direction } from '../input/actions';
import { WorldMap } from './world-map';

/**
 * A small test map drawn as text: `.` open, `#` blocked, `S` spawn, `*` spot (named `spot`).
 */
export function textMap(rows: readonly string[], facing: Direction = 'right'): WorldMap {
  const height = rows.length;
  const width = rows[0].length;
  const blocked: boolean[] = [];
  let spawn = { x: 0, y: 0, facing };
  const spots: { spotId: string; x: number; y: number }[] = [];

  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      blocked.push(cell === '#');
      if (cell === 'S') spawn = { x, y, facing };
      if (cell === '*') spots.push({ spotId: 'spot', x, y });
    }),
  );

  return new WorldMap(
    'test_map',
    width,
    height,
    [{ name: 'ground', tiles: new Array<number>(width * height).fill(1) }],
    blocked,
    spawn,
    spots,
    { firstGid: 1, columns: 8, tileCount: 8, image: 'tiles.png' },
  );
}
