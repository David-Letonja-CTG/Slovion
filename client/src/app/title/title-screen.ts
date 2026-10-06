import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiErrorCode } from '../api/game-api';
import { ConnectionStatus } from '../pwa/connection-status';
import { GameSession } from '../session/game-session';

@Component({
  selector: 'app-title-screen',
  imports: [TranslocoPipe],
  templateUrl: './title-screen.html',
  styleUrl: './title-screen.css',
})
export class TitleScreen {
  private readonly session = inject(GameSession);
  private readonly router = inject(Router);

  /** The browser's connection report; offline, the title screen says a connection is needed. */
  protected readonly online = inject(ConnectionStatus).online;

  protected readonly hasSave = signal(this.session.hasSavedGame());
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<ApiErrorCode | null>(this.session.notice());

  constructor() {
    this.session.notice.set(null);
  }

  protected newGame(): void {
    // The device keeps one save, so replacing it needs confirmation.
    if (this.hasSave()) {
      this.confirming.set(true);
    } else {
      void this.start(() => this.session.newGame());
    }
  }

  protected confirmReplace(): void {
    this.confirming.set(false);
    void this.start(() => this.session.newGame());
  }

  protected cancelReplace(): void {
    this.confirming.set(false);
  }

  protected continueGame(): void {
    void this.start(() => this.session.continueGame());
  }

  private async start(action: () => Promise<ApiErrorCode | null>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const error = await action();
    this.busy.set(false);

    if (error) {
      this.error.set(error);
      this.hasSave.set(this.session.hasSavedGame());
    } else {
      // The address's query (e.g. the development-only ?debug=world) carries over to the game.
      await this.router.navigate(['/play'], { queryParamsHandling: 'preserve' });
    }
  }
}
