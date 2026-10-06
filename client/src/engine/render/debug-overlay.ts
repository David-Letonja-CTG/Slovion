import { TILE_SIZE, WorldMap } from '../world/world-map';

/** Colours of the debug view: one per habitat (by its ID), and fixed ones for the rest. */
const DEBUG_PALETTE = [
  '#3fbf5f',
  '#3f8fbf',
  '#bf9f3f',
  '#bf3f8f',
  '#7f3fbf',
  '#3fbfbf',
  '#bf5f3f',
  '#8fbf3f',
];
export const DEBUG_COLLISION = 'rgba(200, 30, 30, 0.35)';
export const DEBUG_WATER = 'rgba(40, 120, 255, 0.45)';
export const DEBUG_SPOT = '#ffd84a';
export const DEBUG_SPAWN = '#ffffff';

/** A stable colour for a habitat, so the same habitat looks the same on every map. */
export function debugColour(habitatId: string): string {
  let hash = 0;
  for (const char of habitatId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return DEBUG_PALETTE[Math.abs(hash) % DEBUG_PALETTE.length];
}

/**
 * The world's debug view (development only, docs/decisions.md D13): habitat zones tinted by habitat with their outline,
 * blocked tiles, wadeable and swimmable water, spots and the spawn, drawn over the visible part of the map.
 */
export function drawDebugOverlay(
  context: CanvasRenderingContext2D,
  map: WorldMap,
  camera: { readonly x: number; readonly y: number },
  view: { readonly width: number; readonly height: number },
): void {
  const firstX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const lastX = Math.min(map.width - 1, Math.floor((camera.x + view.width - 1) / TILE_SIZE));
  const firstY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const lastY = Math.min(map.height - 1, Math.floor((camera.y + view.height - 1) / TILE_SIZE));
  const at = (x: number, y: number) => ({
    x: x * TILE_SIZE - camera.x,
    y: y * TILE_SIZE - camera.y,
  });

  context.save();
  for (const zone of map.habitats) {
    const { x, y } = at(zone.minX, zone.minY);
    const width = (zone.maxX - zone.minX + 1) * TILE_SIZE;
    const height = (zone.maxY - zone.minY + 1) * TILE_SIZE;
    context.globalAlpha = 0.18;
    context.fillStyle = debugColour(zone.habitatId);
    context.fillRect(x, y, width, height);
    context.globalAlpha = 0.9;
    context.strokeStyle = debugColour(zone.habitatId);
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  context.globalAlpha = 1;
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const water = map.isWadeable(tx, ty) || map.isSwimmable(tx, ty);
      if (water || map.isBlocked(tx, ty)) {
        const { x, y } = at(tx, ty);
        context.fillStyle = water ? DEBUG_WATER : DEBUG_COLLISION;
        context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  context.fillStyle = DEBUG_SPOT;
  for (const spot of map.spots) {
    const { x, y } = at(spot.x, spot.y);
    context.fillRect(x + 5, y + 5, 6, 6);
  }

  const spawn = at(map.spawn.x, map.spawn.y);
  context.strokeStyle = DEBUG_SPAWN;
  context.strokeRect(spawn.x + 2.5, spawn.y + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  context.restore();
}
