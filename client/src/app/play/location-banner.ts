import { Component, input, output } from '@angular/core';

/**
 * The name of the place the player just entered, sliding in at the top centre and out again after about
 * 2.5 seconds. It takes no input, so the player keeps walking. Re-created by the host for every new place.
 */
@Component({
  selector: 'app-location-banner',
  template: `<p class="banner" role="status" (animationend)="done.emit()">{{ name() }}</p>`,
  styles: `
    :host {
      position: absolute;
      top: 0.75rem;
      left: 50%;
      z-index: 6;
      transform: translateX(-50%);
      pointer-events: none;
    }

    .banner {
      margin: 0;
      padding: 0.5rem 1.25rem;
      border: 3px solid var(--color-panel-border);
      background: var(--color-panel);
      color: var(--color-text);
      font-size: 1.1rem;
      white-space: nowrap;
      opacity: 0;
      animation: banner 2.5s ease-in-out forwards;
    }

    @keyframes banner {
      0% {
        opacity: 0;
        transform: translateY(-120%);
      }
      12%,
      88% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-120%);
      }
    }

    @keyframes banner-fade {
      0%,
      100% {
        opacity: 0;
      }
      12%,
      88% {
        opacity: 1;
      }
    }

    /* On narrow screens the banner goes below the corner indicator and torch button instead of over them. */
    @media (max-width: 40rem) {
      :host {
        top: 6.5rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .banner {
        animation-name: banner-fade;
      }
    }
  `,
})
export class LocationBanner {
  readonly name = input.required<string>();
  /** The animation finished; the host may remove the banner. */
  readonly done = output<void>();
}
