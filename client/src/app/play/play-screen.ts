import { Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action, Game, Interaction, LoadedWorld } from '../../engine';
import {
  AlreadyIdentified,
  AnswerResult,
  ApiErrorCode,
  Encounter,
  GameApi,
  NothingFound,
  apiErrorCode,
} from '../api/game-api';
import { GameCanvas } from '../game/game-canvas';
import { GameSession } from '../session/game-session';
import { IdentificationDialog } from './identification-dialog';
import { MessageDialog } from './message-dialog';
import { NatureDexPanel } from './naturedex-panel';
import { WorldLoader } from './world-loader';

export const START_MAP = 'dravsko_polje_meadow';

type Overlay =
  | { readonly kind: 'none' }
  /** Waiting for the server; the world already has no input. */
  | { readonly kind: 'pending' }
  | { readonly kind: 'encounter'; readonly encounter: Encounter }
  | { readonly kind: 'result'; readonly result: AnswerResult }
  | { readonly kind: 'known'; readonly name: string }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'naturedex' }
  | { readonly kind: 'error'; readonly code: ApiErrorCode };

/** The game: the world on canvas plus UI overlays that take input while open. */
@Component({
  selector: 'app-play-screen',
  imports: [GameCanvas, IdentificationDialog, MessageDialog, NatureDexPanel, TranslocoPipe],
  templateUrl: './play-screen.html',
  styleUrl: './play-screen.css',
})
export class PlayScreen {
  private readonly api = inject(GameApi);
  private readonly session = inject(GameSession);
  private readonly router = inject(Router);
  private readonly canvas = viewChild(GameCanvas);
  private readonly identification = viewChild(IdentificationDialog);
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

  /** A spot starts an observation; a search may find something. The server decides both (D3). */
  protected onInteraction(interaction: Interaction): void {
    // Block the world right away, so the player cannot walk off while the server answers.
    this.open({ kind: 'pending' });
    const request =
      interaction.kind === 'spot'
        ? this.api.startEncounter(interaction.mapId, interaction.spotId)
        : this.api.search(interaction.mapId, interaction.x, interaction.y);
    request.subscribe({
      next: (result) => this.overlay.set(this.overlayFor(result)),
      error: (error: unknown) => this.onError(error),
    });
  }

  private overlayFor(result: Encounter | AlreadyIdentified | NothingFound): Overlay {
    if ('found' in result) return { kind: 'nothing' };
    if ('alreadyIdentified' in result) {
      return { kind: 'known', name: result.entry.species?.name ?? '' };
    }
    return { kind: 'encounter', encounter: result };
  }

  protected onAnswer(encounter: Encounter, speciesId: string): void {
    this.overlay.set({ kind: 'pending' });
    this.api.answer(encounter.encounterId, speciesId).subscribe({
      next: (result) => this.overlay.set({ kind: 'result', result }),
      error: (error: unknown) => this.onError(error),
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

  private onError(error: unknown): void {
    const code = apiErrorCode(error);
    if (code === 'invalid_save_token') {
      this.onSaveLost();
    } else {
      this.overlay.set({ kind: 'error', code });
    }
  }

  private open(overlay: Overlay): void {
    this.overlay.set(overlay);
    this.game?.setActionConsumer('ui');
  }

  private onUiAction(action: Action): void {
    const kind = this.overlay().kind;
    if (kind === 'encounter') {
      this.identification()?.handleAction(action);
    } else if (kind === 'result' || kind === 'known' || kind === 'nothing' || kind === 'error') {
      if (action === 'Confirm' || action === 'Cancel') this.close();
    } else if (kind === 'naturedex' && action === 'Cancel') {
      this.close();
    }
  }
}
