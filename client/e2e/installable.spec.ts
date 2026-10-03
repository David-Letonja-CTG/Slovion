import { expect, test } from '@playwright/test';

interface Manifest {
  name: string;
  lang: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; purpose?: string }[];
}

/** The image's natural size, e.g. `192x192`, once it has loaded (runs in the page). */
async function naturalSize(src: string): Promise<string> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return `${image.naturalWidth}x${image.naturalHeight}`;
}

/** Whether the service worker's caches hold the app page (runs in the page). */
async function holdsTheApp(): Promise<boolean> {
  for (const name of await caches.keys()) {
    if (await (await caches.open(name)).match('/index.html')) return true;
  }
  return false;
}

test('the production build is installable and opens without a connection', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Slovion' })).toBeVisible();

  // The manifest and its icons.
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = (await (await page.request.get(href!)).json()) as Manifest;
  expect(manifest).toMatchObject({
    name: 'Slovion',
    lang: 'sl',
    start_url: '/',
    display: 'standalone',
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    expect(await page.evaluate(naturalSize, icon.src)).toBe(icon.sizes);
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(await page.evaluate(naturalSize, apple!)).toBe('180x180');

  // The service worker takes over and caches the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect.poll(() => page.evaluate(holdsTheApp), { timeout: 15_000 }).toBe(true);

  // Offline, the game still opens on the title screen and says a connection is needed.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Slovion' })).toBeVisible();
  await expect(page.getByText('Ni internetne povezave. Za igranje jo potrebuješ.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova igra' })).toBeVisible();

  // Server data is never answered from the cache.
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await expect(page.getByText('Povezava s strežnikom ni uspela. Poskusi znova.')).toBeVisible();
});
