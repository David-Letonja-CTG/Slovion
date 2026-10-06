import { Page, expect, test } from '@playwright/test';

// The play screen is game first at every size (openspec/specs/play-layout): the world takes the largest view of its
// shape the screen allows (16:9; 3:4 on upright phones), the HUD stays on screen without overlaps, and nothing scrolls
// sideways.

interface Size {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** A phone: device pixel ratio 3 and a touch screen. */
  readonly phone: boolean;
  /** The world view's shape: 16:9, or 3:4 on (tall) upright phones. */
  readonly shape: number;
  /** The world's smallest size, as a share of the screen's width and height. */
  readonly world: { readonly width: number; readonly height: number };
}

const SIZES: readonly Size[] = [
  {
    name: 'desktop 1920×1080',
    width: 1920,
    height: 1080,
    phone: false,
    shape: 16 / 9,
    world: { width: 1, height: 1 },
  },
  {
    name: 'desktop 1366×768',
    width: 1366,
    height: 768,
    phone: false,
    shape: 16 / 9,
    world: { width: 0.99, height: 0.99 },
  },
  {
    name: 'phone upright 390×844',
    width: 390,
    height: 844,
    phone: true,
    shape: 3 / 4,
    world: { width: 0.99, height: 0 },
  },
  {
    name: 'phone upright 430×932',
    width: 430,
    height: 932,
    phone: true,
    shape: 3 / 4,
    world: { width: 0.99, height: 0 },
  },
  {
    name: 'phone sideways 844×390',
    width: 844,
    height: 390,
    phone: true,
    shape: 16 / 9,
    world: { width: 0, height: 0.99 },
  },
  {
    name: 'phone sideways 932×430',
    width: 932,
    height: 430,
    phone: true,
    shape: 16 / 9,
    world: { width: 0, height: 0.99 },
  },
];

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

async function newGame(page: Page, phone: boolean): Promise<void> {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Nova igra' });
  await (phone ? start.tap() : start.click());
  const canvas = page.locator('app-game-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.evaluate((c) => (c as HTMLCanvasElement).width))
    .toBeGreaterThan(0);
  await expect(page.locator('.play__journal')).toBeVisible();
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.phone ? 3 : 1,
      hasTouch: size.phone,
      isMobile: size.phone,
    });

    test('the world fills the screen as far as its shape allows, with the HUD on screen', async ({
      page,
    }) => {
      await newGame(page, size.phone);
      const world = (await page.locator('app-game-canvas canvas').boundingBox())!;

      // Never stretched, and as large as the screen allows.
      expect(Math.abs(world.width / world.height - size.shape)).toBeLessThan(0.01);
      expect(world.width).toBeGreaterThanOrEqual(size.width * size.world.width);
      expect(world.height).toBeGreaterThanOrEqual(size.height * size.world.height);

      const selectors = [
        'app-conditions-indicator',
        '.play__torch',
        '.play__bag',
        '.play__journal',
        '.play__more-button',
        ...(size.phone ? ['.touch__pad', '[data-button="a"]', '[data-button="b"]'] : []),
      ];
      const boxes = await Promise.all(
        selectors.map(async (selector) => (await page.locator(selector).boundingBox())!),
      );
      boxes.forEach((box, i) => {
        expect(box.x, selectors[i]).toBeGreaterThanOrEqual(0);
        expect(box.y, selectors[i]).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selectors[i]).toBeLessThanOrEqual(size.width + 0.5);
        expect(box.y + box.height, selectors[i]).toBeLessThanOrEqual(size.height + 0.5);
        if (size.phone) {
          expect(Math.min(box.width, box.height), selectors[i]).toBeGreaterThanOrEqual(44);
        }
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(box, boxes[j]), `${selectors[i]} and ${selectors[j]}`).toBe(false);
        }
      });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width);
    });
  });
}

test('the keyboard hint shows over the world, then fades out; Več keeps it', async ({ page }) => {
  await newGame(page, false);
  const hint = page.locator('.play__hint');
  await expect(hint).toBeVisible();

  await expect(hint).toBeHidden({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Več' }).click();
  await expect(page.locator('.play__menu-hint')).toContainText('Puščice ali WASD');
  await page.keyboard.press('Escape');
  await expect(page.locator('.play__menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Več' })).toBeFocused();
});
