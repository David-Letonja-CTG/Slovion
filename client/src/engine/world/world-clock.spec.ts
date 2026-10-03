import { GameLoop, STEP_MS } from '../game-loop';
import { ActionState } from '../input/action-state';
import { FakeFrames } from '../testing/fake-environment';
import { textMap } from './testing';
import { World, WorldClock } from './world';
import { Season, TimeOfDay } from './world-time';

function setup(clock?: WorldClock) {
  const changes: [Season, TimeOfDay][] = [];
  const world = new World(
    textMap(['#S.#']),
    () => undefined,
    () => undefined,
    clock,
    (season, timeOfDay) => changes.push([season, timeOfDay]),
  );
  const input = new ActionState();
  const frames = new FakeFrames();
  new GameLoop(
    { update: (ms) => world.update(input, ms), render: () => undefined },
    frames,
    frames,
  ).start();
  return { world, frames, changes };
}

describe('World clock', () => {
  it('stands still at noon without a server clock', () => {
    const { world, frames, changes } = setup();

    frames.frames(60, 5000);

    expect(world.time).toMatchObject({ minuteOfDay: 720, timeOfDay: 'day' });
    expect(changes).toEqual([]);
  });

  it('advances one in-game minute per real second and reports nightfall once', () => {
    const { world, frames, changes } = setup({ minutes: 21 * 60 + 58, gameMinutesPerSecond: 1 });

    frames.frames(60, 1000);
    expect(world.time.timeOfDay).toBe('evening');
    frames.frames(60, 1500);

    expect(world.time).toMatchObject({ minuteOfDay: 22 * 60, timeOfDay: 'night' });
    expect(changes).toEqual([['spring', 'night']]);
  });

  it('reports a new season and time of day after a re-sync', () => {
    const { world, frames, changes } = setup({ minutes: 480, gameMinutesPerSecond: 1 });

    world.setWorldTime(4320 + 480); // day 4, 08:00
    frames.frame(STEP_MS);

    expect(world.time).toMatchObject({ day: 4, season: 'summer', timeOfDay: 'morning' });
    expect(changes).toEqual([['summer', 'morning']]);
  });
});
