import { DOCUMENT } from '@angular/common';
import { InjectionToken, Signal, inject, signal } from '@angular/core';

/**
 * Whether the screen is upright (taller than wide), as the CSS `orientation: portrait` media query sees it, updated
 * when the device is turned or the window resized. Replaceable in tests.
 */
export const PORTRAIT = new InjectionToken<Signal<boolean>>('PORTRAIT', {
  providedIn: 'root',
  factory: () => {
    const query = inject(DOCUMENT).defaultView?.matchMedia?.('(orientation: portrait)');
    const portrait = signal(query?.matches ?? false);
    // Root-provided, so it listens for the app's lifetime.
    query?.addEventListener?.('change', (event) => portrait.set(event.matches));
    return portrait.asReadonly();
  },
});
