import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Fullscreen } from './fullscreen';
import { PORTRAIT } from './portrait';
import { TOUCH_DEVICE } from './touch-device';

/** jsdom has no PointerEvent: a mouse event with the pointer's type. */
function pointerDown(pointerType: string): void {
  const event = new MouseEvent('pointerdown', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  document.body.dispatchEvent(event);
}

describe('TOUCH_DEVICE', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is true where the main pointer is coarse', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));

    expect(TestBed.inject(TOUCH_DEVICE)()).toBe(true);
  });

  it('becomes true with the first touch on a device with a mouse, not with a click', () => {
    const touch = TestBed.inject(TOUCH_DEVICE);
    expect(touch()).toBe(false);

    pointerDown('mouse');
    expect(touch()).toBe(false);

    pointerDown('touch');
    expect(touch()).toBe(true);
  });
});

describe('PORTRAIT', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the orientation media query as the device is turned', () => {
    const listeners: ((event: { matches: boolean }) => void)[] = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(orientation: portrait)',
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
    }));
    const portrait = TestBed.inject(PORTRAIT);
    expect(portrait()).toBe(true);

    listeners.forEach((listener) => listener({ matches: false }));

    expect(portrait()).toBe(false);
  });
});

describe('Fullscreen', () => {
  const restore: (() => void)[] = [];

  /** Gives jsdom a Fullscreen API: enabled, with request and exit that fire `fullscreenchange`. */
  function fakeFullscreenApi() {
    const document = TestBed.inject(DOCUMENT);
    let element: Element | null = null;
    const define = (target: object, key: string, value: unknown) => {
      Object.defineProperty(target, key, { configurable: true, value });
      restore.push(() => delete (target as Record<string, unknown>)[key]);
    };
    const change = (next: Element | null) => {
      element = next;
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    const request = vi.fn(() => {
      change(document.documentElement);
      return Promise.resolve();
    });
    const exit = vi.fn(() => {
      change(null);
      return Promise.resolve();
    });
    define(document, 'fullscreenEnabled', true);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => element,
    });
    restore.push(
      () => delete (document as unknown as Record<string, unknown>)['fullscreenElement'],
    );
    define(document, 'exitFullscreen', exit);
    define(document.documentElement, 'requestFullscreen', request);
    return { request, exit, change };
  }

  afterEach(() => restore.splice(0).forEach((undo) => undo()));

  it('is unavailable where the browser has no fullscreen, and then does nothing', () => {
    const fullscreen = TestBed.inject(Fullscreen);

    expect(fullscreen.available).toBe(false);
    expect(() => fullscreen.toggle()).not.toThrow();
    expect(fullscreen.active()).toBe(false);
  });

  it('switches the whole page to fullscreen and back', () => {
    const api = fakeFullscreenApi();
    const fullscreen = TestBed.inject(Fullscreen);
    expect(fullscreen.available).toBe(true);

    fullscreen.toggle();
    expect(api.request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(fullscreen.active()).toBe(true);

    fullscreen.toggle();
    expect(api.exit).toHaveBeenCalled();
    expect(fullscreen.active()).toBe(false);
  });

  it('notices when the browser leaves fullscreen by itself, e.g. with Esc', () => {
    const api = fakeFullscreenApi();
    const fullscreen = TestBed.inject(Fullscreen);
    fullscreen.toggle();

    api.change(null);

    expect(fullscreen.active()).toBe(false);
  });

  it('stays as it is when the browser refuses', async () => {
    const api = fakeFullscreenApi();
    api.request.mockImplementation(() => Promise.reject(new TypeError('no gesture')));
    const fullscreen = TestBed.inject(Fullscreen);

    fullscreen.toggle();
    await Promise.resolve();

    expect(fullscreen.active()).toBe(false);
  });
});
