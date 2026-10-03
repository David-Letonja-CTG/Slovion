import { GameLoop, STEP_MS } from '../game-loop';
import { ActionState } from '../input/action-state';
import { FakeFrames } from '../testing/fake-environment';
import { textMap } from './testing';
import { World, WorldClock } from './world';
import { WorldTime } from './world-time';

function setup(
  clock?: WorldClock,
  rows: readonly string[] = ['#S..#'],
  areaOf?: (x: number, y: number) => string | undefined,
) {
  const times: WorldTime[] = [];
  const areas: string[] = [];
  const torches: boolean[] = [];
  const world = new World(
    textMap(rows, 'right', areaOf),
    () => undefined,
    () => undefined,
    clock,
    {
      onTimeChange: (time) => times.push(time),
      onAreaChange: (area) => areas.push(area),
      onTorchChange: (on) => torches.push(on),
    },
  );
  const input = new ActionState();
  const frames = new FakeFrames();
  new GameLoop(
    { update: (ms) => world.update(input, ms), render: () => undefined },
    frames,
    frames,
  ).start();
  return { world, input, frames, times, areas, torches };
}

describe('World clock', () => {
  it('stands still at noon without a server clock', () => {
    const { world, frames, times } = setup();

    frames.frames(60, 5000);

    expect(world.time).toMatchObject({ minuteOfDay: 720, timeOfDay: 'day' });
    expect(times).toEqual([]);
  });

  it('advances one in-game minute per real second and reports every minute', () => {
    const { world, frames, times } = setup({ minutes: 21 * 60 + 58, gameMinutesPerSecond: 1 });

    frames.frames(60, 2500);

    expect(world.time).toMatchObject({ minuteOfDay: 22 * 60, timeOfDay: 'night' });
    expect(times.map((time) => [time.minuteOfDay, time.timeOfDay])).toEqual([
      [21 * 60 + 59, 'evening'],
      [22 * 60, 'night'],
    ]);
  });

  it('reports the new time after a re-sync', () => {
    const { world, frames, times } = setup({ minutes: 480, gameMinutesPerSecond: 1 });

    world.setWorldTime(4320 + 480); // day 4, 08:00
    frames.frame(STEP_MS);

    expect(world.time).toMatchObject({ day: 4, season: 'summer', timeOfDay: 'morning' });
    expect(times.at(0)).toMatchObject({ day: 4, season: 'summer' });
  });
});

describe('World areas', () => {
  // Tiles x 0–2 are the meadow, x 3+ the hedgerow.
  const areaOf = (x: number) => (x < 3 ? 'meadow' : 'south_hedgerow');

  it('reports the starting area on the first update', () => {
    const { frames, areas } = setup(undefined, ['#S...#'], areaOf);

    frames.frame(STEP_MS);

    expect(areas).toEqual(['meadow']);
  });

  it('reports each crossing into another area once', () => {
    const { input, frames, areas } = setup(undefined, ['#S...#'], areaOf);
    input.press('MoveRight');

    frames.frames(60, 1000); // walks to the end: x 1 → 4

    expect(areas).toEqual(['meadow', 'south_hedgerow']);
  });

  it('reports nothing for tiles without an area', () => {
    const { frames, areas } = setup(undefined, ['#S..#']);

    frames.frame(STEP_MS);

    expect(areas).toEqual([]);
  });
});

describe('Torch', () => {
  it('starts off and toggles with the Torch action', () => {
    const { world, input, frames, torches } = setup();
    expect(world.torchOn).toBe(false);

    input.press('Torch');
    frames.frame(STEP_MS);
    input.release('Torch');
    input.press('Torch');
    frames.frame(STEP_MS);

    expect(torches).toEqual([true, false]);
    expect(world.torchOn).toBe(false);
  });

  it('can be switched by the host and reports only real changes', () => {
    const { world, torches } = setup();

    world.setTorch(true);
    world.setTorch(true);

    expect(world.torchOn).toBe(true);
    expect(torches).toEqual([true]);
  });
});
