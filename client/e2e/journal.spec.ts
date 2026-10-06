import { Page, expect, test } from '@playwright/test';

// Terenski dnevnik shows one habitat per page (openspec/specs/naturedex): an index where there is room, page buttons
// otherwise; even the largest page (Mokrišče, ten species) fits without scrolling, with even padding.

async function openJournal(page: Page, phone: boolean): Promise<void> {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Nova igra' });
  await (phone ? start.tap() : start.click());
  await expect
    .poll(() =>
      page.locator('app-game-canvas canvas').evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);
  const journal = page.getByRole('button', { name: 'Dnevnik' });
  await (phone ? journal.tap() : journal.click());
  await expect(page.locator('.habitat__grid[data-habitat="tall_grass"]')).toBeVisible();
}

/** The page fits: nothing scrolls, every picture is on screen, the grid has the same space on both sides. */
async function expectFits(page: Page, indexBeside: boolean): Promise<void> {
  const fit = await page.evaluate(() => {
    const panel = document.querySelector('.naturedex')!;
    const grid = document.querySelector('.habitat__grid')!.getBoundingClientRect();
    const box = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    return {
      scroll: panel.scrollHeight - panel.clientHeight + (panel.scrollWidth - panel.clientWidth),
      offscreen: [...document.querySelectorAll('.picture')]
        .map((picture) => picture.getBoundingClientRect())
        .filter((r) => r.bottom > innerHeight || r.right > innerWidth || r.left < 0 || r.top < 0)
        .length,
      left: grid.left - box.left - parseFloat(style.borderLeftWidth),
      right: box.right - grid.right - parseFloat(style.borderRightWidth),
      padding: parseFloat(style.paddingRight),
    };
  });
  expect(fit.scroll).toBe(0);
  expect(fit.offscreen).toBe(0);
  expect(Math.abs(fit.right - fit.padding)).toBeLessThanOrEqual(1);
  // Where the index sits beside the page, the grid's left side is the index; otherwise both sides match.
  if (!indexBeside) expect(Math.abs(fit.left - fit.right)).toBeLessThanOrEqual(1);
}

test.describe('desktop 1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('the index opens Mokrišče, which fits without scrolling', async ({ page }) => {
    await openJournal(page, false);
    await expect(page.locator('.flip--next')).toBeHidden();

    await page.locator('.index__habitat[data-habitat="wetland"]').click();

    await expect(page.locator('.habitat__grid[data-habitat="wetland"] .picture')).toHaveCount(10);
    await expect(page.locator('.index__habitat[data-habitat="wetland"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectFits(page, true);
  });
});

for (const [name, width, height] of [
  ['phone upright 390×844', 390, 844],
  ['phone sideways 844×390', 844, 390],
] as const) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

    test('the page buttons turn to Mokrišče, which fits without scrolling', async ({ page }) => {
      await openJournal(page, true);
      await expect(page.locator('.naturedex__index')).toBeHidden();
      const next = page.getByRole('button', { name: 'Naslednji življenjski prostor' });

      await next.tap();
      await expect(page.locator('.habitat__grid[data-habitat="hedgerow"]')).toBeVisible();
      for (const habitat of [
        'fir_beech_forest',
        'mountain_forest',
        'alpine_grassland',
        'wetland',
      ]) {
        await next.tap();
        await expect(page.locator(`.habitat__grid[data-habitat="${habitat}"]`)).toBeVisible();
      }

      await expect(page.locator('.picture')).toHaveCount(10);
      await expectFits(page, false);
    });
  });
}
