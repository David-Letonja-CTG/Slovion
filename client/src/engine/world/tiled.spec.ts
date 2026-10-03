import kocevje from '../../../../content/maps/kocevje_forest.json';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import pohorje from '../../../../content/maps/pohorje_forest.json';
import triglav from '../../../../content/maps/triglav_alps.json';
import { STEP_MS } from '../game-loop';
import { ActionState } from '../input/action-state';
import { MapFormatError, parseTiledMap } from './tiled';
import { Interaction, World } from './world';

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
    expect(map.signposts).toEqual([{ x: 12, y: 9, gid: 31 }]);
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
  function reachableFromSpawn(
    flags: readonly string[] = [],
    id = 'dravsko_polje_meadow',
    json: unknown = meadow,
    tools: readonly string[] = [],
  ) {
    const map = parseTiledMap(id, json);
    const world = new World(map, () => undefined);
    world.setOpenFlags(flags);
    world.setTools(tools);
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
        if (!world.isBlockedForPlayer(next.x, next.y) && !seen.has(key(next.x, next.y))) {
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

  it('lets the player reach the signpost next to the spawn', () => {
    const { map, reachable } = reachableFromSpawn();
    const [signpost] = map.signposts;

    expect(
      Math.abs(signpost.x - map.spawn.x) + Math.abs(signpost.y - map.spawn.y),
    ).toBeLessThanOrEqual(3);
    expect(reachable(signpost.x, signpost.y + 1)).toBe(true); // stand below it, face up
  });

  it.each([
    ['kocevje_forest', kocevje, 'kocevje_bear_1', 'kocevje_forest'],
    ['pohorje_forest', pohorje, 'pohorje_wolf_1', 'pohorje_forest'],
    ['triglav_alps', triglav, 'triglav_chamois_1', 'triglav_slopes'],
  ])(
    'parses the region map %s with a reachable signpost, spots and searchable trees',
    (id, json, spotId, area) => {
      // With the boots, so Kočevje's far bank counts too.
      const { map, reachable } = reachableFromSpawn([], id, json, ['boots']);
      const [signpost] = map.signposts;
      const home = map.spots.find((spot) => spot.spotId === spotId)!;

      expect(map.spawn).toEqual({ x: 1, y: 9, facing: 'right' });
      expect(signpost).toEqual({ x: 2, y: 8, gid: 31 });
      expect(reachable(2, 9)).toBe(true); // beside the spawn, below the signpost
      expect(reachable(home.x, home.y)).toBe(true);
      expect([map.areaAt(map.spawn.x, map.spawn.y), map.areaAt(home.x, home.y)]).toEqual([
        area,
        area,
      ]);
      // The spawn, the tile beside it and the signpost lie outside the habitat zones.
      for (const [x, y] of [
        [1, 9],
        [2, 9],
        [2, 8],
      ]) {
        expect(map.habitatAt(x, y), `${x},${y}`).toBeUndefined();
      }
      expect(map.habitats.length).toBeGreaterThan(0);
      for (const spot of map.spots) expect(reachable(spot.x, spot.y), spot.spotId).toBe(true);
      // Some trees, shrubs or rocks stand inside the zones, so they can be searched.
      const zonedBlocked = map.habitats.some((zone) => {
        for (let y = zone.minY; y <= zone.maxY; y++) {
          for (let x = zone.minX; x <= zone.maxX; x++) if (map.isBlocked(x, y)) return true;
        }
        return false;
      });
      expect(zonedBlocked).toBe(true);
    },
  );

  it("reads wadeable tiles: Kočevje's stream needs the boots to cross", () => {
    const map = parseTiledMap('kocevje_forest', kocevje);
    const salamander = map.spots.find((spot) => spot.spotId === 'kocevje_salamander_1')!;

    expect(map.tileset.wadeable).toEqual(new Set([46]));
    expect([map.isWadeable(5, 16), map.isWadeable(5, 15)]).toEqual([true, false]);
    expect(salamander.y).toBe(17);
    expect(
      reachableFromSpawn([], 'kocevje_forest', kocevje).reachable(salamander.x, salamander.y),
    ).toBe(false);
    expect(
      reachableFromSpawn([], 'kocevje_forest', kocevje, ['boots']).reachable(
        salamander.x,
        salamander.y,
      ),
    ).toBe(true);
  });

  it('searches at a spruce beside the Pohorje path, from outside the zones', () => {
    // The spawn moved onto the path at (5, 9), facing the spruce at (5, 8).
    const json = structuredClone(pohorje) as unknown as {
      layers: {
        name: string;
        objects?: {
          type: string;
          x: number;
          y: number;
          properties?: { name: string; value: string }[];
        }[];
      }[];
    };
    const spawn = json.layers
      .find((l) => l.name === 'objects')!
      .objects!.find((o) => o.type === 'spawn')!;
    Object.assign(spawn, { x: 5 * 16 + 8, y: 9 * 16 + 8 });
    spawn.properties!.find((p) => p.name === 'facing')!.value = 'up';
    const map = parseTiledMap('pohorje_forest', json);
    const interactions: Interaction[] = [];
    const world = new World(map, (interaction) => interactions.push(interaction));
    const input = new ActionState();

    input.press('Interact');
    world.update(input, STEP_MS);

    expect(map.habitatAt(5, 9)).toBeUndefined();
    expect(map.isBlocked(5, 8)).toBe(true);
    expect(interactions).toEqual([{ kind: 'search', mapId: 'pohorje_forest', x: 5, y: 8 }]);
  });

  it('requires exactly one signpost, as a tile object inside the map', () => {
    const json = meadowCopy();
    const objects = json.layers.find((l) => l['name'] === 'objects')!['objects'] as Record<
      string,
      unknown
    >[];
    const signpost = objects.find((o) => o['type'] === 'signpost')!;
    objects.push({ ...signpost, gid: 0 });

    expect(problemsOf(json)).toEqual(
      expect.arrayContaining([
        'exactly one signpost is required (found 2)',
        'the signpost must be a tile object',
      ]),
    );

    json.layers.find((l) => l['name'] === 'objects')!['objects'] = objects.filter(
      (o) => o['type'] !== 'signpost',
    );
    expect(problemsOf(json)).toContain('exactly one signpost is required (found 0)');
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
