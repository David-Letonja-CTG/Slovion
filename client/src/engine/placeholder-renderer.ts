import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './viewport';

const TILE_SIZE = 16;
const LIGHT = '#8bac6f';
const DARK = '#6f9157';
const BORDER = '#f2f5e9';

/**
 * Temporary test pattern: a 16-px checkerboard with a 1-px border, so scaling and crispness can be
 * checked by eye. Replaced by the map renderer in the first gameplay change.
 */
export function renderPlaceholder(context: CanvasRenderingContext2D): void {
  for (let y = 0; y < LOGICAL_HEIGHT; y += TILE_SIZE) {
    for (let x = 0; x < LOGICAL_WIDTH; x += TILE_SIZE) {
      context.fillStyle = ((x + y) / TILE_SIZE) % 2 === 0 ? LIGHT : DARK;
      context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  context.fillStyle = BORDER;
  context.fillRect(0, 0, LOGICAL_WIDTH, 1);
  context.fillRect(0, LOGICAL_HEIGHT - 1, LOGICAL_WIDTH, 1);
  context.fillRect(0, 0, 1, LOGICAL_HEIGHT);
  context.fillRect(LOGICAL_WIDTH - 1, 0, 1, LOGICAL_HEIGHT);
}
