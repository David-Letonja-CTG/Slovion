import { Direction } from '../input/actions';
import { AreaZone, Gate, HabitatZone, MapNpc, WorldMap } from './world-map';

/**
 * A small test map drawn as text: `.` open, `#` blocked, `S` spawn, `*` spot (named `spot`),
 * `g` tall grass (habitat `tall_grass`), `G` spawn standing in tall grass, `N` the NPC `vera` (tile 5),
 * `D` a gate opened by flag `gate_open` (tile 6).
 */
export function textMap(
  rows: readonly string[],
  facing: Direction = 'right',
  /** The area of each tile; none by default. */
  areaOf: (x: number, y: number) => string | undefined = () => undefined,
): WorldMap {
  const height = rows.length;
  const width = rows[0].length;
  const blocked: boolean[] = [];
  let spawn = { x: 0, y: 0, facing };
  const spots: { spotId: string; x: number; y: number }[] = [];
  const habitats: HabitatZone[] = [];
  const npcs: MapNpc[] = [];
  const gates: Gate[] = [];
  const areas: AreaZone[] = [];

  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      blocked.push(cell === '#');
      if (cell === 'S' || cell === 'G') spawn = { x, y, facing };
      if (cell === '*') spots.push({ spotId: 'spot', x, y });
      if (cell === 'N') npcs.push({ npcId: 'vera', x, y, gid: 5 });
      if (cell === 'D') gates.push({ flag: 'gate_open', x, y, gid: 6 });
      const areaId = areaOf(x, y);
      if (areaId) areas.push({ areaId, minX: x, minY: y, maxX: x, maxY: y });
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
    npcs,
    gates,
    areas,
  );
}
