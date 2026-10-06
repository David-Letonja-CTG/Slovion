import { Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import karst from '../../engine/testing/maps/rakov_skocjan_karst.json';
import kocevje from '../../engine/testing/maps/kocevje_forest.json';
import meadow from '../../engine/testing/maps/dravsko_polje_meadow.json';
import sl from '../../../public/i18n/sl.json';
import { Action, UPRIGHT_VIEWS, WIDE_VIEW, worldTimeAt } from '../../engine';
import {
  NatureDexEntry,
  NatureDexSection,
  NatureDexSlot,
  PlayerProgress,
  QuestInfo,
  RegionsInfo,
  StationInfo,
} from '../api/game-api';
import { AudioService } from '../audio/audio.service';
import { FakeAudioService } from '../audio/testing/fake-audio-service';
import { Fullscreen } from '../device/fullscreen';
import { PORTRAIT } from '../device/portrait';
import { TOUCH_DEVICE } from '../device/touch-device';
import { GameSession } from '../session/game-session';
import { SaveTokenStore } from '../session/save-token-store';
import {
  HARE_OBSERVED,
  REGIONS,
  SAGE_ENCOUNTER,
  SAGE_ENTRY,
  sageAnswer,
  settle,
  setupTestApp,
} from '../testing/test-app';

const SAGE = { kind: 'spot', mapId: 'dravsko_polje_meadow', spotId: 'meadow_sage_1' } as const;

const LAMP = { itemId: 'lamp', name: 'svetilka', description: 'Ponoči osvetli okolico.' };
const BINOCULARS = {
  itemId: 'binoculars',
  name: 'daljnogled',
  description: 'Živali prepoznaš tudi do tri polja daleč.',
};
const NO_PROGRESS: PlayerProgress = { flags: [], quests: [], items: [LAMP] };
const RESIDENTS = [
  { spotId: 'meadow_hare_1', speciesId: 'lepus_europaeus', torch: 'curious', present: true },
];
const AREA_NAMES: Record<string, string> = {
  meadow: 'Travnik na Dravskem polju',
  south_hedgerow: 'Južna mejica',
  kocevje_forest: 'Kočevski gozd',
  rakov_skocjan: 'Rakov Škocjan',
  zelske_jame: 'Zelške jame',
};
/** The meadow's weather on a new save: the period 06:00–11:59, changing at 12:00. */
const CLEAR_MORNING = { weather: 'clear', changesAtMinutes: 720 } as const;

const SPRING_MORNING = {
  minutes: 480,
  day: 1,
  season: 'spring',
  timeOfDay: 'morning',
  gameMinutesPerSecond: 1,
};

/**
 * Opens the play screen in the save's current region; the progress response is a body, or an HTTP status to fail
 * with (0 = network).
 */
async function openPlay(
  mapResponse: object | 404 = meadow,
  progressResponse: PlayerProgress | number = NO_PROGRESS,
  regions: RegionsInfo = REGIONS,
  weather: object | number = CLEAR_MORNING,
  providers: readonly Provider[] = [],
) {
  const app = await setupTestApp({ providers });
  TestBed.inject(SaveTokenStore).set('play-token');
  TestBed.inject(GameSession).active.set(true);

  const harness = await RouterTestingHarness.create('/play');
  app.http.expectOne('/api/save/regions').flush(regions);
  await settle(harness.fixture);
  const current = regions.regions.find((region) => region.regionId === regions.currentRegionId)!;
  app.http.expectOne('/api/save/time').flush(SPRING_MORNING);
  app.http.expectOne((r) => r.url === '/api/save/wildlife').flush({ animals: RESIDENTS });
  const weatherRequest = app.http.expectOne((r) => r.url === '/api/save/weather');
  if (typeof weather === 'number')
    weatherRequest.flush(null, { status: weather, statusText: 'Error' });
  else weatherRequest.flush(weather);
  const progress = app.http.expectOne('/api/save/progress');
  if (typeof progressResponse === 'number' && progressResponse === 0) {
    progress.error(new ProgressEvent('error'), { status: 0 });
  } else if (typeof progressResponse === 'number') {
    progress.flush(
      { code: 'invalid_save_token' },
      { status: progressResponse, statusText: 'Error' },
    );
  } else {
    progress.flush(progressResponse);
  }
  const map = app.http.expectOne(`/api/save/maps/${current.mapId}`);
  if (mapResponse === 404) {
    map.flush(null, { status: 404, statusText: 'Not Found' });
  } else {
    map.flush(mapResponse);
  }
  await settle(harness.fixture);
  // The loader then fetches the names of the map's places.
  for (const request of app.http.match((r) => r.url.startsWith('/content/areas/'))) {
    const id = request.request.url.replace('/content/areas/', '').replace('.json', '');
    request.flush({ id, text: { sl: { name: AREA_NAMES[id] } } });
  }
  await settle(harness.fixture);

  const root = () => harness.routeNativeElement as HTMLElement;
  const dialogText = () => root().querySelector('[role="dialog"]')?.textContent?.trim();
  return { ...app, harness, root, dialogText, settle: () => settle(harness.fixture) };
}

/** Opens the *Več* menu, where sound, mute, fullscreen and the controls hint are. */
async function openMoreMenu(play: Awaited<ReturnType<typeof openPlay>>): Promise<void> {
  play.root().querySelector<HTMLButtonElement>('.play__more-button')!.click();
  await play.settle();
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

  it.each([
    [
      false,
      1,
      'Ta vrsta je že zapisana v Terenskem dnevniku: travniška kadulja. Več izveš, če jo opaziš ob drugem času dneva.',
    ],
    [true, 2, 'Raziskava napreduje: travniška kadulja (2/3). V Terenskem dnevniku je nov zapis.'],
    [false, 3, 'Ta vrsta je v Terenskem dnevniku v celoti raziskana: travniška kadulja'],
  ])(
    'tells how research went when an identified species is seen again (researched %s, level %i)',
    async (researched, level, message) => {
      const { game, http, dialogText, settle: wait } = await openPlay();

      game.options!.onInteract(SAGE);
      http.expectOne(START).flush({
        alreadyIdentified: true,
        researched,
        entry: { ...SAGE_ENTRY, researchLevel: level },
      });
      await wait();

      expect(dialogText()).toContain(message);
    },
  );

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
    http.expectOne(SEARCHES).flush({
      alreadyIdentified: true,
      researched: false,
      entry: { ...SAGE_ENTRY, researchLevel: 1 },
    });
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

  const slot = (speciesId: string, entry: NatureDexEntry | null = null): NatureDexSlot => ({
    speciesId,
    status: entry?.status ?? 'unknown',
    entry,
  });
  /** The meadow's tall grass with the sage identified and the hare as given. */
  const tallGrass = (
    sage: NatureDexEntry | null = SAGE_ENTRY,
    hare: NatureDexEntry | null = null,
  ): NatureDexSection[] => [
    {
      habitatId: 'tall_grass',
      name: 'Visoka trava',
      species: [
        slot('lepus_europaeus', hare),
        slot('alauda_arvensis'),
        slot('papilio_machaon'),
        slot('taraxacum_officinale'),
        slot('salvia_pratensis', sage),
      ],
    },
  ];

  async function openNatureDex(habitats = tallGrass()) {
    const play = await openPlay();
    play.game.options!.onOpenMenu!();
    await play.settle();
    play.http.expectOne('/api/save/naturedex').flush({ habitats });
    await play.settle();
    const panel = () => play.root().querySelector('app-naturedex-panel');
    const picture = (id: string) =>
      panel()!.querySelector<HTMLButtonElement>(`.picture[data-species="${id}"]`)!;
    const label = (id: string) => picture(id).querySelector('.picture__label')?.textContent?.trim();
    const page = () => panel()!.querySelector('article.entry');
    const press = async (...actions: Action[]) => {
      for (const action of actions) play.game.pressUi(action);
      await play.settle();
    };
    return { ...play, panel, picture, label, page, press };
  }

  it('opens from the world and takes input while open', async () => {
    const { game, panel } = await openNatureDex();

    expect(panel()?.querySelector('h2')?.textContent).toBe(sl.naturedex.title);
    expect(game.consumer).toBe('ui');
  });

  it('shows each habitat with its name and how many of its species are identified', async () => {
    const { panel } = await openNatureDex();
    const heading = panel()!.querySelector('h3[data-habitat="tall_grass"]')!;

    expect(heading.textContent).toContain('Visoka trava');
    expect(heading.querySelector('.habitat__count')?.textContent?.trim()).toBe('1/5');
  });

  describe('pages', () => {
    /** The tall grass, then a hedgerow with both species identified. */
    const twoHabitats = (): NatureDexSection[] => [
      ...tallGrass(),
      {
        habitatId: 'hedgerow',
        name: 'Mejica',
        species: [
          slot('crataegus_monogyna', { ...SAGE_ENTRY, status: 'identified' }),
          slot('lanius_collurio', { ...SAGE_ENTRY, status: 'identified' }),
        ],
      },
    ];
    const shownHabitat = (panel: () => Element | null) =>
      panel()!.querySelector('.habitat__grid')?.getAttribute('data-habitat');
    const habitatInIndex = (panel: () => Element | null, id: string) =>
      panel()!.querySelector<HTMLButtonElement>(`.index__habitat[data-habitat="${id}"]`)!;

    it('shows one habitat at a time, the first when the journal opens', async () => {
      const { panel } = await openNatureDex(twoHabitats());

      expect(shownHabitat(panel)).toBe('tall_grass');
      expect(panel()!.querySelectorAll('.picture')).toHaveLength(5);
      expect(panel()!.querySelector('.picture[data-species="crataegus_monogyna"]')).toBeNull();
    });

    it('lists every habitat in the index with its progress, marks the one shown and finished ones', async () => {
      const { panel } = await openNatureDex(twoHabitats());
      const index = panel()!.querySelector('nav.naturedex__index')!;

      expect(index.getAttribute('aria-label')).toBe(sl.naturedex.habitats);
      expect(habitatInIndex(panel, 'tall_grass').textContent).toMatch(/Visoka trava\s*1\/5/);
      expect(habitatInIndex(panel, 'tall_grass').getAttribute('aria-current')).toBe('page');
      expect(habitatInIndex(panel, 'hedgerow').getAttribute('aria-current')).toBeNull();
      expect(habitatInIndex(panel, 'hedgerow').classList).toContain('index__habitat--complete');
      expect(habitatInIndex(panel, 'tall_grass').classList).not.toContain(
        'index__habitat--complete',
      );
    });

    it('shows a habitat chosen in the index, with its first picture selected', async () => {
      const { panel, picture, settle } = await openNatureDex(twoHabitats());

      habitatInIndex(panel, 'hedgerow').click();
      await settle();

      expect(shownHabitat(panel)).toBe('hedgerow');
      expect(habitatInIndex(panel, 'hedgerow').getAttribute('aria-current')).toBe('page');
      expect(picture('crataegus_monogyna').classList).toContain('picture--selected');
      expect(document.activeElement).toBe(picture('crataegus_monogyna'));
    });

    it('turns pages with the buttons, which stop at the first and last habitat', async () => {
      const { panel, settle } = await openNatureDex(twoHabitats());
      const flip = (which: string) =>
        panel()!.querySelector<HTMLButtonElement>(`[data-flip="${which}"]`)!;
      expect(flip('previous').disabled).toBe(true);
      expect(flip('previous').getAttribute('aria-label')).toBe(sl.naturedex.previousHabitat);

      flip('next').click();
      await settle();

      expect(shownHabitat(panel)).toBe('hedgerow');
      expect(flip('next').disabled).toBe(true);
      expect(flip('next').getAttribute('aria-label')).toBe(sl.naturedex.nextHabitat);
      expect(panel()!.querySelectorAll('.mark--shown')).toHaveLength(1);
      expect(panel()!.querySelectorAll('.mark')[1].classList).toContain('mark--shown');
    });

    it('turns the page with the arrows past the last and first picture', async () => {
      const { panel, picture, press } = await openNatureDex(twoHabitats());

      await press('MoveRight', 'MoveRight', 'MoveRight', 'MoveRight', 'MoveRight');
      expect(shownHabitat(panel)).toBe('hedgerow');
      expect(picture('crataegus_monogyna').classList).toContain('picture--selected');

      await press('MoveLeft');
      expect(shownHabitat(panel)).toBe('tall_grass');
      expect(picture('salvia_pratensis').classList).toContain('picture--selected');

      await press('MoveDown');
      expect(shownHabitat(panel)).toBe('hedgerow');
    });
  });

  it('shows unknown species as silhouettes, observed ones grey and identified ones in colour', async () => {
    const { picture } = await openNatureDex(tallGrass(SAGE_ENTRY, HARE_OBSERVED));

    expect(picture('alauda_arvensis').classList).toContain('picture--unknown');
    expect(picture('lepus_europaeus').classList).toContain('picture--observed');
    expect(picture('salvia_pratensis').classList).toContain('picture--identified');
    expect(picture('salvia_pratensis').querySelector('img')?.getAttribute('src')).toBe(
      '/content/species-pictures/salvia_pratensis.png',
    );
  });

  it('labels identified species by name and every other species with ???', async () => {
    const { picture, label } = await openNatureDex(tallGrass(SAGE_ENTRY, HARE_OBSERVED));

    expect(label('salvia_pratensis')).toBe('travniška kadulja');
    expect(label('lepus_europaeus')).toBe(sl.naturedex.unknownLabel);
    expect(label('alauda_arvensis')).toBe(sl.naturedex.unknownLabel);
    expect(picture('salvia_pratensis').getAttribute('aria-label')).toBe(
      'travniška kadulja – Raziskano: 3/3',
    );
    expect(picture('salvia_pratensis').querySelector('.picture__stars')?.textContent?.trim()).toBe(
      '★★★',
    );
    expect(picture('lepus_europaeus').querySelector('.picture__stars')).toBeNull();
    expect(picture('lepus_europaeus').getAttribute('aria-label')).toBe(sl.naturedex.unknown);
    expect(picture('alauda_arvensis').getAttribute('aria-disabled')).toBe('true');
  });

  it('selects and focuses the first picture when it opens', async () => {
    const { picture } = await openNatureDex();

    expect(picture('lepus_europaeus').classList).toContain('picture--selected');
    expect(document.activeElement).toBe(picture('lepus_europaeus'));
  });

  it('opens the sourced page of an identified species', async () => {
    const { picture, page, settle: wait } = await openNatureDex();

    picture('salvia_pratensis').click();
    await wait();

    const entry = page()!;
    expect(entry.getAttribute('data-species')).toBe('salvia_pratensis');
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

  it('shows the research level and leaves out facts research has not revealed yet', async () => {
    const levelOne: NatureDexEntry = {
      ...SAGE_ENTRY,
      researchLevel: 1,
      species: { ...SAGE_ENTRY.species!, habitat: null, distribution: null, season: null },
    };
    const { picture, page, settle: wait } = await openNatureDex(tallGrass(levelOne));

    expect(picture('salvia_pratensis').querySelector('.picture__stars')?.textContent?.trim()).toBe(
      '★☆☆',
    );
    picture('salvia_pratensis').click();
    await wait();

    const entry = page()!;
    expect(entry.querySelector('.entry__research')?.textContent).toContain('Raziskano: 1/3');
    expect(entry.querySelector('.entry__hint')?.textContent).toBe(sl.naturedex.researchHint);
    expect(entry.textContent).toContain('Zraste od 30 do 60 cm visoko.');
    expect(entry.textContent).not.toContain(sl.naturedex.habitat.plant);
    expect(entry.textContent).not.toContain(sl.naturedex.distribution);
    expect(entry.textContent).not.toContain(sl.naturedex.season.plant);
  });

  it('shows no research hint once a species is fully researched', async () => {
    const { picture, page, settle: wait } = await openNatureDex();

    picture('salvia_pratensis').click();
    await wait();

    expect(page()!.querySelector('.entry__research')?.textContent).toContain('Raziskano: 3/3');
    expect(page()!.querySelector('.entry__hint')).toBeNull();
  });

  it('opens an observed species as unknown, with its group but without its name', async () => {
    const { picture, page, settle: wait } = await openNatureDex(tallGrass(null, HARE_OBSERVED));

    picture('lepus_europaeus').click();
    await wait();

    const entry = page()!;
    expect(entry.querySelector('h3')?.textContent).toBe(sl.naturedex.unknown);
    expect(entry.textContent).toContain(sl.species.group.mammal);
    expect(entry.textContent).toContain(sl.naturedex.observeAgain);
    expect(entry.textContent).not.toContain('poljski zajec');
    expect(entry.querySelector('.entry__sources')).toBeNull();
  });

  it('opens nothing for an unknown species', async () => {
    const { picture, page, settle: wait } = await openNatureDex();

    picture('alauda_arvensis').click();
    await wait();

    expect(page()).toBeNull();
  });

  it('labels facts by the species group', async () => {
    const swallowtail = { ...SAGE_ENTRY, speciesId: 'papilio_machaon', group: 'insect' as const };
    const habitats = tallGrass();
    habitats[0] = {
      ...habitats[0],
      species: habitats[0].species.map((s) =>
        s.speciesId === 'papilio_machaon' ? slot('papilio_machaon', swallowtail) : s,
      ),
    };
    const { picture, page, settle: wait } = await openNatureDex(habitats);
    const labels = () => [...page()!.querySelectorAll('dt')].map((dt) => dt.textContent);

    picture('papilio_machaon').click();
    await wait();

    expect(labels()).toContain(sl.naturedex.season.insect);
    expect(labels()).toContain(sl.naturedex.habitat.insect);
  });

  it('moves the selection with the arrow keys and opens with Confirm', async () => {
    const { picture, page, press } = await openNatureDex();

    await press('MoveRight', 'MoveRight', 'MoveRight', 'MoveRight');
    expect(picture('salvia_pratensis').classList).toContain('picture--selected');
    expect(document.activeElement).toBe(picture('salvia_pratensis'));

    await press('Confirm');
    expect(page()?.getAttribute('data-species')).toBe('salvia_pratensis');
  });

  it('keeps the selection at the first picture when moving left', async () => {
    const { picture, press } = await openNatureDex();

    await press('MoveLeft');

    expect(picture('lepus_europaeus').classList).toContain('picture--selected');
  });

  it('goes back to the grid with Cancel, then closes and gives input back to the world', async () => {
    const { game, panel, picture, page, press } = await openNatureDex();

    picture('salvia_pratensis').click();
    await press('Cancel');
    expect(page()).toBeNull();
    expect(panel()).not.toBeNull();
    expect(document.activeElement).toBe(picture('salvia_pratensis'));

    await press('Cancel');
    expect(panel()).toBeNull();
    expect(game.consumer).toBe('world');
  });

  it('returns to the grid with the back button', async () => {
    const { picture, page, settle: wait } = await openNatureDex();

    picture('salvia_pratensis').click();
    await wait();
    page()!.querySelector<HTMLButtonElement>('.entry__back')!.click();
    await wait();

    expect(page()).toBeNull();
  });

  it('ignores Confirm on an unknown species', async () => {
    const { panel, page, press } = await openNatureDex();

    await press('MoveRight', 'Confirm');

    expect(page()).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('encourages exploring above a grid of silhouettes when nothing is discovered yet', async () => {
    const { panel } = await openNatureDex(tallGrass(null));

    expect(panel()?.querySelector('.naturedex__empty')?.textContent).toBe(sl.naturedex.empty);
    expect(panel()!.querySelectorAll('.picture--unknown')).toHaveLength(5);
  });

  it('has no encouragement once something is discovered', async () => {
    const { panel } = await openNatureDex();

    expect(panel()?.querySelector('.naturedex__empty')).toBeNull();
  });
});

describe('Quests', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const TALK = '/api/save/conversations';
  const VERA = { kind: 'npc', mapId: 'dravsko_polje_meadow', npcId: 'vera' } as const;
  const quest = (progress: number, status: 'active' | 'completed' = 'active'): QuestInfo => ({
    questId: 'eye_for_nature',
    title: 'Oko za naravo',
    summary: 'Prepoznaj tri vrste.',
    returnHint: 'Vrni se k Veri.',
    status,
    progress,
    goal: 3,
  });
  const conversation = (
    lines: string[],
    flags: string[] = [],
    info = quest(0),
    items = [LAMP],
  ) => ({
    npcName: 'Vera',
    lines,
    quest: info,
    flags,
    items,
  });

  it('starts the world with the flags of the loaded progress', async () => {
    const { game } = await openPlay(meadow, {
      flags: ['hedgerow_open'],
      quests: [],
      items: [LAMP],
    });

    expect(game.options?.openFlags).toEqual(['hedgerow_open']);
  });

  it('shows no tracker before a quest is started', async () => {
    const { root } = await openPlay();

    expect(root().querySelector('app-quest-tracker')).toBeNull();
  });

  it('tracks an active quest with its title and progress', async () => {
    const { root } = await openPlay(meadow, { flags: [], quests: [quest(1)], items: [LAMP] });
    const tracker = root().querySelector('app-quest-tracker')!;

    expect(tracker.textContent).toContain('Oko za naravo');
    expect(tracker.querySelector('.tracker__progress')?.textContent?.trim()).toBe('1/3');
  });

  it('folds the quest summary away and back with a click on its title', async () => {
    const { root, settle } = await openPlay(meadow, {
      flags: [],
      quests: [quest(1)],
      items: [LAMP],
    });
    const details = root().querySelector<HTMLDetailsElement>('app-quest-tracker details')!;
    const head = details.querySelector<HTMLElement>('summary')!;
    expect(details.open).toBe(true);
    expect(head.querySelector('.tracker__progress')).not.toBeNull();

    head.click();
    await settle();
    expect(details.open).toBe(false);

    head.click();
    await settle();
    expect(details.open).toBe(true);
  });

  it('says to return to the giver once the goal is met', async () => {
    const { root } = await openPlay(meadow, { flags: [], quests: [quest(3)], items: [LAMP] });

    expect(root().querySelector('.tracker__hint')?.textContent?.trim()).toBe('Vrni se k Veri.');
  });

  it('hides completed quests', async () => {
    const { root } = await openPlay(meadow, {
      flags: ['hedgerow_open'],
      quests: [quest(3, 'completed')],
      items: [LAMP],
    });

    expect(root().querySelector('app-quest-tracker')).toBeNull();
  });

  it('does not start without progress when the server is unreachable', async () => {
    const { game, root } = await openPlay(meadow, 0);

    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.network);
    expect(game.options).toBeUndefined();
  });

  it('returns to the title screen when the save is gone', async () => {
    await openPlay(meadow, 401);

    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('talks to Vera one line at a time and opens the gate when the box closes', async () => {
    const {
      game,
      http,
      root,
      dialogText,
      settle: wait,
    } = await openPlay(meadow, {
      flags: [],
      quests: [quest(3)],
      items: [LAMP],
    });

    game.options!.onInteract(VERA);
    expect(game.consumer).toBe('ui');
    const request = http.expectOne({ method: 'POST', url: TALK });
    expect(request.request.body).toEqual({ mapId: 'dravsko_polje_meadow', npcId: 'vera' });
    request.flush(
      conversation(['Odlično!', 'Vrata so odprta.'], ['hedgerow_open'], quest(3, 'completed')),
    );
    await wait();

    expect(root().querySelector('#dialogue-name')?.textContent).toBe('Vera');
    expect(dialogText()).toContain('Odlično!');
    expect(game.openFlags).toEqual([]);

    game.pressUi('Confirm');
    await wait();
    expect(dialogText()).toContain('Vrata so odprta.');

    game.pressUi('Confirm');
    await wait();
    expect(root().querySelector('app-dialogue-box')).toBeNull();
    expect(game.consumer).toBe('world');
    expect(game.openFlags).toEqual(['hedgerow_open']);
    expect(root().querySelector('app-quest-tracker')).toBeNull(); // the quest is completed
  });

  it('starts tracking a quest Vera offers', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onInteract(VERA);
    http.expectOne(TALK).flush(conversation(['Živijo!']));
    await wait();
    game.pressUi('Cancel');
    await wait();

    expect(root().querySelector('.tracker__progress')?.textContent?.trim()).toBe('0/3');
  });

  it('skips the rest of the dialogue with Cancel', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onInteract(VERA);
    http.expectOne(TALK).flush(conversation(['Ena.', 'Dva.', 'Tri.']));
    await wait();
    game.pressUi('Cancel');
    await wait();

    expect(root().querySelector('app-dialogue-box')).toBeNull();
    expect(game.consumer).toBe('world');
  });

  it('advances with a click on the button', async () => {
    const { game, http, root, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(VERA);
    http.expectOne(TALK).flush(conversation(['Ena.', 'Dva.']));
    await wait();
    root().querySelector<HTMLButtonElement>('.dialogue__next')!.click();
    await wait();

    expect(dialogText()).toContain('Dva.');
  });

  it('explains when nobody is there', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(VERA);
    http.expectOne(TALK).flush({ code: 'unknown_npc' }, { status: 404, statusText: 'Not Found' });
    await wait();

    expect(dialogText()).toContain(sl.errors.unknown_npc);
  });

  /** Identifies the sage, then answers the progress reload with `reload` (a status to fail with). */
  async function identifyWithProgress(reload: PlayerProgress | number) {
    const play = await openPlay(meadow, { flags: [], quests: [quest(1)], items: [LAMP] });
    play.game.options!.onInteract(SAGE);
    play.http
      .expectOne('/api/save/encounters')
      .flush(SAGE_ENCOUNTER, { status: 201, statusText: 'Created' });
    await play.settle();
    play.root().querySelector<HTMLButtonElement>('[data-kind="candidate"]')!.click();
    play.http
      .expectOne(`/api/save/encounters/${SAGE_ENCOUNTER.encounterId}/identification`)
      .flush(sageAnswer(true));
    await play.settle();
    const progress = play.http.expectOne('/api/save/progress');
    if (typeof reload === 'number') progress.flush(null, { status: reload, statusText: 'Error' });
    else progress.flush(reload);
    await play.settle();
    return play.root().querySelector('.tracker__progress')?.textContent?.trim();
  }

  it('moves the tracker on after a correct identification, as the server reports', async () => {
    expect(await identifyWithProgress({ flags: [], quests: [quest(2)], items: [LAMP] })).toBe(
      '2/3',
    );
  });

  it('keeps the tracker when the identified species does not count for the quest', async () => {
    expect(await identifyWithProgress({ flags: [], quests: [quest(1)], items: [LAMP] })).toBe(
      '1/3',
    );
  });

  it('keeps the tracker when the progress cannot be reloaded', async () => {
    expect(await identifyWithProgress(500)).toBe('1/3');
  });
});

describe('World conditions', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const now = (root: () => HTMLElement) =>
    root().querySelector('.conditions__now')?.textContent?.replace(/\s+/g, ' ').trim();
  const location = (root: () => HTMLElement) =>
    root().querySelector('.conditions__location')?.textContent?.trim();
  const banners = (root: () => HTMLElement) =>
    [...root().querySelectorAll('app-location-banner')].map((b) => b.textContent?.trim());

  it('starts the game with the save clock and shows season, time of day and clock', async () => {
    const { game, root } = await openPlay();

    expect(game.options?.worldTime).toMatchObject({ minutes: 480, gameMinutesPerSecond: 1 });
    expect(now(root)).toBe('Pomlad · jutro · 08:00 · jasno');
  });

  it('ticks the clock and updates the conditions as the world reports time', async () => {
    const { game, root, settle: wait } = await openPlay();

    game.options!.onTimeChange!(worldTimeAt(495));
    await wait();
    expect(now(root)).toBe('Pomlad · jutro · 08:15 · jasno');

    game.options!.onTimeChange!(worldTimeAt(4320 + 22 * 60));
    await wait();
    expect(now(root)).toBe('Poletje · noč · 22:00 · jasno'); // the last known weather until the reload answers
  });

  it('re-syncs the clock when the page becomes visible again', async () => {
    const { game, http, settle: wait } = await openPlay();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    document.dispatchEvent(new Event('visibilitychange'));
    http.expectOne('/api/save/time').flush({
      minutes: 13440,
      day: 10,
      season: 'winter',
      timeOfDay: 'morning',
      gameMinutesPerSecond: 1,
    });
    await wait();

    expect(game.worldMinutes).toBe(13440);
  });

  it('shows the place and announces it with a banner', async () => {
    const { game, root, settle: wait } = await openPlay();

    game.options!.onAreaChange!('meadow');
    await wait();

    expect(location(root)).toBe('Travnik na Dravskem polju');
    expect(banners(root)).toEqual(['Travnik na Dravskem polju']);
  });

  it('replaces the banner when the player enters another place', async () => {
    const { game, root, settle: wait } = await openPlay();

    game.options!.onAreaChange!('meadow');
    await wait();
    game.options!.onAreaChange!('south_hedgerow');
    await wait();

    expect(location(root)).toBe('Južna mejica');
    expect(banners(root)).toEqual(['Južna mejica']);
  });

  it('removes the banner once its animation ends', async () => {
    const { game, root, settle: wait } = await openPlay();
    game.options!.onAreaChange!('meadow');
    await wait();

    root().querySelector('.banner')!.dispatchEvent(new Event('animationend'));
    await wait();

    expect(banners(root)).toEqual([]);
  });

  it('switches the torch with the button and shows its state', async () => {
    const { game, root, settle: wait } = await openPlay();
    const button = () => root().querySelector<HTMLButtonElement>('.play__torch')!;
    expect(button().getAttribute('aria-pressed')).toBe('false');

    button().click();
    expect(game.torch).toBe(true);
    game.options!.onTorchChange!(true);
    await wait();

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelector('.play__torch-status')?.textContent?.trim()).toBe(sl.torch.on);
  });

  it('ignores the torch key while a dialog is open', async () => {
    const { game, http, settle: wait } = await openPlay();
    game.options!.onInteract(SAGE);
    http.expectOne('/api/save/encounters').flush({ found: false });
    await wait();

    game.pressUi('Torch');
    await wait();

    expect(game.torch).toBeUndefined();
  });

  it('says to come back later when a spot has nothing right now', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http.expectOne('/api/save/encounters').flush({ found: false });
    await wait();
    expect(dialogText()).toContain(sl.spot.notNow);

    game.pressUi('Cancel');
    await wait();
    expect(game.consumer).toBe('world');
  });
});

describe('Resident animals', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('starts the game with the residents of the map', async () => {
    const { game } = await openPlay();

    expect(game.options?.residents).toEqual(RESIDENTS);
  });

  it('refreshes the residents when the time of day changes', async () => {
    const { game, http, settle: wait } = await openPlay();

    game.options!.onTimeChange!(worldTimeAt(9 * 60 + 59)); // still morning
    http.expectNone((r) => r.url === '/api/save/wildlife');
    game.options!.onTimeChange!(worldTimeAt(10 * 60)); // day
    const request = http.expectOne((r) => r.url === '/api/save/wildlife');
    expect(request.request.params.get('mapId')).toBe('dravsko_polje_meadow');
    request.flush({ animals: [] });
    await wait();

    expect(game.residents).toEqual([]);
  });
});

describe('Weather', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it("starts the game with the region's weather and names it in the indicator", async () => {
    const { game, root } = await openPlay(meadow, NO_PROGRESS, REGIONS, {
      weather: 'rain',
      changesAtMinutes: 720,
    });

    expect(game.options?.weather).toBe('rain');
    expect(root().querySelector('.conditions__weather')?.textContent).toBe(sl.weather.rain);
  });

  it('reloads the weather and then the animals when the weather period ends', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onTimeChange!(worldTimeAt(11 * 60 + 59)); // day: the animals are reloaded, the weather is not
    http.expectNone((r) => r.url === '/api/save/weather');
    http.expectOne((r) => r.url === '/api/save/wildlife').flush({ animals: RESIDENTS });
    game.options!.onTimeChange!(worldTimeAt(12 * 60));
    const request = http.expectOne((r) => r.url === '/api/save/weather');
    expect(request.request.params.get('mapId')).toBe('dravsko_polje_meadow');
    request.flush({ weather: 'fog', changesAtMinutes: 1080 });
    await wait();
    http.expectOne((r) => r.url === '/api/save/wildlife').flush({ animals: [] });
    await wait();

    expect(game.weather).toBe('fog');
    expect(game.residents).toEqual([]);
    expect(root().querySelector('.conditions__weather')?.textContent).toBe(sl.weather.fog);
  });

  it('starts with clear weather when the weather cannot be loaded', async () => {
    const { game, root } = await openPlay(meadow, NO_PROGRESS, REGIONS, 500);

    expect(game.start).toHaveBeenCalled();
    expect(game.options?.weather).toBe('clear');
    expect(root().querySelector('.conditions__weather')).toBeNull();
  });
});

describe('Travel', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const SIGNPOST = { kind: 'signpost', mapId: 'dravsko_polje_meadow' } as const;
  const KOCEVJE = REGIONS.regions[1];

  /** Reads the signpost and answers with the regions. */
  async function openTravelMap(play: Awaited<ReturnType<typeof openPlay>>, regions = REGIONS) {
    play.game.options!.onInteract(SIGNPOST);
    await play.settle();
    expect(play.game.consumer).toBe('ui');
    play.http.expectOne('/api/save/regions').flush(regions);
    await play.settle();
  }

  const entries = (root: () => HTMLElement) =>
    [...root().querySelectorAll<HTMLButtonElement>('.travel__region')].map((entry) => ({
      region: entry.dataset['region'],
      text: [...entry.querySelectorAll('span')].map((part) => part.textContent?.trim()).join(' '),
      disabled: entry.getAttribute('aria-disabled'),
      selected: entry.classList.contains('travel__region--selected'),
    }));

  /** Answers the requests of arriving in Kočevje: time, animals, map and area names. */
  async function arriveInKocevje(play: Awaited<ReturnType<typeof openPlay>>) {
    play.http.expectOne({ method: 'POST', url: '/api/save/travel' }).flush(KOCEVJE);
    await play.settle();
    play.http.expectOne('/api/save/time').flush(SPRING_MORNING);
    const wildlife = play.http.expectOne((r) => r.url === '/api/save/wildlife');
    expect(wildlife.request.params.get('mapId')).toBe('kocevje_forest');
    wildlife.flush({ animals: [] });
    play.http.expectOne((r) => r.url === '/api/save/weather').flush(CLEAR_MORNING);
    play.http.expectOne('/api/save/maps/kocevje_forest').flush(kocevje);
    await play.settle();
    for (const request of play.http.match((r) => r.url.startsWith('/content/areas/'))) {
      request.flush({ text: { sl: { name: 'Kočevski gozd' } } });
    }
    await play.settle();
  }

  it("continues in the save's current region", async () => {
    const { game } = await openPlay(kocevje, NO_PROGRESS, {
      ...REGIONS,
      currentRegionId: 'kocevje',
    });

    expect(game.options?.world.map.id).toBe('kocevje_forest');
  });

  it('opens the travel map at the signpost with every region and what unlocks the locked ones', async () => {
    const play = await openPlay();

    await openTravelMap(play);

    expect(play.root().querySelector('#travel-title')?.textContent).toBe(sl.travel.title);
    expect(play.root().querySelectorAll('.travel__marker')).toHaveLength(4);
    expect(entries(play.root)).toEqual([
      { region: 'dravsko_polje', text: 'Dravsko polje Tukaj si', disabled: 'true', selected: true },
      { region: 'kocevje', text: 'Kočevje Odprto', disabled: 'false', selected: false },
      {
        region: 'pohorje',
        text: 'Pohorje Zaklenjeno Za pot na Pohorje moraš bolje poznati naravo. Prepoznaj še 2 vrsti.',
        disabled: 'true',
        selected: false,
      },
      {
        region: 'triglav',
        text: 'Triglav Zaklenjeno V gore se odpravijo le izkušeni naravoslovci. Prepoznaj še 4 vrste.',
        disabled: 'true',
        selected: false,
      },
    ]);
    expect(document.activeElement?.getAttribute('data-region')).toBe('dravsko_polje');
  });

  it('travels to the selected open region: fades, loads its map and names the place', async () => {
    const play = await openPlay();
    await openTravelMap(play);

    play.game.pressUi('MoveDown');
    await play.settle();
    expect(document.activeElement?.getAttribute('data-region')).toBe('kocevje');
    play.game.pressUi('Confirm');
    await play.settle();

    const travel = play.http.expectOne({ method: 'POST', url: '/api/save/travel' });
    expect(travel.request.body).toEqual({ regionId: 'kocevje' });
    travel.flush(KOCEVJE);
    await play.settle();
    expect(play.root().querySelector('.play__fade--dark')).not.toBeNull();
    play.http.expectOne('/api/save/time').flush(SPRING_MORNING);
    play.http.expectOne((r) => r.url === '/api/save/wildlife').flush({ animals: [] });
    play.http.expectOne((r) => r.url === '/api/save/weather').flush(CLEAR_MORNING);
    play.http.expectOne('/api/save/maps/kocevje_forest').flush(kocevje);
    await play.settle();
    for (const request of play.http.match((r) => r.url.startsWith('/content/areas/'))) {
      request.flush({ text: { sl: { name: 'Kočevski gozd' } } });
    }
    await play.settle();

    expect(play.game.options?.world.map.id).toBe('kocevje_forest');
    expect(play.root().querySelector('[role="dialog"]')).toBeNull();
    expect(play.root().querySelector('.play__fade--dark')).toBeNull();
    expect(play.game.consumer).toBe('world');
    play.game.options!.onAreaChange!('kocevje_forest');
    await play.settle();
    expect(play.root().querySelector('app-location-banner')?.textContent).toBe('Kočevski gozd');
  });

  it('travels when an open region is clicked, and keeps the torch lit', async () => {
    const play = await openPlay();
    play.game.options!.onTorchChange!(true);
    await openTravelMap(play);

    play.root().querySelector<HTMLButtonElement>('[data-region="kocevje"]')!.click();
    await play.settle();
    await arriveInKocevje(play);

    expect(play.game.options?.world.map.id).toBe('kocevje_forest');
    expect(play.game.torch).toBe(true);
  });

  it.each([
    ['a locked region', 2],
    ['the current region', 0],
  ])('does not travel to %s', async (_, downs) => {
    const play = await openPlay();
    await openTravelMap(play);

    for (let i = 0; i < downs; i++) play.game.pressUi('MoveDown');
    play.game.pressUi('Confirm');
    play.root().querySelector<HTMLButtonElement>('[data-region="triglav"]')!.click();
    await play.settle();

    play.http.expectNone('/api/save/travel');
    expect(play.root().querySelector('#travel-title')).not.toBeNull();
  });

  it('closes with Cancel and gives input back to the world', async () => {
    const play = await openPlay();
    await openTravelMap(play);

    play.game.pressUi('Cancel');
    await play.settle();

    expect(play.root().querySelector('#travel-title')).toBeNull();
    expect(play.game.consumer).toBe('world');
  });

  it('shows the regions again when the region was locked meanwhile', async () => {
    const play = await openPlay();
    await openTravelMap(play);
    play.root().querySelector<HTMLButtonElement>('[data-region="kocevje"]')!.click();
    await play.settle();

    play.http
      .expectOne('/api/save/travel')
      .flush({ code: 'region_locked' }, { status: 409, statusText: 'Conflict' });
    await play.settle();
    const locked = { ...KOCEVJE, unlocked: false, lockedHint: 'Pomagaj Veri na Dravskem polju.' };
    play.http
      .expectOne('/api/save/regions')
      .flush({ ...REGIONS, regions: [REGIONS.regions[0], locked] });
    await play.settle();

    expect(entries(play.root).map((entry) => entry.text)).toEqual([
      'Dravsko polje Tukaj si',
      'Kočevje Zaklenjeno Pomagaj Veri na Dravskem polju.',
    ]);
  });

  it('shows the map error when the new region cannot be loaded', async () => {
    const play = await openPlay();
    await openTravelMap(play);
    play.root().querySelector<HTMLButtonElement>('[data-region="kocevje"]')!.click();
    await play.settle();
    play.http.expectOne('/api/save/travel').flush(KOCEVJE);
    await play.settle();
    play.http.expectOne('/api/save/time').flush(SPRING_MORNING);
    play.http.expectOne((r) => r.url === '/api/save/wildlife').flush({ animals: [] });
    play.http.expectOne((r) => r.url === '/api/save/weather').flush(CLEAR_MORNING);
    play.http
      .expectOne('/api/save/maps/kocevje_forest')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await play.settle();

    expect(play.root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.map);
  });
});

describe('Field tools', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const MAGNIFIER = {
    itemId: 'magnifier',
    name: 'povečevalno steklo',
    description: 'Pri rastlinah in žuželkah takoj vidiš dva namiga.',
  };
  const withItems = (...items: (typeof LAMP)[]): PlayerProgress => ({
    flags: [],
    quests: [],
    items,
  });
  const items = (root: () => HTMLElement) =>
    [...root().querySelectorAll('.inventory__item')].map((item) => item.getAttribute('data-item'));

  it("starts the engine with the save's tools", async () => {
    const { game } = await openPlay(meadow, withItems(LAMP, BINOCULARS));

    expect(game.options?.tools).toEqual(['lamp', 'binoculars']);
  });

  it('opens the bag from the Inventory action and closes it with Cancel', async () => {
    const play = await openPlay(meadow, withItems(LAMP, BINOCULARS));

    play.game.options!.onOpenInventory!();
    await play.settle();

    expect(play.root().querySelector('#inventory-title')?.textContent).toBe(sl.inventory.title);
    expect(items(play.root)).toEqual(['lamp', 'binoculars']);
    expect(play.root().querySelector('.inventory__item')?.textContent).toContain(LAMP.description);
    expect(play.game.consumer).toBe('ui');

    play.game.pressUi('Cancel');
    await play.settle();
    expect(play.root().querySelector('#inventory-title')).toBeNull();
    expect(play.game.consumer).toBe('world');
  });

  it('opens the bag from its button and closes it with the Inventory action', async () => {
    const play = await openPlay();

    play.root().querySelector<HTMLButtonElement>('.play__bag')!.click();
    await play.settle();
    expect(items(play.root)).toEqual(['lamp']);

    play.game.pressUi('Inventory');
    await play.settle();
    expect(play.root().querySelector('#inventory-title')).toBeNull();
  });

  it('announces a tool a conversation gives once the dialogue closes', async () => {
    const play = await openPlay();

    play.game.options!.onInteract({ kind: 'npc', mapId: 'dravsko_polje_meadow', npcId: 'vera' });
    play.http.expectOne('/api/save/conversations').flush({
      npcName: 'Vera',
      lines: ['Odlično!'],
      quest: {
        questId: 'eye_for_nature',
        title: 'Oko za naravo',
        summary: '',
        returnHint: '',
        status: 'completed',
        progress: 3,
        goal: 3,
      },
      flags: ['hedgerow_open'],
      items: [LAMP, BINOCULARS],
    });
    await play.settle();
    expect(play.root().querySelector('app-location-banner')).toBeNull();
    play.game.pressUi('Confirm');
    await play.settle();

    expect(play.root().querySelector('app-location-banner')?.textContent).toBe(
      'Novo v nahrbtniku: daljnogled',
    );
    expect(play.game.tools).toEqual(['lamp', 'binoculars']);
  });

  it.each([
    ['a plant with the magnifier', 'plant', [LAMP, MAGNIFIER], 2],
    ['a plant without it', 'plant', [LAMP], 1],
    ['a mammal with the magnifier', 'mammal', [LAMP, MAGNIFIER], 1],
  ] as const)('shows the right number of clues at first for %s', async (_, group, owned, clues) => {
    const play = await openPlay(meadow, withItems(...owned));

    play.game.options!.onInteract({
      kind: 'spot',
      mapId: 'dravsko_polje_meadow',
      spotId: 'meadow_sage_1',
    });
    play.http
      .expectOne('/api/save/encounters')
      .flush({ ...SAGE_ENCOUNTER, group }, { status: 201, statusText: 'Created' });
    await play.settle();

    expect(play.root().querySelectorAll('.identification__clues li')).toHaveLength(clues);
  });
});

describe('Research stations', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const STATIONS = '/api/save/stations';
  const MEADOW_STATION = {
    kind: 'station',
    mapId: 'dravsko_polje_meadow',
    stationId: 'meadow_station',
  } as const;
  const station = (overrides: Partial<StationInfo> = {}): StationInfo => ({
    stationId: 'meadow_station',
    name: 'Raziskovalna postaja na Dravskem polju',
    theme: 'Travniki in mejice',
    mapId: 'dravsko_polje_meadow',
    goal: 3,
    researched: 1,
    met: false,
    species: [
      { speciesId: 'salvia_pratensis', level: 3, name: 'travniška kadulja' },
      { speciesId: 'taraxacum_officinale', level: 1, name: 'navadni regrat' },
      { speciesId: 'crataegus_monogyna', level: 0, name: null },
      { speciesId: 'iris_sibirica', level: 0, name: null },
    ],
    ...overrides,
  });
  const forest = (met: boolean): StationInfo => ({
    stationId: 'forest_station',
    name: 'Raziskovalna postaja v Kočevju',
    theme: 'Gozdna drevesa',
    mapId: 'kocevje_forest',
    goal: 3,
    researched: met ? 3 : 0,
    met,
    species: [
      { speciesId: 'abies_alba', level: met ? 3 : 0, name: met ? 'navadna jelka' : null },
      { speciesId: 'fagus_sylvatica', level: met ? 3 : 0, name: met ? 'navadna bukev' : null },
      { speciesId: 'picea_abies', level: met ? 3 : 0, name: met ? 'navadna smreka' : null },
    ],
  });

  async function openStation(stations: StationInfo[] = [station(), forest(false)]) {
    const play = await openPlay();
    play.game.options!.onInteract(MEADOW_STATION);
    play.http.expectOne(STATIONS).flush({ stations });
    await play.settle();
    const dialog = () => play.root().querySelector('app-station-dialog');
    return { ...play, dialog };
  }

  it('opens a station with its theme, species and progress', async () => {
    const { dialog, game } = await openStation();

    expect(dialog()?.querySelector('h2')?.textContent).toBe(
      'Raziskovalna postaja na Dravskem polju',
    );
    expect(dialog()?.querySelector('.station__theme')?.textContent).toBe('Travniki in mejice');
    expect(dialog()?.querySelector('.station__progress')?.textContent?.trim()).toBe(
      'Popolnoma raziskane vrste: 1 od 3',
    );
    const sage = dialog()!.querySelector('[data-species="salvia_pratensis"]')!;
    expect(sage.querySelector('.station__name')?.textContent).toBe('travniška kadulja');
    expect(sage.querySelector('.station__stars')?.textContent).toBe('★★★');
    const hawthorn = dialog()!.querySelector('[data-species="crataegus_monogyna"]')!;
    expect(hawthorn.classList).toContain('station__picture--unknown');
    expect(hawthorn.querySelector('.station__name')?.textContent).toBe(sl.naturedex.unknown);
    expect(hawthorn.querySelector('.station__stars')).toBeNull();
    expect(dialog()?.querySelector('.station__met')).toBeNull();
    expect(game.consumer).toBe('ui');
  });

  it('says the certificate is in the journal once the goal is met', async () => {
    const { dialog } = await openStation([station({ researched: 3, met: true })]);

    expect(dialog()?.querySelector('.station__met')?.textContent).toBe(sl.station.met);
  });

  it.each(['Cancel', 'Confirm'] as const)(
    'closes the station with %s and gives input back to the world',
    async (action) => {
      const { dialog, game, settle } = await openStation();

      game.pressUi(action);
      await settle();

      expect(dialog()).toBeNull();
      expect(game.consumer).toBe('world');
    },
  );

  it('announces a new certificate after the research message', async () => {
    const play = await openPlay();
    play.game.options!.onInteract(SAGE);
    play.http.expectOne('/api/save/encounters').flush({
      alreadyIdentified: true,
      researched: true,
      entry: { ...SAGE_ENTRY, researchLevel: 3 },
      newCertificates: [
        { stationId: 'meadow_station', name: 'Raziskovalna postaja na Dravskem polju' },
      ],
    });
    await play.settle();
    expect(play.root().querySelector('app-location-banner')).toBeNull();

    play.game.pressUi('Confirm');
    await play.settle();

    expect(play.root().querySelector('app-location-banner')?.textContent).toBe(
      'Novo potrdilo: Raziskovalna postaja na Dravskem polju',
    );
  });

  describe('Certificates in Terenski dnevnik', () => {
    async function openCertificates(stations: StationInfo[]) {
      const play = await openPlay();
      play.game.options!.onOpenMenu!();
      await play.settle();
      play.http.expectOne('/api/save/naturedex').flush({ habitats: [] });
      await play.settle();
      const panel = () => play.root().querySelector('app-naturedex-panel')!;
      panel().querySelector<HTMLButtonElement>('[data-action="certificates"]')!.click();
      await play.settle();
      play.http.expectOne(STATIONS).flush({ stations });
      await play.settle();
      return { ...play, panel };
    }

    it('lists the stations whose goal is met, with their researched species', async () => {
      const { panel } = await openCertificates([station(), forest(true)]);

      const certificates = panel().querySelectorAll('.certificate');
      expect(certificates.length).toBe(1);
      expect(certificates[0].getAttribute('data-station')).toBe('forest_station');
      expect(certificates[0].querySelector('.certificate__theme')?.textContent).toBe(
        'Gozdna drevesa',
      );
      expect(certificates[0].querySelector('.certificate__species')?.textContent).toBe(
        'navadna jelka, navadna bukev, navadna smreka',
      );
    });

    it('explains where certificates come from while there are none', async () => {
      const { panel } = await openCertificates([station(), forest(false)]);

      expect(panel().querySelector('.certificates__empty')?.textContent).toBe(
        sl.naturedex.certificates.empty,
      );
    });

    it('goes back to the grid with Cancel', async () => {
      const { panel, game, settle } = await openCertificates([forest(true)]);

      game.pressUi('Cancel');
      await settle();

      expect(panel().querySelector('.certificates')).toBeNull();
      expect(panel().querySelector('h2')?.textContent).toBe(sl.naturedex.title);
    });
  });
});

describe('Sound', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const IN_GRASS = { kind: 'search', mapId: 'dravsko_polje_meadow', x: 12, y: 12 } as const;
  const VERA = { kind: 'npc', mapId: 'dravsko_polje_meadow', npcId: 'vera' } as const;
  const QUEST_DONE: QuestInfo = {
    questId: 'eye_for_nature',
    title: 'Oko za naravo',
    summary: '',
    returnHint: '',
    status: 'completed',
    progress: 3,
    goal: 3,
  };

  /** The play screen with a recording stand-in for the sound. */
  async function openWithSound(
    map: object = meadow,
    progress: PlayerProgress = NO_PROGRESS,
    regions: RegionsInfo = REGIONS,
    weather: object = CLEAR_MORNING,
  ) {
    const audio = new FakeAudioService();
    const play = await openPlay(map, progress, regions, weather, [
      { provide: AudioService, useValue: audio },
    ]);
    const button = (selector: string) => play.root().querySelector<HTMLButtonElement>(selector);
    return { ...play, audio, button, openMore: () => openMoreMenu(play) };
  }

  it('has no sound buttons where the browser cannot play sound', async () => {
    const play = await openPlay();
    const { root } = play;
    await openMoreMenu(play);

    expect(root().querySelector('.play__menu')).not.toBeNull();
    expect(root().querySelector('.play__sound')).toBeNull();
    expect(root().querySelector('.play__mute')).toBeNull();
  });

  it('plays the scene of the place, the time of day and the weather', async () => {
    const { audio } = await openWithSound(meadow, NO_PROGRESS, REGIONS, {
      weather: 'rain',
      changesAtMinutes: 720,
    });

    expect(audio.scenes.at(-1)).toEqual({
      mapId: 'dravsko_polje_meadow',
      timeOfDay: 'morning',
      weather: 'rain',
      underground: false,
    });
  });

  it('follows the player into an underground area and out again', async () => {
    const karstRegion = {
      ...REGIONS.regions[0],
      regionId: 'rakov_skocjan',
      name: 'Rakov Škocjan',
      mapId: 'rakov_skocjan_karst',
    };
    const { audio, game, settle } = await openWithSound(karst, NO_PROGRESS, {
      currentRegionId: 'rakov_skocjan',
      regions: [...REGIONS.regions, karstRegion],
    });

    game.options!.onAreaChange!('zelske_jame');
    await settle();
    expect(audio.scenes.at(-1)).toMatchObject({ mapId: 'rakov_skocjan_karst', underground: true });

    game.options!.onAreaChange!('rakov_skocjan');
    await settle();
    expect(audio.scenes.at(-1)?.underground).toBe(false);
  });

  it('turns the music down while a dialog is open', async () => {
    const { audio, game, settle } = await openWithSound();
    expect(audio.ducked).toBe(false);

    game.options!.onOpenInventory!();
    await settle();
    expect(audio.ducked).toBe(true);

    game.pressUi('Cancel');
    await settle();
    expect(audio.ducked).toBe(false);
  });

  it.each([
    [true, 'correct'],
    [false, 'wrong'],
  ] as const)(
    'plays the observation sound, then for a %s answer the %s sound',
    async (correct, effect) => {
      const { audio, game, http, root, settle } = await openWithSound();

      game.options!.onInteract(SAGE);
      http
        .expectOne('/api/save/encounters')
        .flush(SAGE_ENCOUNTER, { status: 201, statusText: 'Created' });
      await settle();
      expect(audio.effects).toEqual(['observe']);

      [...root().querySelectorAll<HTMLButtonElement>('app-identification-dialog button')]
        .find((button) => button.textContent?.trim() === 'travniška kadulja')!
        .click();
      http
        .expectOne(`/api/save/encounters/${SAGE_ENCOUNTER.encounterId}/identification`)
        .flush(sageAnswer(correct));
      if (correct) http.expectOne('/api/save/progress').flush(NO_PROGRESS);
      await settle();

      expect(audio.effects).toEqual(['observe', effect]);
    },
  );

  it('plays the search sound when a search starts', async () => {
    const { audio, game, http } = await openWithSound();

    game.options!.onInteract(IN_GRASS);

    expect(audio.effects).toEqual(['search']);
    http.expectOne('/api/save/searches').flush({ found: false });
  });

  it('plays the research sound, then the certificate sound as the message closes', async () => {
    const { audio, game, http, settle } = await openWithSound();

    game.options!.onInteract(SAGE);
    http.expectOne('/api/save/encounters').flush({
      alreadyIdentified: true,
      researched: true,
      entry: { ...SAGE_ENTRY, researchLevel: 3 },
      newCertificates: [{ stationId: 'meadow_station', name: 'Postaja' }],
    });
    await settle();
    expect(audio.effects).toEqual(['research']);

    game.pressUi('Confirm');
    await settle();
    expect(audio.effects).toEqual(['research', 'certificate']);
  });

  it('plays the quest and tool sounds when a conversation completes a quest and gives a tool', async () => {
    const { audio, game, http, settle } = await openWithSound(meadow, {
      flags: [],
      quests: [{ ...QUEST_DONE, status: 'active' }],
      items: [LAMP],
    });

    game.options!.onInteract(VERA);
    http.expectOne('/api/save/conversations').flush({
      npcName: 'Vera',
      lines: ['Odlično!'],
      quest: QUEST_DONE,
      flags: [],
      items: [LAMP, BINOCULARS],
    });
    await settle();
    game.pressUi('Confirm');
    await settle();

    expect(audio.effects).toEqual(['quest', 'tool']);
  });

  it('plays no quest sound when talking about a quest completed before', async () => {
    const { audio, game, http, settle } = await openWithSound(meadow, {
      flags: [],
      quests: [QUEST_DONE],
      items: [LAMP],
    });

    game.options!.onInteract(VERA);
    http.expectOne('/api/save/conversations').flush({
      npcName: 'Vera',
      lines: ['Lep dan!'],
      quest: QUEST_DONE,
      flags: [],
      items: [LAMP],
    });
    await settle();
    game.pressUi('Confirm');
    await settle();

    expect(audio.effects).toEqual([]);
  });

  it('plays the torch sound when the torch is switched', async () => {
    const { audio, game } = await openWithSound();

    game.options!.onTorchChange!(true);
    game.options!.onTorchChange!(false);

    expect(audio.effects).toEqual(['torch', 'torch']);
  });

  it('mutes with the button in the Več menu, which then offers to turn sound back on', async () => {
    const { audio, button, settle, openMore } = await openWithSound();
    await openMore();
    expect(button('.play__mute')?.textContent?.trim()).toBe(sl.sound.muteButton);
    expect(button('.play__mute')?.getAttribute('aria-pressed')).toBe('false');

    button('.play__mute')!.click();
    await settle();

    expect(audio.settings().muted).toBe(true);
    // Muting closes the menu; it shows the new state when opened again.
    expect(button('.play__menu')).toBeNull();
    await openMore();
    expect(button('.play__mute')?.textContent?.trim()).toBe(sl.sound.unmuteButton);
    expect(button('.play__mute')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the sound settings with the button and closes them with Cancel', async () => {
    const { game, button, root, settle, openMore } = await openWithSound();
    await openMore();

    button('.play__sound')!.click();
    await settle();
    expect(root().querySelector('app-sound-settings-dialog h2')?.textContent).toBe(sl.sound.title);
    expect(root().querySelector('.play__menu')).toBeNull();
    expect(game.consumer).toBe('ui');

    game.pressUi('MoveRight');
    await settle();
    expect(root().querySelector<HTMLInputElement>('input[data-volume="music"]')?.value).toBe('60');

    game.pressUi('Cancel');
    await settle();
    expect(root().querySelector('app-sound-settings-dialog')).toBeNull();
    expect(game.consumer).toBe('world');
  });
});

describe('Touch screens and fullscreen', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  /** Stands in for the browser's fullscreen mode. */
  class FakeFullscreen {
    readonly available = true;
    readonly active = signal(false);
    toggle = vi.fn(() => this.active.update((on) => !on));
  }

  /** The play screen on a touch screen (or not), with a fake fullscreen mode. */
  async function openOn(touch: boolean) {
    const fullscreen = new FakeFullscreen();
    const play = await openPlay(meadow, NO_PROGRESS, REGIONS, CLEAR_MORNING, [
      { provide: TOUCH_DEVICE, useValue: signal(touch) },
      { provide: Fullscreen, useValue: fullscreen },
    ]);
    const control = (selector: string) => play.root().querySelector<HTMLElement>(selector);
    /** Taps a touch control: a finger down and up. */
    const tap = (selector: string) => {
      for (const type of ['pointerdown', 'pointerup']) {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'pointerId', { value: 1 });
        control(selector)!.dispatchEvent(event);
      }
    };
    return { ...play, fullscreen, control, tap, openMore: () => openMoreMenu(play) };
  }

  it('shows the D-pad and buttons on touch screens, in the handheld layout, without the keyboard hint', async () => {
    const { root } = await openOn(true);

    expect(root().querySelector('app-touch-controls')).not.toBeNull();
    expect(root().querySelector('main')?.classList).toContain('play--touch');
    expect(root().querySelector('.play__hint')).toBeNull();
  });

  it('shows no touch controls with a mouse and keyboard', async () => {
    const { root } = await openOn(false);

    expect(root().querySelector('app-touch-controls')).toBeNull();
    expect(root().querySelector('main')?.classList).not.toContain('play--touch');
    expect(root().querySelector('.play__hint')).not.toBeNull();
  });

  it('hands the controls to the game like keys', async () => {
    const { game, tap } = await openOn(true);

    tap('[data-button="a"]');

    expect(game.pressed).toEqual(['+Interact', '+Confirm', '-Interact', '-Confirm']);
  });

  it('drives a dialog with the controls: B closes the bag', async () => {
    const { game, root, tap, settle } = await openOn(true);
    game.options!.onOpenInventory!();
    await settle();
    expect(root().querySelector('app-inventory-panel')).not.toBeNull();

    tap('[data-button="b"]');
    await settle();

    expect(root().querySelector('app-inventory-panel')).toBeNull();
    expect(game.consumer).toBe('world');
  });

  it('opens Terenski dnevnik with the Dnevnik button', async () => {
    const { game, http, control, root, settle } = await openOn(false);

    control('.play__journal')!.click();
    await settle();
    http.expectOne('/api/save/naturedex').flush({ habitats: [] });
    await settle();

    expect(control('.play__journal')?.textContent?.trim()).toBe(sl.naturedex.button);
    expect(root().querySelector('app-naturedex-panel h2')?.textContent).toBe(sl.naturedex.title);
    expect(game.consumer).toBe('ui');
  });

  it('switches to fullscreen with the button, which shows that it is on', async () => {
    const { fullscreen, control, settle, openMore } = await openOn(false);
    const button = () => control('.play__fullscreen')!;
    await openMore();
    expect(button().textContent?.trim()).toBe(sl.fullscreen.button);
    expect(button().getAttribute('aria-pressed')).toBe('false');

    button().click();
    await settle();

    expect(fullscreen.toggle).toHaveBeenCalled();
    await openMore();
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().classList).toContain('button--primary');
  });

  it('zooms in on an upright touch screen and switches back to 16:9 when the phone is turned', async () => {
    const portrait = signal(true);
    const { game, settle } = await openPlay(meadow, NO_PROGRESS, REGIONS, CLEAR_MORNING, [
      { provide: TOUCH_DEVICE, useValue: signal(true) },
      { provide: PORTRAIT, useValue: portrait },
    ]);
    expect(game.options?.views).toEqual(UPRIGHT_VIEWS);

    portrait.set(false);
    await settle();
    expect(game.views).toEqual([WIDE_VIEW]);

    portrait.set(true);
    await settle();
    expect(game.views).toEqual(UPRIGHT_VIEWS);
  });

  it('keeps the 16:9 world view with a mouse and keyboard, even in a tall window', async () => {
    const { game } = await openPlay(meadow, NO_PROGRESS, REGIONS, CLEAR_MORNING, [
      { provide: TOUCH_DEVICE, useValue: signal(false) },
      { provide: PORTRAIT, useValue: signal(true) },
    ]);

    expect(game.options?.views).toEqual([WIDE_VIEW]);
  });

  it('has no fullscreen button where the browser cannot go fullscreen', async () => {
    const play = await openPlay();
    await openMoreMenu(play);

    expect(play.root().querySelector('.play__fullscreen')).toBeNull();
  });
});

describe('The Več menu', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const more = (root: () => HTMLElement) =>
    root().querySelector<HTMLButtonElement>('.play__more-button');
  const menu = (root: () => HTMLElement) => root().querySelector('.play__menu');

  it('opens and closes with its button, which reports whether it is open', async () => {
    const play = await openPlay();
    const { root, settle } = play;
    expect(more(root)?.textContent?.trim()).toBe(sl.play.more);
    expect(more(root)?.getAttribute('aria-expanded')).toBe('false');
    expect(menu(root)).toBeNull();

    await openMoreMenu(play);
    expect(more(root)?.getAttribute('aria-expanded')).toBe('true');
    expect(menu(root)?.id).toBe(more(root)?.getAttribute('aria-controls'));

    more(root)!.click();
    await settle();
    expect(menu(root)).toBeNull();
  });

  it('holds the controls hint for keyboard players', async () => {
    const play = await openPlay();
    await openMoreMenu(play);

    expect(play.root().querySelector('.play__menu-hint')?.textContent).toBe(sl.play.controlsHint);
  });

  it('closes on Escape, in the menu or on Več, gives focus back to Več and keeps the key from the game', async () => {
    const play = await openPlay();
    const { root, settle } = play;
    // The game's keyboard listens on the window, where Escape would also open the journal.
    const reachedTheGame = vi.fn();
    window.addEventListener('keydown', reachedTheGame);
    const escape = (target: Element) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    for (const target of [() => menu(root)!, () => more(root)!]) {
      await openMoreMenu(play);
      escape(target());
      await settle();

      expect(menu(root)).toBeNull();
      expect(document.activeElement).toBe(more(root));
    }
    expect(reachedTheGame).not.toHaveBeenCalled();

    // With the menu closed, Escape on Več reaches the game as usual.
    escape(more(root)!);
    expect(reachedTheGame).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', reachedTheGame);
  });

  it('closes on a press outside it, but not on a press inside it', async () => {
    const play = await openPlay();
    const { root, settle } = play;
    await openMoreMenu(play);
    const press = (target: Element) =>
      target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    press(menu(root)!);
    await settle();
    expect(menu(root)).not.toBeNull();

    press(root().querySelector('app-game-canvas')!);
    await settle();
    expect(menu(root)).toBeNull();
  });

  it('closes when a dialog opens', async () => {
    const play = await openPlay();
    const { root, game, settle } = play;
    await openMoreMenu(play);

    game.options!.onOpenInventory!();
    await settle();

    expect(menu(root)).toBeNull();
  });

  it('is not offered on a touch screen without sound or fullscreen, where it would be empty', async () => {
    const { root } = await openPlay(meadow, NO_PROGRESS, REGIONS, CLEAR_MORNING, [
      { provide: TOUCH_DEVICE, useValue: signal(true) },
    ]);

    expect(more(root)).toBeNull();
    expect(root().querySelector('.play__journal')).not.toBeNull();
  });
});
