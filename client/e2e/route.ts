import { Page, expect } from '@playwright/test';

// Walking generated maps (docs/decisions.md D13): the save's map comes from the API, the player's tile from the
// debug view (`?debug=world`), and routes are found by breadth-first search, so tests do not depend on a layout.

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  readonly x: number;
  readonly y: number;
}

interface TileObject extends Tile {
  readonly type: string;
  readonly properties: Record<string, unknown>;
}

/** A map as the API serves it, reduced to what walking needs. */
export interface ServedMap {
  readonly width: number;
  readonly height: number;
  readonly blocked: readonly boolean[];
  /** NPCs, gates, the signpost, stations and lamps: tile objects that block their tile. */
  readonly actors: readonly TileObject[];
  readonly spots: readonly (Tile & { readonly spotId: string })[];
  readonly habitats: readonly {
    readonly habitatId: string;
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  }[];
}

/** The parts of the Tiled JSON walking reads. */
interface RawObject {
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly gid?: number;
  readonly properties?: readonly { readonly name: string; readonly value: unknown }[];
}

interface RawLayer {
  readonly name: string;
  readonly type: string;
  readonly data?: readonly number[];
  readonly objects?: readonly RawObject[];
}

const STEPS: Record<Direction, Tile> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const KEYS: Record<Direction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

/** Fetches the save's map. */
export async function loadMap(page: Page, mapId = 'dravsko_polje_meadow'): Promise<ServedMap> {
  const json = await page.evaluate(async (id) => {
    const token = localStorage.getItem('slovion.saveToken');
    const response = await fetch(`/api/save/maps/${id}`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    return response.json();
  }, mapId);
  const layers = json.layers as RawLayer[];
  const objects = layers.find((layer) => layer.type === 'objectgroup')!.objects!;
  const properties = (o: RawObject) =>
    Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
  const tileOf = (o: RawObject) => ({
    x: Math.floor((o.x + o.width / 2) / 16),
    y: Math.floor((o.y - o.height / 2) / 16),
  });
  // Zones cover the tiles whose centre lies inside them.
  const zoneOf = (o: RawObject) => ({
    minX: Math.ceil((o.x - 8) / 16),
    minY: Math.ceil((o.y - 8) / 16),
    maxX: Math.ceil((o.x + o.width - 8) / 16) - 1,
    maxY: Math.ceil((o.y + o.height - 8) / 16) - 1,
  });
  return {
    width: json.width,
    height: json.height,
    blocked: layers.find((layer) => layer.name === 'collision')!.data!.map((gid) => gid !== 0),
    actors: objects
      .filter((o) => o.gid)
      .map((o) => ({ type: o.type, ...tileOf(o), properties: properties(o) })),
    spots: objects
      .filter((o) => o.type === 'spot')
      .map((o) => ({
        spotId: String(properties(o)['spotId']),
        x: Math.floor(o.x / 16),
        y: Math.floor(o.y / 16),
      })),
    habitats: objects
      .filter((o) => o.type === 'habitat')
      .map((o) => ({ habitatId: String(properties(o)['habitatId']), ...zoneOf(o) })),
  };
}

/** The spot of a species on the map (generated maps name them `<mapId>_<speciesId>_1`). */
export function spotOf(map: ServedMap, speciesId: string): Tile & { spotId: string } {
  const spot = map.spots.find((s) => s.spotId.endsWith(`_${speciesId}_1`));
  if (!spot) throw new Error(`no spot of ${speciesId}`);
  return spot;
}

/** The player's tile and facing, from the debug view. */
export async function playerAt(page: Page): Promise<Tile & { facing: Direction }> {
  // Drawn with every frame; right after the game opens there may not have been one yet.
  const canvas = page.locator('app-game-canvas canvas');
  await expect(canvas, 'the debug view is off: open the game with ?debug=world').toHaveAttribute(
    'data-player',
    /^\d+,\d+,\w+$/,
  );
  const value = (await canvas.getAttribute('data-player'))!;
  const [x, y, facing] = value.split(',');
  return { x: Number(x), y: Number(y), facing: facing as Direction };
}

export interface WalkOptions {
  /** Flags whose gates are open. */
  readonly openFlags?: readonly string[];
  /** Presses a direction once, one finished step; the keyboard by default. */
  readonly press?: (direction: Direction) => Promise<void>;
}

/** Walks onto `target`. */
export async function walkTo(page: Page, map: ServedMap, target: Tile, options: WalkOptions = {}) {
  await follow(page, map, [target], options);
  expect(await playerAt(page)).toMatchObject(target);
}

/**
 * Walks to a tile beside `target` and faces it: beside it and turning when it blocks (a person, a bush), or arriving
 * with a step towards it when it can be walked on (a plant on the grass).
 */
export async function face(page: Page, map: ServedMap, target: Tile, options: WalkOptions = {}) {
  const press = options.press ?? keyboard(page);
  const walkable = isWalkable(map, target, options.openFlags);
  for (let attempt = 0; attempt < 6; attempt++) {
    const at = await playerAt(page);
    const facing = (Object.keys(STEPS) as Direction[]).find(
      (d) => at.x + STEPS[d].x === target.x && at.y + STEPS[d].y === target.y,
    );
    if (facing && at.facing === facing) return;
    if (facing && !walkable) {
      await press(facing);
      continue;
    }
    // From where to start the last step: beside the target (it blocks), or one tile further out (it does not).
    const starts = (Object.keys(STEPS) as Direction[])
      .map((d) => {
        const beside = { x: target.x - STEPS[d].x, y: target.y - STEPS[d].y };
        const start = walkable ? { x: beside.x - STEPS[d].x, y: beside.y - STEPS[d].y } : beside;
        return { d, beside, start };
      })
      .filter(
        ({ beside, start }) =>
          isWalkable(map, beside, options.openFlags) && isWalkable(map, start, options.openFlags),
      );
    const start = await follow(
      page,
      map,
      starts.map((s) => s.start),
      options,
    );
    const chosen = starts.find((s) => s.start.x === start.x && s.start.y === start.y)!;
    await press(chosen.d);
    if (!walkable) continue;
    const now = await playerAt(page);
    if (now.x === chosen.beside.x && now.y === chosen.beside.y && now.facing === chosen.d) return;
  }
  throw new Error(`could not face (${target.x}, ${target.y})`);
}

/** Walks to the nearest walkable tile of a habitat zone. */
export async function walkIntoHabitat(
  page: Page,
  map: ServedMap,
  habitatId: string,
  options: WalkOptions = {},
): Promise<Tile> {
  const tiles = map.habitats
    .filter((zone) => zone.habitatId === habitatId)
    .flatMap((zone) => {
      const inside: Tile[] = [];
      for (let y = zone.minY; y <= zone.maxY; y++) {
        for (let x = zone.minX; x <= zone.maxX; x++) inside.push({ x, y });
      }
      return inside;
    })
    .filter((tile) => isWalkable(map, tile, options.openFlags));
  return follow(page, map, tiles, options);
}

/** Walks to whichever of `goals` is nearest, step by step; an animal in the way is waited for or walked around. */
async function follow(
  page: Page,
  map: ServedMap,
  goals: readonly Tile[],
  options: WalkOptions,
): Promise<Tile> {
  const press = options.press ?? keyboard(page);
  const avoid = new Set<string>();
  for (let step = 0; step < 200; step++) {
    const at = await playerAt(page);
    const reached = goals.find((goal) => goal.x === at.x && goal.y === at.y);
    if (reached) return reached;
    const route = search(map, at, goals, options.openFlags, avoid);
    if (!route) throw new Error(`no way from (${at.x}, ${at.y}) to the goal`);
    await press(route[0]);
    const now = await playerAt(page);
    if (now.x === at.x && now.y === at.y) {
      // Something (an animal) stands in the way: wait a moment, then try around it.
      await page.waitForTimeout(500);
      avoid.add(`${at.x + STEPS[route[0]].x},${at.y + STEPS[route[0]].y}`);
    } else {
      avoid.clear();
    }
  }
  throw new Error('the walk took too long');
}

function search(
  map: ServedMap,
  from: Tile,
  goals: readonly Tile[],
  openFlags: readonly string[] = [],
  avoid: ReadonlySet<string> = new Set(),
): Direction[] | undefined {
  const key = (tile: Tile) => `${tile.x},${tile.y}`;
  const wanted = new Set(goals.map(key));
  const previous = new Map<string, { from: string; direction: Direction }>();
  const queue: Tile[] = [from];
  const seen = new Set([key(from)]);
  while (queue.length > 0) {
    const tile = queue.shift()!;
    if (wanted.has(key(tile))) {
      const route: Direction[] = [];
      for (let at = key(tile); previous.has(at); at = previous.get(at)!.from) {
        route.unshift(previous.get(at)!.direction);
      }
      return route;
    }
    for (const direction of Object.keys(STEPS) as Direction[]) {
      const next = { x: tile.x + STEPS[direction].x, y: tile.y + STEPS[direction].y };
      if (seen.has(key(next)) || avoid.has(key(next)) || !isWalkable(map, next, openFlags)) {
        continue;
      }
      seen.add(key(next));
      previous.set(key(next), { from: key(tile), direction });
      queue.push(next);
    }
  }
  return undefined;
}

function isWalkable(map: ServedMap, tile: Tile, openFlags: readonly string[] = []): boolean {
  if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height) return false;
  if (map.blocked[tile.y * map.width + tile.x]) return false;
  const actor = map.actors.find((a) => a.x === tile.x && a.y === tile.y);
  return (
    !actor ||
    (actor.type === 'gate' && openFlags.includes(String(actor.properties['requiresFlag'])))
  );
}

/** One tap of an arrow key; a step takes 250 ms, so wait a little longer. */
function keyboard(page: Page): (direction: Direction) => Promise<void> {
  return async (direction) => {
    await page.keyboard.press(KEYS[direction]);
    await page.waitForTimeout(400);
  };
}
