import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { Game, GameOptions, Interaction, LoadedWorld } from '../../engine';
import { provideTestLocalization } from '../i18n/localization.testing';
import { GAME_FACTORY, GameCanvas } from './game-canvas';

const WORLD = { map: { id: 'test_map' } } as unknown as LoadedWorld;

@Component({
  imports: [GameCanvas],
  template: `<app-game-canvas
    [world]="world"
    (interaction)="interactions.push($event)"
    (started)="started.set($event)"
  />`,
})
class Host {
  readonly world = WORLD;
  readonly interactions: Interaction[] = [];
  readonly started = signal<Game | undefined>(undefined);
}

describe('GameCanvas', () => {
  const game = { start: vi.fn(), stop: vi.fn(), setActionConsumer: vi.fn(), onUiAction: vi.fn() };
  let options: GameOptions | undefined;
  const factory = vi.fn((_host: HTMLElement, _canvas: HTMLCanvasElement, given: GameOptions) => {
    options = given;
    return game;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideTestLocalization({ sl }), { provide: GAME_FACTORY, useValue: factory }],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  it('starts the game with the given world on its own element and canvas', async () => {
    const fixture = await render();
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-game-canvas');

    expect(factory).toHaveBeenCalledWith(host, host?.querySelector('canvas'), expect.anything());
    expect(options?.world).toBe(WORLD);
    expect(game.start).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.started()).toBe(game);
  });

  it('emits interactions reported by the engine', async () => {
    const fixture = await render();

    options?.onInteract({ kind: 'spot', mapId: 'test_map', spotId: 'spot' });

    expect(fixture.componentInstance.interactions).toEqual([
      { kind: 'spot', mapId: 'test_map', spotId: 'spot' },
    ]);
  });

  it('labels the canvas from the translation catalog', async () => {
    const fixture = await render();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas');

    expect(canvas?.getAttribute('aria-label')).toBe(sl.game.viewportLabel);
  });

  it('stops the game when destroyed', async () => {
    const fixture = await render();

    fixture.destroy();

    expect(game.stop).toHaveBeenCalledOnce();
  });
});
