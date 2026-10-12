// Regenerates the screenshots and GIFs in docs/images/ from the running game, so the docs stay current.
//
// Needs the database (docker compose up -d db), the API and the client (npm start). Each scene starts a new save,
// moves its in-game clock and marks quests as done (or fills the journal) directly in the database, then plays a short
// route. The routes fit the generated regions of world seed 1 (docs/decisions.md D13), so run the API with
// WorldGeneration__FixedSeed=1.
//
//   cd client
//   node scripts/docs-media/capture.mjs              # all scenes, against http://localhost:4200
//   node scripts/docs-media/capture.mjs tour cave    # only some scenes (tour: hero.gif and regions.png)
//   DOCS_MEDIA_URL=http://localhost:4300 node scripts/docs-media/capture.mjs
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
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

/** Stops collecting and returns the frames (RGBA at the logical size). */
async function stopRecording(page) {
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
  return frames;
}

function writeGif(name, frames, ms = 100) {
  writeFileSync(join(out, name), encodeGif(frames, { ...LOGICAL, scale: 2, delayMs: ms }));
  console.log(`${name}: ${frames.length} frames`);
}

/** The backdrop colour (#11161c) the tour fades through between its places. */
const BACKDROP = [0x11, 0x16, 0x1c];

/** `steps` frames blending `frame` towards the backdrop (`out`) or from it (`in`). */
function fade(frame, steps, direction) {
  return Array.from({ length: steps }, (_, i) => {
    const t = direction === 'out' ? (i + 1) / (steps + 1) : (steps - i) / (steps + 1);
    const blended = new Uint8Array(frame.length);
    for (let p = 0; p < frame.length; p += 4) {
      for (let c = 0; c < 3; c++)
        blended[p + c] = Math.round(frame[p + c] * (1 - t) + BACKDROP[c] * t);
      blended[p + 3] = 255;
    }
    return blended;
  });
}

/** Clips joined by a short fade through the backdrop. */
function joinClips(clips) {
  return clips.flatMap((clip, i) => [
    ...(i > 0 ? fade(clip[0], 3, 'in') : []),
    ...clip,
    ...(i < clips.length - 1 ? fade(clip.at(-1), 3, 'out') : []),
  ]);
}

/**
 * Marks most species of every habitat identified (research levels 1 to 3, `fullyResearched` at 3), one per habitat
 * only observed and the last one unknown, so the journal looks like a save well into the journey.
 */
function fillJournal(page, fullyResearched = []) {
  return page
    .evaluate(() => localStorage.getItem('slovion.saveToken'))
    .then((token) => {
      const slot = `(select id from save_slots where token_hash = sha256(convert_to('${token}', 'UTF8')))`;
      const rows = [];
      const habitats = readdirSync(join(repo, 'content', 'habitats')).map((file) =>
        JSON.parse(readFileSync(join(repo, 'content', 'habitats', file), 'utf8')),
      );
      for (const habitat of habitats) {
        const ids = habitat.species.map((entry) => entry.speciesId);
        ids.slice(0, -1).forEach((id, i) => {
          const observed = ids.length >= 4 && i === ids.length - 2;
          const level = fullyResearched.includes(id) ? 3 : 1 + (i % 3);
          rows.push(
            `(${slot}, '${id}', 'docs', now() - interval '${i} days', ${observed ? 'null' : `now() - interval '${i} days'`}, '${habitat.id}', ${observed ? 0 : level})`,
          );
        });
      }
      sql(
        `insert into discoveries (save_slot_id, species_id, map_id, observed_at, identified_at, habitat_id, research_level) values ${rows.join(', ')} on conflict do nothing;`,
      );
    });
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

/**
 * A walk in every region in journey order, at the time of day that suits it (minutes past 08:00 on a spring day), along
 * a route that fits world seed 1; `torch` lights the torch first, and `hero` puts the walk in the tour of hero.gif.
 */
const WALKS = [
  {
    region: 'dravsko_polje',
    map: 'dravsko_polje_meadow',
    name: 'Dravsko polje, morning',
    minutes: 60,
    // From the spawn (10, 10) down past the sage at (11, 14), then right; the hare lives at (9, 17).
    route: [
      ['ArrowDown', 5],
      ['ArrowRight', 3],
    ],
    hero: true,
  },
  {
    region: 'kocevje',
    map: 'kocevje_forest',
    name: 'Kočevje, noon',
    minutes: 240,
    // Along the forest path to the clearing.
    route: [['ArrowRight', 9]],
    hero: true,
  },
  {
    region: 'pohorje',
    map: 'pohorje_forest',
    name: 'Pohorje, morning',
    minutes: 30,
    // Along the path to the bend above the bog pool.
    route: [
      ['ArrowRight', 7],
      ['ArrowDown', 1],
    ],
  },
  {
    region: 'triglav',
    map: 'triglav_alps',
    name: 'Triglav, afternoon',
    minutes: 330,
    route: [
      ['ArrowRight', 8],
      ['ArrowDown', 2],
    ],
    hero: true,
  },
  {
    region: 'cerknica',
    map: 'cerknica_lake',
    name: 'Cerkniško jezero, morning',
    minutes: 0,
    // To the end of the path, then down through the meadow towards the shallows.
    route: [
      ['ArrowRight', 7],
      ['ArrowDown', 3],
      ['ArrowRight', 4],
    ],
    hero: true,
  },
  {
    region: 'rakov_skocjan',
    map: 'rakov_skocjan_karst',
    name: 'Rakov Škocjan, evening',
    minutes: 690,
    torch: true,
    route: [['ArrowRight', 12]],
  },
  {
    region: 'ljubljana',
    map: 'ljubljana_park',
    name: 'Ljubljana, evening',
    minutes: 690,
    torch: true,
    // Along the path past the street lamps, by the Ljubljanica.
    route: [
      ['ArrowRight', 8],
      ['ArrowDown', 2],
    ],
  },
  {
    region: 'murska_sobota',
    map: 'murska_sobota_village',
    name: 'Murska Sobota, afternoon',
    minutes: 420,
    // Along the path to the fields and the fish pond.
    route: [
      ['ArrowRight', 6],
      ['ArrowDown', 2],
    ],
  },
  {
    region: 'portoroz',
    map: 'portoroz_coast',
    name: 'Portorož, afternoon',
    minutes: 300,
    // Along the path, then down to the beach.
    route: [
      ['ArrowRight', 8],
      ['ArrowDown', 3],
    ],
    hero: true,
  },
];

/** Frames (100 ms each) of every place in the hero tour. */
const HERO_CLIP_FRAMES = 28;

const scenes = {
  /**
   * The tour: every region's walk. The hero GIF joins five of them by day (meadow, forest, mountains, lake, coast), as
   * the tints of evening and night would band in its single palette; the regions montage shows where each walk ends.
   */
  async tour(browser) {
    const clips = [];
    const images = [];
    for (const walk of WALKS) {
      const page = await newGame(browser, {
        quests: JOURNEY,
        minutes: walk.minutes,
        region: walk.region,
        clearSky: walk.map,
      });
      if (walk.torch) await page.keyboard.press('KeyL');
      await startRecording(page);
      await page.waitForTimeout(400);
      for (const [key, times] of walk.route) await keys(page, key, times);
      await page.waitForTimeout(600);
      const frames = await stopRecording(page);
      // The tour shows each place briefly, so hero.gif stays a few megabytes.
      if (walk.hero) clips.push(frames.slice(0, HERO_CLIP_FRAMES));
      images.push([walk.name, await canvasImage(page)]);
      await page.close();
    }
    writeGif('hero.gif', joinClips(clips));

    const page = await browser.newPage({ viewport: { width: 3 * 488 + 8, height: 600 } });
    await page.setContent(`<body style="margin:0;padding:4px;background:#11161c;font:16px sans-serif;color:#e8efe4">
      <div style="display:grid;grid-template-columns:repeat(3,480px);gap:8px">
      ${images.map(([n, src]) => `<figure style="margin:0"><img src="${src}" width="480" height="270" style="image-rendering:pixelated;display:block"><figcaption style="padding:4px 2px 0">${n}</figcaption></figure>`).join('')}
      </div></body>`);
    await page.screenshot({ path: join(out, 'regions.png'), fullPage: true });
    await page.close();
  },

  /**
   * Observing the meadow sage, then Terenski dnevnik of a save well into the journey: the wetland page and the fully
   * researched page of the white water lily.
   */
  async journal(browser) {
    const page = await newGame(browser, { minutes: 60 });
    // Seed 1's sage grows at (11, 14): from the spawn (10, 10), one step right, then down until it is ahead.
    await keys(page, 'ArrowRight');
    await keys(page, 'ArrowDown', 3);
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
    await fillJournal(page, ['nymphaea_alba']);
    await page.keyboard.press('KeyM');
    const journal = page.getByRole('dialog', { name: 'Terenski dnevnik' });
    await journal.waitFor();
    await journal.locator('.index__habitat[data-habitat="wetland"]').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, 'journal.png') });
    await journal.locator('.picture[data-species="nymphaea_alba"]').first().click();
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

  /** Ljubljana at night: the street lamps and the torch. */
  async night(browser) {
    const page = await newGame(browser, { quests: JOURNEY, minutes: 870, region: 'ljubljana' });
    await page.keyboard.press('KeyL');
    await startRecording(page);
    await page.waitForTimeout(600);
    await keys(page, 'ArrowRight', 10);
    await page.waitForTimeout(600);
    writeGif('night.gif', await stopRecording(page));
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
    // Generated per save (D13): with the docs' fixed world seed 1, the cave floor beside its pool.
    await keys(page, 'ArrowRight', 18);
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
    // Seed 1: into the yard beside the farmhouse, facing the chimney at (8, 1).
    await keys(page, 'ArrowUp', 6);
    await keys(page, 'ArrowRight', 4);
    await keys(page, 'ArrowUp', 2);
    await keys(page, 'ArrowRight', 2);
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
    // Seed 1: down into the shallows, then swim east to the pen shell at (22, 15).
    await keys(page, 'ArrowDown', 6);
    await keys(page, 'ArrowRight', 20);
    await page.waitForTimeout(800);
    writeGif('snorkel.gif', await stopRecording(page));
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
