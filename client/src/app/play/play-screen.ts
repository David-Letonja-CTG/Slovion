import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action, Game, Interaction, LoadedWorld } from '../../engine';
import { ApiErrorCode, DiscoveryResult, GameApi, apiErrorCode } from '../api/game-api';
import { GameCanvas } from '../game/game-canvas';
import { GameSession } from '../session/game-session';
import { MessageDialog } from './message-dialog';
import { NatureDexPanel } from './naturedex-panel';
import { WorldLoader } from './world-loader';

export const START_MAP = 'dravsko_polje_meadow';

type Overlay =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'discovery'; readonly result: DiscoveryResult }
  | { readonly kind: 'naturedex' }
  | { readonly kind: 'error'; readonly code: ApiErrorCode };

/** The game: the world on canvas plus UI overlays that take input while open. */
@Component({
  selector: 'app-play-screen',
  imports: [GameCanvas, MessageDialog, NatureDexPanel, TranslocoPipe],
  templateUrl: './play-screen.html',
  styleUrl: './play-screen.css',
})
export class PlayScreen {
  private readonly api = inject(GameApi);
  private readonly session = inject(GameSession);
  private readonly router = inject(Router);
  private readonly canvas = viewChild(GameCanvas);
  private game: Game | undefined;

  protected readonly world = signal<LoadedWorld | undefined>(undefined);
  protected readonly loadFailed = signal(false);
  protected readonly overlay = signal<Overlay>({ kind: 'none' });

  constructor() {
    inject(WorldLoader)
      .load(START_MAP)
      .then(
        (world) => this.world.set(world),
        () => this.loadFailed.set(true),
      );
  }

  protected onStarted(game: Game): void {
    this.game = game;
    game.onUiAction((action) => this.onUiAction(action));
  }

  protected onInteraction(interaction: Interaction): void {
    // Block the world right away, so the player cannot walk off while the server answers.
    this.open({ kind: 'pending' });
    this.api.discover(interaction.mapId, interaction.spotId).subscribe({
      next: (result) => this.overlay.set({ kind: 'discovery', result }),
      error: (error: unknown) => {
        const code = apiErrorCode(error);
        if (code === 'invalid_save_token') {
          this.onSaveLost();
        } else {
          this.overlay.set({ kind: 'error', code });
        }
      },
    });
  }

  protected onMenu(): void {
    this.open({ kind: 'naturedex' });
  }

  protected close(): void {
    this.overlay.set({ kind: 'none' });
    this.game?.setActionConsumer('world');
    this.canvas()?.focus();
  }

  /** The server no longer knows this save: back to the title screen with an explanation. */
  protected onSaveLost(): void {
    this.session.forgetSave();
    this.session.notice.set('invalid_save_token');
    void this.router.navigate(['/']);
  }

  private open(overlay: Overlay): void {
    this.overlay.set(overlay);
    this.game?.setActionConsumer('ui');
  }

  private onUiAction(action: Action): void {
    const kind = this.overlay().kind;
    const closesMessage = kind === 'discovery' || kind === 'error';
    if (
      (closesMessage && (action === 'Confirm' || action === 'Cancel')) ||
      (kind === 'naturedex' && action === 'Cancel')
    ) {
      this.close();
    }
  }
}
