import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Weather, WorldTime } from '../../engine';

/**
 * The current season, time of day, clock and weather over the world, e.g. "Pomlad · jutro · 08:15 · dež", and the
 * place the player is in (docs/decisions.md D8, D11). Only season, time of day and weather are announced to screen
 * readers, not every minute. Labels are looked up dynamically:
 * t(weather.clear, weather.cloudy, weather.rain, weather.fog, weather.snow)
 * t(time.season.spring, time.season.summer, time.season.autumn, time.season.winter)
 * t(time.timeOfDay.morning, time.timeOfDay.day, time.timeOfDay.evening, time.timeOfDay.night)
 */
@Component({
  selector: 'app-conditions-indicator',
  imports: [TranslocoPipe],
  template: `
    <div class="conditions" [attr.aria-label]="'time.label' | transloco">
      <p class="conditions__now" aria-hidden="true">
        <span class="conditions__season">{{ 'time.season.' + time().season | transloco }}</span>
        ·
        <span class="conditions__time">{{ 'time.timeOfDay.' + time().timeOfDay | transloco }}</span>
        · <span class="conditions__clock">{{ clock() }}</span>
        @if (weather(); as now) {
          · <span class="conditions__weather">{{ 'weather.' + now | transloco }}</span>
        }
      </p>
      <p class="visually-hidden" aria-live="polite">
        {{ 'time.season.' + time().season | transloco }},
        {{ 'time.timeOfDay.' + time().timeOfDay | transloco }}
        @if (weather(); as now) {
          , {{ 'weather.' + now | transloco }}
        }
      </p>
      @if (location(); as place) {
        <p class="conditions__location" [attr.aria-label]="'area.label' | transloco">{{ place }}</p>
      }
    </div>
  `,
  styles: `
    .conditions {
      padding: 0.35rem 0.75rem;
      border: 2px solid var(--color-panel-border);
      background: rgb(28 37 48 / 88%);
      color: var(--color-text);
      font-size: 0.85rem;
      text-align: right;
    }

    .conditions p {
      margin: 0;
    }

    .conditions__clock {
      font-variant-numeric: tabular-nums;
    }

    .conditions__location {
      color: var(--color-text-muted);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class ConditionsIndicator {
  readonly time = input.required<WorldTime>();
  /** The name of the place the player is in, if known. */
  readonly location = input<string | undefined>(undefined);
  /** The current region's weather, if known (D11). */
  readonly weather = input<Weather | undefined>(undefined);

  protected readonly clock = computed(() => {
    const minuteOfDay = this.time().minuteOfDay;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
  });
}
