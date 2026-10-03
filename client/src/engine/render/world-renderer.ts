import { Direction } from '../input/actions';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../viewport';
import { cameraOffset } from '../world/camera';
import { World } from '../world/world';
import { TILE_SIZE } from '../world/world-map';
import { TimeOfDay } from '../world/world-time';

/** Images the world needs. Loaded by the host; the engine never fetches (design §6). */
export interface WorldImages {
  readonly tileset: CanvasImageSource;
  /** 16×16 frames: columns are walk frames, rows are facing down, up, left, right. */
  readonly playerSprite: CanvasImageSource;
}

const BACKDROP = '#11161c';
const PLAYER_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/** The torch's light: fully clear within 2 tiles of the player, fading to the tint at 3.5 tiles. */
export const TORCH_INNER_RADIUS = 2 * TILE_SIZE;
export const TORCH_OUTER_RADIUS = 3.5 * TILE_SIZE;

/** A tint over the whole view by time of day; none by day. */
export const TIME_TINT: Record<TimeOfDay, string | undefined> = {
  morning: 'rgba(255, 196, 140, 0.10)',
  day: undefined,
  evening: 'rgba(255, 128, 48, 0.20)',
  night: 'rgba(10, 14, 40, 0.68)',
};

/**
 * Draws the visible part of the map in authored layer order, then closed gates and NPCs, then the player, then
 * the time-of-day tint over everything.
 */
export function renderWorld(
  context: CanvasRenderingContext2D,
  world: World,
  images: WorldImages,
): void {
  const { map, player } = world;
  const position = player.position;
  // Whole pixels everywhere, so scaled pixel art stays crisp.
  const playerX = Math.round(position.x * TILE_SIZE);
  const playerY = Math.round(position.y * TILE_SIZE);
  const camera = cameraOffset(
    { x: playerX + TILE_SIZE / 2, y: playerY + TILE_SIZE / 2 },
    { width: map.width * TILE_SIZE, height: map.height * TILE_SIZE },
    { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
  );

  context.fillStyle = BACKDROP;
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const firstX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const lastX = Math.min(map.width - 1, Math.floor((camera.x + LOGICAL_WIDTH - 1) / TILE_SIZE));
  const firstY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const lastY = Math.min(map.height - 1, Math.floor((camera.y + LOGICAL_HEIGHT - 1) / TILE_SIZE));
  const { firstGid, columns, tileCount } = map.tileset;

  for (const layer of map.layers) {
    for (let y = firstY; y <= lastY; y++) {
      for (let x = firstX; x <= lastX; x++) {
        const index = layer.tiles[y * map.width + x] - firstGid;
        if (index < 0 || index >= tileCount) continue; // 0 = empty
        context.drawImage(
          images.tileset,
          (index % columns) * TILE_SIZE,
          Math.floor(index / columns) * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          x * TILE_SIZE - camera.x,
          y * TILE_SIZE - camera.y,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }
  }

  const drawTile = (gid: number, x: number, y: number): void => {
    const index = gid - firstGid;
    if (index < 0 || index >= tileCount) return;
    context.drawImage(
      images.tileset,
      (index % columns) * TILE_SIZE,
      Math.floor(index / columns) * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      x * TILE_SIZE - camera.x,
      y * TILE_SIZE - camera.y,
      TILE_SIZE,
      TILE_SIZE,
    );
  };
  for (const gate of world.closedGates) drawTile(gate.gid, gate.x, gate.y);
  for (const npc of map.npcs) drawTile(npc.gid, npc.x, npc.y);

  context.drawImage(
    images.playerSprite,
    (player.isStepping ? player.walkFrame : 0) * TILE_SIZE,
    PLAYER_ROW[player.facing] * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    playerX - camera.x,
    playerY - camera.y,
    TILE_SIZE,
    TILE_SIZE,
  );

  const timeOfDay = world.time.timeOfDay;
  const tint = TIME_TINT[timeOfDay];
  if (!tint) return;
  if (world.torchOn && (timeOfDay === 'evening' || timeOfDay === 'night')) {
    // The torch clears the tint in a soft circle around the player; the gradient pads with the tint.
    const centreX = playerX - camera.x + TILE_SIZE / 2;
    const centreY = playerY - camera.y + TILE_SIZE / 2;
    const light = context.createRadialGradient(
      centreX,
      centreY,
      TORCH_INNER_RADIUS,
      centreX,
      centreY,
      TORCH_OUTER_RADIUS,
    );
    light.addColorStop(0, 'rgba(0, 0, 0, 0)');
    light.addColorStop(1, tint);
    context.fillStyle = light;
  } else {
    context.fillStyle = tint;
  }
  context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}
