/** Logical resolution of the game world, in game pixels. */
export const LOGICAL_WIDTH = 320;
export const LOGICAL_HEIGHT = 180;

/** Where and how large the canvas is drawn inside its container. */
export interface ViewportLayout {
  /** Physical device pixels per logical pixel. An integer unless the container is too small. */
  readonly scale: number;
  /** Canvas backing-store size in physical pixels. */
  readonly backingWidth: number;
  readonly backingHeight: number;
  /** Displayed canvas size in CSS pixels. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Offset of the canvas inside the container in CSS pixels, aligned to whole physical pixels. */
  readonly cssLeft: number;
  readonly cssTop: number;
}

/**
 * Fits the logical resolution into the available area.
 *
 * Uses the largest integer scale in physical pixels so pixel art stays crisp, and centres the
 * result (letterboxing). If not even a 1× scale fits, it scales down fractionally to stay visible.
 */
export function computeViewport(
  availableCssWidth: number,
  availableCssHeight: number,
  devicePixelRatio: number,
): ViewportLayout {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const width = Math.max(0, availableCssWidth);
  const height = Math.max(0, availableCssHeight);

  const physicalWidth = width * dpr;
  const physicalHeight = height * dpr;
  const integerScale = Math.floor(
    Math.min(physicalWidth / LOGICAL_WIDTH, physicalHeight / LOGICAL_HEIGHT),
  );

  if (integerScale >= 1) {
    const backingWidth = LOGICAL_WIDTH * integerScale;
    const backingHeight = LOGICAL_HEIGHT * integerScale;
    return {
      scale: integerScale,
      backingWidth,
      backingHeight,
      cssWidth: backingWidth / dpr,
      cssHeight: backingHeight / dpr,
      cssLeft: Math.floor((physicalWidth - backingWidth) / 2) / dpr,
      cssTop: Math.floor((physicalHeight - backingHeight) / 2) / dpr,
    };
  }

  const fit = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const cssWidth = LOGICAL_WIDTH * fit;
  const cssHeight = LOGICAL_HEIGHT * fit;
  return {
    scale: fit * dpr,
    backingWidth: LOGICAL_WIDTH,
    backingHeight: LOGICAL_HEIGHT,
    cssWidth,
    cssHeight,
    cssLeft: (width - cssWidth) / 2,
    cssTop: (height - cssHeight) / 2,
  };
}
