import { Direction } from '../input/actions';
import { ViewSize, WIDE_VIEW } from '../viewport';
import { drawWeather } from './weather';
import { cameraOffset } from '../world/camera';
import { World } from '../world/world';
import { TILE_SIZE, animatedTile } from '../world/world-map';
import { TimeOfDay } from '../world/world-time';

/** Images the world needs. Loaded by the host; the engine never fetches (design §6). */
export interface WorldImages {
  readonly tileset: CanvasImageSource;
  /** 16×16 frames: columns are walk frames, rows are facing down, up, left, right. */
  readonly playerSprite: CanvasImageSource;
  /** NPC sheets by NPC ID, in the player sprite's layout; NPCs without one are drawn as their map tile. */
  readonly npcSprites?: Readonly<Record<string, CanvasImageSource>>;
  /** Animal walk sprites by species ID: two 16×16 frames facing right. */
  readonly wildlifeSprites?: Readonly<Record<string, CanvasImageSource>>;
  /** The 8×8 lamp the player holds while the torch is on. */
  readonly lampSprite?: CanvasImageSource;
}

/** Where the lamp hangs relative to the player's tile, by facing. */
const LAMP_OFFSET: Record<Direction, { readonly x: number; readonly y: number }> = {
  down: { x: 11, y: 7 },
  up: { x: -2, y: 7 },
  left: { x: -3, y: 6 },
  right: { x: 11, y: 6 },
};

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

/** Underground (a cave) it is darker than night, at any time of day. */
export const CAVE_TINT = 'rgba(4, 6, 12, 0.86)';

/**
 * Supplies the offscreen layer the tint is drawn into when circles of light are cut out of it: a 2D context
 * whose transform maps logical pixels onto its canvas like the main context's. Injected so tests can record it.
 */
export type DarknessLayerFactory = () => CanvasRenderingContext2D;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Draws the visible part of the map in authored layer order, then closed gates, signposts, stations, lamp posts and NPCs, then
 * the player, then the time-of-day tint over everything, with circles of light around the lit torch and lamps.
 */
export function renderWorld(
  context: CanvasRenderingContext2D,
  world: World,
  images: WorldImages,
  darknessLayer: DarknessLayerFactory,
  view: ViewSize = WIDE_VIEW,
): void {
  const { map, player } = world;
  const position = player.position;
  // Whole pixels everywhere, so scaled pixel art stays crisp.
  const playerX = Math.round(position.x * TILE_SIZE);
  const playerY = Math.round(position.y * TILE_SIZE);
  const camera = cameraOffset(
    { x: playerX + TILE_SIZE / 2, y: playerY + TILE_SIZE / 2 },
    { width: map.width * TILE_SIZE, height: map.height * TILE_SIZE },
    { width: view.width, height: view.height },
  );

  context.fillStyle = BACKDROP;
  context.fillRect(0, 0, view.width, view.height);

  const firstX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const lastX = Math.min(map.width - 1, Math.floor((camera.x + view.width - 1) / TILE_SIZE));
  const firstY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const lastY = Math.min(map.height - 1, Math.floor((camera.y + view.height - 1) / TILE_SIZE));
  const { firstGid, columns, tileCount } = map.tileset;

  for (const layer of map.layers) {
    for (let y = firstY; y <= lastY; y++) {
      for (let x = firstX; x <= lastX; x++) {
        const stored = layer.tiles[y * map.width + x] - firstGid;
        if (stored < 0 || stored >= tileCount) continue; // 0 = empty
        const index = animatedTile(map.tileset, stored, world.elapsedMs);
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
  for (const signpost of map.signposts) drawTile(signpost.gid, signpost.x, signpost.y);
  for (const station of map.stations) drawTile(station.gid, station.x, station.y);
  for (const lamp of map.lamps) drawTile(lamp.gid, lamp.x, lamp.y);
  for (const npc of map.npcs) {
    const sheet = images.npcSprites?.[npc.npcId];
    if (!sheet) {
      drawTile(npc.gid, npc.x, npc.y);
      continue;
    }
    context.drawImage(
      sheet,
      0,
      PLAYER_ROW[world.npcFacing(npc.npcId)] * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      npc.x * TILE_SIZE - camera.x,
      npc.y * TILE_SIZE - camera.y,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
  for (const resident of world.residents) {
    const sprite = images.wildlifeSprites?.[resident.speciesId];
    if (!sprite) continue;
    const at = resident.position;
    const dx = Math.round(at.x * TILE_SIZE) - camera.x;
    const dy = Math.round(at.y * TILE_SIZE) - camera.y;
    const sx = resident.walkFrame * TILE_SIZE;
    if (resident.facingLeft) {
      // Sprites face right; mirror them for left.
      context.save();
      context.translate(dx + TILE_SIZE, dy);
      context.scale(-1, 1);
      context.drawImage(sprite, sx, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      context.restore();
    } else {
      context.drawImage(sprite, sx, 0, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
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

  if (world.torchOn && images.lampSprite) {
    const offset = LAMP_OFFSET[player.facing];
    context.drawImage(
      images.lampSprite,
      0,
      0,
      8,
      8,
      playerX - camera.x + offset.x,
      playerY - camera.y + offset.y,
      8,
      8,
    );
  }

  const underground = world.isUnderground;
  const tint = underground ? CAVE_TINT : TIME_TINT[world.time.timeOfDay];
  if (tint) {
    const lights: Point[] = [];
    if (world.torchOn && world.isDark) {
      lights.push({ x: playerX - camera.x + TILE_SIZE / 2, y: playerY - camera.y + TILE_SIZE / 2 });
    }
    if (world.lampsLit) {
      for (const lamp of map.lamps) {
        const light = {
          x: lamp.x * TILE_SIZE - camera.x + TILE_SIZE / 2,
          y: lamp.y * TILE_SIZE - camera.y + TILE_SIZE / 2,
        };
        if (inView(light, TORCH_OUTER_RADIUS, view)) lights.push(light);
      }
    }
    drawTint(context, tint, lights, darknessLayer, view);
  }
  // No weather falls underground.
  if (!underground) drawWeather(context, world.weather, world.elapsedMs, world.reducedMotion, view);
}

/** Whether a circle of `radius` around `point` reaches into the view. */
function inView(point: Point, radius: number, view: ViewSize): boolean {
  return (
    point.x + radius > 0 &&
    point.y + radius > 0 &&
    point.x - radius < view.width &&
    point.y - radius < view.height
  );
}

/**
 * The tint over the view. Without lights it is filled directly; otherwise it is filled into the darkness layer, a soft
 * circle is cut out of it around each light, and the layer is drawn over the view.
 */
function drawTint(
  context: CanvasRenderingContext2D,
  tint: string,
  lights: readonly Point[],
  darknessLayer: DarknessLayerFactory,
  view: ViewSize,
): void {
  if (lights.length === 0) {
    context.fillStyle = tint;
    context.fillRect(0, 0, view.width, view.height);
    return;
  }

  const layer = darknessLayer();
  layer.globalCompositeOperation = 'source-over';
  layer.clearRect(0, 0, view.width, view.height);
  layer.fillStyle = tint;
  layer.fillRect(0, 0, view.width, view.height);
  // Fully clear within the inner radius, fading back to the tint at the outer one.
  layer.globalCompositeOperation = 'destination-out';
  for (const light of lights) {
    const hole = layer.createRadialGradient(
      light.x,
      light.y,
      TORCH_INNER_RADIUS,
      light.x,
      light.y,
      TORCH_OUTER_RADIUS,
    );
    hole.addColorStop(0, 'rgba(0, 0, 0, 1)');
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    layer.fillStyle = hole;
    layer.fillRect(
      light.x - TORCH_OUTER_RADIUS,
      light.y - TORCH_OUTER_RADIUS,
      TORCH_OUTER_RADIUS * 2,
      TORCH_OUTER_RADIUS * 2,
    );
  }
  layer.globalCompositeOperation = 'source-over';
  context.drawImage(layer.canvas, 0, 0, view.width, view.height);
}
