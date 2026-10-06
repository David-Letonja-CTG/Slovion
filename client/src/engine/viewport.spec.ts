import {
  COMPACT_VIEW,
  TALL_VIEW,
  UPRIGHT_VIEWS,
  WIDE_VIEW,
  chooseView,
  computeViewport,
} from './viewport';

describe('computeViewport', () => {
  it('has a 320×180 (16:9) view, and for upright touch screens 240×180 (4:3) or a flexible 180×180–240', () => {
    expect(WIDE_VIEW).toEqual({ width: 320, height: 180 });
    expect(UPRIGHT_VIEWS).toEqual([COMPACT_VIEW, TALL_VIEW]);
    expect(TALL_VIEW).toEqual({ width: 180, height: 240, minHeight: 180 });
    expect(COMPACT_VIEW).toEqual({ width: 240, height: 180 });
  });

  it('fills a tall phone above its buttons with the 3:4 view (390×528 @3)', () => {
    const layout = computeViewport(390, 528, 3, TALL_VIEW);

    expect([layout.cssWidth * 3, layout.cssHeight * 3]).toEqual([1170, 1560]);
    expect(layout.scale).toBe(7);
  });

  it('chooses the upright view whose pixels are shown largest', () => {
    // A tall phone: the tall view at full width, 3:4 (2.17 CSS px per game pixel), beats 4:3 (1.62).
    expect(chooseView(UPRIGHT_VIEWS, 390, 528)).toEqual({ width: 180, height: 240 });
    // Less height (a browser's address bar): the tall view gets shorter, still at the full width.
    expect(chooseView(UPRIGHT_VIEWS, 412, 521)).toEqual({ width: 180, height: 227 });
    // Wider than square: 4:3 is as large, and wins the tie.
    expect(chooseView(UPRIGHT_VIEWS, 375, 250)).toBe(COMPACT_VIEW);
    expect(chooseView([WIDE_VIEW], 375, 351)).toBe(WIDE_VIEW);
  });

  it('fills an exact multiple completely, unresampled (1280×720 @1 → 4×)', () => {
    const layout = computeViewport(1280, 720, 1);

    expect(layout).toEqual({
      scale: 4,
      backingWidth: 1280,
      backingHeight: 720,
      cssWidth: 1280,
      cssHeight: 720,
      cssLeft: 0,
      cssTop: 0,
      smooth: false,
    });
  });

  it('fills a non-multiple area as far as 16:9 allows, drawn at the scale above (1000×700 @1)', () => {
    const layout = computeViewport(1000, 700, 1);

    expect([layout.cssWidth, layout.cssHeight]).toEqual([1000, 562]);
    expect([layout.cssLeft, layout.cssTop]).toEqual([0, 69]);
    expect(layout.scale).toBe(4);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([1280, 720]);
    expect(layout.smooth).toBe(true);
  });

  it('never stretches: the shown size has the view’s shape, to within a pixel', () => {
    for (const view of [WIDE_VIEW, TALL_VIEW, COMPACT_VIEW]) {
      for (const [width, height, dpr] of [
        [1366, 768, 1],
        [390, 844, 3],
        [844, 390, 3],
        [1000, 1000, 1.25],
      ]) {
        const layout = computeViewport(width, height, dpr, view);

        expect(
          Math.abs((layout.cssWidth * dpr) / view.width - (layout.cssHeight * dpr) / view.height),
        ).toBeLessThan(1 / Math.min(view.width, view.height));
        expect(layout.cssWidth).toBeLessThanOrEqual(width);
        expect(layout.cssHeight).toBeLessThanOrEqual(height);
      }
    }
  });

  it('shows the same logical content on a full-HD window (1920×1080 @1 → 6×, filled)', () => {
    const layout = computeViewport(1920, 1080, 1);

    expect(layout.scale).toBe(6);
    expect([layout.cssWidth, layout.cssHeight]).toEqual([1920, 1080]);
    expect(layout.smooth).toBe(false);
    expect(layout.backingWidth / layout.scale).toBe(320);
    expect(layout.backingHeight / layout.scale).toBe(180);
  });

  it('fills the width of an upright phone (390×844 @3)', () => {
    const layout = computeViewport(390, 844, 3);

    expect(layout.cssWidth * 3).toBe(1170);
    expect(layout.cssHeight * 3).toBe(658);
    expect(layout.scale).toBe(4);
    expect(layout.smooth).toBe(true);
  });

  it('uses whole physical pixels on high-density displays (412×800 @2.625)', () => {
    const layout = computeViewport(412, 800, 2.625);

    expect(layout.scale).toBe(4);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([1280, 720]);
    expect(layout.cssWidth * 2.625).toBeCloseTo(1081, 9);
    expect(layout.cssHeight * 2.625).toBeCloseTo(608, 9);
    expect(layout.cssWidth).toBeLessThanOrEqual(412);
    // The left offset lands on a whole physical pixel, so the canvas is not blurred by sub-pixel placement.
    expect(layout.cssLeft * 2.625).toBeCloseTo(0, 9);
  });

  it('fills an upright phone with the 4:3 view, drawn at the scale above (390×292 @3)', () => {
    const layout = computeViewport(390, 292, 3, COMPACT_VIEW);

    expect([layout.cssWidth * 3, layout.cssHeight * 3]).toEqual([1168, 876]);
    expect(layout.scale).toBe(5);
    expect([layout.backingWidth, layout.backingHeight]).toEqual([1200, 900]);
    expect(layout.smooth).toBe(true);
  });

  it('shows the 4:3 view unresampled at an exact multiple (960×720 @1 → 4×)', () => {
    const layout = computeViewport(960, 720, 1, COMPACT_VIEW);

    expect(layout).toMatchObject({ scale: 4, cssWidth: 960, cssHeight: 720, smooth: false });
  });

  it('letterboxes the 4:3 view at the sides of a wide area (1280×720 @1)', () => {
    const layout = computeViewport(1280, 720, 1, COMPACT_VIEW);

    expect([layout.cssWidth, layout.cssHeight]).toEqual([960, 720]);
    expect([layout.cssLeft, layout.cssTop]).toEqual([160, 0]);
  });

  it('accounts for device pixel ratio 2 (1280×720 @2 → 8× physical)', () => {
    const layout = computeViewport(1280, 720, 2);

    expect(layout.scale).toBe(8);
    expect([layout.cssWidth, layout.cssHeight]).toEqual([1280, 720]);
    expect(layout.smooth).toBe(false);
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
