import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import { MapFormatError, parseTiledMap } from './tiled';

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

    expect([map.id, map.width, map.height]).toEqual(['dravsko_polje_meadow', 32, 20]);
    expect(map.spawn).toEqual({ x: 10, y: 10, facing: 'right' });
    expect(map.spots).toContainEqual({ spotId: 'meadow_sage_1', x: 13, y: 10 });
    expect(map.spots.map((spot) => spot.spotId).sort()).toEqual([
      'meadow_dandelion_1',
      'meadow_hare_1',
      'meadow_sage_1',
      'meadow_skylark_1',
      'meadow_swallowtail_1',
    ]);
    expect(map.layers.map((layer) => layer.name)).toEqual(['ground', 'decor']);
    expect(map.tileset.image).toBe('../tilesets/meadow.png');
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

  it('lets the player reach every spot from the spawn', () => {
    const map = parseTiledMap('dravsko_polje_meadow', meadow);
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
        if (!map.isBlocked(next.x, next.y) && !seen.has(key(next.x, next.y))) {
          seen.add(key(next.x, next.y));
          queue.push(next);
        }
      }
    }

    for (const spot of map.spots) {
      expect(seen.has(key(spot.x, spot.y)), spot.spotId).toBe(true);
    }
  });

  it('reads the tall-grass habitat zones (same tiles as the server)', () => {
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
      [10, 10],
      [19, 12],
      [12, 11],
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
