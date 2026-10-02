import { Page, expect, test } from '@playwright/test';

/** One step takes 250 ms; wait a little longer so every tap is exactly one finished step. */
async function step(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(400);
}

async function waitForTheWorld(page: Page): Promise<void> {
  await expect(page.locator('app-game-canvas canvas')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('app-game-canvas canvas').evaluate((c) => (c as HTMLCanvasElement).width),
    )
    .toBeGreaterThan(0);
}

test('discover the meadow sage, read about it, and keep it after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);

  // The meadow places the player three tiles left of the sage, facing it.
  await step(page, 'ArrowRight');
  await step(page, 'ArrowRight');
  await page.keyboard.press('KeyE');

  const message = page.getByRole('dialog');
  await expect(message).toContainText('Nov vnos v Terenskem dnevniku: travniška kadulja');
  await page.keyboard.press('Enter');
  await expect(message).toHaveCount(0);

  await page.keyboard.press('KeyM');
  const natureDex = page.getByRole('dialog', { name: 'Terenski dnevnik' });
  await expect(natureDex).toContainText('travniška kadulja');
  await expect(natureDex).toContainText('Salvia pratensis L.');
  await expect(natureDex).toContainText('Viri');
  await page.keyboard.press('Escape');
  await expect(natureDex).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await waitForTheWorld(page);
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('dialog', { name: 'Terenski dnevnik' })).toContainText(
    'travniška kadulja',
  );
});
