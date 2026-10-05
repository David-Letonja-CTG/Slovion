import cerknica from '../../../../content/maps/cerknica_lake.json';
import karst from '../../../../content/maps/rakov_skocjan_karst.json';
import kocevje from '../../../../content/maps/kocevje_forest.json';
import ljubljana from '../../../../content/maps/ljubljana_park.json';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import murskaSobota from '../../../../content/maps/murska_sobota_village.json';
import pohorje from '../../../../content/maps/pohorje_forest.json';
import portoroz from '../../../../content/maps/portoroz_coast.json';
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
    ['cerknica_lake', cerknica, 'cerknica_heron_1', 'cerknica_lake'],
    ['rakov_skocjan_karst', karst, 'karst_saxifrage_1', 'rakov_skocjan'],
    ['ljubljana_park', ljubljana, 'city_hedgehog_1', 'ljubljana'],
    ['murska_sobota_village', murskaSobota, 'orchard_hoopoe_1', 'murska_sobota'],
    ['portoroz_coast', portoroz, 'sea_salema_1', 'portoroz'],
  ])(
    'parses the region map %s with a reachable signpost, spots and searchable trees',
    (id, json, spotId, area) => {
      // With the boots and the snorkel, so Kočevje's far bank and Portorož's shallows count too.
      const { map, reachable } = reachableFromSpawn([], id, json, ['boots', 'snorkel']);
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
      // Every spot can be reached, or, on a blocked tile (a perched animal's nest), faced from a reachable tile.
      for (const spot of map.spots) {
        const faceable = [
          [0, 0],
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].some(([dx, dy]) => reachable(spot.x + dx, spot.y + dy));
        expect(
          map.isBlocked(spot.x, spot.y) ? faceable : reachable(spot.x, spot.y),
          spot.spotId,
        ).toBe(true);
      }
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

    expect(map.tileset.wadeable).toEqual(new Set([46, 116])); // the stream and the cave pool
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

  it.each([
    ['dravsko_polje_meadow', meadow, 'meadow_station', { x: 14, y: 8 }],
    ['kocevje_forest', kocevje, 'forest_station', { x: 6, y: 8 }],
    ['pohorje_forest', pohorje, 'mammal_station', { x: 5, y: 10 }],
    ['triglav_alps', triglav, 'mountain_station', { x: 6, y: 8 }],
    ['cerknica_lake', cerknica, 'bird_station', { x: 6, y: 8 }],
    ['rakov_skocjan_karst', karst, 'cave_station', { x: 6, y: 8 }],
    ['ljubljana_park', ljubljana, 'city_station', { x: 6, y: 8 }],
    ['murska_sobota_village', murskaSobota, 'farmland_station', { x: 6, y: 8 }],
    ['portoroz_coast', portoroz, 'coast_station', { x: 6, y: 8 }],
  ])(
    'places a reachable research station on %s, outside the habitat zones',
    (id, json, stationId, tile) => {
      const { map, reachable } = reachableFromSpawn([], id, json);

      expect(map.stations).toEqual([{ stationId, ...tile, gid: 57 }]);
      expect(map.habitatAt(tile.x, tile.y)).toBeUndefined();
      const faceable = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => reachable(tile.x + dx, tile.y + dy));
      expect(faceable).toBe(true);
    },
  );

  it('reads the karst map: a daylit gorge, an underground cave, the olm in the cave pool', () => {
    const map = parseTiledMap('rakov_skocjan_karst', karst);
    const spot = (id: string) => map.spots.find((s) => s.spotId === id)!;

    expect([map.areaAt(1, 9), map.isUnderground(1, 9)]).toEqual(['rakov_skocjan', false]);
    expect([map.areaAt(20, 8), map.isUnderground(20, 8)]).toEqual(['zelske_jame', true]);
    const olm = spot('karst_olm_1');
    expect([map.isWadeable(olm.x, olm.y), map.isUnderground(olm.x, olm.y)]).toEqual([true, true]);
    for (const id of ['karst_beetle_1', 'karst_bat_1']) {
      expect(
        [map.isBlocked(spot(id).x, spot(id).y), map.isUnderground(spot(id).x, spot(id).y)],
        id,
      ).toEqual([false, true]);
    }
    expect(map.habitats.every((zone) => zone.maxX < 18)).toBe(true);
    expect(map.npcs).toEqual([expect.objectContaining({ npcId: 'tilen', x: 3, y: 10 })]);
  });

  it('reads the Ljubljana park: lamp posts on the street and paths, the park, the barje beyond the bridge', () => {
    const { map, reachable } = reachableFromSpawn([], 'ljubljana_park', ljubljana);
    const spot = (id: string) => map.spots.find((s) => s.spotId === id)!;
    const world = new World(map, () => undefined);

    expect(map.npcs).toEqual([expect.objectContaining({ npcId: 'ana', x: 3, y: 10 })]);
    expect(map.lamps).toHaveLength(7);
    expect(map.lamps.every((lamp) => lamp.gid === 127 && world.isBlocked(lamp.x, lamp.y))).toBe(
      true,
    );
    expect(map.lamps.filter((lamp) => lamp.y === 4)).toHaveLength(4); // along the street
    expect([map.habitatAt(10, 7), map.areaAt(10, 7)]).toEqual(['city', 'ljubljana']);
    const fritillary = spot('barje_fritillary_1');
    expect([
      map.habitatAt(fritillary.x, fritillary.y),
      map.areaAt(fritillary.x, fritillary.y),
    ]).toEqual(['wetland', 'ljubljansko_barje']);
    expect(map.habitatAt(spot('barje_corncrake_1').x, spot('barje_corncrake_1').y)).toBe('wetland');
    // The river is deep, not wadeable: only the bridge crosses it.
    expect(reachable(13, 14)).toBe(true);
    expect([map.isBlocked(12, 14), map.isWadeable(12, 14)]).toEqual([true, false]);
  });

  it("reads the Murska Sobota village: the stork's nest on a roof beside a yard, the fields, the oxbow", () => {
    const { map, reachable } = reachableFromSpawn([], 'murska_sobota_village', murskaSobota);
    const spot = (id: string) => map.spots.find((s) => s.spotId === id)!;

    expect(map.npcs).toEqual([expect.objectContaining({ npcId: 'stefan', x: 3, y: 10 })]);
    const nest = spot('village_stork_1');
    expect([nest.x, nest.y, map.isBlocked(nest.x, nest.y)]).toEqual([7, 1, true]);
    expect(reachable(nest.x - 1, nest.y)).toBe(true); // the yard beside the house
    expect(map.habitatAt(nest.x, nest.y)).toBeUndefined();
    expect([map.habitatAt(12, 6), map.areaAt(12, 6)]).toEqual(['farmland', 'murska_sobota']);
    const otter = spot('oxbow_otter_1');
    expect([
      map.isWadeable(otter.x, otter.y),
      map.habitatAt(otter.x, otter.y),
      map.areaAt(otter.x, otter.y),
    ]).toEqual([true, 'wetland', 'mura']);
    // The Mura is deep: the player stays on the gravel bank.
    expect([reachable(5, 14), map.isBlocked(5, 15), map.isWadeable(5, 15)]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('reads the Portorož coast: swimmable shallows the pen shell needs the snorkel for, the salt pans', () => {
    const map = parseTiledMap('portoroz_coast', portoroz);
    const spot = (id: string) => map.spots.find((s) => s.spotId === id)!;
    const faceable = (reachable: (x: number, y: number) => boolean, x: number, y: number) =>
      [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => reachable(x + dx, y + dy));

    expect(map.npcs).toEqual([expect.objectContaining({ npcId: 'nina', x: 3, y: 10 })]);
    expect(map.tileset.swimmable).toEqual(new Set([143]));
    expect(map.lamps).toHaveLength(3);
    const shell = spot('sea_pen_shell_1');
    expect([map.isSwimmable(shell.x, shell.y), map.isBlocked(shell.x, shell.y)]).toEqual([
      true,
      true,
    ]);
    const onFoot = reachableFromSpawn([], 'portoroz_coast', portoroz, ['boots']).reachable;
    const swimming = reachableFromSpawn([], 'portoroz_coast', portoroz, ['snorkel']).reachable;
    expect([faceable(onFoot, shell.x, shell.y), faceable(swimming, shell.x, shell.y)]).toEqual([
      false,
      true,
    ]);
    // The deep sea stays closed even when swimming.
    expect([swimming(6, 15), swimming(6, 16), map.isSwimmable(6, 16)]).toEqual([
      true,
      false,
      false,
    ]);
    // Every spot on land can be reached on foot.
    for (const id of [
      'saltpan_stilt_1',
      'saltpan_egret_1',
      'saltpan_glasswort_1',
      'saltpan_glasswort_2',
    ]) {
      expect(onFoot(spot(id).x, spot(id).y), id).toBe(true);
    }
    const killifish = spot('saltpan_killifish_1');
    expect([
      map.isWadeable(killifish.x, killifish.y),
      map.habitatAt(killifish.x, killifish.y),
    ]).toEqual([true, 'saltpan']);
    expect([map.habitatAt(17, 6), map.areaAt(17, 6), map.areaAt(6, 14)]).toEqual([
      'saltpan',
      'secoveljske_soline',
      'portoroz',
    ]);
  });

  it('reports an area whose underground property is not a boolean', () => {
    const json = meadowCopy();
    const objects = (
      json.layers.find((layer) => layer['name'] === 'objects') as {
        objects: Record<string, unknown>[];
      }
    ).objects;
    const area = objects.find((object) => object['type'] === 'area')!;
    (area['properties'] as unknown[]).push({ name: 'underground', type: 'string', value: 'yes' });

    expect(
      problemsOf(json).some((problem) => problem.includes('"underground" that is not a boolean')),
    ).toBe(true);
  });

  it('needs the boots for the water lily and the islet on the lake, and never enters deep water', () => {
    const without = reachableFromSpawn([], 'cerknica_lake', cerknica);
    const withBoots = reachableFromSpawn([], 'cerknica_lake', cerknica, ['boots']);
    const spot = (id: string) => without.map.spots.find((s) => s.spotId === id)!;
    const wading = ['cerknica_water_lily_1', 'cerknica_demoiselle_1'];

    for (const id of wading) {
      expect(without.reachable(spot(id).x, spot(id).y), id).toBe(false);
      expect(withBoots.reachable(spot(id).x, spot(id).y), id).toBe(true);
    }
    // The lily lies two tiles out: no tile next to it can be reached without the boots.
    const lily = spot('cerknica_water_lily_1');
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      expect(without.reachable(lily.x + dx, lily.y + dy)).toBe(false);
    }
    for (const s of without.map.spots.filter((s) => !wading.includes(s.spotId))) {
      expect(without.reachable(s.x, s.y), s.spotId).toBe(true);
    }
    for (let x = 0; x < without.map.width; x++) expect(withBoots.reachable(x, 17)).toBe(false);
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

  it('reports research stations without an ID, without a tile, or outside the map', () => {
    const json = meadowCopy();
    const objects = (
      json.layers.find((layer) => layer['name'] === 'objects') as {
        objects: Record<string, unknown>[];
      }
    ).objects;
    const station = objects.find((object) => object['type'] === 'station')!;
    objects.push(
      { ...station, name: 'unnamed', properties: [] },
      { ...station, name: 'flat', gid: undefined },
      { ...station, name: 'far', x: 9999 },
    );

    expect(problemsOf(json)).toEqual(
      expect.arrayContaining([
        "station 'unnamed' needs a stationId",
        "station 'flat' must be a tile object",
        "station 'far' lies outside the map",
      ]),
    );
  });

  it('reports lamp posts without a tile or outside the map', () => {
    const json = meadowCopy();
    const objects = (
      json.layers.find((layer) => layer['name'] === 'objects') as {
        objects: Record<string, unknown>[];
      }
    ).objects;
    const station = objects.find((object) => object['type'] === 'station')!;
    const lamp = { ...station, type: 'lamp', properties: undefined };
    objects.push({ ...lamp, name: 'flat', gid: undefined }, { ...lamp, name: 'far', x: 9999 });

    expect(problemsOf(json)).toEqual([
      "lamp 'flat' must be a tile object",
      "lamp 'far' lies outside the map",
    ]);
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
