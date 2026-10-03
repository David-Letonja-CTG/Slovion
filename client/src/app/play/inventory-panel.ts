import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';
import { ItemInfo } from '../api/game-api';

/**
 * The bag (*Nahrbtnik*): the save's field tools with their icons, names and descriptions, as the server reported
 * them (D3). Keyboard input arrives as UI actions from the play screen: `Cancel`, `Confirm` and `Inventory` close it.
 */
@Component({
  selector: 'app-inventory-panel',
  imports: [TranslocoPipe],
  template: `
    <div class="overlay">
      <section
        class="dialog inventory"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-title"
      >
        <header class="inventory__header">
          <h2 id="inventory-title">{{ 'inventory.title' | transloco }}</h2>
          <button #close type="button" class="button" (click)="closed.emit()">
            {{ 'common.close' | transloco }}
          </button>
        </header>
        @if (items().length === 0) {
          <p class="inventory__empty">{{ 'inventory.empty' | transloco }}</p>
        }
        <ul class="inventory__list">
          @for (item of items(); track item.itemId) {
            <li class="inventory__item" [attr.data-item]="item.itemId">
              <img
                class="inventory__icon"
                [src]="'/content/item-icons/' + item.itemId + '.png'"
                alt=""
                width="16"
                height="16"
              />
              <div>
                <p class="inventory__name">{{ item.name }}</p>
                <p class="inventory__description">{{ item.description }}</p>
              </div>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styleUrl: './overlay.css',
  styles: `
    .inventory {
      width: min(28rem, 100%);
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      text-align: left;
    }

    .inventory__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .inventory__header h2,
    .inventory__empty {
      margin: 0;
    }

    .inventory__list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .inventory__item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.4rem 0.6rem;
      background: rgb(0 0 0 / 15%);
    }

    .inventory__icon {
      width: 2.5rem;
      height: 2.5rem;
      image-rendering: pixelated;
    }

    .inventory__name {
      margin: 0;
      font-weight: bold;
    }

    .inventory__description {
      margin: 0.15rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.9rem;
    }
  `,
})
export class InventoryPanel {
  readonly items = input.required<readonly ItemInfo[]>();
  readonly closed = output<void>();
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('close');

  constructor() {
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }

  /** Keyboard input routed from the play screen while the bag is open. */
  handleAction(action: Action): void {
    if (action === 'Cancel' || action === 'Confirm' || action === 'Inventory') this.closed.emit();
  }
}
