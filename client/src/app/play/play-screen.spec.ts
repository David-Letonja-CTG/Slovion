import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import meadow from '../../../../content/maps/dravsko_polje_meadow.json';
import sl from '../../../public/i18n/sl.json';
import { GameSession } from '../session/game-session';
import { SaveTokenStore } from '../session/save-token-store';
import { SAGE_ENTRY, sageDiscovery, settle, setupTestApp } from '../testing/test-app';

const MAP_URL = '/content/maps/dravsko_polje_meadow.json';
const SAGE = { mapId: 'dravsko_polje_meadow', spotId: 'meadow_sage_1' };

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

describe('Discovery flow', () => {
  afterEach(() => TestBed.inject(Router).dispose());

  it('blocks world input as soon as the player interacts', async () => {
    const { game, http } = await openPlay();

    game.options!.onInteract(SAGE);

    expect(game.consumer).toBe('ui');
    const request = http.expectOne('/api/save/discoveries');
    expect(request.request.body).toEqual(SAGE);
    request.flush(sageDiscovery(true), { status: 201, statusText: 'Created' });
  });

  it('announces a new entry with the species name', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http
      .expectOne('/api/save/discoveries')
      .flush(sageDiscovery(true), { status: 201, statusText: 'Created' });
    await wait();

    expect(dialogText()).toContain('Nov vnos v Terenskem dnevniku: travniška kadulja');
  });

  it('says when the species is already recorded', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http.expectOne('/api/save/discoveries').flush(sageDiscovery(false));
    await wait();

    expect(dialogText()).toContain(
      'Ta vrsta je že zapisana v Terenskem dnevniku: travniška kadulja',
    );
  });

  it.each(['Confirm', 'Cancel'] as const)(
    'closes the dialog with %s and gives input back to the world',
    async (action) => {
      const { game, http, root, settle: wait } = await openPlay();
      game.options!.onInteract(SAGE);
      http
        .expectOne('/api/save/discoveries')
        .flush(sageDiscovery(true), { status: 201, statusText: 'Created' });
      await wait();

      game.pressUi(action);
      await wait();

      expect(root().querySelector('[role="dialog"]')).toBeNull();
      expect(game.consumer).toBe('world');
    },
  );

  it('ignores movement while the dialog is open', async () => {
    const { game, http, root, settle: wait } = await openPlay();
    game.options!.onInteract(SAGE);
    http
      .expectOne('/api/save/discoveries')
      .flush(sageDiscovery(true), { status: 201, statusText: 'Created' });
    await wait();

    game.pressUi('MoveUp');
    await wait();

    expect(root().querySelector('[role="dialog"]')).not.toBeNull();
    expect(game.consumer).toBe('ui');
  });

  it('shows a network error and lets the player try again', async () => {
    const { game, http, dialogText, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http.expectOne('/api/save/discoveries').error(new ProgressEvent('error'), { status: 0 });
    await wait();
    expect(dialogText()).toContain(sl.errors.network);

    game.pressUi('Confirm');
    await wait();
    expect(game.consumer).toBe('world');
  });

  it('returns to the title screen when the save no longer exists', async () => {
    const { game, http, root, settle: wait } = await openPlay();

    game.options!.onInteract(SAGE);
    http
      .expectOne('/api/save/discoveries')
      .flush({ code: 'invalid_save_token' }, { status: 401, statusText: 'Unauthorized' });
    await wait();

    expect(TestBed.inject(Router).url).toBe('/');
    // The title screen shows the notice (and consumes it).
    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.invalid_save_token);
    expect(TestBed.inject(GameSession).active()).toBe(false);
    expect(TestBed.inject(SaveTokenStore).get()).toBeNull();
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
