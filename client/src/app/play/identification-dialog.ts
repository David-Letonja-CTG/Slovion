import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';
import { Encounter } from '../api/game-api';

type Option =
  | { readonly kind: 'clue' }
  | { readonly kind: 'candidate'; readonly speciesId: string; readonly name: string }
  | { readonly kind: 'leave' };

/**
 * Observation puzzle (docs/decisions.md D1): read clues one at a time, then pick the species.
 * Keyboard input arrives as UI actions from the play screen; mouse and touch click directly.
 */
@Component({
  selector: 'app-identification-dialog',
  imports: [TranslocoPipe],
  templateUrl: './identification-dialog.html',
  styleUrls: ['./overlay.css', './identification-dialog.css'],
})
export class IdentificationDialog {
  readonly encounter = input.required<Encounter>();
  /** Clues shown when the dialog opens: 2 for plants and insects with the magnifier, otherwise 1. */
  readonly initialClues = input(1);
  readonly answered = output<string>();
  readonly left = output<void>();

  protected readonly revealed = linkedSignal(() => this.initialClues());
  protected readonly selected = signal(0);
  protected readonly visibleClues = computed(() =>
    this.encounter().clues.slice(0, this.revealed()),
  );
  protected readonly options = computed<readonly Option[]>(() => [
    ...(this.revealed() < this.encounter().clues.length ? [{ kind: 'clue' } as const] : []),
    ...this.encounter().candidates.map((c) => ({ kind: 'candidate', ...c }) as const),
    { kind: 'leave' } as const,
  ]);

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('option');

  constructor() {
    // Focus follows the selection, so screen readers and the visible focus ring stay in sync.
    effect(() => this.buttons()[this.selected()]?.nativeElement.focus());
  }

  /** Keyboard input routed from the play screen while this dialog has input. */
  handleAction(action: Action): void {
    const count = this.options().length;
    if (action === 'MoveDown') this.selected.update((i) => (i + 1) % count);
    if (action === 'MoveUp') this.selected.update((i) => (i - 1 + count) % count);
    if (action === 'Confirm') this.activate(this.selected());
    if (action === 'Cancel') this.left.emit();
  }

  protected activate(index: number): void {
    const option = this.options()[index];
    this.selected.set(index);
    if (option.kind === 'clue') {
      this.revealed.update((n) => n + 1);
      // The clue button disappears with the last clue; keep the selection on the same row.
      this.selected.set(Math.min(index, this.options().length - 1));
    } else if (option.kind === 'candidate') {
      this.answered.emit(option.speciesId);
    } else {
      this.left.emit();
    }
  }
}
