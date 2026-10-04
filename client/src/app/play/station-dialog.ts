import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';
import { StationInfo } from '../api/game-api';

/**
 * A research station's board: its theme, its species with their research stars (silhouettes until identified) and
 * the progress towards its goal, as the server reported them (D3). Keyboard input arrives as UI actions from the play
 * screen: `Cancel` and `Confirm` close it.
 */
@Component({
  selector: 'app-station-dialog',
  imports: [TranslocoPipe],
  template: `
    <div class="overlay">
      <section
        class="dialog station"
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-title"
      >
        <header class="station__header">
          <div>
            <h2 id="station-title">{{ station().name }}</h2>
            <p class="station__theme">{{ station().theme }}</p>
          </div>
          <button #close type="button" class="button" (click)="closed.emit()">
            {{ 'common.close' | transloco }}
          </button>
        </header>
        <ul class="station__species">
          @for (species of station().species; track species.speciesId) {
            <li
              class="station__picture"
              [class.station__picture--unknown]="species.name === null"
              [attr.data-species]="species.speciesId"
            >
              <img [src]="pictureUrl(species.speciesId)" alt="" width="32" height="32" />
              <span class="station__name">{{
                species.name ?? ('naturedex.unknown' | transloco)
              }}</span>
              @if (species.name !== null) {
                <span
                  class="station__stars"
                  [attr.aria-label]="'naturedex.research' | transloco: { level: species.level }"
                  >{{ filled(species.level)
                  }}<span class="stars__empty">{{ empty(species.level) }}</span></span
                >
              }
            </li>
          }
        </ul>
        <p class="station__progress">
          {{
            'station.progress'
              | transloco: { researched: station().researched, goal: station().goal }
          }}
        </p>
        @if (station().met) {
          <p class="station__met">{{ 'station.met' | transloco }}</p>
        }
      </section>
    </div>
  `,
  styleUrl: './overlay.css',
  styles: `
    .station {
      width: min(34rem, 100%);
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      text-align: left;
    }

    .station__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .station__header h2,
    .station__theme,
    .station__progress,
    .station__met {
      margin: 0;
    }

    .station__theme {
      color: var(--color-text-muted);
    }

    .station__species {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .station__picture {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.4rem;
      background: rgb(0 0 0 / 15%);
      text-align: center;
    }

    .station__picture img {
      width: 3.5rem;
      height: 3.5rem;
      image-rendering: pixelated;
    }

    .station__picture--unknown img {
      filter: brightness(0);
      opacity: 0.7;
    }

    .station__name {
      font-size: 0.85rem;
    }

    .station__stars {
      color: #e8c94a;
    }

    .stars__empty {
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .station__met {
      color: var(--color-accent);
    }
  `,
})
export class StationDialog {
  readonly station = input.required<StationInfo>();
  readonly closed = output<void>();
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('close');

  constructor() {
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }

  /** Keyboard input routed from the play screen while the board is open. */
  handleAction(action: Action): void {
    if (action === 'Cancel' || action === 'Confirm') this.closed.emit();
  }

  protected pictureUrl(speciesId: string): string {
    return `/content/species-pictures/${encodeURIComponent(speciesId)}.png`;
  }

  protected filled(level: number): string {
    return '★'.repeat(Math.max(0, Math.min(3, level)));
  }

  protected empty(level: number): string {
    return '☆'.repeat(3 - Math.max(0, Math.min(3, level)));
  }
}
