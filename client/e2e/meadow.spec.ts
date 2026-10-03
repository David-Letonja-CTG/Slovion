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

/** A species picture in the open *Terenski dnevnik*. */
const pictureOf = (page: Page, speciesId: string) =>
  page.locator(`app-naturedex-panel .picture[data-species="${speciesId}"]`);

test('identify the meadow sage, read about it, and keep it after a reload', async ({ page }) => {
  const observation = await observeTheSage(page);
  // A new save starts on a spring morning (docs/decisions.md D8).
  await expect(page.locator('.conditions__now')).toHaveText(/Pomlad\s*·\s*jutro\s*·\s*08:\d\d/);
  await expect(page.locator('.conditions__location')).toHaveText('Travnik na Dravskem polju');
  // The meadow's weather, decided by the server for this time (docs/decisions.md D11).
  await expect(page.locator('.conditions__weather')).toHaveText(/^(jasno|oblačno|dež|megla|sneg)$/);

  await observation.getByRole('button', { name: 'Nov namig' }).click();
  await expect(observation.locator('li')).toHaveCount(2);
  await observation.getByRole('button', { name: 'travniška kadulja' }).click();

  const message = page.getByRole('dialog');
  await expect(message).toContainText('Pravilno! Nov vnos v Terenskem dnevniku: travniška kadulja');
  await page.keyboard.press('Enter');
  await expect(message).toHaveCount(0);

  // Seeing it again at once does not research it further; another time of day would.
  await page.keyboard.press('KeyE');
  await expect(message).toContainText('Več izveš, če jo opaziš ob drugem času dneva.');
  await page.keyboard.press('Enter');
  await expect(message).toHaveCount(0);

  await page.keyboard.press('KeyM');
  const natureDex = page.getByRole('dialog', { name: 'Terenski dnevnik' });
  await expect(natureDex.locator('[data-habitat="tall_grass"] h3')).toContainText('Visoka trava');
  await expect(natureDex.locator('[data-habitat="tall_grass"] .habitat__count')).toHaveText('1/5');
  await expect(natureDex.locator('[data-habitat="hedgerow"] h3')).toContainText('Mejica');
  await expect(natureDex.locator('[data-habitat="hedgerow"] .habitat__count')).toHaveText('0/2');

  // Hovering shows the name of the identified sage and ??? for a species not yet found.
  const sage = pictureOf(page, 'salvia_pratensis');
  await sage.hover();
  await expect(sage.locator('.picture__label')).toBeVisible();
  await expect(sage.locator('.picture__label')).toHaveText('travniška kadulja');
  const skylark = pictureOf(page, 'alauda_arvensis');
  await skylark.hover();
  await expect(skylark.locator('.picture__label')).toHaveText('???');

  await sage.click();
  await expect(natureDex.locator('article.entry')).toContainText('Salvia pratensis L.');
  await expect(natureDex.locator('article.entry')).toContainText('Raziskano: 1/3');
  await expect(natureDex).toContainText('Viri');
  await page.keyboard.press('Escape');
  await expect(natureDex.locator('article.entry')).toHaveCount(0);
  await expect(sage).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(natureDex).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await waitForTheWorld(page);
  await page.keyboard.press('KeyM');
  await expect(pictureOf(page, 'salvia_pratensis')).toHaveAttribute('data-status', 'identified');
  await expect(pictureOf(page, 'salvia_pratensis')).toHaveAccessibleName(
    'travniška kadulja – Raziskano: 1/3',
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
  await expect(pictureOf(page, 'salvia_pratensis')).toHaveAttribute('data-status', 'observed');
  await pictureOf(page, 'salvia_pratensis').click();
  await expect(natureDex).toContainText('Neznana vrsta');
  await expect(natureDex).toContainText('rastlina');
  await expect(natureDex).not.toContainText('travniška kadulja');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(natureDex).toHaveCount(0);

  // Observe again and identify it with the keyboard.
  await page.keyboard.press('KeyE');
  const again = page.getByRole('dialog', { name: 'Opaziš rastlino' });
  await expect(again).toBeVisible();
  await again.getByRole('button', { name: 'travniška kadulja' }).click();
  await expect(page.getByRole('dialog')).toContainText('Pravilno!');
});

test('searching the tall grass finds something sooner or later', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);

  // From the spawn (10,10): two steps right, two down into the south tall-grass patch at (12,12).
  await step(page, 'ArrowRight');
  await step(page, 'ArrowRight');
  await step(page, 'ArrowDown');
  await step(page, 'ArrowDown');

  const observation = page.getByRole('dialog', { name: /^Opaziš / });
  let found = false;
  // Every search ends in one of three messages; at a 70 % chance, six tries almost surely find something.
  for (let attempt = 0; attempt < 6 && !found; attempt++) {
    await page.keyboard.press('KeyE');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    if (await observation.isVisible()) {
      found = true;
      await expect(observation.getByRole('button', { name: 'Odidi' })).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      await expect(dialog).toContainText(
        /Tu ni ničesar\. Poskusi drugje\.|Ta vrsta je že zapisana v Terenskem dnevniku/,
      );
      await page.keyboard.press('Enter');
    }
    await expect(dialog).toHaveCount(0);
  }

  expect(found).toBe(true);
});

/** Taps `key` `count` times, one finished step each. */
async function walk(page: Page, key: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await step(page, key);
}

/** Faces the spot ahead, observes it and names it correctly. */
async function identifyAhead(page: Page, heading: string, name: string): Promise<void> {
  await page.keyboard.press('KeyE');
  const observation = page.getByRole('dialog', { name: heading });
  await observation.getByRole('button', { name }).click();
  await expect(page.getByRole('dialog')).toContainText('Pravilno!');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Reads a conversation to its end with Enter. */
async function readDialogue(page: Page): Promise<void> {
  const dialogue = page.getByRole('dialog', { name: 'Vera' });
  await expect(dialogue).toBeVisible();
  while ((await dialogue.count()) > 0) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }
}

/** From the spawn (10,10): to the gate column, down through the southern hedge, one step into the hedgerow. */
async function walkIntoTheHedgerow(page: Page): Promise<void> {
  await walk(page, 'ArrowRight', 10);
  await walk(page, 'ArrowDown', 10);
  // Through the gate the player enters another place, announced by the banner.
  await expect(page.locator('app-location-banner')).toHaveText('Južna mejica');
  await expect(page.locator('.conditions__location')).toHaveText('Južna mejica');
  await walk(page, 'ArrowLeft', 1);
  // (19, 20) lies in a hedgerow zone: searching there proves the player got through.
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog')).toContainText(/Opaziš |Tu ni ničesar/);
  await page.keyboard.press('Escape');
}

test('Vera opens the hedgerow once three species are identified', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);
  const tracker = page.locator('app-quest-tracker');
  await expect(tracker).toHaveCount(0);

  // Vera stands at (7,9): three steps left, then face up.
  await walk(page, 'ArrowLeft', 3);
  await step(page, 'ArrowUp');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog', { name: 'Vera' })).toContainText('Jaz sem Vera');
  await readDialogue(page);
  await expect(tracker).toContainText('Oko za naravo');
  await expect(tracker).toContainText('0/3');

  // Meadow sage (13,10): from (7,10) five steps right, facing it.
  await walk(page, 'ArrowRight', 5);
  await identifyAhead(page, 'Opaziš rastlino', 'travniška kadulja');
  await expect(tracker).toContainText('1/3');

  // Dandelion (7,12): back to (7,10), one step down, facing it.
  await walk(page, 'ArrowLeft', 5);
  await step(page, 'ArrowDown');
  await identifyAhead(page, 'Opaziš rastlino', 'navadni regrat');

  // The brown hare wanders around its home, so walking up to it is not deterministic: identify it through
  // the API (the same encounter the game opens when the player meets it); engine tests cover the meeting.
  await identifyThroughApi(page, 'meadow_hare_1', 'lepus_europaeus');

  // Back to Vera at (7,9): up to the path, then face her. She completes the quest; the gate opens as the
  // dialogue closes.
  await step(page, 'ArrowUp');
  await step(page, 'ArrowUp');
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog', { name: 'Vera' })).toContainText('Odlično!');
  await readDialogue(page);
  await expect(tracker).toHaveCount(0);

  // From (7,10): to the spawn column, then the usual route into the hedgerow.
  await walk(page, 'ArrowRight', 3);
  await walkIntoTheHedgerow(page);

  // After a reload the gate is still open.
  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await waitForTheWorld(page);
  await expect(tracker).toHaveCount(0);
  await walkIntoTheHedgerow(page);
});

test('a new game announces the meadow and the torch switches with L', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);

  await expect(page.locator('app-location-banner')).toHaveText('Travnik na Dravskem polju');
  const torch = page.getByRole('button', { name: 'Svetilka' });
  await expect(torch).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('KeyL');
  await expect(torch).toHaveAttribute('aria-pressed', 'true');
  await torch.click();
  await expect(torch).toHaveAttribute('aria-pressed', 'false');
});

/** Opens and answers a spot's encounter through the API with the page's save token. */
async function identifyThroughApi(
  page: Page,
  spotId: string,
  speciesId: string,
  mapId = 'dravsko_polje_meadow',
): Promise<void> {
  const correct = await page.evaluate(
    async ([spot, species, map]) => {
      const token = localStorage.getItem('slovion.saveToken');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const started = await fetch('/api/save/encounters', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mapId: map, spotId: spot }),
      }).then((r) => r.json());
      const answer = await fetch(`/api/save/encounters/${started.encounterId}/identification`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ speciesId: species }),
      }).then((r) => r.json());
      return answer.correct as boolean;
    },
    [spotId, speciesId, mapId],
  );
  expect(correct).toBe(true);
}

/** Identifies three species and completes Vera's quest through the API; its flag opens Kočevje. */
async function completeVerasQuestThroughApi(page: Page): Promise<void> {
  const talk = () =>
    page.evaluate(async () => {
      const token = localStorage.getItem('slovion.saveToken');
      await fetch('/api/save/conversations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: 'dravsko_polje_meadow', npcId: 'vera' }),
      });
    });
  await talk();
  await identifyThroughApi(page, 'meadow_sage_1', 'salvia_pratensis');
  await identifyThroughApi(page, 'meadow_dandelion_1', 'taraxacum_officinale');
  await identifyThroughApi(page, 'meadow_hare_1', 'lepus_europaeus');
  await talk();
}

test('the signpost takes the player to Kočevje once Vera is helped, and the game continues there', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);
  await completeVerasQuestThroughApi(page);

  // The signpost stands at (12,9): two steps right of the spawn, then face up.
  await walk(page, 'ArrowRight', 2);
  await step(page, 'ArrowUp');
  await page.keyboard.press('KeyE');
  const travelMap = page.getByRole('dialog', { name: 'Kažipot' });
  await expect(travelMap).toBeVisible();
  await expect(travelMap.locator('[data-region="dravsko_polje"]')).toContainText('Tukaj si');
  await expect(travelMap.locator('[data-region="kocevje"]')).toContainText('Odprto');
  await expect(travelMap.locator('[data-region="pohorje"]')).toContainText(
    'Pomagaj Juretu v Kočevju.',
  );
  await expect(travelMap.locator('[data-region="triglav"]')).toContainText('Zaklenjeno');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('app-location-banner')).toHaveText('Kočevski gozd');
  await expect(page.locator('.conditions__location')).toHaveText('Kočevski gozd');
  await expect(travelMap).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await waitForTheWorld(page);
  await expect(page.locator('.conditions__location')).toHaveText('Kočevski gozd');
});

test('searching at a spruce on Pohorje finds a plant of the mountain forest', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await waitForTheWorld(page);
  // Jure's quest opens Pohorje: help Vera, identify three Kočevje species and talk to Jure, all through the API.
  await completeVerasQuestThroughApi(page);
  for (const [spot, species] of [
    ['kocevje_garlic_1', 'allium_ursinum'],
    ['kocevje_woodruff_1', 'galium_odoratum'],
    ['kocevje_bear_1', 'ursus_arctos'],
  ]) {
    await identifyThroughApi(page, spot, species, 'kocevje_forest');
  }
  for (let talk = 0; talk < 2; talk++) {
    await page.evaluate(async () => {
      const token = localStorage.getItem('slovion.saveToken');
      await fetch('/api/save/conversations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: 'kocevje_forest', npcId: 'jure' }),
      });
    });
  }
  const travelled = await page.evaluate(async () => {
    const token = localStorage.getItem('slovion.saveToken');
    const response = await fetch('/api/save/travel', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ regionId: 'pohorje' }),
    });
    return response.status;
  });
  expect(travelled).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await waitForTheWorld(page);
  await expect(page.locator('.conditions__location')).toHaveText('Pohorski gozd');

  // From the spawn (1,9) four steps along the path to (5,9), then face the spruce at (5,8).
  await walk(page, 'ArrowRight', 4);
  await step(page, 'ArrowUp');

  const observation = page.getByRole('dialog', { name: 'Opaziš rastlino' });
  let found = false;
  // At a 60 % chance, eight tries almost surely find something; in spring that is a bilberry or a spruce.
  for (let attempt = 0; attempt < 8 && !found; attempt++) {
    await page.keyboard.press('KeyE');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    if (await observation.isVisible()) {
      found = true;
      await observation.locator('[data-kind="candidate"]').first().click();
      await expect(page.getByRole('dialog')).toContainText(/navadna borovnica|navadna smreka/);
      await page.keyboard.press('Enter');
    } else {
      await expect(dialog).toContainText(/Tu ni ničesar\. Poskusi drugje\./);
      await page.keyboard.press('Enter');
    }
    await expect(dialog).toHaveCount(0);
  }

  expect(found).toBe(true);
});
