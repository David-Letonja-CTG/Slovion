import { GameLoop, STEP_MS } from './game-loop';
import { FakeFrames } from './testing/fake-environment';

function createLoop() {
  const frames = new FakeFrames();
  const counts = { updates: 0, renders: 0 };
  const loop = new GameLoop(
    { update: () => counts.updates++, render: () => counts.renders++ },
    frames,
    frames,
  );
  return { frames, counts, loop };
}

describe('GameLoop', () => {
  it('advances exactly 60 steps per second at 30 fps', () => {
    const { frames, counts, loop } = createLoop();
    loop.start();

    frames.frames(30, 1000);

    expect(counts.updates).toBe(60);
    expect(counts.renders).toBe(30);
  });

  it('advances exactly 60 steps per second at 144 fps', () => {
    const { frames, counts, loop } = createLoop();
    loop.start();

    frames.frames(144, 1000);

    expect(counts.updates).toBe(60);
    expect(counts.renders).toBe(144);
  });

  it('passes the fixed step duration to update', () => {
    const frames = new FakeFrames();
    const steps: number[] = [];
    const loop = new GameLoop(
      { update: (ms) => steps.push(ms), render: () => undefined },
      frames,
      frames,
    );
    loop.start();

    frames.frame(STEP_MS * 2);

    expect(steps).toEqual([STEP_MS, STEP_MS]);
  });

  it('catches up at most 250 ms after a long stall', () => {
    const { frames, counts, loop } = createLoop();
    loop.start();

    frames.frame(2000);

    expect(counts.updates).toBe(15);
  });

  it('does not simulate time while paused (page hidden)', () => {
    const { frames, counts, loop } = createLoop();
    loop.start();
    frames.frames(6, 100);
    const before = counts.updates;

    loop.pause();
    frames.advance(10_000);
    loop.resume();
    frames.frame(STEP_MS);

    expect(before).toBe(6);
    expect(counts.updates).toBe(before + 1);
  });

  it('schedules no frames while paused', () => {
    const { frames, loop } = createLoop();
    loop.start();

    loop.pause();

    expect(frames.pendingCount).toBe(0);
  });

  it('stops scheduling frames after stop', () => {
    const { frames, counts, loop } = createLoop();
    loop.start();
    frames.frame(STEP_MS);

    loop.stop();
    frames.frame(1000);

    expect(frames.pendingCount).toBe(0);
    expect(counts.updates).toBe(1);
  });
});
