import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Reloads the page; replaced in tests. */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => () => document.location.reload(),
});

/**
 * New versions of the installed app: the service worker downloads them in the background, and the
 * player chooses when to load one. A broken cache is reported the same way, since reloading fixes it.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly updates = inject(SwUpdate);
  private readonly reloadPage = inject(PAGE_RELOAD);
  private readonly ready = signal(false);

  /** Whether a new version is waiting for a reload. */
  readonly available = this.ready.asReadonly();

  constructor() {
    // Without a service worker (development, unsupported browsers) there is nothing to update.
    if (!this.updates.isEnabled) return;
    this.updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    this.updates.unrecoverable.subscribe(() => this.ready.set(true));
  }

  /** Loads the new version. Progress lives on the server, so nothing is lost. */
  reload(): void {
    this.reloadPage();
  }
}
