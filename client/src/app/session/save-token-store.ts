import { Injectable, InjectionToken, inject } from '@angular/core';

/** Device storage for the save token; `undefined` when the browser blocks it. */
export const DEVICE_STORAGE = new InjectionToken<Storage | undefined>('DEVICE_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  },
});

/**
 * Keeps the anonymous save token on this device (docs/decisions.md D4). If device storage is
 * unavailable, the token lives in memory so the current visit stays playable.
 */
@Injectable({ providedIn: 'root' })
export class SaveTokenStore {
  static readonly storageKey = 'slovion.saveToken';

  private readonly storage = inject(DEVICE_STORAGE);
  private memory: string | null = null;

  get(): string | null {
    if (this.memory) return this.memory;
    try {
      return this.storage?.getItem(SaveTokenStore.storageKey) ?? null;
    } catch {
      return null;
    }
  }

  set(token: string): void {
    this.memory = token;
    try {
      this.storage?.setItem(SaveTokenStore.storageKey, token);
    } catch {
      // Storage blocked (e.g. a private window): the in-memory token still works for this visit.
    }
  }

  clear(): void {
    this.memory = null;
    try {
      this.storage?.removeItem(SaveTokenStore.storageKey);
    } catch {
      // Nothing stored that could be removed.
    }
  }
}
