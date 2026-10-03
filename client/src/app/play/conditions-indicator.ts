import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Season, TimeOfDay } from '../../engine';

/**
 * The current season and time of day over the world, e.g. "Pomlad · jutro" (docs/decisions.md D8).
 * Labels are looked up dynamically:
 * t(time.season.spring, time.season.summer, time.season.autumn, time.season.winter)
 * t(time.timeOfDay.morning, time.timeOfDay.day, time.timeOfDay.evening, time.timeOfDay.night)
 */
@Component({
  selector: 'app-conditions-indicator',
  imports: [TranslocoPipe],
  template: `
    <p class="conditions" aria-live="polite" [attr.aria-label]="'time.label' | transloco">
      <span class="conditions__season">{{ 'time.season.' + season() | transloco }}</span>
      ·
      <span class="conditions__time">{{ 'time.timeOfDay.' + timeOfDay() | transloco }}</span>
    </p>
  `,
  styles: `
    .conditions {
      margin: 0;
      padding: 0.35rem 0.75rem;
      border: 2px solid var(--color-panel-border);
      background: rgb(28 37 48 / 88%);
      color: var(--color-text);
      font-size: 0.85rem;
    }
  `,
})
export class ConditionsIndicator {
  readonly season = input.required<Season>();
  readonly timeOfDay = input.required<TimeOfDay>();
}
