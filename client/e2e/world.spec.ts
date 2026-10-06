import { expect, test } from '@playwright/test';

// Generated worlds (docs/decisions.md D13): the save's maps come from the API, and development builds have a debug view.

test('the debug view shows the map, and generated maps say how they were made', async ({
  page,
}) => {
  await page.goto('/?debug=world');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await expect
    .poll(() =>
      page.locator('app-game-canvas canvas').evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);

  // The meadow is authored: the panel names it, with no generation details.
  await expect(page.locator('.play__debug')).toHaveText('dravsko_polje_meadow');

  // Kočevje is generated from the save's world seed (fixed to 1 for these tests).
  const kocevje = await page.evaluate(async () => {
    const token = localStorage.getItem('slovion.saveToken');
    const response = await fetch('/api/save/maps/kocevje_forest', {
      headers: { Authorization: 'Bearer ' + token },
    });
    return { status: response.status, world: response.headers.get('X-World') };
  });
  expect(kocevje).toEqual({
    status: 200,
    world: 'seed=1; version=1; biomes=fir_beech_forest',
  });
});

test('without the debug flag there is no debug view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await expect(page.locator('app-game-canvas canvas')).toBeVisible();

  await expect(page.locator('.play__debug')).toHaveCount(0);
});
