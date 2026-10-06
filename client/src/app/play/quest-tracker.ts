import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { QuestInfo } from '../api/game-api';

/**
 * The active quest over the world: its title and progress, or the hint to return once the goal is met. The player can
 * fold away the summary to keep more of the world in view.
 */
@Component({
  selector: 'app-quest-tracker',
  imports: [TranslocoPipe],
  template: `
    <aside class="tracker" aria-live="polite" [attr.aria-label]="'quest.trackerLabel' | transloco">
      <details open>
        <summary class="tracker__head">
          <span class="tracker__label">{{ 'quest.trackerLabel' | transloco }}</span>
          <strong class="tracker__title">{{ quest().title }}</strong>
          @if (ready()) {
            <span class="tracker__hint">{{ quest().returnHint }}</span>
          } @else {
            <span class="tracker__progress">{{
              'quest.progress' | transloco: { progress: quest().progress, goal: quest().goal }
            }}</span>
          }
        </summary>
        @if (!ready()) {
          <p class="tracker__summary">{{ quest().summary }}</p>
        }
      </details>
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }

    .tracker {
      max-width: 14rem;
      padding: 0.4rem 0.75rem;
      border: 2px solid var(--color-panel-border);
      background: rgb(28 37 48 / 88%);
      color: var(--color-text);
      font-size: 0.85rem;
    }

    .tracker__head {
      position: relative;
      display: grid;
      gap: 0.15rem;
      padding-right: 1rem;
      list-style: none;
      cursor: pointer;
    }

    .tracker__head::-webkit-details-marker {
      display: none;
    }

    /* A small triangle that points down while open and right while folded. */
    .tracker__head::after {
      position: absolute;
      top: 0.35rem;
      right: 0;
      border: 0.3rem solid transparent;
      border-top-color: var(--color-text-muted);
      border-bottom-width: 0;
      content: '';
    }

    details:not([open]) .tracker__head::after {
      transform: rotate(-90deg);
    }

    .tracker__head:focus-visible {
      outline: 3px solid var(--color-warning);
      outline-offset: 2px;
    }

    .tracker__summary {
      margin: 0.15rem 0 0;
    }

    .tracker__label {
      color: var(--color-text-muted);
      font-size: 0.75rem;
    }

    .tracker__hint,
    .tracker__progress {
      color: var(--color-warning);
    }
  `,
})
export class QuestTracker {
  readonly quest = input.required<QuestInfo>();
  protected readonly ready = computed(() => this.quest().progress >= this.quest().goal);
}
