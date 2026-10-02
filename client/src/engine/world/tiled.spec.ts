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
    expect(map.spots).toEqual([{ spotId: 'meadow_sage_1', x: 13, y: 10 }]);
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
