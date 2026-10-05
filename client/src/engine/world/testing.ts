import { Direction } from '../input/actions';
import {
  AreaZone,
  Gate,
  HabitatZone,
  MapLamp,
  MapNpc,
  MapStation,
  Signpost,
  WorldMap,
} from './world-map';

/**
 * A small test map drawn as text: `.` open, `#` blocked, `S` spawn, `*` spot (named `spot`),
 * `g` tall grass (habitat `tall_grass`), `G` spawn standing in tall grass, `N` the NPC `vera` (tile 5),
 * `D` a gate opened by flag `gate_open` (tile 6), `R` the home spot `hare` of a resident animal,
 * `P` the signpost (tile 7), `B` a research station (tile 7), `L` a lamp post (tile 7), `T` a tree: a blocked tile inside a `tall_grass` zone, `~` shallow water: a blocked,
 * wadeable tile (tile 8), `O` shallow water holding the home spot `olm`, `^` a blocked tile inside a `tall_grass` zone
 * holding the home spot `hare` (like a nest on a roof), `%` shallow sea: a blocked, swimmable tile (tile 9). An area named `cave` is underground.
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
  const ground: number[] = [];
  let spawn = { x: 0, y: 0, facing };
  const spots: { spotId: string; x: number; y: number }[] = [];
  const habitats: HabitatZone[] = [];
  const npcs: MapNpc[] = [];
  const gates: Gate[] = [];
  const areas: AreaZone[] = [];
  const signposts: Signpost[] = [];
  const stations: MapStation[] = [];
  const lamps: MapLamp[] = [];

  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      blocked.push(
        cell === '#' ||
          cell === 'T' ||
          cell === '~' ||
          cell === 'O' ||
          cell === '^' ||
          cell === '%',
      );
      ground.push(cell === '~' || cell === 'O' ? 8 : cell === '%' ? 9 : 1);
      if (cell === 'S' || cell === 'G') spawn = { x, y, facing };
      if (cell === '*') spots.push({ spotId: 'spot', x, y });
      if (cell === 'R' || cell === '^') spots.push({ spotId: 'hare', x, y });
      if (cell === 'O') spots.push({ spotId: 'olm', x, y });
      if (cell === 'N') npcs.push({ npcId: 'vera', x, y, gid: 5 });
      if (cell === 'D') gates.push({ flag: 'gate_open', x, y, gid: 6 });
      if (cell === 'P') signposts.push({ x, y, gid: 7 });
      if (cell === 'B') stations.push({ stationId: 'test_station', x, y, gid: 7 });
      if (cell === 'L') lamps.push({ x, y, gid: 7 });
      const areaId = areaOf(x, y);
      if (areaId) {
        areas.push({
          areaId,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          ...(areaId === 'cave' ? { underground: true } : {}),
        });
      }
      if (cell === 'g' || cell === 'G' || cell === 'T' || cell === '^') {
        habitats.push({ habitatId: 'tall_grass', minX: x, minY: y, maxX: x, maxY: y });
      }
    }),
  );

  return new WorldMap(
    'test_map',
    width,
    height,
    [{ name: 'ground', tiles: ground }],
    blocked,
    spawn,
    spots,
    {
      firstGid: 1,
      columns: 8,
      tileCount: 9,
      image: 'tiles.png',
      wadeable: new Set([7]),
      swimmable: new Set([8]),
    },
    habitats,
    npcs,
    gates,
    areas,
    signposts,
    stations,
    lamps,
  );
}
