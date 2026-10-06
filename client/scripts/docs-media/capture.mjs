// Regenerates the screenshots and GIFs in docs/images/ from the running game, so the docs stay current.
//
// Needs the database (docker compose up -d db), the API and the client (npm start). Each scene starts a new save,
// moves its in-game clock and marks quests as done directly in the database, then plays a short route.
//
//   cd client
//   node scripts/docs-media/capture.mjs              # all scenes, against http://localhost:4200
//   node scripts/docs-media/capture.mjs hero cave    # only some scenes
//   DOCS_MEDIA_URL=http://localhost:4300 node scripts/docs-media/capture.mjs
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGif } from './gif.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const out = join(repo, 'docs', 'images');
const base = process.env.DOCS_MEDIA_URL ?? 'http://localhost:4200';
const VIEW = { width: 1280, height: 720 };
const LOGICAL = { width: 480, height: 270 };

/** Every region quest in journey order; completing them opens all regions and gives all tools. */
const JOURNEY = [
  'eye_for_nature',
  'in_the_shade_of_firs',
  'secrets_of_the_bog',
  'below_the_peaks',
  'vanishing_lake',
  'into_the_dark',
  'city_nature',
  'under_the_storks_nest',
  'between_salt_and_sea',
];

const sql = (query) =>
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-U', 'slovion', '-d', 'slovion', '-t', '-A'],
    {
      cwd: repo,
      input: query,
    },
  ).toString();

/**
 * Starts a new save in a fresh page, with `quests` done and the clock at `minutes` past 08:00 on day 0 (spring; one real
 * second is one in-game minute), travels to `region` and enters the world. With `clearSky` (the map ID), a rainy, foggy
 * or snowy day is skipped for the same time on the next spring day, so pictures show the map clearly. With `device`,
 * the page emulates that device (e.g. a phone with a touch screen) instead of a desktop `viewport`.
 */
async function newGame(
  browser,
  { quests = [], minutes = 240, region, clearSky, viewport = VIEW, device } = {},
) {
  const page = await browser.newPage(device ?? { viewport });
  await page.goto(base);
  await page.getByRole('button', { name: 'Nova igra' }).click();
  await page.waitForSelector('app-game-canvas canvas');
  const token = await page.evaluate(() => localStorage.getItem('slovion.saveToken'));
  const slot = `(select id from save_slots where token_hash = sha256(convert_to('${token}', 'UTF8')))`;
  const done = quests.map((q) => `(${slot}, '${q}', now(), now())`).join(', ');
  sql(
    `update save_slots set created_at = now() - interval '${minutes} seconds' where id = ${slot};` +
      (done
        ? `insert into quest_progress (save_slot_id, quest_id, started_at, completed_at) values ${done};`
        : ''),
  );
  for (let day = 1; clearSky && day < 3; day++) {
    const weather = await page.evaluate(async (mapId) => {
      const token = localStorage.getItem('slovion.saveToken');
      const response = await fetch(`/api/save/weather?mapId=${mapId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await response.json()).weather;
    }, clearSky);
    if (weather === 'clear' || weather === 'cloudy') break;
    sql(
      `update save_slots set created_at = created_at - interval '1440 seconds' where id = ${slot};`,
    );
  }
  if (region) {
    await page.evaluate(async (regionId) => {
      const token = localStorage.getItem('slovion.saveToken');
      await fetch('/api/save/travel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId }),
      });
    }, region);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Nadaljuj' }).click();
  await page.waitForSelector('app-game-canvas canvas');
  await page.waitForTimeout(2500);
  return page;
}

async function keys(page, key, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(330);
  }
}

/** Starts collecting the canvas at its logical size every `ms` milliseconds. */
async function startRecording(page, ms = 100) {
  await page.evaluate(
    ([w, h, ms]) => {
      const source = document.querySelector('app-game-canvas canvas');
      const copy = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
      copy.imageSmoothingEnabled = false;
      window.__frames = [];
      window.__recorder = setInterval(() => {
        copy.drawImage(source, 0, 0, w, h);
        window.__frames.push(copy.getImageData(0, 0, w, h).data);
      }, ms);
    },
    [LOGICAL.width, LOGICAL.height, ms],
  );
}

async function stopRecording(page, name, ms = 100) {
  const count = await page.evaluate(() => {
    clearInterval(window.__recorder);
    return window.__frames.length;
  });
  const frames = [];
  for (let i = 0; i < count; i++) {
    const b64 = await page.evaluate((i) => {
      let s = '';
      for (const byte of window.__frames[i]) s += String.fromCharCode(byte);
      return btoa(s);
    }, i);
    frames.push(new Uint8Array(Buffer.from(b64, 'base64')));
  }
  writeFileSync(join(out, name), encodeGif(frames, { ...LOGICAL, scale: 2, delayMs: ms }));
  console.log(`${name}: ${frames.length} frames`);
}

const canvasShot = (page, name) =>
  page.locator('app-game-canvas canvas').screenshot({ path: join(out, name) });

/** The canvas at its logical size, as a PNG data URL (for the regions montage). */
const canvasImage = (page) =>
  page.evaluate(
    ([w, h]) => {
      const source = document.querySelector('app-game-canvas canvas');
      const copy = document.createElement('canvas');
      copy.width = w;
      copy.height = h;
      const context = copy.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.drawImage(source, 0, 0, w, h);
      return copy.toDataURL('image/png');
    },
    [LOGICAL.width, LOGICAL.height],
  );

const scenes = {
  /** Walking along the Dravsko polje meadow on a spring morning. */
  async hero(browser) {
    const page = await newGame(browser, { minutes: 60, clearSky: 'dravsko_polje_meadow' });
    await startRecording(page);
    await page.waitForTimeout(600);
    await keys(page, 'ArrowRight', 8);
    await page.waitForTimeout(600);
    await stopRecording(page, 'hero.gif');
    await page.close();
  },

  /** Observing the meadow sage, then its page in Terenski dnevnik. */
  async journal(browser) {
    const page = await newGame(browser, { minutes: 60 });
    await keys(page, 'ArrowRight', 2);
    await page.keyboard.press('KeyE');
    const observation = page.getByRole('dialog', { name: 'Opaziš rastlino' });
    await observation.waitFor();
    await observation.getByRole('button', { name: 'Nov namig' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, 'identify.png') });
    await observation.getByRole('button', { name: 'travniška kadulja' }).click();
    await page.getByRole('dialog').filter({ hasText: 'Pravilno!' }).waitFor();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyM');
    const journal = page.getByRole('dialog', { name: 'Terenski dnevnik' });
    await journal.waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, 'journal.png') });
    await journal.locator('.picture[data-species="salvia_pratensis"]').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, 'species-page.png') });
    await page.close();
  },

  /** A phone, upright and sideways, with the touch controls. */
  async phone(browser) {
    const phone = devices['Pixel 7'];
    const upright = await newGame(browser, {
      minutes: 240,
      clearSky: 'dravsko_polje_meadow',
      device: phone,
    });
    await upright.screenshot({ path: join(out, 'phone.png') });
    await upright.close();
    const sideways = await newGame(browser, {
      minutes: 240,
      clearSky: 'dravsko_polje_meadow',
      device: {
        ...phone,
        viewport: { width: phone.viewport.height, height: phone.viewport.width },
      },
    });
    await sideways.screenshot({ path: join(out, 'phone-sideways.png') });
    await sideways.close();
  },

  /** The travel map with every region open. */
  async travel(browser) {
    const page = await newGame(browser, {
      quests: JOURNEY,
      minutes: 60,
      viewport: { width: 1280, height: 900 },
    });
    await keys(page, 'ArrowUp');
    await keys(page, 'ArrowRight');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelectorAll('*').forEach((e) => (e.scrollTop = 0)));
    await page.getByRole('dialog').screenshot({ path: join(out, 'travel-map.png') });
    await page.close();
  },

  /** Every region's spawn at noon, in journey order. */
  async regions(browser) {
    const regions = [
      ['dravsko_polje', 'dravsko_polje_meadow', 'Dravsko polje'],
      ['kocevje', 'kocevje_forest', 'Kočevje'],
      ['pohorje', 'pohorje_forest', 'Pohorje'],
      ['triglav', 'triglav_alps', 'Triglav'],
      ['cerknica', 'cerknica_lake', 'Cerkniško jezero'],
      ['rakov_skocjan', 'rakov_skocjan_karst', 'Rakov Škocjan'],
      ['ljubljana', 'ljubljana_park', 'Ljubljana'],
      ['murska_sobota', 'murska_sobota_village', 'Murska Sobota'],
      ['portoroz', 'portoroz_coast', 'Portorož'],
    ];
    const images = [];
    for (const [region, map, name] of regions) {
      const page = await newGame(browser, { quests: JOURNEY, minutes: 240, region, clearSky: map });
      images.push([name, await canvasImage(page)]);
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 3 * 488 + 8, height: 600 } });
    await page.setContent(`<body style="margin:0;padding:4px;background:#11161c;font:16px sans-serif;color:#e8efe4">
      <div style="display:grid;grid-template-columns:repeat(3,480px);gap:8px">
      ${images.map(([n, src]) => `<figure style="margin:0"><img src="${src}" width="480" height="270" style="image-rendering:pixelated;display:block"><figcaption style="padding:4px 2px 0">${n}</figcaption></figure>`).join('')}
      </div></body>`);
    await page.screenshot({ path: join(out, 'regions.png'), fullPage: true });
    await page.close();
  },

  /** Ljubljana at night: the street lamps and the torch. */
  async night(browser) {
    const page = await newGame(browser, { quests: JOURNEY, minutes: 870, region: 'ljubljana' });
    await page.keyboard.press('KeyL');
    await startRecording(page);
    await page.waitForTimeout(600);
    await keys(page, 'ArrowRight', 10);
    await page.waitForTimeout(600);
    await stopRecording(page, 'night.gif');
    await page.close();
  },

  /** Into the dark cave of Rakov Škocjan with the torch. */
  async cave(browser) {
    const page = await newGame(browser, {
      quests: JOURNEY,
      minutes: 240,
      region: 'rakov_skocjan',
      clearSky: 'rakov_skocjan_karst',
    });
    await keys(page, 'ArrowRight', 19);
    await page.keyboard.press('KeyL');
    await page.waitForTimeout(1500);
    await canvasShot(page, 'cave.png');
    await page.close();
  },

  /** The white stork on its chimney in Murska Sobota, seen from the yard. */
  async stork(browser) {
    const page = await newGame(browser, {
      quests: JOURNEY,
      minutes: 240,
      region: 'murska_sobota',
      clearSky: 'murska_sobota_village',
    });
    await keys(page, 'ArrowUp', 6);
    await keys(page, 'ArrowRight', 5);
    await keys(page, 'ArrowUp', 2);
    await keys(page, 'ArrowRight');
    await page.waitForTimeout(1500);
    await canvasShot(page, 'stork.png');
    await page.close();
  },

  /** Swimming with the snorkel in Portorož's shallow sea, to the noble pen shell. */
  async snorkel(browser) {
    const page = await newGame(browser, {
      quests: JOURNEY,
      minutes: 240,
      region: 'portoroz',
      clearSky: 'portoroz_coast',
    });
    await startRecording(page);
    await page.waitForTimeout(400);
    await keys(page, 'ArrowDown', 3);
    await keys(page, 'ArrowRight', 5);
    await keys(page, 'ArrowDown', 2);
    await keys(page, 'ArrowRight', 3);
    await page.waitForTimeout(800);
    await stopRecording(page, 'snorkel.gif');
    await page.close();
  },
};

const wanted = process.argv.slice(2);
const browser = await chromium.launch();
try {
  for (const [name, scene] of Object.entries(scenes)) {
    if (wanted.length && !wanted.includes(name)) continue;
    await scene(browser);
    console.log(`${name} done`);
  }
} finally {
  await browser.close();
}
