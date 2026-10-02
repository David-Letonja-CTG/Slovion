import { Direction } from '../input/actions';
import { HabitatZone, WorldMap } from './world-map';

/**
 * A small test map drawn as text: `.` open, `#` blocked, `S` spawn, `*` spot (named `spot`),
 * `g` tall grass (habitat `tall_grass`), `G` spawn standing in tall grass.
 */
export function textMap(rows: readonly string[], facing: Direction = 'right'): WorldMap {
  const height = rows.length;
  const width = rows[0].length;
  const blocked: boolean[] = [];
  let spawn = { x: 0, y: 0, facing };
  const spots: { spotId: string; x: number; y: number }[] = [];
  const habitats: HabitatZone[] = [];

  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      blocked.push(cell === '#');
      if (cell === 'S' || cell === 'G') spawn = { x, y, facing };
      if (cell === '*') spots.push({ spotId: 'spot', x, y });
      if (cell === 'g' || cell === 'G') {
        habitats.push({ habitatId: 'tall_grass', minX: x, minY: y, maxX: x, maxY: y });
      }
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
    habitats,
  );
}
