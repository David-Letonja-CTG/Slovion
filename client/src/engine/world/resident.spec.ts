import { GameLoop, STEP_MS } from '../game-loop';
import { ActionState } from '../input/action-state';
import { FakeFrames } from '../testing/fake-environment';
import { seededRandom } from './random';
import { RESIDENT_RANGE, ResidentInfo, TorchReaction } from './resident';
import { textMap } from './testing';
import { Interaction, World, WorldClock } from './world';

const NIGHT: WorldClock = { minutes: 23 * 60, gameMinutesPerSecond: 0 };
const NOON: WorldClock = { minutes: 12 * 60, gameMinutesPerSecond: 0 };

const hare = (torch: TorchReaction = 'curious', present = true): ResidentInfo => ({
  spotId: 'hare',
  speciesId: 'lepus_europaeus',
  torch,
  present,
});

/** An open 15×9 field with the resident's home in the middle and the player on the left. */
const FIELD = [
  '###############',
  '#.............#',
  '#.............#',
  '#.............#',
  '#S......R.....#',
  '#.............#',
  '#.............#',
  '#.............#',
  '###############',
];

function setup(
  rows: readonly string[] = FIELD,
  residents: readonly ResidentInfo[] = [hare()],
  clock: WorldClock = NOON,
  areaOf: (x: number, y: number) => string | undefined = () => undefined,
) {
  const interactions: Interaction[] = [];
  const world = new World(
    textMap(rows, 'right', areaOf),
    (i) => interactions.push(i),
    () => undefined,
    clock,
  );
  world.setResidents(residents);
  const input = new ActionState();
  const frames = new FakeFrames();
  new GameLoop(
    { update: (ms) => world.update(input, ms), render: () => undefined },
    frames,
    frames,
  ).start();
  return { world, input, frames, interactions };
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const tileOf = (world: World) => ({ x: world.residents[0].tileX, y: world.residents[0].tileY });

describe('seededRandom', () => {
  it('repeats for the same seed and differs between seeds', () => {
    const a = seededRandom('hare');
    const b = seededRandom('hare');
    const c = seededRandom('skylark');
    const first = [a(), a(), a()];

    expect([b(), b(), b()]).toEqual(first);
    expect(c()).not.toBe(first[0]);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('Resident animals', () => {
  it('appear at home when present and not at all when absent', () => {
    expect(setup().world.residents.map((r) => [r.tileX, r.tileY])).toEqual([[8, 4]]);
    expect(setup(FIELD, [hare('curious', false)]).world.residents).toEqual([]);
  });

  it('wander but never more than 3 tiles from home', () => {
    const { world, frames } = setup();
    const visited = new Set<string>();

    for (let second = 0; second < 120; second++) {
      frames.frames(30, 1000);
      const at = tileOf(world);
      visited.add(`${at.x},${at.y}`);
      expect(distance(at, { x: 8, y: 4 })).toBeLessThanOrEqual(RESIDENT_RANGE);
    }
    expect(visited.size).toBeGreaterThan(3);
  });

  it('wait next to the player', () => {
    const { world, frames } = setup(['#####', '#SR.#', '#####']);

    frames.frames(30, 20000);

    expect(tileOf(world)).toEqual({ x: 2, y: 1 });
  });

  it('come closer to a lit torch at night when curious', () => {
    const { world, frames } = setup(
      ['#############', '#.S...R.....#', '#############'],
      [hare('curious')],
      NIGHT,
    );
    world.setTorch(true);

    frames.frames(30, 5000);

    expect(tileOf(world)).toEqual({ x: 3, y: 1 });
  });

  it('move away from a lit torch at night when shy', () => {
    const { world, frames } = setup(
      ['##############', '#.S..R.......#', '##############'],
      [hare('shy')],
      NIGHT,
    );
    world.setTorch(true);

    frames.frames(30, 5000);

    expect(world.residents[0].tileX).toBeGreaterThan(6);
  });

  it('react to a lit torch underground, even by day', () => {
    const { world, frames } = setup(
      ['#############', '#.S...R.....#', '#############'],
      [hare('curious')],
      NOON,
      () => 'cave',
    );
    world.setTorch(true);

    frames.frames(30, 5000);

    expect(world.isUnderground).toBe(true);
    expect(world.isDark).toBe(true);
    expect(tileOf(world)).toEqual({ x: 3, y: 1 });
  });

  it('stay in the water when aquatic', () => {
    const pool = [
      '#########',
      '#S......#',
      '#.~~~~~.#',
      '#.~~O~~.#',
      '#.~~~~~.#',
      '#.......#',
      '#########',
    ];
    const olm: ResidentInfo = {
      spotId: 'olm',
      speciesId: 'proteus_anguinus',
      torch: 'shy',
      aquatic: true,
      present: true,
    };
    const { world, frames } = setup(pool, [olm]);
    const visited = new Set<string>();

    for (let second = 0; second < 120; second++) {
      frames.frames(30, 1000);
      const at = tileOf(world);
      visited.add(`${at.x},${at.y}`);
      expect(pool[at.y][at.x], `${at.x},${at.y}`).toMatch(/[~O]/);
    }
    expect(visited.size).toBeGreaterThan(3);
  });

  it('swim in the shallow sea when aquatic, but never onto land', () => {
    const sea = [
      '#########',
      '#S......#',
      '#.%%%%%.#',
      '#.%%O%%.#',
      '#.%%%%%.#',
      '#.......#',
      '#########',
    ];
    const fish: ResidentInfo = {
      spotId: 'olm',
      speciesId: 'sarpa_salpa',
      torch: 'calm',
      aquatic: true,
      present: true,
    };
    const { world, frames } = setup(sea, [fish]);
    const visited = new Set<string>();

    for (let second = 0; second < 120; second++) {
      frames.frames(30, 1000);
      const at = tileOf(world);
      visited.add(`${at.x},${at.y}`);
      expect(sea[at.y][at.x], `${at.x},${at.y}`).toMatch(/[%O]/);
    }
    expect([...visited].some((key) => key !== '4,3')).toBe(true);
  });

  it('ignore the torch when calm and by day', () => {
    const calm = setup(['#############', '#.S...R.....#', '#############'], [hare('calm')], NIGHT);
    calm.world.setTorch(true);
    const day = setup(['#############', '#.S...R.....#', '#############'], [hare('curious')], NOON);
    day.world.setTorch(true);

    calm.frames.frames(30, 5000);
    day.frames.frames(30, 5000);

    expect(calm.world.residents[0].tileX).toBeGreaterThanOrEqual(6 - RESIDENT_RANGE);
    expect(day.world.residents[0].tileX).toBeGreaterThanOrEqual(6 - RESIDENT_RANGE);
    expect(tileOf(day.world)).not.toEqual({ x: 3, y: 1 });
  });

  it('stay on their home tile when perched, even on a blocked tile and near a lit torch', () => {
    const { world, frames } = setup(
      ['#########', '#S..^...#', '#########'],
      [{ ...hare('curious'), perched: true }],
      NIGHT,
    );
    world.setTorch(true);

    frames.frames(200, 500);

    expect(tileOf(world)).toEqual({ x: 4, y: 1 });
    expect(world.isBlocked(4, 1)).toBe(true);
  });

  it('are met on their blocked home tile rather than searching it, when perched', () => {
    const { input, frames, interactions } = setup(
      ['#####', '#S^.#', '#####'],
      [{ ...hare('calm'), perched: true }],
    );

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'spot', mapId: 'test_map', spotId: 'hare' }]);
  });

  it('block the player', () => {
    const { world, input, frames } = setup(['#####', '#SR.#', '#####']);

    input.press('MoveRight');
    frames.frames(30, 1000);

    expect(world.player.position).toEqual({ x: 1, y: 1 });
  });

  it('start the encounter of their spot when faced', () => {
    const { world, input, frames, interactions } = setup(['#####', '#SR.#', '#####']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(world.player.facing).toBe('right');
    expect(interactions).toEqual([{ kind: 'spot', mapId: 'test_map', spotId: 'hare' }]);
  });

  it('leave their home spot unreachable while absent', () => {
    const { input, frames, interactions } = setup(
      ['#####', '#SR.#', '#####'],
      [hare('curious', false)],
    );

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
  });

  it('keep their position when the list is refreshed and leave when absent', () => {
    const { world, frames } = setup();
    frames.frames(30, 20000);
    const before = tileOf(world);

    world.setResidents([hare()]);
    expect(tileOf(world)).toEqual(before);

    world.setResidents([hare('curious', false)]);
    expect(world.residents).toEqual([]);
  });
});

describe('NPCs', () => {
  it('look around while idle and turn to the player when talked to', () => {
    const { world, input, frames, interactions } = setup(['#####', '#SN.#', '#####'], []);
    const facings = new Set<string>();

    for (let i = 0; i < 40; i++) {
      frames.frames(30, 1000);
      facings.add(world.npcFacing('vera'));
    }
    expect(facings.size).toBeGreaterThan(1);
    expect(facings.has('up')).toBe(false);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'npc', mapId: 'test_map', npcId: 'vera' }]);
    expect(world.npcFacing('vera')).toBe('left');
  });
});

describe('Binoculars', () => {
  function sight(rows: readonly string[], tools: readonly string[]) {
    const interactions: Interaction[] = [];
    const world = new World(textMap(rows), (interaction) => interactions.push(interaction));
    world.setTools(tools);
    world.setResidents([
      { spotId: 'hare', speciesId: 'lepus_europaeus', torch: 'curious', present: true },
    ]);
    const input = new ActionState();
    input.press('Interact');
    world.update(input, STEP_MS);
    return interactions;
  }

  const HARE = { kind: 'spot', mapId: 'test_map', spotId: 'hare' };

  it.each([
    ['2 tiles', ['S.R']],
    ['3 tiles', ['S..R']],
  ])('reach an animal %s away over open ground', (_, rows) => {
    expect(sight(rows, ['binoculars'])).toEqual([HARE]);
  });

  it.each([
    ['without binoculars', ['S.R'], []],
    ['beyond 3 tiles', ['S...R'], ['binoculars']],
    ['behind something blocking', ['S#R'], ['binoculars']],
    ['behind the signpost', ['S.PR'], ['binoculars']],
  ])('do not reach an animal %s', (_, rows, tools) => {
    expect(sight(rows, tools)).toEqual([]);
  });
});
