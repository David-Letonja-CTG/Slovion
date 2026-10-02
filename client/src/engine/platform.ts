/** Monotonic time source in milliseconds. */
export interface Clock {
  now(): number;
}

/** Schedules work for the next display frame. */
export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** Releases a subscription. */
export type Unsubscribe = () => void;

/**
 * Everything the engine needs from its host platform. Injected so the engine stays deterministic
 * and testable without a browser.
 */
export interface GameEnvironment {
  readonly clock: Clock;
  readonly scheduler: FrameScheduler;
  devicePixelRatio(): number;
  observeSize(
    element: HTMLElement,
    onResize: (cssWidth: number, cssHeight: number) => void,
  ): Unsubscribe;
  observeDevicePixelRatio(onChange: () => void): Unsubscribe;
  observeVisibility(onChange: (hidden: boolean) => void): Unsubscribe;
}

/** The real browser implementation of {@link GameEnvironment}. */
export function browserEnvironment(window: Window): GameEnvironment {
  const document = window.document;

  return {
    clock: { now: () => window.performance.now() },
    scheduler: {
      request: (callback) => window.requestAnimationFrame(() => callback()),
      cancel: (handle) => window.cancelAnimationFrame(handle),
    },
    devicePixelRatio: () => window.devicePixelRatio || 1,

    observeSize(element, onResize) {
      const observer = new ResizeObserver(([entry]) => {
        if (entry) onResize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(element);
      return () => observer.disconnect();
    },

    observeDevicePixelRatio(onChange) {
      // A resolution media query only matches one ratio, so re-arm it after every change.
      let query: MediaQueryList | undefined;
      const listener = () => {
        arm();
        onChange();
      };
      const arm = () => {
        query?.removeEventListener('change', listener);
        query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        query.addEventListener('change', listener);
      };
      arm();
      return () => query?.removeEventListener('change', listener);
    },

    observeVisibility(onChange) {
      const listener = () => onChange(document.visibilityState === 'hidden');
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}
