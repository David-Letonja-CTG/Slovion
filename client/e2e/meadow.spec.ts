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

/** New game, then walk to the meadow sage (three tiles right of the spawn) and observe it. */
async function observeTheSage(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);
  await step(page, 'ArrowRight');
  await step(page, 'ArrowRight');
  await page.keyboard.press('KeyE');

  const observation = page.getByRole('dialog', { name: 'Opaziš rastlino' });
  await expect(observation).toBeVisible();
  return observation;
}

test('identify the meadow sage, read about it, and keep it after a reload', async ({ page }) => {
  const observation = await observeTheSage(page);

  await observation.getByRole('button', { name: 'Nov namig' }).click();
  await expect(observation.locator('li')).toHaveCount(2);
  await observation.getByRole('button', { name: 'travniška kadulja' }).click();

  const message = page.getByRole('dialog');
  await expect(message).toContainText('Pravilno! Nov vnos v Terenskem dnevniku: travniška kadulja');
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

test('a wrong answer leaves the species unknown until it is identified', async ({ page }) => {
  const observation = await observeTheSage(page);

  // Any candidate except the sage (the last option is "Odidi").
  const wrong = observation
    .getByRole('button')
    .filter({ hasNotText: /travniška kadulja|Nov namig|Odidi/ })
    .first();
  await wrong.click();
  const message = page.getByRole('dialog');
  await expect(message).toContainText('Žal ne – to je bila vrsta travniška kadulja.');
  await page.keyboard.press('Enter');

  await page.keyboard.press('KeyM');
  const natureDex = page.getByRole('dialog', { name: 'Terenski dnevnik' });
  await expect(natureDex).toContainText('Neznana vrsta');
  await expect(natureDex).toContainText('rastlina');
  await expect(natureDex).not.toContainText('travniška kadulja');
  await page.keyboard.press('Escape');
  await expect(natureDex).toHaveCount(0);

  // Observe again and identify it with the keyboard.
  await page.keyboard.press('KeyE');
  const again = page.getByRole('dialog', { name: 'Opaziš rastlino' });
  await expect(again).toBeVisible();
  await again.getByRole('button', { name: 'travniška kadulja' }).click();
  await expect(page.getByRole('dialog')).toContainText('Pravilno!');
});
