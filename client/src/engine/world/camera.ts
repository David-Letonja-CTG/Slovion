export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Top-left of the view in map pixels (whole pixels, for crisp drawing). The camera centres the
 * focus point but never shows anything beyond the map; along a dimension where the map is smaller
 * than the view, the map is centred instead (the offset is then negative).
 */
export function cameraOffset(focus: Point, map: Size, view: Size): Point {
  return {
    x: axisOffset(focus.x, map.width, view.width),
    y: axisOffset(focus.y, map.height, view.height),
  };
}

function axisOffset(focus: number, mapSize: number, viewSize: number): number {
  if (mapSize <= viewSize) {
    return -Math.floor((viewSize - mapSize) / 2);
  }
  return Math.round(Math.min(Math.max(focus - viewSize / 2, 0), mapSize - viewSize));
}
