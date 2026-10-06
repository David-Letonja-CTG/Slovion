import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { Action, ResidentInfo, Game, GameOptions, Weather } from '../../engine';
import { AnswerResult, Encounter, NatureDexEntry, RegionsInfo } from '../api/game-api';
import { gameApiInterceptor } from '../api/game-api.interceptor';
import { routes } from '../app.routes';
import { GAME_FACTORY } from '../game/game-canvas';
import { provideTestLocalization } from '../i18n/localization.testing';
import { TRAVEL_FADE_MS } from '../play/play-screen';
import { IMAGE_LOADER } from '../play/world-loader';
import { DEVICE_STORAGE, SaveTokenStore } from '../session/save-token-store';

/** Engine stand-in: jsdom has no canvas. Lets tests trigger engine callbacks and UI actions. */
export class FakeGame implements Game {
  options: GameOptions | undefined;
  consumer: 'world' | 'ui' = 'world';
  /** The flags last given with `setOpenFlags`. */
  openFlags: readonly string[] = [];
  /** The in-game minutes last given with `setWorldTime`. */
  worldMinutes: number | undefined;
  /** The torch state last given with `setTorch`. */
  torch: boolean | undefined;
  /** The residents last given with `setResidents`. */
  residents: readonly ResidentInfo[] | undefined;
  /** The weather last given with `setWeather`. */
  weather: Weather | undefined;
  /** The tools last given with `setTools`. */
  tools: readonly string[] | undefined;
  private readonly uiListeners = new Set<(action: Action) => void>();

  start = vi.fn();
  stop = vi.fn();

  setActionConsumer(consumer: 'world' | 'ui'): void {
    this.consumer = consumer;
  }

  onUiAction(listener: (action: Action) => void) {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  setOpenFlags(flags: readonly string[]): void {
    this.openFlags = flags;
  }

  setResidents(residents: readonly ResidentInfo[]): void {
    this.residents = residents;
  }

  setTools(tools: readonly string[]): void {
    this.tools = tools;
  }

  setWeather(weather: Weather): void {
    this.weather = weather;
  }

  setTorch(on: boolean): void {
    this.torch = on;
  }

  setWorldTime(minutes: number): void {
    this.worldMinutes = minutes;
  }

  /** Simulates the player pressing a key while the UI has input. */
  pressUi(action: Action): void {
    if (this.consumer === 'ui') this.uiListeners.forEach((listener) => listener(action));
  }
}

export class MemoryStorage {
  readonly items = new Map<string, string>();
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

export interface TestAppOptions {
  /** Device storage; `'blocked'` makes every access throw. */
  readonly storage?: MemoryStorage | 'blocked';
  /** Further providers, e.g. a stand-in for a service. */
  readonly providers?: readonly Provider[];
}

/** Configures TestBed like the real app, with HTTP, storage, images and the engine faked. */
export async function setupTestApp(options: TestAppOptions = {}) {
  const game = new FakeGame();
  const storage = options.storage ?? new MemoryStorage();
  const blocked = () => {
    throw new DOMException('blocked', 'SecurityError');
  };

  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(withInterceptors([gameApiInterceptor])),
      provideHttpClientTesting(),
      provideTestLocalization({ sl }),
      {
        provide: DEVICE_STORAGE,
        useValue:
          storage === 'blocked'
            ? { getItem: blocked, setItem: blocked, removeItem: blocked }
            : storage,
      },
      { provide: IMAGE_LOADER, useValue: (url: string) => Promise.resolve({ url }) },
      { provide: TRAVEL_FADE_MS, useValue: 0 },
      {
        provide: GAME_FACTORY,
        useValue: (_host: HTMLElement, _canvas: HTMLCanvasElement, given: GameOptions) => {
          game.options = given;
          return game;
        },
      },
      ...(options.providers ?? []),
    ],
  });
  await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));

  return {
    game,
    storage,
    http: TestBed.inject(HttpTestingController),
    tokens: TestBed.inject(SaveTokenStore),
  };
}

/** A save on Dravsko polje after Vera's quest, with 4 species identified: Kočevje is open. */
export const REGIONS: RegionsInfo = {
  currentRegionId: 'dravsko_polje',
  regions: [
    {
      regionId: 'dravsko_polje',
      name: 'Dravsko polje',
      mapId: 'dravsko_polje_meadow',
      x: 74,
      y: 35,
      unlocked: true,
      identified: null,
      required: null,
      lockedHint: null,
    },
    {
      regionId: 'kocevje',
      name: 'Kočevje',
      mapId: 'kocevje_forest',
      x: 45,
      y: 84,
      unlocked: true,
      identified: null,
      required: null,
      lockedHint: null,
    },
    {
      regionId: 'pohorje',
      name: 'Pohorje',
      mapId: 'pohorje_forest',
      x: 62,
      y: 27,
      unlocked: false,
      identified: 4,
      required: 6,
      lockedHint: 'Za pot na Pohorje moraš bolje poznati naravo.',
    },
    {
      regionId: 'triglav',
      name: 'Triglav',
      mapId: 'triglav_alps',
      x: 15,
      y: 35,
      unlocked: false,
      identified: 4,
      required: 8,
      lockedHint: 'V gore se odpravijo le izkušeni naravoslovci.',
    },
  ],
};

export const SAGE_ENTRY: NatureDexEntry = {
  speciesId: 'salvia_pratensis',
  group: 'plant',
  status: 'identified',
  observedAt: '2026-06-01T10:00:00Z',
  identifiedAt: '2026-06-01T10:05:00Z',
  researchLevel: 3,
  species: {
    name: 'travniška kadulja',
    scientificName: 'Salvia pratensis L.',
    family: 'ustnatice (Lamiaceae)',
    habitat: 'Suhi travniki in pašniki.',
    distribution: 'V Sloveniji je zelo pogosta.',
    season: 'Cveti od maja do avgusta.',
    characteristics: ['Zraste od 30 do 60 cm visoko.', 'Steblo je štirirobo.'],
    sources: [
      {
        title: 'Travniška kadulja',
        publisher: 'Notranjski regijski park',
        url: 'https://notranjski-park.si/',
        accessed: '2026-10-02',
        licence: '©',
      },
    ],
  },
};

/** An observed but not identified hare. */
export const HARE_OBSERVED: NatureDexEntry = {
  speciesId: 'lepus_europaeus',
  group: 'mammal',
  status: 'observed',
  observedAt: '2026-06-02T08:00:00Z',
  identifiedAt: null,
  researchLevel: null,
  species: null,
};

export const SAGE_ENCOUNTER: Encounter = {
  encounterId: 'enc-1',
  group: 'plant',
  clues: ['Cvetovi so modri do vijolični.', 'Steblo je štirirobo.', 'Listna rozeta.'],
  candidates: [
    { speciesId: 'lepus_europaeus', name: 'poljski zajec' },
    { speciesId: 'salvia_pratensis', name: 'travniška kadulja' },
    { speciesId: 'taraxacum_officinale', name: 'navadni regrat' },
    { speciesId: 'papilio_machaon', name: 'lastovičar' },
  ],
};

export const sageAnswer = (correct: boolean): AnswerResult => ({
  correct,
  species: { speciesId: 'salvia_pratensis', name: 'travniška kadulja' },
  entry: correct ? SAGE_ENTRY : null,
});

/** Lets pending promises and change detection settle. */
export async function settle(fixture?: { whenStable(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture?.whenStable();
  }
}
