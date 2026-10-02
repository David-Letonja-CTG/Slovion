import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import sl from '../../../public/i18n/sl.json';
import { GameSession } from '../session/game-session';
import { SaveTokenStore } from '../session/save-token-store';
import {
  HARE_OBSERVED,
  SAGE_ENCOUNTER,
  SAGE_ENTRY,
  sageAnswer,
  settle,
  setupTestApp,
} from '../testing/test-app';

const MAP_URL = '/content/maps/dravsko_polje_meadow.json';
const SAGE = { kind: 'spot', mapId: 'dravsko_polje_meadow', spotId: 'meadow_sage_1' } as const;

async function openPlay(mapResponse: object | 404 = meadow) {
  const app = await setupTestApp();
  TestBed.inject(SaveTokenStore).set('play-token');
  TestBed.inject(GameSession).active.set(true);

  const harness = await RouterTestingHarness.create('/play');
  const map = app.http.expectOne(MAP_URL);
  if (mapResponse === 404) {
    map.flush(null, { status: 404, statusText: 'Not Found' });
  } else {
    map.flush(mapResponse);
  }
  await settle(harness.fixture);

  const root = () => harness.routeNativeElement as HTMLElement;
  const dialogText = () => root().querySelector('[role="dialog"]')?.textContent?.trim();
  return { ...app, harness, root, dialogText, settle: () => settle(harness.fixture) };
}

describe('Play screen', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('loads the meadow and its images and hands them to the engine', async () => {
    const { game } = await openPlay();

    expect(game.start).toHaveBeenCalled();
    expect(game.options?.world.map.id).toBe('dravsko_polje_meadow');
    expect(game.options?.world.tileset).toEqual({ url: '/content/tilesets/meadow.png' });
    expect(game.options?.world.playerSprite).toEqual({ url: '/sprites/player.png' });
  });

  it('shows the controls hint', async () => {
    const { root } = await openPlay();

    expect(root().querySelector('.play__hint')?.textContent).toBe(sl.play.controlsHint);
  });

  it.each([
    ['cannot be fetched', 404 as const],
    ['is invalid', { orientation: 'isometric' }],
  ])('shows an error message when the map %s', async (_, response) => {
    const { root, game } = await openPlay(response);

    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.map);
    expect(game.start).not.toHaveBeenCalled();
  });
});

describe('Identification flow', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const START = '/api/save/encounters';
  const ANSWER = `/api/save/encounters/${SAGE_ENCOUNTER.encounterId}/identification`;

  /** Interacts with the sage spot and opens the identification dialog. */
  async function openEncounter() {
    const play = await openPlay();
    play.game.options!.onInteract(SAGE);
    play.http.expectOne(START).flush(SAGE_ENCOUNTER, { status: 201, statusText: 'Created' });
    await play.settle();
    const optionButton = (text: string) =>
      [...play.root().querySelectorAll<HTMLButtonElement>('app-identification-dialog button')].find(
        (button) => button.textContent?.trim() === text,
      );
    return { ...play, optionButton };
  }

  it('blocks world input as soon as the player interacts', async () => {
    const { game, http } = await openPlay();

    game.options!.onInteract(SAGE);

    expect(game.consumer).toBe('ui');
    const request = http.expectOne(START);
    expect(request.request.body).toEqual({ mapId: SAGE.mapId, spotId: SAGE.spotId });
    request.flush(SAGE_ENCOUNTER, { status: 201, statusText: 'Created' });
  });

  it('opens the identification dialog with the first clue and the candidates', async () => {
    const { root } = await openEncounter();
    const dialog = root().querySelector('app-identification-dialog');

    expect(dialog?.querySelector('h2')?.textContent?.trim()).toBe(sl.identification.heading.plant);
    expect(dialog?.textContent).toContain('Cvetovi so modri do vijolični.');
    expect(dialog?.textContent).toContain('navadni regrat');
  });

  it('announces a new entry after a correct answer', async () => {
    const { http, optionButton, dialogText, settle: wait } = await openEncounter();

    optionButton('travniška kadulja')!.click();
    const answer = http.expectOne(ANSWER);
    expect(answer.request.body).toEqual({ speciesId: 'salvia_pratensis' });
    answer.flush(sageAnswer(true));
    await wait();

    expect(dialogText()).toContain('Pravilno! Nov vnos v Terenskem dnevniku: travniška kadulja');
  });

  it('names the species after a wrong answer', async () => {
    const { http, optionButton, dialogText, settle: wait } = await openEncounter();

    optionButton('poljski zajec')!.click();
    http.expectOne(ANSWER).flush(sageAnswer(false));
    await wait();

    expect(dialogText()).toContain(
      'Žal ne – to je bila vrsta travniška kadulja. Opazuj jo znova in jo prepoznaj.',
    );
  });

  it('forwards keyboard input to the dialog', async () => {
    const { game, http, settle: wait } = await openEncounter();

    game.pressUi('MoveDown'); // from "Nov namig" to the first candidate
    game.pressUi('Confirm');
    await wait();

    expect(http.expectOne(ANSWER).request.body).toEqual({ speciesId: 'lepus_europaeus' });
  });

  it('leaves the encounter with Cancel without answering', async () => {
    const { game, http, root, settle: wait } = await openEncounter();

    game.pressUi('Cancel');
    await wait();

    http.expectNone(ANSWER);
    expect(root().querySelector('[role="dialog"]')).toBeNull();
    expect(game.consumer).toBe('world');
  });

  it('says when the species is already identified', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http.expectOne(START).flush({ alreadyIdentified: true, entry: SAGE_ENTRY });
    await wait();

    expect(dialogText()).toContain(
      'Ta vrsta je že zapisana v Terenskem dnevniku: travniška kadulja',
    );
  });

  it.each(['Confirm', 'Cancel'] as const)(
    'closes the result with %s and gives input back to the world',
    async (action) => {
      const { game, http, optionButton, root, settle: wait } = await openEncounter();
      optionButton('travniška kadulja')!.click();
      http.expectOne(ANSWER).flush(sageAnswer(true));
      await wait();

      game.pressUi(action);
      await wait();

      expect(root().querySelector('[role="dialog"]')).toBeNull();
      expect(game.consumer).toBe('world');
    },
  );

  it('ignores movement while a message is open', async () => {
    const { game, http, optionButton, root, settle: wait } = await openEncounter();
    optionButton('travniška kadulja')!.click();
    http.expectOne(ANSWER).flush(sageAnswer(true));
    await wait();

    game.pressUi('MoveUp');
    await wait();

    expect(root().querySelector('[role="dialog"]')).not.toBeNull();
    expect(game.consumer).toBe('ui');
  });

  it('shows a network error and lets the player try again', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http.expectOne(START).error(new ProgressEvent('error'), { status: 0 });
    await wait();
    expect(dialogText()).toContain(sl.errors.network);

    game.pressUi('Confirm');
    await wait();
    expect(game.consumer).toBe('world');
  });

  it('explains an encounter that is no longer valid', async () => {
    const { http, optionButton, dialogText, settle: wait } = await openEncounter();

    optionButton('travniška kadulja')!.click();
    http
      .expectOne(ANSWER)
      .flush({ code: 'unknown_encounter' }, { status: 404, statusText: 'Not Found' });
    await wait();

    expect(dialogText()).toContain(sl.errors.unknown_encounter);
  });

  it('returns to the title screen when the save no longer exists', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http
      .expectOne(START)
      .flush({ code: 'invalid_save_token' }, { status: 401, statusText: 'Unauthorized' });
    await wait();

    expect(TestBed.inject(Router).url).toBe('/');
    // The title screen shows the notice (and consumes it).
    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.invalid_save_token);
    expect(TestBed.inject(GameSession).active()).toBe(false);
    expect(TestBed.inject(SaveTokenStore).get()).toBeNull();
  });
});

describe('Search flow', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const SEARCHES = '/api/save/searches';
  const IN_GRASS = { kind: 'search', mapId: 'dravsko_polje_meadow', x: 12, y: 12 } as const;

  it('blocks world input and asks the server to search the tile', async () => {
    const { game, http } = await openPlay();

    game.options!.onInteract(IN_GRASS);

    expect(game.consumer).toBe('ui');
    const request = http.expectOne({ method: 'POST', url: SEARCHES });
    expect(request.request.body).toEqual({ mapId: 'dravsko_polje_meadow', x: 12, y: 12 });
    request.flush({ found: false });
  });

  it('says when nothing is here and gives input back after closing', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(IN_GRASS);
    http.expectOne(SEARCHES).flush({ found: false });
    await wait();
    expect(dialogText()).toContain(sl.search.nothing);

    game.pressUi('Confirm');
    await wait();
    expect(game.consumer).toBe('world');
  });

  it('opens the identification dialog when something is found', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onInteract(IN_GRASS);
    http
      .expectOne(SEARCHES)
      .flush({ ...SAGE_ENCOUNTER, group: 'mammal' }, { status: 201, statusText: 'Created' });
    await wait();

    const dialog = root().querySelector('app-identification-dialog');
    expect(dialog?.querySelector('h2')?.textContent?.trim()).toBe(sl.identification.heading.mammal);
  });

  it('says when the found species is already recorded', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(IN_GRASS);
    http.expectOne(SEARCHES).flush({ alreadyIdentified: true, entry: SAGE_ENTRY });
    await wait();

    expect(dialogText()).toContain(
      'Ta vrsta je že zapisana v Terenskem dnevniku: travniška kadulja',
    );
  });

  it('explains a tile where searching is not possible', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(IN_GRASS);
    http
      .expectOne(SEARCHES)
      .flush({ code: 'unknown_habitat' }, { status: 404, statusText: 'Not Found' });
    await wait();

    expect(dialogText()).toContain(sl.errors.unknown_habitat);
  });
});

describe('Terenski dnevnik', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  async function openNatureDex(entries = [SAGE_ENTRY]) {
    const play = await openPlay();
    play.game.options!.onOpenMenu!();
    await play.settle();
    play.http.expectOne('/api/save/naturedex').flush({ entries });
    await play.settle();
    const panel = () => play.root().querySelector('app-naturedex-panel');
    return { ...play, panel };
  }

  it('opens from the world and takes input while open', async () => {
    const { game, panel } = await openNatureDex();

    expect(panel()?.querySelector('h2')?.textContent).toBe(sl.naturedex.title);
    expect(game.consumer).toBe('ui');
  });

  it('shows the sourced Slovenian entry', async () => {
    const { panel } = await openNatureDex();
    const entry = panel()!.querySelector('[data-species="salvia_pratensis"]')!;

    expect(entry.querySelector('h3')?.textContent).toBe('travniška kadulja');
    expect(entry.querySelector('i')?.textContent).toBe('Salvia pratensis L.');
    expect(entry.textContent).toContain(sl.naturedex.family);
    expect(entry.textContent).toContain('ustnatice (Lamiaceae)');
    expect(entry.textContent).toContain('Suhi travniki in pašniki.');
    expect(entry.textContent).toContain('Zraste od 30 do 60 cm visoko.');
    expect(entry.textContent).toContain(sl.naturedex.sources);
    const source = entry.querySelector('.entry__sources li');
    expect(source?.textContent).toContain('Travniška kadulja');
    expect(source?.textContent).toContain('Notranjski regijski park');
  });

  it('shows an observed species as unknown, with its group but without its name', async () => {
    const { panel } = await openNatureDex([HARE_OBSERVED]);
    const entry = panel()!.querySelector('[data-species="lepus_europaeus"]')!;

    expect(entry.querySelector('h3')?.textContent).toBe(sl.naturedex.unknown);
    expect(entry.textContent).toContain(sl.species.group.mammal);
    expect(entry.textContent).toContain(sl.naturedex.observeAgain);
    expect(entry.textContent).not.toContain('poljski zajec');
    expect(entry.querySelector('.entry__sources')).toBeNull();
  });

  it('labels facts by the species group', async () => {
    const swallowtail = {
      ...SAGE_ENTRY,
      speciesId: 'papilio_machaon',
      group: 'insect' as const,
    };
    const { panel } = await openNatureDex([SAGE_ENTRY, swallowtail]);
    const labels = (id: string) =>
      [...panel()!.querySelectorAll(`[data-species="${id}"] dt`)].map((dt) => dt.textContent);

    expect(labels('salvia_pratensis')).toContain(sl.naturedex.season.plant);
    expect(labels('salvia_pratensis')).toContain(sl.naturedex.habitat.plant);
    expect(labels('papilio_machaon')).toContain(sl.naturedex.season.insect);
    expect(labels('papilio_machaon')).toContain(sl.naturedex.habitat.insect);
  });

  it('encourages exploring when nothing is discovered yet', async () => {
    const { panel } = await openNatureDex([]);

    expect(panel()?.querySelector('.naturedex__empty')?.textContent).toBe(sl.naturedex.empty);
  });

  it('closes with Cancel only and gives input back to the world', async () => {
    const { game, panel, settle: wait } = await openNatureDex();

    game.pressUi('Confirm');
    await wait();
    expect(panel()).not.toBeNull();

    game.pressUi('Cancel');
    await wait();
    expect(panel()).toBeNull();
    expect(game.consumer).toBe('world');
  });
});
