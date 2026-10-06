/** The size of the world view, in game pixels. */
export interface ViewSize {
  readonly width: number;
  readonly height: number;
  /** A flexible view gets shorter, down to this height, to fit the area's shape at its full width (`fitView`). */
  readonly minHeight?: number;
}

/** The world view on desktops and sideways screens: 16:9. */
export const WIDE_VIEW: ViewSize = { width: 320, height: 180 };
/**
 * The world view on tall upright touch screens: zoomed in, 180 wide and as tall as the space above the buttons allows,
 * from 180 to 240 (3:4), so it fills that space at the full width.
 */
export const TALL_VIEW: ViewSize = { width: 180, height: 240, minHeight: 180 };
/** The world view on short upright touch screens, where a 3:4 view would be squeezed: 4:3. */
export const COMPACT_VIEW: ViewSize = { width: 240, height: 180 };
/** The views an upright touch screen may use; the game shows the one that fits largest (`chooseView`), 4:3 on a tie. */
export const UPRIGHT_VIEWS: readonly ViewSize[] = [COMPACT_VIEW, TALL_VIEW];

/** Tolerance for floating-point scales that are whole numbers in exact arithmetic. */
const EPSILON = 1e-6;

/** Where and how large the canvas is drawn inside its container. */
export interface ViewportLayout {
  /** Physical pixels per game pixel in the backing store: always an integer, so game pixels are even. */
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
  /** The backing store is resampled smoothly to the displayed size, which lies between two integer scales. */
  readonly smooth: boolean;
}

/** A view for the available area: a flexible one takes the area's shape within its heights, others are as they are. */
export function fitView(
  view: ViewSize,
  availableCssWidth: number,
  availableCssHeight: number,
): ViewSize {
  if (view.minHeight === undefined || availableCssWidth <= 0 || availableCssHeight <= 0)
    return view;
  const height = Math.floor((view.width * availableCssHeight) / availableCssWidth);
  return { width: view.width, height: Math.min(view.height, Math.max(view.minHeight, height)) };
}

/**
 * The view, of several, whose game pixels are shown largest in the available area (each fitted to it, `fitView`); the
 * first of equals.
 */
export function chooseView(
  views: readonly ViewSize[],
  availableCssWidth: number,
  availableCssHeight: number,
): ViewSize {
  const shownScale = (view: ViewSize) =>
    Math.min(availableCssWidth / view.width, availableCssHeight / view.height);
  return views
    .map((view) => fitView(view, availableCssWidth, availableCssHeight))
    .reduce((best, view) => (shownScale(view) > shownScale(best) ? view : best));
}

/**
 * Fits the world view into the available area.
 *
 * Shows the largest size of the view's shape that fits, each side rounded down to whole physical pixels, centred
 * (letterboxing). The world is drawn with nearest-neighbour at the integer scale at or above that size, so every game
 * pixel is the same size, and only between two integer scales is the canvas resampled smoothly down to the shown size
 * ("sharp bilinear"): game pixels stay even and only their edges blend. If not even a 1× scale fits, it scales down to
 * stay visible.
 */
export function computeViewport(
  availableCssWidth: number,
  availableCssHeight: number,
  devicePixelRatio: number,
  view: ViewSize = WIDE_VIEW,
): ViewportLayout {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const width = Math.max(0, availableCssWidth);
  const height = Math.max(0, availableCssHeight);

  const physicalWidth = width * dpr;
  const physicalHeight = height * dpr;
  // Physical pixels per game pixel. Rounding each side down to whole pixels keeps the shape to within one pixel.
  const fitted = Math.min(physicalWidth / view.width, physicalHeight / view.height);

  if (fitted >= 1) {
    const shownWidth = Math.floor(view.width * fitted + EPSILON);
    const shownHeight = Math.floor(view.height * fitted + EPSILON);
    const scale = Math.ceil(fitted - EPSILON);
    return {
      scale,
      backingWidth: view.width * scale,
      backingHeight: view.height * scale,
      cssWidth: shownWidth / dpr,
      cssHeight: shownHeight / dpr,
      cssLeft: Math.floor((physicalWidth - shownWidth) / 2) / dpr,
      cssTop: Math.floor((physicalHeight - shownHeight) / 2) / dpr,
      smooth: shownWidth !== view.width * scale || shownHeight !== view.height * scale,
    };
  }

  const fit = Math.min(width / view.width, height / view.height);
  const cssWidth = view.width * fit;
  const cssHeight = view.height * fit;
  return {
    scale: 1,
    backingWidth: view.width,
    backingHeight: view.height,
    cssWidth,
    cssHeight,
    cssLeft: (width - cssWidth) / 2,
    cssTop: (height - cssHeight) / 2,
    smooth: false,
  };
}
