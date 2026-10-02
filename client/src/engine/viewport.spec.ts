import { LOGICAL_HEIGHT, LOGICAL_WIDTH, computeViewport } from './viewport';

describe('computeViewport', () => {
  it('uses a fixed 320×180 logical resolution', () => {
    expect([LOGICAL_WIDTH, LOGICAL_HEIGHT]).toEqual([320, 180]);
  });

  it('fills an exact multiple completely (1280×720 @1 → 4×)', () => {
    const layout = computeViewport(1280, 720, 1);

    expect(layout).toEqual({
      scale: 4,
      backingWidth: 1280,
      backingHeight: 720,
      cssWidth: 1280,
      cssHeight: 720,
      cssLeft: 0,
      cssTop: 0,
    });
  });

  it('letterboxes a non-multiple area (1000×700 @1 → 3×, centred)', () => {
    const layout = computeViewport(1000, 700, 1);

    expect(layout.scale).toBe(3);
    expect([layout.cssWidth, layout.cssHeight]).toEqual([960, 540]);
    expect([layout.cssLeft, layout.cssTop]).toEqual([20, 80]);
  });

  it('shows the same logical content on a large window (1920×1080 @1 → 6×)', () => {
    const layout = computeViewport(1920, 1080, 1);

    expect(layout.scale).toBe(6);
    expect(layout.backingWidth / layout.scale).toBe(LOGICAL_WIDTH);
    expect(layout.backingHeight / layout.scale).toBe(LOGICAL_HEIGHT);
  });

  it('uses an integer scale in physical pixels on high-density displays (412×800 @2.625)', () => {
    const layout = computeViewport(412, 800, 2.625);

    expect(Number.isInteger(layout.scale)).toBe(true);
    expect(layout.scale).toBe(3);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([960, 540]);
    expect(layout.cssWidth).toBeLessThanOrEqual(412);
    // The left offset lands on a whole physical pixel, so the canvas is not blurred by sub-pixel placement.
    expect(layout.cssLeft * 2.625).toBeCloseTo(60, 9);
  });

  it('accounts for device pixel ratio 2 (1280×720 @2 → 8× physical)', () => {
    const layout = computeViewport(1280, 720, 2);

    expect(layout.scale).toBe(8);
    expect([layout.cssWidth, layout.cssHeight]).toEqual([1280, 720]);
  });

  it('scales down to stay visible in a tiny area (240×300 @1 → 240×135)', () => {
    const layout = computeViewport(240, 300, 1);

    expect([layout.cssWidth, layout.cssHeight]).toEqual([240, 135]);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([320, 180]);
    expect(layout.cssLeft).toBe(0);
    expect(layout.cssTop).toBe(82.5);
  });

  it('handles an empty area without producing invalid sizes', () => {
    const layout = computeViewport(0, 0, 1);

    expect([layout.cssWidth, layout.cssHeight]).toEqual([0, 0]);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([320, 180]);
  });
});
