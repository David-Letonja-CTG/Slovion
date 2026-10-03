import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppUpdates } from './app-updates';

/**
 * A small panel offering a new version of the game. It isn't modal and doesn't take game input, so a
 * walk goes on until the player chooses *Osveži*.
 */
@Component({
  selector: 'app-update-notice',
  imports: [TranslocoPipe],
  template: `
    @if (updates.available()) {
      <aside class="update" role="status">
        <p class="update__text">{{ 'app.updateReady' | transloco }}</p>
        <button type="button" class="button button--primary" (click)="updates.reload()">
          {{ 'app.reload' | transloco }}
        </button>
      </aside>
    }
  `,
  styles: `
    .update {
      position: fixed;
      bottom: 0.75rem;
      left: 50%;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      max-width: calc(100% - 1.5rem);
      padding: 0.5rem 0.75rem;
      border: 2px solid var(--color-panel-border);
      background: var(--color-panel);
      transform: translateX(-50%);
    }

    .update__text {
      margin: 0;
    }
  `,
})
export class UpdateNotice {
  protected readonly updates = inject(AppUpdates);
}
