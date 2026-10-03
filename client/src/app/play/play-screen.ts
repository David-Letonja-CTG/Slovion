import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Action, Game, Interaction, ResidentInfo, WorldTime, worldTimeAt } from '../../engine';
import {
  AlreadyIdentified,
  AnswerResult,
  ApiErrorCode,
  Conversation,
  Encounter,
  GameApi,
  NothingFound,
  PlayerProgress,
  RegionInfo,
  RegionsInfo,
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
import { TravelMap } from './travel-map';
import { LoadedPlace, WorldLoader } from './world-loader';

/** How long the screen takes to fade out (and in again) when travelling; none for players who prefer reduced motion. */
export const TRAVEL_FADE_MS = new InjectionToken<number>('TRAVEL_FADE_MS', {
  providedIn: 'root',
  factory: () =>
    inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 300,
});

/** The map of the save's current region (the server reports the start region if content removed it). */
function currentMapOf({ currentRegionId, regions }: RegionsInfo): string {
  return (regions.find((region) => region.regionId === currentRegionId) ?? regions[0]).mapId;
}

/** A loaded map with its resident animals. */
interface Place {
  readonly mapId: string;
  readonly world: LoadedPlace;
  readonly residents: readonly ResidentInfo[];
}

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
  /** A sighting of an identified species: whether it advanced the research, and the level now. */
  | {
      readonly kind: 'known';
      readonly name: string;
      readonly level: number;
      readonly researched: boolean;
    }
  | { readonly kind: 'nothing' }
  /** A spot whose species is not around at the save's in-game time (D8). */
  | { readonly kind: 'notNow' }
  | { readonly kind: 'naturedex' }
  | { readonly kind: 'dialogue'; readonly conversation: Conversation }
  /** The travel map opened at a signpost. */
  | { readonly kind: 'travel'; readonly regions: RegionsInfo }
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
    TravelMap,
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
  private readonly travelMap = viewChild(TravelMap);
  private readonly fadeMs = inject(TRAVEL_FADE_MS);
  private game: Game | undefined;
  /** The map of the place the player is in. */
  private mapId = '';
  /** Set while arriving in a region, so the new game gets focus and the torch carries over. */
  private arriving = false;

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
  /** The screen is dark while travelling to another region. */
  protected readonly fading = signal(false);
  /** The map's resident animals, as the server last listed them (D3, D8). */
  protected readonly residents = signal<readonly ResidentInfo[]>([]);
  private readonly loader = inject(WorldLoader);
  protected readonly activeQuest = computed(() =>
    this.progress().quests.find((quest) => quest.status === 'active'),
  );

  constructor() {
    // The game continues in the save's current region. The world starts only with the save's progress, so gates
    // are right from the first frame.
    firstValueFrom(this.api.regions())
      .then((regions) =>
        Promise.all([
          this.loadPlace(currentMapOf(regions)),
          firstValueFrom(this.api.progress()),
          firstValueFrom(this.api.time()),
        ]),
      )
      .then(([place, progress, time]) => {
        this.progress.set(progress);
        this.enter(place, time);
      })
      .catch((error: unknown) => {
        const reason = error === MAP_FAILED ? 'map' : apiErrorCode(error);
        if (reason === 'invalid_save_token') {
          this.onSaveLost();
        } else {
          this.loadError.set(reason);
        }
      });

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

  /** The map with its sprites, and its residents with their walk sprites. */
  private async loadPlace(mapId: string): Promise<Place> {
    const [world, { animals }] = await Promise.all([
      this.loader.load(mapId).catch((cause: unknown) => {
        // The player sees one message; developers get the cause (invalid map, missing file …).
        console.error('The map could not be loaded.', cause);
        return Promise.reject(MAP_FAILED);
      }),
      firstValueFrom(this.api.wildlife(mapId)),
    ]);
    const wildlifeSprites = await this.loader
      .wildlifeSprites(animals.map((animal) => animal.speciesId))
      .catch((cause: unknown) => {
        console.error('The animal sprites could not be loaded.', cause);
        return Promise.reject(MAP_FAILED);
      });
    return { mapId, world: { ...world, wildlifeSprites }, residents: animals };
  }

  /** Shows a loaded place with the clock as the server reported it; a new place starts a new game. */
  private enter(place: Place, time: WorldTimeInfo): void {
    this.mapId = place.mapId;
    this.worldTime.set(time);
    this.time.set(worldTimeAt(time.minutes));
    this.residents.set(place.residents);
    this.world.set(place.world); // a new place starts a new game
  }

  protected onTimeChanged(time: WorldTime): void {
    // A new time of day may bring other animals out (D8).
    if (this.time() && this.time()!.timeOfDay !== time.timeOfDay) this.refreshResidents();
    this.time.set(time);
  }

  private refreshResidents(): void {
    const mapId = this.mapId;
    this.api.wildlife(mapId).subscribe({
      next: ({ animals }) => {
        if (mapId !== this.mapId) return; // travelled meanwhile
        this.residents.set(animals);
        this.game?.setResidents(animals);
      },
      // A failed refresh keeps the animals as they are; the server still decides every encounter.
      error: () => undefined,
    });
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
    this.refreshResidents();
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
    if (this.arriving) {
      this.arriving = false;
      game.setActionConsumer('world');
      if (this.torchOn()) game.setTorch(true);
      this.canvas()?.focus();
    }
  }

  /**
   * An NPC talks; the signpost opens the travel map; a spot starts an observation; a search may find something.
   * The server decides (D3).
   */
  protected onInteraction(interaction: Interaction): void {
    // Block the world right away, so the player cannot walk off while the server answers.
    this.open({ kind: 'pending' });
    if (interaction.kind === 'signpost') {
      this.openTravelMap();
      return;
    }
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

  private openTravelMap(): void {
    this.api.regions().subscribe({
      next: (regions) => this.open({ kind: 'travel', regions }),
      error: (error: unknown) => this.onError(error),
    });
  }

  /**
   * Travels to a region the server allows (D3): the screen fades out, the region's map loads with its animals,
   * and the screen fades in again; the place banner then names the area.
   */
  protected onTravel(region: RegionInfo): void {
    this.overlay.set({ kind: 'pending' });
    this.api.travel(region.regionId).subscribe({
      next: (travelled) => void this.arrive(travelled.mapId),
      error: (error: unknown) => {
        // Progress may have changed elsewhere: show the regions as they are now.
        if (apiErrorCode(error) === 'region_locked') this.openTravelMap();
        else this.onError(error);
      },
    });
  }

  private async arrive(mapId: string): Promise<void> {
    this.fading.set(true);
    try {
      const [place, time] = await Promise.all([
        this.loadPlace(mapId),
        firstValueFrom(this.api.time()),
        new Promise((resolve) => setTimeout(resolve, this.fadeMs)),
      ]);
      this.overlay.set({ kind: 'none' });
      this.arriving = true;
      this.enter(place, time);
    } catch (error) {
      if (error === MAP_FAILED) this.loadError.set('map');
      else this.onError(error);
    } finally {
      this.fading.set(false);
    }
  }

  private overlayFor(
    result: Encounter | AlreadyIdentified | NothingFound,
    interaction: 'spot' | 'search',
  ): Overlay {
    if ('found' in result) return { kind: interaction === 'spot' ? 'notNow' : 'nothing' };
    if ('alreadyIdentified' in result) {
      return {
        kind: 'known',
        name: result.entry.species?.name ?? '',
        level: result.entry.researchLevel ?? 1,
        researched: result.researched,
      };
    }
    return { kind: 'encounter', encounter: result };
  }

  protected onAnswer(encounter: Encounter, speciesId: string): void {
    this.overlay.set({ kind: 'pending' });
    this.api.answer(encounter.encounterId, speciesId).subscribe({
      next: (result) => {
        if (result.correct) this.refreshProgress();
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
   * A new identification may move a quest on; only the server knows whether the species counts for it (a quest may
   * count only one habitat's species), so the tracker shows the progress the server reports (D3).
   */
  private refreshProgress(): void {
    this.api.progress().subscribe({
      next: (progress) => this.progress.set(progress),
      // A failed reload keeps the tracker as it is; the next conversation or load corrects it.
      error: () => undefined,
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
    } else if (kind === 'travel') {
      this.travelMap()?.handleAction(action);
    }
  }
}
