import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { Action, Game, GameOptions } from '../../engine';
import { DiscoveryResult, NatureDexEntry } from '../api/game-api';
import { gameApiInterceptor } from '../api/game-api.interceptor';
import { routes } from '../app.routes';
import { GAME_FACTORY } from '../game/game-canvas';
import { provideTestLocalization } from '../i18n/localization.testing';
import { IMAGE_LOADER } from '../play/world-loader';
import { DEVICE_STORAGE, SaveTokenStore } from '../session/save-token-store';

/** Engine stand-in: jsdom has no canvas. Lets tests trigger engine callbacks and UI actions. */
export class FakeGame implements Game {
  options: GameOptions | undefined;
  consumer: 'world' | 'ui' = 'world';
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
      {
        provide: GAME_FACTORY,
        useValue: (_host: HTMLElement, _canvas: HTMLCanvasElement, given: GameOptions) => {
          game.options = given;
          return game;
        },
      },
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

export const SAGE_ENTRY: NatureDexEntry = {
  speciesId: 'salvia_pratensis',
  discoveredAt: '2026-06-01T10:00:00Z',
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

export const sageDiscovery = (isNew: boolean): DiscoveryResult => ({ ...SAGE_ENTRY, isNew });

/** Lets pending promises and change detection settle. */
export async function settle(fixture?: { whenStable(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture?.whenStable();
  }
}
