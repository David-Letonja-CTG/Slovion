import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * The browser's fullscreen mode for the whole page, so dialogs and controls come along. Not every browser has it
 * (Safari on iPhone does not); there `available` is false.
 */
@Injectable({ providedIn: 'root' })
export class Fullscreen {
  private readonly document = inject(DOCUMENT);

  readonly available = this.document.fullscreenEnabled === true;
  /** Follows the browser, so leaving with `Esc` is noticed too. */
  readonly active = signal(this.isActive());

  constructor() {
    const onChange = () => this.active.set(this.isActive());
    this.document.addEventListener('fullscreenchange', onChange);
    inject(DestroyRef).onDestroy(() =>
      this.document.removeEventListener('fullscreenchange', onChange),
    );
  }

  toggle(): void {
    if (!this.available) return;
    const change = this.active()
      ? this.document.exitFullscreen()
      : this.document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Refused, e.g. without a user gesture: the page simply stays as it is.
    void change.catch(() => undefined);
  }

  private isActive(): boolean {
    return (this.document.fullscreenElement ?? null) !== null;
  }
}
