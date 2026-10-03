import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterRenderEffect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  Game,
  Interaction,
  LoadedWorld,
  ResidentInfo,
  Weather,
  WorldClock,
  WorldTime,
  createGame,
} from '../../engine';

/** Creates the engine; replaceable in tests. */
export const GAME_FACTORY = new InjectionToken<typeof createGame>('GAME_FACTORY', {
  providedIn: 'root',
  factory: () => createGame,
});

/**
 * Hosts the framework-free game engine. The engine sizes and centres the canvas itself. A new world (another
 * region's map) stops the running game and starts a new one.
 */
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
  /** The world to play; a new world starts a new game. */
  readonly world = input.required<LoadedWorld>();
  /** The save's progress flags when a game starts; later changes go through `Game.setOpenFlags`. */
  readonly openFlags = input<readonly string[]>([]);
  /** The map's resident animals when a game starts; refreshes go through `Game.setResidents`. */
  readonly residents = input<readonly ResidentInfo[]>([]);
  /** The save's in-game clock when a game starts; later re-syncs go through `Game.setWorldTime`. */
  readonly worldTime = input<WorldClock | undefined>(undefined);
  /** The current region's weather when a game starts; changes go through `Game.setWeather`. */
  readonly weather = input<Weather>('clear');
  /** Draws weather without movement, for players who prefer reduced motion. */
  readonly reducedMotion = input(false);
  /** A new in-game minute (once per in-game minute while playing, and after a re-sync). */
  readonly timeChanged = output<WorldTime>();
  /** The player's tile lies in another place, including at the start. */
  readonly areaChanged = output<string>();
  readonly torchChanged = output<boolean>();
  /** The player interacted with an NPC, a spot or a habitat; the host asks the server what happens. */
  readonly interaction = output<Interaction>();
  /** The player asked for the menu (OpenMenu) while in the world. */
  readonly menuRequested = output<void>();
  /** The player asked for the bag (Inventory) while in the world. */
  readonly inventoryRequested = output<void>();
  /** The save's field tools when a game starts; changes go through `Game.setTools`. */
  readonly tools = input<readonly string[]>([]);
  /** Emitted whenever a game starts running, so the host can route input to overlays. */
  readonly started = output<Game>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private game: Game | undefined;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    const createGameFn = inject(GAME_FACTORY);

    // Runs after the first render and again whenever the world changes; the other inputs only matter at start.
    afterRenderEffect(() => {
      const world = this.world();
      untracked(() => {
        this.game?.stop();
        const game = createGameFn(host.nativeElement, this.canvas().nativeElement, {
          world,
          onInteract: (interaction) => this.interaction.emit(interaction),
          onOpenMenu: () => this.menuRequested.emit(),
          onOpenInventory: () => this.inventoryRequested.emit(),
          tools: this.tools(),
          openFlags: this.openFlags(),
          worldTime: this.worldTime(),
          residents: this.residents(),
          weather: this.weather(),
          reducedMotion: this.reducedMotion(),
          onTimeChange: (time) => this.timeChanged.emit(time),
          onAreaChange: (area) => this.areaChanged.emit(area),
          onTorchChange: (on) => this.torchChanged.emit(on),
        });
        this.game = game;
        game.start();
        this.started.emit(game);
      });
    });
    destroyRef.onDestroy(() => this.game?.stop());
  }

  /** Gives keyboard focus back to the game, e.g. after closing a dialog. */
  focus(): void {
    this.canvas().nativeElement.focus();
  }
}
