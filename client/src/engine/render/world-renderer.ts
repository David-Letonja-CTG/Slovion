import { Direction } from '../input/actions';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../viewport';
import { cameraOffset } from '../world/camera';
import { World } from '../world/world';
import { TILE_SIZE } from '../world/world-map';

/** Images the world needs. Loaded by the host; the engine never fetches (design §6). */
export interface WorldImages {
  readonly tileset: CanvasImageSource;
  /** 16×16 frames: columns are walk frames, rows are facing down, up, left, right. */
  readonly playerSprite: CanvasImageSource;
}

const BACKDROP = '#11161c';
const PLAYER_ROW: Record<Direction, number> = { down: 0, up: 1, left: 2, right: 3 };

/** Draws the visible part of the map in authored layer order, then the player on top. */
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
}
