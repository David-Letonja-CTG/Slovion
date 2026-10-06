import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';

type Move = 'MoveUp' | 'MoveDown' | 'MoveLeft' | 'MoveRight';
type ButtonId = 'a' | 'b';

/** A is the keyboard's E or Enter; B is Esc (back) and, held while walking, Shift (run). */
const BUTTON_ACTIONS: Readonly<Record<ButtonId, readonly Action[]>> = {
  a: ['Interact', 'Confirm'],
  b: ['Cancel', 'Run'],
};

/** Touches this close to the D-pad's centre (a share of its radius) hold no direction. */
const DEAD_ZONE = 0.25;

/**
 * The on-screen D-pad and the A and B buttons for touch screens (docs/gameplay.md). They report logical actions as
 * they are pressed and released; the play screen hands them to the game like key presses. The D-pad is one surface:
 * sliding the thumb to another side turns without lifting it. Each control follows its own finger, so the D-pad and
 * B work together.
 */
@Component({
  selector: 'app-touch-controls',
  imports: [TranslocoPipe],
  template: `
    <div class="touch" (contextmenu)="$event.preventDefault()">
      <div
        class="touch__pad"
        role="group"
        [attr.aria-label]="'touch.pad' | transloco"
        (pointerdown)="padDown($event)"
        (pointermove)="padMove($event)"
        (pointerup)="padUp($event)"
        (pointercancel)="padUp($event)"
        (lostpointercapture)="padUp($event)"
      >
        @for (move of moves; track move) {
          <span
            [class]="'touch__arrow touch__arrow--' + move"
            [class.touch__arrow--held]="direction() === move"
            [attr.data-move]="move"
          ></span>
        }
      </div>
      <div class="touch__buttons">
        @for (button of buttons; track button.id) {
          <button
            type="button"
            tabindex="-1"
            [class]="'touch__button touch__button--' + button.id"
            [class.touch__button--held]="held().has(button.id)"
            [attr.data-button]="button.id"
            [attr.aria-label]="button.name | transloco"
            (pointerdown)="buttonDown(button.id, $event)"
            (pointerup)="buttonUp(button.id, $event)"
            (pointercancel)="buttonUp(button.id, $event)"
            (lostpointercapture)="buttonUp(button.id, $event)"
          >
            {{ button.label | transloco }}
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './touch-controls.css',
})
export class TouchControls {
  /** Actions now held, e.g. `['MoveRight']` or A's `['Interact', 'Confirm']`. */
  readonly pressed = output<readonly Action[]>();
  readonly released = output<readonly Action[]>();

  protected readonly moves: readonly Move[] = ['MoveUp', 'MoveLeft', 'MoveRight', 'MoveDown'];
  protected readonly buttons: readonly {
    readonly id: ButtonId;
    readonly label: string;
    readonly name: string;
  }[] = [
    { id: 'b', label: 'touch.b.label', name: 'touch.b.name' },
    { id: 'a', label: 'touch.a.label', name: 'touch.a.name' },
  ];
  /** The direction the D-pad now holds. */
  protected readonly direction = signal<Move | undefined>(undefined);
  protected readonly held = signal<ReadonlySet<ButtonId>>(new Set());
  private padPointer: number | undefined;
  private readonly buttonPointers = new Map<ButtonId, number>();

  constructor() {
    // Like the keyboard: nothing stays held when the window loses focus or the page is hidden. (A new place starts a
    // new game, so nothing needs releasing when the controls go away.)
    const document = inject(DOCUMENT);
    const view = document.defaultView;
    const releaseAll = () => this.releaseAll();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll();
    };
    view?.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  protected padDown(event: PointerEvent): void {
    event.preventDefault();
    if (this.padPointer !== undefined) return;
    this.padPointer = event.pointerId;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.padMove(event);
  }

  protected padMove(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    const pad = (event.currentTarget as Element).getBoundingClientRect();
    const dx = event.clientX - (pad.left + pad.width / 2);
    const dy = event.clientY - (pad.top + pad.height / 2);
    if (Math.hypot(dx, dy) < (pad.width / 2) * DEAD_ZONE) {
      this.hold(undefined);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      this.hold(dx > 0 ? 'MoveRight' : 'MoveLeft');
    } else {
      this.hold(dy > 0 ? 'MoveDown' : 'MoveUp');
    }
  }

  protected padUp(event: PointerEvent): void {
    if (event.pointerId !== this.padPointer) return;
    this.padPointer = undefined;
    this.hold(undefined);
  }

  protected buttonDown(button: ButtonId, event: PointerEvent): void {
    event.preventDefault();
    if (this.buttonPointers.has(button)) return;
    this.buttonPointers.set(button, event.pointerId);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.held.update((held) => new Set([...held, button]));
    this.pressed.emit(BUTTON_ACTIONS[button]);
  }

  protected buttonUp(button: ButtonId, event: PointerEvent): void {
    if (this.buttonPointers.get(button) !== event.pointerId) return;
    this.release(button);
  }

  private hold(move: Move | undefined): void {
    const current = this.direction();
    if (current === move) return;
    if (current) this.released.emit([current]);
    this.direction.set(move);
    if (move) this.pressed.emit([move]);
  }

  private release(button: ButtonId): void {
    this.buttonPointers.delete(button);
    this.held.update((held) => new Set([...held].filter((id) => id !== button)));
    this.released.emit(BUTTON_ACTIONS[button]);
  }

  private releaseAll(): void {
    this.padPointer = undefined;
    this.hold(undefined);
    [...this.buttonPointers.keys()].forEach((button) => this.release(button));
  }
}
