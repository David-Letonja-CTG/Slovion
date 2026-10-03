import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Whether the browser reports a network connection. Only a hint: it can say online behind a dead
 * network, so requests still handle their own failures.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionStatus {
  private readonly state = signal(navigator.onLine);

  readonly online = this.state.asReadonly();

  constructor() {
    const update = () => this.state.set(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    });
  }
}
