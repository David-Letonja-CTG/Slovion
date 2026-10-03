import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { QuestInfo } from '../api/game-api';

/** The active quest over the world: its title and progress, or the hint to return once the goal is met. */
@Component({
  selector: 'app-quest-tracker',
  imports: [TranslocoPipe],
  template: `
    <aside class="tracker" aria-live="polite" [attr.aria-label]="'quest.trackerLabel' | transloco">
      <span class="tracker__label">{{ 'quest.trackerLabel' | transloco }}</span>
      <strong class="tracker__title">{{ quest().title }}</strong>
      @if (ready()) {
        <span class="tracker__hint">{{ quest().returnHint }}</span>
      } @else {
        <span class="tracker__summary">{{ quest().summary }}</span>
        <span class="tracker__progress">{{
          'quest.progress' | transloco: { progress: quest().progress, goal: quest().goal }
        }}</span>
      }
    </aside>
  `,
  styles: `
    .tracker {
      display: grid;
      gap: 0.15rem;
      max-width: 14rem;
      padding: 0.5rem 0.75rem;
      border: 2px solid var(--color-panel-border);
      background: rgb(28 37 48 / 88%);
      color: var(--color-text);
      font-size: 0.85rem;
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
