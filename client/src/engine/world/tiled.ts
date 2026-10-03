import { Direction } from '../input/actions';
import {
  AreaZone,
  Gate,
  Signpost,
  HabitatZone,
  MapNpc,
  Spot,
  TILE_SIZE,
  TileLayer,
  Tileset,
  WorldMap,
} from './world-map';

/** The map does not satisfy the supported Tiled subset. Lists every problem found. */
export class MapFormatError extends Error {
  constructor(
    readonly mapId: string,
    readonly problems: readonly string[],
  ) {
    super(`Map "${mapId}" is invalid: ${problems.join('; ')}`);
    this.name = 'MapFormatError';
  }
}

interface TiledProperty {
  name?: string;
  value?: unknown;
}

interface TiledObject {
  gid?: number;
  type?: string;
  class?: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  properties?: TiledProperty[];
}

interface TiledLayer {
  name?: string;
  type?: string;
  visible?: boolean;
  data?: number[];
  objects?: TiledObject[];
}

interface TiledTileset {
  firstgid?: number;
  columns?: number;
  tilecount?: number;
  image?: string;
  tiles?: {
    id?: number;
    animation?: { tileid?: number; duration?: number }[];
    properties?: TiledProperty[];
  }[];
}

interface TiledMap {
  orientation?: string;
  width?: number;
  height?: number;
  tilewidth?: number;
  tileheight?: number;
  layers?: TiledLayer[];
  tilesets?: TiledTileset[];
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/**
 * Parses the Tiled JSON subset Slovion supports (design §4): orthogonal, 16×16 tiles, one embedded
 * tileset, tile layers `ground` (+ optional others) and `collision`, object layer `objects` with one
 * `spawn`, any number of `spot` objects, habitat and area zones, NPC and gate tile objects, and one signpost.
 */
export function parseTiledMap(id: string, json: unknown): WorldMap {
  const map = (json ?? {}) as TiledMap;
  const problems: string[] = [];
  const width = map.width ?? 0;
  const height = map.height ?? 0;

  if (map.orientation !== 'orthogonal') problems.push('only orthogonal maps are supported');
  if (map.tilewidth !== TILE_SIZE || map.tileheight !== TILE_SIZE) {
    problems.push(`tiles must be ${TILE_SIZE}×${TILE_SIZE}`);
  }
  if (width <= 0 || height <= 0) problems.push('width and height must be positive');

  const tileLayers = (map.layers ?? []).filter((layer) => layer.type === 'tilelayer');
  for (const required of ['ground', 'collision']) {
    if (!tileLayers.some((layer) => layer.name === required)) {
      problems.push(`tile layer "${required}" is required`);
    }
  }
  for (const layer of tileLayers) {
    if (layer.data?.length !== width * height) {
      problems.push(`tile layer "${layer.name}" must have ${width * height} tiles`);
    }
  }

  const tileset = map.tilesets?.length === 1 ? map.tilesets[0] : undefined;
  if (!tileset?.image || !tileset.columns || !tileset.firstgid || !tileset.tilecount) {
    problems.push('exactly one embedded tileset with an image is required');
  }

  const objects = map.layers?.find(
    (l) => l.name === 'objects' && l.type === 'objectgroup',
  )?.objects;
  if (!objects) problems.push('object layer "objects" is required');

  const tileOf = (object: TiledObject) => ({
    x: Math.floor((object.x ?? -1) / TILE_SIZE),
    y: Math.floor((object.y ?? -1) / TILE_SIZE),
  });

  const spawns = objects?.filter((object) => classOf(object) === 'spawn') ?? [];
  if (objects && spawns.length !== 1) {
    problems.push(`exactly one spawn is required (found ${spawns.length})`);
  }
  const facing = spawns[0] ? property(spawns[0], 'facing') : undefined;
  if (spawns.length === 1 && !DIRECTIONS.includes(facing as Direction)) {
    problems.push('spawn needs a "facing" property: up, down, left or right');
  }

  const spots: Spot[] = [];
  for (const object of objects?.filter((o) => classOf(o) === 'spot') ?? []) {
    const spotId = property(object, 'spotId');
    if (typeof spotId !== 'string' || spotId === '') {
      problems.push('a spot is missing its "spotId"');
      continue;
    }
    spots.push({ spotId, ...tileOf(object) });
  }

  // Habitat zones: a tile belongs to a zone when its centre lies inside the rectangle (design §1).
  const habitats: HabitatZone[] = parseZones(
    objects,
    'habitat',
    'habitatId',
    width,
    height,
    problems,
  ).map(({ id, ...tiles }) => ({ habitatId: id, ...tiles }));
  const areas: AreaZone[] = parseZones(objects, 'area', 'areaId', width, height, problems).map(
    ({ id, ...tiles }) => ({ areaId: id, ...tiles }),
  );

  // Every walkable tile lies in an area, so the player always has a location (as on the server).
  const collisionData = tileLayers.find((layer) => layer.name === 'collision')?.data;
  if (collisionData?.length === width * height) {
    const uncovered = collisionData
      .map((gid, i) => ({ gid, x: i % width, y: Math.floor(i / width) }))
      .filter(({ gid, x, y }) => gid === 0 && !areas.some((a) => inZone(a, x, y)));
    if (uncovered.length > 0) {
      const first = uncovered[0];
      problems.push(
        `${uncovered.length} walkable tile(s) lie in no area, e.g. (${first.x}, ${first.y})`,
      );
    }
  }

  // NPCs and gates are tile objects (with a gid), anchored at their bottom-left corner; each covers
  // the tile under its centre, as on the server.
  const npcs: MapNpc[] = [];
  const gates: Gate[] = [];
  for (const object of objects?.filter((o) => ['npc', 'gate'].includes(classOf(o) ?? '')) ?? []) {
    const kind = classOf(object)!;
    const value = property(object, kind === 'npc' ? 'npcId' : 'requiresFlag');
    const label = `${kind} "${object.name ?? value}"`;
    const x = Math.floor(((object.x ?? 0) + (object.width ?? 0) / 2) / TILE_SIZE);
    const y = Math.floor(((object.y ?? 0) - (object.height ?? 0) / 2) / TILE_SIZE);
    if (typeof value !== 'string' || value === '') {
      problems.push(`${label} is missing its "${kind === 'npc' ? 'npcId' : 'requiresFlag'}"`);
    } else if (!object.gid || object.gid <= 0) {
      problems.push(`${label} must be a tile object`);
    } else if (x < 0 || y < 0 || x >= width || y >= height) {
      problems.push(`${label} lies outside the map`);
    } else if (kind === 'npc') {
      npcs.push({ npcId: value, x, y, gid: object.gid });
    } else {
      gates.push({ flag: value, x, y, gid: object.gid });
    }
  }

  // The signpost: a tile object like the gates, exactly one per map, opening the travel map.
  const signposts: Signpost[] = [];
  const signpostObjects = objects?.filter((o) => classOf(o) === 'signpost') ?? [];
  if (objects && signpostObjects.length !== 1) {
    problems.push(`exactly one signpost is required (found ${signpostObjects.length})`);
  }
  for (const object of signpostObjects) {
    const x = Math.floor(((object.x ?? 0) + (object.width ?? 0) / 2) / TILE_SIZE);
    const y = Math.floor(((object.y ?? 0) - (object.height ?? 0) / 2) / TILE_SIZE);
    if (!object.gid || object.gid <= 0) {
      problems.push('the signpost must be a tile object');
    } else if (x < 0 || y < 0 || x >= width || y >= height) {
      problems.push('the signpost lies outside the map');
    } else {
      signposts.push({ x, y, gid: object.gid });
    }
  }

  if (problems.length > 0) throw new MapFormatError(id, problems);

  const spawnTile = tileOf(spawns[0]);
  const collision = tileLayers.find((layer) => layer.name === 'collision')!.data!;
  const layers: TileLayer[] = tileLayers
    .filter((layer) => layer.name !== 'collision' && layer.visible !== false)
    .map((layer) => ({ name: layer.name ?? '', tiles: layer.data! }));
  const set: Tileset = {
    firstGid: tileset!.firstgid!,
    columns: tileset!.columns!,
    tileCount: tileset!.tilecount!,
    image: tileset!.image!,
    animations: new Map(
      (tileset!.tiles ?? [])
        .filter((tile) => typeof tile.id === 'number' && (tile.animation?.length ?? 0) > 0)
        .map((tile) => [
          tile.id!,
          tile.animation!.map((frame) => ({
            tile: frame.tileid ?? tile.id!,
            ms: frame.duration ?? 100,
          })),
        ]),
    ),
    wadeable: new Set(
      (tileset!.tiles ?? [])
        .filter(
          (tile) =>
            typeof tile.id === 'number' &&
            tile.properties?.some((p) => p.name === 'wadeable' && p.value === true),
        )
        .map((tile) => tile.id!),
    ),
  };

  return new WorldMap(
    id,
    width,
    height,
    layers,
    collision.map((gid) => gid !== 0),
    { ...spawnTile, facing: facing as Direction },
    spots,
    set,
    habitats,
    npcs,
    gates,
    areas,
    signposts,
  );
}

interface Zone {
  readonly id: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Zones of one kind (`habitat` or `area`): rectangles naming an ID; a tile belongs to a zone if its
 * centre lies inside. Zones of a kind must not overlap.
 */
function parseZones(
  objects: readonly TiledObject[] | undefined,
  kind: string,
  idProperty: string,
  width: number,
  height: number,
  problems: string[],
): Zone[] {
  const zones: Zone[] = [];
  for (const object of objects?.filter((o) => classOf(o) === kind) ?? []) {
    const id = property(object, idProperty);
    const label = `${kind} zone "${object.name ?? id}"`;
    if (typeof id !== 'string' || id === '') {
      problems.push(`${label} is missing its "${idProperty}"`);
      continue;
    }
    const half = TILE_SIZE / 2;
    const x = object.x ?? 0;
    const y = object.y ?? 0;
    const zone: Zone = {
      id,
      minX: Math.ceil((x - half) / TILE_SIZE),
      minY: Math.ceil((y - half) / TILE_SIZE),
      maxX: Math.ceil((x + (object.width ?? 0) - half) / TILE_SIZE) - 1,
      maxY: Math.ceil((y + (object.height ?? 0) - half) / TILE_SIZE) - 1,
    };
    if (zone.maxX < zone.minX || zone.maxY < zone.minY) {
      problems.push(`${label} covers no tiles`);
    } else if (zone.minX < 0 || zone.minY < 0 || zone.maxX >= width || zone.maxY >= height) {
      problems.push(`${label} extends beyond the map`);
    } else if (zones.some((other) => overlaps(other, zone))) {
      problems.push(`${label} overlaps another ${kind} zone`);
    } else {
      zones.push(zone);
    }
  }
  return zones;
}

function inZone(zone: Omit<Zone, 'id'>, x: number, y: number): boolean {
  return x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY;
}

function overlaps(a: Omit<Zone, 'id'>, b: Omit<Zone, 'id'>): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** Tiled writes the object class as `type` in JSON; `class` is accepted too. */
function classOf(object: TiledObject): string | undefined {
  return object.type || object.class;
}

function property(object: TiledObject, name: string): unknown {
  return object.properties?.find((p) => p.name === name)?.value;
}
