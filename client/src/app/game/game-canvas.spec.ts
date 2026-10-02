import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { provideTestLocalization } from '../i18n/localization.testing';
import { GAME_FACTORY, GameCanvas } from './game-canvas';

describe('GameCanvas', () => {
  const game = { start: vi.fn(), stop: vi.fn() };
  const factory = vi.fn(() => game);

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [GameCanvas],
      providers: [provideTestLocalization({ sl }), { provide: GAME_FACTORY, useValue: factory }],
    });
    await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  });

  async function render() {
    const fixture = TestBed.createComponent(GameCanvas);
    await fixture.whenStable();
    return fixture;
  }

  it('starts the game on its own element and canvas after rendering', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;

    expect(factory).toHaveBeenCalledWith(host, host.querySelector('canvas'));
    expect(game.start).toHaveBeenCalledOnce();
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
