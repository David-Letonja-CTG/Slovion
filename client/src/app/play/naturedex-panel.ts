import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiErrorCode, GameApi, NatureDexEntry, apiErrorCode } from '../api/game-api';

type PanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly entries: readonly NatureDexEntry[] }
  | { readonly kind: 'error'; readonly code: ApiErrorCode };

/** The NatureDex, shown to players as "Terenski dnevnik" (docs/decisions.md D10). */
@Component({
  selector: 'app-naturedex-panel',
  imports: [DatePipe, TranslocoPipe],
  templateUrl: './naturedex-panel.html',
  styleUrls: ['./overlay.css', './naturedex-panel.css'],
})
export class NatureDexPanel {
  readonly closed = output<void>();
  /** The save no longer exists on the server. */
  readonly saveLost = output<void>();

  protected readonly state = signal<PanelState>({ kind: 'loading' });
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('close');

  constructor() {
    inject(GameApi)
      .natureDex()
      .subscribe({
        next: ({ entries }) => this.state.set({ kind: 'loaded', entries }),
        error: (error: unknown) => {
          const code = apiErrorCode(error);
          if (code === 'invalid_save_token') this.saveLost.emit();
          this.state.set({ kind: 'error', code });
        },
      });
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }
}
