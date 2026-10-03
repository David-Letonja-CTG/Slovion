import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Action, Game, Interaction, WorldTime, worldTimeAt } from '../../engine';
import {
  AlreadyIdentified,
  AnswerResult,
  ApiErrorCode,
  Conversation,
  Encounter,
  GameApi,
  NothingFound,
  PlayerProgress,
  WorldTimeInfo,
  apiErrorCode,
} from '../api/game-api';
import { GameCanvas } from '../game/game-canvas';
import { GameSession } from '../session/game-session';
import { ConditionsIndicator } from './conditions-indicator';
import { LocationBanner } from './location-banner';
import { DialogueBox } from './dialogue-box';
import { IdentificationDialog } from './identification-dialog';
import { MessageDialog } from './message-dialog';
import { NatureDexPanel } from './naturedex-panel';
import { QuestTracker } from './quest-tracker';
import { LoadedPlace, WorldLoader } from './world-loader';

export const START_MAP = 'dravsko_polje_meadow';

/** Marks a failed map load, as opposed to a failed progress request. */
const MAP_FAILED = Symbol('map');

/**
 * Why the game could not start; each has a key `errors.<reason>`, used dynamically:
 * t(errors.map)
 */
type LoadError = 'map' | ApiErrorCode;

type Overlay =
  | { readonly kind: 'none' }
  /** Waiting for the server; the world already has no input. */
  | { readonly kind: 'pending' }
  | { readonly kind: 'encounter'; readonly encounter: Encounter }
  | { readonly kind: 'result'; readonly result: AnswerResult }
  | { readonly kind: 'known'; readonly name: string }
  | { readonly kind: 'nothing' }
  /** A spot whose species is not around at the save's in-game time (D8). */
  | { readonly kind: 'notNow' }
  | { readonly kind: 'naturedex' }
  | { readonly kind: 'dialogue'; readonly conversation: Conversation }
  | { readonly kind: 'error'; readonly code: ApiErrorCode };

/** The game: the world on canvas plus UI overlays that take input while open. */
@Component({
  selector: 'app-play-screen',
  imports: [
    ConditionsIndicator,
    DialogueBox,
    GameCanvas,
    IdentificationDialog,
    LocationBanner,
    MessageDialog,
    NatureDexPanel,
    QuestTracker,
    TranslocoPipe,
  ],
  templateUrl: './play-screen.html',
  styleUrl: './play-screen.css',
})
export class PlayScreen {
  private readonly api = inject(GameApi);
  private readonly session = inject(GameSession);
  private readonly router = inject(Router);
  private readonly canvas = viewChild(GameCanvas);
  private readonly identification = viewChild(IdentificationDialog);
  private readonly natureDex = viewChild(NatureDexPanel);
  private readonly dialogue = viewChild(DialogueBox);
  private game: Game | undefined;

  protected readonly world = signal<LoadedPlace | undefined>(undefined);
  protected readonly loadError = signal<LoadError | undefined>(undefined);
  protected readonly overlay = signal<Overlay>({ kind: 'none' });
  /** The save's flags and quests, as the server last reported them (D3). */
  protected readonly progress = signal<PlayerProgress>({ flags: [], quests: [] });
  /** The save's in-game clock at load, passed to the engine, which advances it (D8). */
  protected readonly worldTime = signal<WorldTimeInfo | undefined>(undefined);
  /** The current in-game time, as the engine reports it every in-game minute. */
  protected readonly time = signal<WorldTime | undefined>(undefined);
  /** The place the player is in, and the banner announcing a newly entered place. */
  protected readonly area = signal<string | undefined>(undefined);
  protected readonly areaName = computed(() => {
    const area = this.area();
    return area === undefined ? undefined : this.world()?.areaNames[area];
  });
  protected readonly banner = signal<{ readonly key: number; readonly name: string } | undefined>(
    undefined,
  );
  protected readonly torchOn = signal(false);
  protected readonly activeQuest = computed(() =>
    this.progress().quests.find((quest) => quest.status === 'active'),
  );

  constructor() {
    // The world starts only with the save's progress, so gates are right from the first frame.
    Promise.all([
      inject(WorldLoader)
        .load(START_MAP)
        .catch(() => Promise.reject(MAP_FAILED)),
      firstValueFrom(this.api.progress()),
      firstValueFrom(this.api.time()),
    ]).then(
      ([world, progress, time]) => {
        this.progress.set(progress);
        this.worldTime.set(time);
        this.time.set(worldTimeAt(time.minutes));
        this.world.set(world);
      },
      (error: unknown) => {
        const reason = error === MAP_FAILED ? 'map' : apiErrorCode(error);
        if (reason === 'invalid_save_token') {
          this.onSaveLost();
        } else {
          this.loadError.set(reason);
        }
      },
    );

    // The game loop pauses while the page is hidden, but the server clock does not: re-sync on return.
    const document = inject(DOCUMENT);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && this.game) this.syncTime();
    };
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  protected onTimeChanged(time: WorldTime): void {
    this.time.set(time);
  }

  /** A new place: show its name and announce it with the banner. */
  protected onAreaChanged(area: string): void {
    this.area.set(area);
    const name = this.world()?.areaNames[area];
    if (name) this.banner.update((banner) => ({ key: (banner?.key ?? 0) + 1, name }));
  }

  protected onBannerDone(key: number): void {
    if (this.banner()?.key === key) this.banner.set(undefined);
  }

  protected onTorchChanged(on: boolean): void {
    this.torchOn.set(on);
  }

  /** The on-screen torch button; keyboard players use the Torch action. Focus goes back to the game. */
  protected toggleTorch(): void {
    this.game?.setTorch(!this.torchOn());
    this.canvas()?.focus();
  }

  private syncTime(): void {
    this.api.time().subscribe({
      next: (time) => {
        this.game?.setWorldTime(time.minutes);
      },
      // A failed re-sync keeps the local clock; the server still decides every encounter.
      error: () => undefined,
    });
  }

  protected onStarted(game: Game): void {
    this.game = game;
    game.onUiAction((action) => this.onUiAction(action));
  }

  /** An NPC talks; a spot starts an observation; a search may find something. The server decides (D3). */
  protected onInteraction(interaction: Interaction): void {
    // Block the world right away, so the player cannot walk off while the server answers.
    this.open({ kind: 'pending' });
    if (interaction.kind === 'npc') {
      this.api.talk(interaction.mapId, interaction.npcId).subscribe({
        next: (conversation) => this.overlay.set({ kind: 'dialogue', conversation }),
        error: (error: unknown) => this.onError(error),
      });
      return;
    }

    const request =
      interaction.kind === 'spot'
        ? this.api.startEncounter(interaction.mapId, interaction.spotId)
        : this.api.search(interaction.mapId, interaction.x, interaction.y);
    const kind = interaction.kind;
    request.subscribe({
      next: (result) => this.overlay.set(this.overlayFor(result, kind)),
      error: (error: unknown) => this.onError(error),
    });
  }

  private overlayFor(
    result: Encounter | AlreadyIdentified | NothingFound,
    interaction: 'spot' | 'search',
  ): Overlay {
    if ('found' in result) return { kind: interaction === 'spot' ? 'notNow' : 'nothing' };
    if ('alreadyIdentified' in result) {
      return { kind: 'known', name: result.entry.species?.name ?? '' };
    }
    return { kind: 'encounter', encounter: result };
  }

  protected onAnswer(encounter: Encounter, speciesId: string): void {
    this.overlay.set({ kind: 'pending' });
    this.api.answer(encounter.encounterId, speciesId).subscribe({
      next: (result) => {
        if (result.correct) this.countIdentification();
        this.overlay.set({ kind: 'result', result });
      },
      error: (error: unknown) => this.onError(error),
    });
  }

  /** Applies what the conversation changed once the player has read it: the gate opens as the box closes. */
  protected onDialogueClosed(conversation: Conversation): void {
    this.game?.setOpenFlags(conversation.flags);
    this.progress.update((progress) => ({
      flags: conversation.flags,
      quests: [
        ...progress.quests.filter((quest) => quest.questId !== conversation.quest.questId),
        conversation.quest,
      ],
    }));
    this.close();
  }

  /**
   * A new identification moves active quests on. This only updates the tracker; the server stays
   * authoritative and confirms progress on the next conversation or load.
   */
  private countIdentification(): void {
    this.progress.update((progress) => ({
      ...progress,
      quests: progress.quests.map((quest) =>
        quest.status === 'active'
          ? { ...quest, progress: Math.min(quest.goal, quest.progress + 1) }
          : quest,
      ),
    }));
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
    } else if (
      kind === 'result' ||
      kind === 'known' ||
      kind === 'nothing' ||
      kind === 'notNow' ||
      kind === 'error'
    ) {
      if (action === 'Confirm' || action === 'Cancel') this.close();
    } else if (kind === 'naturedex') {
      this.natureDex()?.handleAction(action);
    } else if (kind === 'dialogue') {
      this.dialogue()?.handleAction(action);
    }
  }
}
