import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import { MapFormatError, parseTiledMap } from './tiled';
import { World } from './world';

/** A deep copy of the real meadow, to break one detail at a time. */
function meadowCopy(): Record<string, unknown> & { layers: Record<string, unknown>[] } {
  return structuredClone(meadow) as never;
}

function problemsOf(json: unknown): readonly string[] {
  try {
    parseTiledMap('broken', json);
  } catch (error) {
    if (error instanceof MapFormatError) return error.problems;
    throw error;
  }
  throw new Error('expected the map to be rejected');
}

describe('parseTiledMap', () => {
  it('parses the real Dravsko polje meadow', () => {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);

    expect([map.id, map.width, map.height]).toEqual(['dravsko_polje_meadow', 32, 28]);
    expect(map.spawn).toEqual({ x: 10, y: 10, facing: 'right' });
    expect(map.spots).toContainEqual({ spotId: 'meadow_sage_1', x: 13, y: 10 });
    expect(map.spots.map((spot) => spot.spotId).sort()).toEqual([
      'hedgerow_hawthorn_1',
      'hedgerow_shrike_1',
      'meadow_dandelion_1',
      'meadow_hare_1',
      'meadow_sage_1',
      'meadow_skylark_1',
      'meadow_swallowtail_1',
    ]);
    expect(map.layers.map((layer) => layer.name)).toEqual(['ground', 'decor']);
    expect(map.tileset.image).toBe('../tilesets/meadow.png');
    expect(map.npcs).toEqual([{ npcId: 'vera', x: 7, y: 9, gid: 20 }]);
    expect(map.gates).toEqual([{ flag: 'hedgerow_open', x: 20, y: 19, gid: 19 }]);
    // Trees (tile 5) and tall grass (tile 3) sway between two frames.
    expect(map.tileset.animations?.get(5)?.map((frame) => frame.tile)).toEqual([5, 20]);
    expect(map.tileset.animations?.get(3)?.map((frame) => frame.tile)).toEqual([3, 21]);
    expect([map.areaAt(10, 10), map.areaAt(20, 19), map.areaAt(20, 20)]).toEqual([
      'meadow',
      'meadow',
      'south_hedgerow',
    ]);
  });

  it('knows which tiles are blocked, including everything outside the map', () => {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);

    expect(map.isBlocked(0, 0)).toBe(true); // hedge border
    expect(map.isBlocked(10, 8)).toBe(true); // hedge above the spawn
    expect(map.isBlocked(10, 10)).toBe(false); // spawn
    expect(map.isBlocked(13, 10)).toBe(false); // the sage spot can be walked on
    expect(map.isBlocked(-1, 5)).toBe(true);
    expect(map.isBlocked(32, 5)).toBe(true);
  });

  it('finds spots by tile', () => {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);

    expect(map.spotAt(13, 10)?.spotId).toBe('meadow_sage_1');
    expect(map.spotAt(12, 10)).toBeUndefined();
  });

  /** Every tile the player can walk to from the spawn, with the given progress flags. */
  function reachableFromSpawn(flags: readonly string[] = []) {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);
    const world = new World(map, () => undefined);
    world.setOpenFlags(flags);
    const key = (x: number, y: number) => `${x},${y}`;
    const seen = new Set([key(map.spawn.x, map.spawn.y)]);
    const queue = [{ x: map.spawn.x, y: map.spawn.y }];
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const next = { x: x + dx, y: y + dy };
        if (!world.isBlocked(next.x, next.y) && !seen.has(key(next.x, next.y))) {
          seen.add(key(next.x, next.y));
          queue.push(next);
        }
      }
    }

    return { map, reachable: (x: number, y: number) => seen.has(key(x, y)) };
  }

  it('lets the player reach every meadow spot from the spawn', () => {
    const { map, reachable } = reachableFromSpawn();

    for (const spot of map.spots.filter((s) => s.spotId.startsWith('meadow_'))) {
      expect(reachable(spot.x, spot.y), spot.spotId).toBe(true);
    }
  });

  it('keeps the hedgerow strip closed off behind the gate until the quest opens it', () => {
    const { map, reachable } = reachableFromSpawn();

    for (let y = 19; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(reachable(x, y), `${x},${y}`).toBe(false);
      }
    }
  });

  it('lets the player reach the hedgerow and its spot once the gate is open', () => {
    const { map, reachable } = reachableFromSpawn(['hedgerow_open']);

    expect(reachable(20, 19)).toBe(true);
    const hawthorn = map.spots.find((spot) => spot.spotId === 'hedgerow_hawthorn_1')!;
    expect(reachable(hawthorn.x, hawthorn.y + 1)).toBe(true);
  });

  it('reports NPCs and gates that are not usable tile objects', () => {
    const json = meadowCopy();
    const objects = json.layers.find((l) => l['name'] === 'objects')!['objects'] as Record<
      string,
      unknown
    >[];
    const vera = objects.find((o) => o['type'] === 'npc')!;
    const gate = objects.find((o) => o['type'] === 'gate')!;
    objects.push({ ...vera, name: 'no_gid', gid: 0 });
    objects.push({ ...vera, name: 'far_away', x: 9999 });
    objects.push({ ...gate, name: 'flagless', properties: [] });

    expect(problemsOf(json)).toEqual(
      expect.arrayContaining([
        'npc "no_gid" must be a tile object',
        'npc "far_away" lies outside the map',
        'gate "flagless" is missing its "requiresFlag"',
      ]),
    );
  });

  it('reads the habitat zones (same tiles as the server)', () => {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);

    for (const [x, y] of [
      [12, 12],
      [18, 15],
      [8, 3],
      [13, 6],
    ]) {
      expect(map.habitatAt(x, y), `${x},${y}`).toBe('tall_grass');
    }
    for (const [x, y] of [
      [2, 20],
      [13, 22],
      [29, 22],
      [5, 26],
    ]) {
      expect(map.habitatAt(x, y), `${x},${y}`).toBe('hedgerow');
    }
    for (const [x, y] of [
      [10, 10],
      [19, 12],
      [12, 11],
      [20, 21],
      [10, 23],
      [20, 19],
    ]) {
      expect(map.habitatAt(x, y), `${x},${y}`).toBeUndefined();
    }
  });

  it('reports overlapping habitat zones', () => {
    const json = meadowCopy();
    const objects = json.layers.find((l) => l['name'] === 'objects')!['objects'] as Record<
      string,
      unknown
    >[];
    objects.push({ ...objects.find((o) => o['type'] === 'habitat')!, name: 'copy' });

    expect(problemsOf(json)).toContain('habitat zone "copy" overlaps another habitat zone');
  });

  it('reports walkable tiles that lie in no area', () => {
    const json = meadowCopy();
    const objects = json.layers.find((l) => l['name'] === 'objects')!['objects'] as Record<
      string,
      unknown
    >[];
    json.layers.find((l) => l['name'] === 'objects')!['objects'] = objects.filter(
      (o) => o['name'] !== 'area_south_hedgerow',
    );

    expect(problemsOf(json).join('\n')).toMatch(
      /walkable tile\(s\) lie in no area, e\.g\. \(\d+, 2\d\)/,
    );
  });

  it('reports a missing spawn', () => {
    const json = meadowCopy();
    const objects = json.layers.find((l) => l['name'] === 'objects')!['objects'] as unknown[];
    objects.splice(0, 1);

    expect(problemsOf(json)).toContain('exactly one spawn is required (found 0)');
  });

  it('reports a missing required layer', () => {
    const json = meadowCopy();
    json.layers = json.layers.filter((l) => l['name'] !== 'collision');

    expect(problemsOf(json)).toContain('tile layer "collision" is required');
  });

  it('reports a non-orthogonal map', () => {
    const json = meadowCopy();
    json['orientation'] = 'isometric';

    expect(problemsOf(json)).toContain('only orthogonal maps are supported');
  });

  it('reports every problem at once', () => {
    expect(problemsOf({}).length).toBeGreaterThan(3);
  });
});
