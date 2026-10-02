import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiErrorCode, GameApi, apiErrorCode } from '../api/game-api';
import { SaveTokenStore } from './save-token-store';

/** Starting and resuming the game with an anonymous save slot (docs/decisions.md D4). */
@Injectable({ providedIn: 'root' })
export class GameSession {
  private readonly store = inject(SaveTokenStore);
  private readonly api = inject(GameApi);

  /** True once a new or continued game may be played. */
  readonly active = signal(false);
  /** A problem to show on the title screen, e.g. after the save disappeared during play. */
  readonly notice = signal<ApiErrorCode | null>(null);

  hasSavedGame(): boolean {
    return this.store.get() !== null;
  }

  /** Creates a new save slot. Resolves to an error code, or `null` on success. */
  async newGame(): Promise<ApiErrorCode | null> {
    try {
      const { token } = await firstValueFrom(this.api.createSave());
      this.store.set(token);
      this.active.set(true);
      return null;
    } catch (error) {
      return apiErrorCode(error);
    }
  }

  /** Checks the stored save with the server. Forgets it if the server no longer knows it. */
  async continueGame(): Promise<ApiErrorCode | null> {
    try {
      await firstValueFrom(this.api.natureDex());
      this.active.set(true);
      return null;
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'invalid_save_token') this.forgetSave();
      return code;
    }
  }

  /** The save cannot be used any more: drop it and leave the game. */
  forgetSave(): void {
    this.store.clear();
    this.active.set(false);
  }
}

/** The play screen needs a started or continued game; otherwise go to the title screen. */
export const playGuard: CanActivateFn = () =>
  inject(GameSession).active() || inject(Router).createUrlTree(['/']);
