import { Component, computed, input } from '@angular/core';

export type HudIconName = 'torch' | 'bag' | 'journal' | 'more';

/** Each icon is drawn from rectangles on a 12×12 pixel grid: [x, y, width, height]. Original drawings (D10). */
const ICONS: Readonly<Record<HudIconName, readonly (readonly [number, number, number, number])[]>> =
  {
    // A flame with a hollow core.
    torch: [
      [5, 0, 1, 1],
      [5, 1, 2, 1],
      [4, 2, 3, 1],
      [4, 3, 4, 1],
      [3, 4, 5, 1],
      [3, 5, 6, 1],
      [2, 6, 3, 1],
      [6, 6, 4, 1],
      [2, 7, 2, 2],
      [7, 7, 3, 2],
      [2, 9, 3, 1],
      [6, 9, 4, 1],
      [3, 10, 6, 1],
      [4, 11, 4, 1],
    ],
    // A rucksack: loop, flap, sides and a front pocket.
    bag: [
      [5, 1, 2, 1],
      [2, 2, 8, 1],
      [1, 3, 10, 3],
      [1, 6, 1, 5],
      [10, 6, 1, 5],
      [3, 7, 6, 1],
      [3, 8, 1, 2],
      [8, 8, 1, 2],
      [3, 10, 6, 1],
      [1, 11, 10, 1],
    ],
    // An open book with lines on both pages.
    journal: [
      [1, 2, 4, 1],
      [7, 2, 4, 1],
      [0, 3, 1, 7],
      [11, 3, 1, 7],
      [5, 3, 2, 8],
      [2, 5, 2, 1],
      [8, 5, 2, 1],
      [2, 7, 2, 1],
      [8, 7, 2, 1],
      [1, 10, 4, 1],
      [7, 10, 4, 1],
    ],
    // Three dots.
    more: [
      [1, 5, 2, 2],
      [5, 5, 2, 2],
      [9, 5, 2, 2],
    ],
  };

/** A small pixel icon for the play screen's HUD buttons; decorative, the button's label names it. */
@Component({
  selector: 'app-hud-icon',
  template: `
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
      @for (rect of rects(); track $index) {
        <rect
          [attr.x]="rect[0]"
          [attr.y]="rect[1]"
          [attr.width]="rect[2]"
          [attr.height]="rect[3]"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    svg {
      width: 1.5rem;
      height: 1.5rem;
      fill: currentColor;
    }
  `,
})
export class HudIcon {
  readonly name = input.required<HudIconName>();
  protected readonly rects = computed(() => ICONS[this.name()]);
}
