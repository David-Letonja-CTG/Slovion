import { Locator, Page, devices, expect, test } from '@playwright/test';
import { Direction, face, loadMap, spotOf } from './route';

// A phone held upright, with a touch screen: the game shows its D-pad and buttons.
test.use({ ...devices['Pixel 7'] });

/** A new game; with the debug view, the test can walk routes on the generated meadow (D13). */
async function newGame(page: Page, debug = false): Promise<void> {
  await page.goto(debug ? '/?debug=world' : '/');
  await page.getByRole('button', { name: 'Nova igra' }).tap();
  const canvas = page.locator('app-game-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.evaluate((c) => (c as HTMLCanvasElement).width))
    .toBeGreaterThan(0);
}

/** Taps a point of an element, as a share of its size from its top-left corner. */
async function tapAt(page: Page, target: Locator, x: number, y: number): Promise<void> {
  const box = (await target.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('upright, the world is at the top at full width and nothing covers it', async ({ page }) => {
  await newGame(page);
  const viewport = page.viewportSize()!;
  const world = (await page.locator('app-game-canvas canvas').boundingBox())!;

  expect(world.width).toBeGreaterThanOrEqual(viewport.width * 0.99);
  expect(world.y).toBeLessThan(40);
  for (const selector of [
    'app-conditions-indicator',
    '.play__actions',
    'app-touch-controls .touch__pad',
    '[data-button="a"]',
  ]) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(overlaps(box, world), selector).toBe(false);
  }
  await expect(page.locator('.play__hint')).toHaveCount(0);
});

test('walk to the meadow sage with the D-pad, observe it with A and leave with B', async ({
  page,
}) => {
  await newGame(page, true);
  const pad = page.locator('.touch__pad');
  const at: Record<Direction, [number, number]> = {
    up: [0.5, 0.1],
    down: [0.5, 0.9],
    left: [0.1, 0.5],
    right: [0.9, 0.5],
  };

  // A tap is one step; the sage grows within six steps of the spawn.
  const map = await loadMap(page);
  await face(page, map, spotOf(map, 'salvia_pratensis'), {
    press: async (direction) => {
      await tapAt(page, pad, ...at[direction]);
      await page.waitForTimeout(400);
    },
  });
  await page.locator('[data-button="a"]').tap();

  const observation = page.getByRole('dialog', { name: 'Opaziš rastlino' });
  await expect(observation).toBeVisible();

  await page.locator('[data-button="b"]').tap();
  await expect(observation).toHaveCount(0);
});

test('the Dnevnik button opens the journal by touch', async ({ page }) => {
  await newGame(page);

  await page.getByRole('button', { name: 'Dnevnik' }).tap();

  await expect(page.getByRole('dialog', { name: 'Terenski dnevnik' })).toBeVisible();
});

test('sideways, the D-pad and the buttons sit in the bottom corners', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await newGame(page);
  const pad = (await page.locator('.touch__pad').boundingBox())!;
  const a = (await page.locator('[data-button="a"]').boundingBox())!;
  const world = (await page.locator('app-game-canvas canvas').boundingBox())!;

  expect(world.height).toBeGreaterThanOrEqual(411);
  expect(pad.x).toBeLessThan(40);
  expect(pad.y + pad.height).toBeGreaterThan(412 - 40);
  expect(a.x + a.width).toBeGreaterThan(915 - 40);
});
