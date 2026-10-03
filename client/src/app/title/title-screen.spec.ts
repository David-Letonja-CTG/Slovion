import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import sl from '../../../public/i18n/sl.json';
import { GameSession } from '../session/game-session';
import { SaveTokenStore } from '../session/save-token-store';
import { MemoryStorage, settle, setupTestApp } from '../testing/test-app';

async function openTitle(storage?: MemoryStorage | 'blocked') {
  const app = await setupTestApp({ storage });
  const harness = await RouterTestingHarness.create('/');
  const root = () => harness.routeNativeElement as HTMLElement;
  const button = (action: string) =>
    root().querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  const buttonWithText = (text: string) =>
    [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { ...app, harness, root, button, buttonWithText };
}

function withSavedGame(token = 'saved-token') {
  const storage = new MemoryStorage();
  storage.setItem(SaveTokenStore.storageKey, token);
  return storage;
}

describe('Title screen', () => {
  it('shows the Slovenian title from the catalog', async () => {
    const { root } = await openTitle();

    expect(root().querySelector('h1')?.textContent).toBe(sl.app.title);
    expect(root().querySelector('.title__tagline')?.textContent).toBe(sl.shell.tagline);
  });

  it('offers only "Nova igra" on a first visit', async () => {
    const { button } = await openTitle();

    expect(button('new-game')?.textContent?.trim()).toBe(sl.title.newGame);
    expect(button('continue')).toBeNull();
  });

  it('offers "Nadaljuj" and "Nova igra" to a returning player', async () => {
    const { button } = await openTitle(withSavedGame());

    expect(button('continue')?.textContent?.trim()).toBe(sl.title.continue);
    expect(button('new-game')).not.toBeNull();
  });

  it('starts a new game: stores the token and enters the meadow', async () => {
    const { button, http, tokens, harness } = await openTitle();

    button('new-game')!.click();
    http
      .expectOne({ method: 'POST', url: '/api/saves' })
      .flush({ token: 'new-token' }, { status: 201, statusText: 'Created' });
    await settle(harness.fixture);

    expect(tokens.get()).toBe('new-token');
    expect(TestBed.inject(Router).url).toBe('/play');
  });

  it('asks before replacing a save, and keeps it when declined', async () => {
    const storage = withSavedGame();
    const { button, buttonWithText, http, harness, root } = await openTitle(storage);

    button('new-game')!.click();
    await settle(harness.fixture);
    expect(root().querySelector('[role="alertdialog"]')?.textContent).toContain(
      sl.title.confirmReplace,
    );

    buttonWithText(sl.common.cancel)!.click();
    await settle(harness.fixture);

    http.expectNone('/api/saves');
    expect(storage.getItem(SaveTokenStore.storageKey)).toBe('saved-token');
    expect(button('continue')).not.toBeNull();
  });

  it('replaces the save when confirmed', async () => {
    const storage = withSavedGame();
    const { button, buttonWithText, http, harness } = await openTitle(storage);

    button('new-game')!.click();
    await settle(harness.fixture);
    buttonWithText(sl.title.confirmReplaceYes)!.click();
    http
      .expectOne('/api/saves')
      .flush({ token: 'fresh-token' }, { status: 201, statusText: 'Created' });
    await settle(harness.fixture);

    expect(storage.getItem(SaveTokenStore.storageKey)).toBe('fresh-token');
    expect(TestBed.inject(Router).url).toBe('/play');
  });

  it('continues a saved game after the server confirms it', async () => {
    const { button, http, harness } = await openTitle(withSavedGame());

    button('continue')!.click();
    const check = http.expectOne('/api/save/naturedex');
    expect(check.request.headers.get('Authorization')).toBe('Bearer saved-token');
    check.flush({ entries: [] });
    await settle(harness.fixture);

    expect(TestBed.inject(Router).url).toBe('/play');
  });

  it('forgets a save the server no longer knows and offers only "Nova igra"', async () => {
    const storage = withSavedGame();
    const { button, http, harness, root } = await openTitle(storage);

    button('continue')!.click();
    http
      .expectOne('/api/save/naturedex')
      .flush({ code: 'invalid_save_token' }, { status: 401, statusText: 'Unauthorized' });
    await settle(harness.fixture);

    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.invalid_save_token);
    expect(button('continue')).toBeNull();
    expect(storage.getItem(SaveTokenStore.storageKey)).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('stays on the title screen without a token when the server is unreachable', async () => {
    const { button, http, harness, root, tokens } = await openTitle();

    button('new-game')!.click();
    http.expectOne('/api/saves').error(new ProgressEvent('error'), { status: 0 });
    await settle(harness.fixture);

    expect(root().querySelector('[role="alert"]')?.textContent).toBe(sl.errors.network);
    expect(tokens.get()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
    expect(button('new-game')?.disabled).toBe(false); // can retry
  });

  it('still starts the game when device storage is blocked', async () => {
    const { button, http, harness } = await openTitle('blocked');

    button('new-game')!.click();
    http
      .expectOne('/api/saves')
      .flush({ token: 'memory-token' }, { status: 201, statusText: 'Created' });
    await settle(harness.fixture);

    expect(TestBed.inject(Router).url).toBe('/play');
    expect(TestBed.inject(SaveTokenStore).get()).toBe('memory-token');
  });

  it('shows a notice left by the play screen', async () => {
    await setupTestApp();
    TestBed.inject(GameSession).notice.set('invalid_save_token');

    const harness = await RouterTestingHarness.create('/');

    expect(
      (harness.routeNativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toBe(sl.errors.invalid_save_token);
  });

  it('keeps players out of the play screen until a game is started', async () => {
    await setupTestApp();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/play');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});

describe('Title screen without a connection', () => {
  afterEach(() => vi.restoreAllMocks());

  const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

  it('says a connection is needed and still offers the buttons', async () => {
    offline();

    const { root, button } = await openTitle(withSavedGame());

    expect(root().querySelector('.title__offline')?.textContent).toBe(sl.title.offline);
    expect(button('continue')).not.toBeNull();
    expect(button('new-game')).not.toBeNull();
  });

  it('hides the notice when the connection returns', async () => {
    const onLine = offline();
    const { root, harness } = await openTitle();

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await settle(harness.fixture);

    expect(root().querySelector('.title__offline')).toBeNull();
  });

  it('shows the notice when the connection drops', async () => {
    const { root, harness } = await openTitle();
    expect(root().querySelector('.title__offline')).toBeNull();

    offline();
    window.dispatchEvent(new Event('offline'));
    await settle(harness.fixture);

    expect(root().querySelector('.title__offline')?.textContent).toBe(sl.title.offline);
  });
});
