import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { createGame } from '../../engine';

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
    [attr.aria-label]="'game.viewportLabel' | transloco"
  ></canvas>`,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
    }
  `,
})
export class GameCanvas {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const destroyRef = inject(DestroyRef);
    const createGameFn = inject(GAME_FACTORY);

    afterNextRender(() => {
      const game = createGameFn(host.nativeElement, this.canvas().nativeElement);
      game.start();
      destroyRef.onDestroy(() => game.stop());
    });
  }
}
