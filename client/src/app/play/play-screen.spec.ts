import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import sl from '../../../public/i18n/sl.json';
import { Action } from '../../engine';
import {
  NatureDexEntry,
  NatureDexSection,
  NatureDexSlot,
  PlayerProgress,
  QuestInfo,
} from '../api/game-api';
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

const NO_PROGRESS: PlayerProgress = { flags: [], quests: [] };
const SPRING_MORNING = {
  minutes: 480,
  day: 1,
  season: 'spring',
  timeOfDay: 'morning',
  gameMinutesPerSecond: 1,
};

/** Opens the play screen; the progress response is a body, or an HTTP status to fail with (0 = network). */
async function openPlay(
  mapResponse: object | 404 = meadow,
  progressResponse: PlayerProgress | number = NO_PROGRESS,
) {
  const app = await setupTestApp();
  TestBed.inject(SaveTokenStore).set('play-token');
  TestBed.inject(GameSession).active.set(true);

  const harness = await RouterTestingHarness.create('/play');
  app.http.expectOne('/api/save/time').flush(SPRING_MORNING);
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
    expect(picture('salvia_pratensis').getAttribute('aria-label')).toBe('travniška kadulja');
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
  const conversation = (lines: string[], flags: string[] = [], info = quest(0)) => ({
    npcName: 'Vera',
    lines,
    quest: info,
    flags,
  });

  it('starts the world with the flags of the loaded progress', async () => {
    const { game } = await openPlay(meadow, { flags: ['hedgerow_open'], quests: [] });

    expect(game.options?.openFlags).toEqual(['hedgerow_open']);
  });

  it('shows no tracker before a quest is started', async () => {
    const { root } = await openPlay();

    expect(root().querySelector('app-quest-tracker')).toBeNull();
  });

  it('tracks an active quest with its title and progress', async () => {
    const { root } = await openPlay(meadow, { flags: [], quests: [quest(1)] });
    const tracker = root().querySelector('app-quest-tracker')!;

    expect(tracker.textContent).toContain('Oko za naravo');
    expect(tracker.querySelector('.tracker__progress')?.textContent?.trim()).toBe('1/3');
  });

  it('says to return to the giver once the goal is met', async () => {
    const { root } = await openPlay(meadow, { flags: [], quests: [quest(3)] });

    expect(root().querySelector('.tracker__hint')?.textContent?.trim()).toBe('Vrni se k Veri.');
  });

  it('hides completed quests', async () => {
    const { root } = await openPlay(meadow, {
      flags: ['hedgerow_open'],
      quests: [quest(3, 'completed')],
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

  it('moves the tracker on after a correct identification', async () => {
    const {
      game,
      http,
      root,
      settle: wait,
    } = await openPlay(meadow, {
      flags: [],
      quests: [quest(1)],
    });

    game.options!.onInteract(SAGE);
    http
      .expectOne('/api/save/encounters')
      .flush(SAGE_ENCOUNTER, { status: 201, statusText: 'Created' });
    await wait();
    root().querySelector<HTMLButtonElement>('[data-kind="candidate"]')!.click();
    http
      .expectOne(`/api/save/encounters/${SAGE_ENCOUNTER.encounterId}/identification`)
      .flush(sageAnswer(true));
    await wait();

    expect(root().querySelector('.tracker__progress')?.textContent?.trim()).toBe('2/3');
  });
});

describe('World conditions', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  const indicator = (root: () => HTMLElement) =>
    root().querySelector('app-conditions-indicator')?.textContent?.replace(/\s+/g, ' ').trim();

  it('starts the game with the save clock and shows the season and time of day', async () => {
    const { game, root } = await openPlay();

    expect(game.options?.worldTime).toMatchObject({ minutes: 480, gameMinutesPerSecond: 1 });
    expect(indicator(root)).toBe('Pomlad · jutro');
  });

  it('updates the indicator when the world reports a change', async () => {
    const { game, root, settle: wait } = await openPlay();

    game.options!.onConditionsChange!('summer', 'night');
    await wait();

    expect(indicator(root)).toBe('Poletje · noč');
  });

  it('re-syncs the clock when the page becomes visible again', async () => {
    const { game, http, root, settle: wait } = await openPlay();
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
    expect(indicator(root)).toBe('Zima · jutro');
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
