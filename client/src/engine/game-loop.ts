import { Clock, FrameScheduler } from './platform';

/** Simulation step: 60 updates per simulated second. */
export const STEP_MS = 1000 / 60;
/** Most simulated time caught up after a long pause between frames. */
export const MAX_CATCH_UP_MS = 250;

// Absorbs floating-point drift so e.g. two 33.33… ms frames yield exactly four steps.
const EPSILON_MS = 1e-6;

export interface GameLoopCallbacks {
  /** Advances the simulation by exactly one fixed step. */
  update(stepMs: number): void;
  /** Draws the current state. `alpha` is the fraction of a step not yet simulated (0–1). */
  render(alpha: number): void;
}

/**
 * Fixed-timestep loop: the simulation advances in constant steps regardless of the display's
 * refresh rate, while rendering happens once per display frame.
 */
export class GameLoop {
  private handle: number | undefined;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;

  constructor(
    private readonly callbacks: GameLoopCallbacks,
    private readonly clock: Clock,
    private readonly scheduler: FrameScheduler,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.restartTiming();
  }

  stop(): void {
    this.running = false;
    this.cancelFrame();
  }

  /** Stops advancing without losing state; hidden time is never simulated. */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.cancelFrame();
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.restartTiming();
  }

  private restartTiming(): void {
    this.lastTime = this.clock.now();
    this.accumulator = 0;
    this.scheduleFrame();
  }

  private readonly frame = (): void => {
    this.handle = undefined;
    if (!this.running || this.paused) return;

    const now = this.clock.now();
    this.accumulator += Math.min(now - this.lastTime, MAX_CATCH_UP_MS);
    this.lastTime = now;

    while (this.accumulator + EPSILON_MS >= STEP_MS) {
      this.callbacks.update(STEP_MS);
      this.accumulator -= STEP_MS;
    }
    this.accumulator = Math.max(0, this.accumulator);

    this.callbacks.render(this.accumulator / STEP_MS);
    this.scheduleFrame();
  };

  private scheduleFrame(): void {
    this.handle = this.scheduler.request(this.frame);
  }

  private cancelFrame(): void {
    if (this.handle !== undefined) {
      this.scheduler.cancel(this.handle);
      this.handle = undefined;
    }
  }
}
