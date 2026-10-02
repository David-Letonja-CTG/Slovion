import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { provideTestLocalization } from '../i18n/localization.testing';
import { DEVICE_STORAGE, SaveTokenStore } from '../session/save-token-store';
import { GameApi, apiErrorCode } from './game-api';
import { gameApiInterceptor } from './game-api.interceptor';

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail } as unknown as Storage;
}

function setup(storage: Storage | undefined = new MemoryStorage() as unknown as Storage) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([gameApiInterceptor])),
      provideHttpClientTesting(),
      provideTestLocalization({ sl, en: sl }),
      { provide: DEVICE_STORAGE, useValue: storage },
    ],
  });
  return {
    api: TestBed.inject(GameApi),
    store: TestBed.inject(SaveTokenStore),
    http: TestBed.inject(HttpTestingController),
  };
}

class MemoryStorage {
  private readonly items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

describe('SaveTokenStore', () => {
  it('keeps the token on the device', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    setup(storage);
    TestBed.inject(SaveTokenStore).set('abc');

    expect(storage.getItem(SaveTokenStore.storageKey)).toBe('abc');
  });

  it('still works in memory when device storage throws', () => {
    const { store } = setup(throwingStorage());

    expect(store.get()).toBeNull();
    store.set('abc');

    expect(store.get()).toBe('abc');
    expect(() => store.clear()).not.toThrow();
    expect(store.get()).toBeNull();
  });

  it('works when the browser offers no storage at all', () => {
    const { store } = setup(undefined);

    store.set('abc');

    expect(store.get()).toBe('abc');
  });
});

describe('gameApiInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the token only in the Authorization header of /api/save calls', () => {
    const { api, store, http } = setup();
    store.set('secret-token');

    api.natureDex().subscribe();
    api.createSave().subscribe();

    const natureDex = http.expectOne('/api/save/naturedex');
    const create = http.expectOne('/api/saves');
    expect(natureDex.request.headers.get('Authorization')).toBe('Bearer secret-token');
    expect(natureDex.request.urlWithParams).not.toContain('secret-token');
    expect(create.request.headers.has('Authorization')).toBe(false);
    natureDex.flush({ entries: [] });
    create.flush({ token: 'x' });
  });

  it('asks for content in the active language', async () => {
    const { api, http } = setup();
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));

    api.natureDex().subscribe();
    http.expectOne('/api/save/naturedex').flush({ entries: [] });
    transloco.setActiveLang('en');
    api.natureDex().subscribe();
    const english = http.expectOne('/api/save/naturedex');

    expect(english.request.headers.get('Accept-Language')).toBe('en');
    english.flush({ entries: [] });
  });

  it('leaves non-API requests alone', () => {
    const { store, http } = setup();
    store.set('secret-token');

    TestBed.inject(GameApi)['http'].get('/content/maps/x.json').subscribe();

    const request = http.expectOne('/content/maps/x.json');
    expect(request.request.headers.keys()).toEqual([]);
    request.flush({});
  });
});

describe('GameApi encounters', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('starts an encounter with only the map and spot', () => {
    const { api, store, http } = setup();
    store.set('token');

    api.startEncounter('dravsko_polje_meadow', 'meadow_hare_1').subscribe();

    const request = http.expectOne({ method: 'POST', url: '/api/save/encounters' });
    expect(request.request.body).toEqual({
      mapId: 'dravsko_polje_meadow',
      spotId: 'meadow_hare_1',
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({ encounterId: 'e1', group: 'mammal', clues: [], candidates: [] });
  });

  it('answers an encounter by species ID', () => {
    const { api, store, http } = setup();
    store.set('token');

    api.answer('3f2a', 'lepus_europaeus').subscribe();

    const request = http.expectOne({
      method: 'POST',
      url: '/api/save/encounters/3f2a/identification',
    });
    expect(request.request.body).toEqual({ speciesId: 'lepus_europaeus' });
    request.flush({
      correct: true,
      species: { speciesId: 'lepus_europaeus', name: 'x' },
      entry: null,
    });
  });
});

describe('apiErrorCode', () => {
  it.each([
    [new HttpErrorResponse({ status: 0 }), 'network'],
    [
      new HttpErrorResponse({ status: 401, error: { code: 'invalid_save_token' } }),
      'invalid_save_token',
    ],
    [new HttpErrorResponse({ status: 404, error: { code: 'unknown_spot' } }), 'unknown_spot'],
    [
      new HttpErrorResponse({ status: 404, error: { code: 'unknown_encounter' } }),
      'unknown_encounter',
    ],
    [new HttpErrorResponse({ status: 500, error: { code: 'internal_error' } }), 'error'],
    [new Error('boom'), 'error'],
  ])('maps %o to %s', (error, code) => {
    expect(apiErrorCode(error)).toBe(code);
  });
});
