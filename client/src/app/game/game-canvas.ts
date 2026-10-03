import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  Game,
  Interaction,
  LoadedWorld,
  Season,
  TimeOfDay,
  WorldClock,
  createGame,
} from '../../engine';

/** Creates the engine; replaceable in tests. */
export const GAME_FACTORY = new InjectionToken<typeof createGame>('GAME_FACTORY', {
  providedIn: 'root',
  factory: () => createGame,
});

/** Hosts the framework-free game engine. The engine sizes and centres the canvas itself. */
@Component({
  selector: 'app-game-canvas',
  imports: [TranslocoPipe],
  template: `<canvas
    #canvas
    role="img"
    tabindex="-1"
    [attr.aria-label]="'game.viewportLabel' | transloco"
  ></canvas>`,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
    }
    canvas:focus {
      outline: none;
    }
  `,
})
export class GameCanvas {
  readonly world = input.required<LoadedWorld>();
  /** The save's progress flags when the game starts; later changes go through `Game.setOpenFlags`. */
  readonly openFlags = input<readonly string[]>([]);
  /** The save's in-game clock when the game starts; later re-syncs go through `Game.setWorldTime`. */
  readonly worldTime = input<WorldClock | undefined>(undefined);
  /** The season or the time of day changed while playing. */
  readonly conditionsChanged = output<{ season: Season; timeOfDay: TimeOfDay }>();
  /** The player interacted with an NPC, a spot or a habitat; the host asks the server what happens. */
  readonly interaction = output<Interaction>();
  /** The player asked for the menu (OpenMenu) while in the world. */
  readonly menuRequested = output<void>();
  /** Emitted once the engine runs, so the host can route input to overlays. */
  readonly started = output<Game>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    const createGameFn = inject(GAME_FACTORY);

    afterNextRender(() => {
      const game = createGameFn(host.nativeElement, this.canvas().nativeElement, {
        world: this.world(),
        onInteract: (interaction) => this.interaction.emit(interaction),
        onOpenMenu: () => this.menuRequested.emit(),
        openFlags: this.openFlags(),
        worldTime: this.worldTime(),
        onConditionsChange: (season, timeOfDay) =>
          this.conditionsChanged.emit({ season, timeOfDay }),
      });
      game.start();
      destroyRef.onDestroy(() => game.stop());
      this.started.emit(game);
    });
  }

  /** Gives keyboard focus back to the game, e.g. after closing a dialog. */
  focus(): void {
    this.canvas().nativeElement.focus();
  }
}
