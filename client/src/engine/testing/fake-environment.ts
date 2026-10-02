import { Clock, FrameScheduler, GameEnvironment, Unsubscribe } from '../platform';

/** Manually advanced clock and frame scheduler for deterministic loop tests. */
export class FakeFrames implements Clock, FrameScheduler {
  private time = 0;
  private nextHandle = 1;
  private readonly pending = new Map<number, () => void>();

  now(): number {
    return this.time;
  }

  request(callback: () => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** Moves time forward without running frames (e.g. while a tab is hidden). */
  advance(ms: number): void {
    this.time += ms;
  }

  /** Moves time forward by `ms` and runs the frames that were scheduled. */
  frame(ms: number): void {
    this.time += ms;
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    callbacks.forEach((callback) => callback());
  }

  /** Runs `count` frames spread evenly over `durationMs`. */
  frames(count: number, durationMs: number): void {
    const start = this.time;
    for (let i = 1; i <= count; i++) {
      this.frame(start + (durationMs * i) / count - this.time);
    }
  }
}

/** In-memory {@link GameEnvironment} that records subscriptions and lets tests fire events. */
export class FakeEnvironment implements GameEnvironment {
  readonly frames = new FakeFrames();
  readonly clock = this.frames;
  readonly scheduler = this.frames;

  pixelRatio = 1;
  private readonly resizeListeners = new Set<(width: number, height: number) => void>();
  private readonly ratioListeners = new Set<() => void>();
  private readonly visibilityListeners = new Set<(hidden: boolean) => void>();

  devicePixelRatio(): number {
    return this.pixelRatio;
  }

  observeSize(
    _element: HTMLElement,
    onResize: (width: number, height: number) => void,
  ): Unsubscribe {
    return track(this.resizeListeners, onResize);
  }

  observeDevicePixelRatio(onChange: () => void): Unsubscribe {
    return track(this.ratioListeners, onChange);
  }

  observeVisibility(onChange: (hidden: boolean) => void): Unsubscribe {
    return track(this.visibilityListeners, onChange);
  }

  get listenerCount(): number {
    return this.resizeListeners.size + this.ratioListeners.size + this.visibilityListeners.size;
  }

  resize(width: number, height: number): void {
    this.resizeListeners.forEach((listener) => listener(width, height));
  }

  changePixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.ratioListeners.forEach((listener) => listener());
  }

  setHidden(hidden: boolean): void {
    this.visibilityListeners.forEach((listener) => listener(hidden));
  }
}

function track<T>(listeners: Set<T>, listener: T): Unsubscribe {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
