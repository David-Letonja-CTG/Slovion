import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import kocevje from '../../../../content/maps/kocevje_forest.json';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import sl from '../../../public/i18n/sl.json';
import { Action, worldTimeAt } from '../../engine';
import {
  NatureDexEntry,
  NatureDexSection,
  NatureDexSlot,
  PlayerProgress,
  QuestInfo,
  RegionsInfo,
} from '../api/game-api';
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
) {
  const app = await setupTestApp();
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
  const map = app.http.expectOne(`/content/maps/${current.mapId}.json`);
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
    const heading = panel()!.querySelector('[data-habitat="tall_grass"] h3')!;

    expect(heading.textContent).toContain('Visoka trava');
    expect(heading.querySelector('.habitat__count')?.textContent?.trim()).toBe('1/5');
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
    play.http.expectOne('/content/maps/kocevje_forest.json').flush(kocevje);
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
    play.http.expectOne('/content/maps/kocevje_forest.json').flush(kocevje);
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
      .expectOne('/content/maps/kocevje_forest.json')
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
