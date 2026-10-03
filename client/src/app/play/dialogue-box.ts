import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';

/**
 * An NPC's lines, one at a time. Keyboard input arrives as UI actions from the play screen:
 * `Confirm` shows the next line and closes after the last, `Cancel` closes at once.
 */
@Component({
  selector: 'app-dialogue-box',
  imports: [TranslocoPipe],
  template: `
    <div class="overlay overlay--bottom">
      <section
        class="dialog dialogue"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-name"
      >
        <h2 id="dialogue-name" class="dialogue__name">{{ name() }}</h2>
        <p class="dialogue__line" aria-live="polite">{{ lines()[index()] }}</p>
        <button
          #next
          type="button"
          class="button button--primary dialogue__next"
          (click)="advance()"
        >
          {{ (isLast() ? 'common.close' : 'dialogue.next') | transloco }}
        </button>
      </section>
    </div>
  `,
  styleUrls: ['./overlay.css', './dialogue-box.css'],
})
export class DialogueBox {
  readonly name = input.required<string>();
  readonly lines = input.required<readonly string[]>();
  readonly closed = output<void>();

  protected readonly index = signal(0);
  protected readonly isLast = computed(() => this.index() >= this.lines().length - 1);
  private readonly nextButton = viewChild.required<ElementRef<HTMLButtonElement>>('next');

  constructor() {
    // Keep focus on the button as lines change, so Enter and screen readers follow the dialogue.
    effect(() => {
      this.index();
      this.nextButton().nativeElement.focus();
    });
  }

  /** Keyboard input routed from the play screen while the box is open. */
  handleAction(action: Action): void {
    if (action === 'Confirm') this.advance();
    if (action === 'Cancel') this.closed.emit();
  }

  protected advance(): void {
    if (this.isLast()) {
      this.closed.emit();
    } else {
      this.index.update((i) => i + 1);
    }
  }
}
