import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Action, Game, Interaction, ResidentInfo, WorldTime, worldTimeAt } from '../../engine';
import { AudioService } from '../audio/audio.service';
import { SoundSettingsDialog } from '../audio/sound-settings-dialog';
import {
  AlreadyIdentified,
  AnswerResult,
  ApiErrorCode,
  CertificateInfo,
  Conversation,
  Encounter,
  GameApi,
  NothingFound,
  PlayerProgress,
  RegionInfo,
  WeatherInfo,
  RegionsInfo,
  StationInfo,
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
import { InventoryPanel } from './inventory-panel';
import { StationDialog } from './station-dialog';
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
  /** The region's weather, or undefined when it could not be loaded (drawn as clear). */
  readonly weather: WeatherInfo | undefined;
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
      /** Research stations whose goal this sighting met; announced when the message closes. */
      readonly certificates: readonly CertificateInfo[];
    }
  | { readonly kind: 'nothing' }
  /** A spot whose species is not around at the save's in-game time (D8). */
  | { readonly kind: 'notNow' }
  | { readonly kind: 'naturedex' }
  | { readonly kind: 'dialogue'; readonly conversation: Conversation }
  /** The travel map opened at a signpost. */
  | { readonly kind: 'travel'; readonly regions: RegionsInfo }
  /** The bag with the save's field tools. */
  | { readonly kind: 'inventory' }
  /** A research station's board. */
  | { readonly kind: 'station'; readonly station: StationInfo }
  /** The sound settings. */
  | { readonly kind: 'sound' }
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
    InventoryPanel,
    SoundSettingsDialog,
    StationDialog,
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
  private readonly inventory = viewChild(InventoryPanel);
  private readonly stationDialog = viewChild(StationDialog);
  private readonly soundSettings = viewChild(SoundSettingsDialog);
  protected readonly audio = inject(AudioService);
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
  protected readonly progress = signal<PlayerProgress>({ flags: [], quests: [], items: [] });
  /** The IDs of the save's field tools, for the engine (binoculars, boots) and the magnifier's clues. */
  protected readonly toolIds = computed(() => this.progress().items.map((item) => item.itemId));
  private readonly transloco = inject(TranslocoService);
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
  /** The current region's weather and when it next changes, as the server last reported it (D11). */
  protected readonly weather = signal<WeatherInfo | undefined>(undefined);
  /** Weather is drawn without movement for players who prefer reduced motion. */
  protected readonly reducedMotion =
    inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private weatherLoading = false;
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

    // Sound follows the place, the time of day and the weather; the music is turned down while a dialog is open.
    effect(() => {
      const place = this.world();
      const time = this.time();
      if (!place || !time) return;
      const area = this.area();
      this.audio.setScene({
        mapId: place.map.id,
        timeOfDay: time.timeOfDay,
        weather: this.weather()?.weather ?? 'clear',
        underground: place.map.areas.some(
          (zone) => zone.areaId === area && zone.underground === true,
        ),
      });
    });
    effect(() => {
      const kind = this.overlay().kind;
      this.audio.duck(kind !== 'none' && kind !== 'pending');
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
    const [world, { animals }, weather] = await Promise.all([
      this.loader.load(mapId).catch((cause: unknown) => {
        // The player sees one message; developers get the cause (invalid map, missing file …).
        console.error('The map could not be loaded.', cause);
        return Promise.reject(MAP_FAILED);
      }),
      firstValueFrom(this.api.wildlife(mapId)),
      // Weather only changes how the world looks and which animals are listed; without it the world stays clear.
      firstValueFrom(this.api.weather(mapId)).catch(() => undefined),
    ]);
    const wildlifeSprites = await this.loader
      .wildlifeSprites(animals.map((animal) => animal.speciesId))
      .catch((cause: unknown) => {
        console.error('The animal sprites could not be loaded.', cause);
        return Promise.reject(MAP_FAILED);
      });
    return { mapId, world: { ...world, wildlifeSprites }, residents: animals, weather };
  }

  /** Shows a loaded place with the clock as the server reported it; a new place starts a new game. */
  private enter(place: Place, time: WorldTimeInfo): void {
    this.mapId = place.mapId;
    this.worldTime.set(time);
    this.time.set(worldTimeAt(time.minutes));
    this.residents.set(place.residents);
    this.weather.set(place.weather);
    this.world.set(place.world); // a new place starts a new game
  }

  protected onTimeChanged(time: WorldTime): void {
    // A new time of day may bring other animals out (D8); new weather may too, and changes the sky (D11).
    const weather = this.weather();
    if (weather && time.minutes >= weather.changesAtMinutes) {
      this.refreshWeather();
    } else if (this.time() && this.time()!.timeOfDay !== time.timeOfDay) {
      this.refreshResidents();
    }
    this.time.set(time);
  }

  /** Reloads the region's weather, then the animals, which may come out in it. */
  private refreshWeather(): void {
    if (this.weatherLoading) return;
    this.weatherLoading = true;
    const mapId = this.mapId;
    this.api.weather(mapId).subscribe({
      next: (weather) => {
        this.weatherLoading = false;
        if (mapId !== this.mapId) return; // travelled meanwhile
        this.weather.set(weather);
        this.game?.setWeather(weather.weather);
        this.refreshResidents();
      },
      error: () => {
        // Keep the current weather and try again in an in-game hour; the server still decides every encounter.
        this.weatherLoading = false;
        this.weather.update((weather) =>
          weather ? { ...weather, changesAtMinutes: weather.changesAtMinutes + 60 } : weather,
        );
      },
    });
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
    if (on !== this.torchOn()) this.audio.play('torch');
    this.torchOn.set(on);
  }

  /** The on-screen torch button; keyboard players use the Torch action. Focus goes back to the game. */
  protected toggleTorch(): void {
    this.game?.setTorch(!this.torchOn());
    this.canvas()?.focus();
  }

  private syncTime(): void {
    this.refreshWeather();
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
    if (interaction.kind === 'station') {
      this.openStation(interaction.stationId);
      return;
    }
    if (interaction.kind === 'npc') {
      this.api.talk(interaction.mapId, interaction.npcId).subscribe({
        next: (conversation) => this.overlay.set({ kind: 'dialogue', conversation }),
        error: (error: unknown) => this.onError(error),
      });
      return;
    }

    if (interaction.kind === 'search') this.audio.play('search');
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

  private openStation(stationId: string): void {
    this.api.stations().subscribe({
      next: ({ stations }) => {
        const station = stations.find((candidate) => candidate.stationId === stationId);
        if (station) this.open({ kind: 'station', station });
        else this.close();
      },
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
    this.audio.play('travel');
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
      if (result.researched) this.audio.play('research');
      return {
        kind: 'known',
        name: result.entry.species?.name ?? '',
        level: result.entry.researchLevel ?? 1,
        researched: result.researched,
        certificates: result.newCertificates ?? [],
      };
    }
    this.audio.play('observe');
    return { kind: 'encounter', encounter: result };
  }

  protected onAnswer(encounter: Encounter, speciesId: string): void {
    this.overlay.set({ kind: 'pending' });
    this.api.answer(encounter.encounterId, speciesId).subscribe({
      next: (result) => {
        this.audio.play(result.correct ? 'correct' : 'wrong');
        if (result.correct) this.refreshProgress();
        this.overlay.set({ kind: 'result', result });
      },
      error: (error: unknown) => this.onError(error),
    });
  }

  /** Applies what the conversation changed once the player has read it: the gate opens as the box closes. */
  protected onDialogueClosed(conversation: Conversation): void {
    this.game?.setOpenFlags(conversation.flags);
    this.game?.setTools(conversation.items.map((item) => item.itemId));
    const owned = new Set(this.toolIds());
    const received = conversation.items.filter((item) => !owned.has(item.itemId));
    const before = this.progress().quests.find(
      (quest) => quest.questId === conversation.quest.questId,
    );
    const completed = conversation.quest.status === 'completed' && before?.status !== 'completed';
    if (completed) this.audio.play('quest');
    if (received.length > 0) this.audio.play('tool');
    this.progress.update((progress) => ({
      flags: conversation.flags,
      quests: [
        ...progress.quests.filter((quest) => quest.questId !== conversation.quest.questId),
        conversation.quest,
      ],
      items: conversation.items,
    }));
    this.close();
    // A new tool is announced like a new place.
    for (const item of received) {
      const name = this.transloco.translate('inventory.received', { name: item.name });
      this.banner.update((banner) => ({ key: (banner?.key ?? 0) + 1, name }));
    }
  }

  /**
   * A new identification may move a quest on; only the server knows whether the species counts for it (a quest may
   * count only one habitat's species), so the tracker shows the progress the server reports (D3).
   */
  private refreshProgress(): void {
    this.api.progress().subscribe({
      next: (progress) => {
        this.progress.set(progress);
        this.game?.setTools(progress.items.map((item) => item.itemId));
      },
      // A failed reload keeps the tracker as it is; the next conversation or load corrects it.
      error: () => undefined,
    });
  }

  protected onMenu(): void {
    this.open({ kind: 'naturedex' });
  }

  /** The sound settings, from the button; focus returns to the game when they close. */
  protected openSoundSettings(): void {
    this.open({ kind: 'sound' });
  }

  /** The quick mute button; focus goes back to the game. */
  protected toggleMute(): void {
    this.audio.update({ muted: !this.audio.settings().muted });
    this.canvas()?.focus();
  }

  /** The bag, from the Inventory action or the button; focus returns to the game when it closes. */
  protected openInventory(): void {
    this.open({ kind: 'inventory' });
  }

  /** The magnifier shows two clues at once for plants and insects. */
  protected initialCluesFor(encounter: Encounter): number {
    const magnified = encounter.group === 'plant' || encounter.group === 'insect';
    return magnified && this.toolIds().includes('magnifier') ? 2 : 1;
  }

  protected close(): void {
    const closing = this.overlay();
    this.overlay.set({ kind: 'none' });
    this.game?.setActionConsumer('world');
    this.canvas()?.focus();
    // A finished research station is announced after the research message, like a new tool.
    if (closing.kind === 'known') {
      if (closing.certificates.length > 0) this.audio.play('certificate');
      for (const certificate of closing.certificates) {
        const name = this.transloco.translate('certificate.received', { name: certificate.name });
        this.banner.update((banner) => ({ key: (banner?.key ?? 0) + 1, name }));
      }
    }
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
    } else if (kind === 'inventory') {
      this.inventory()?.handleAction(action);
    } else if (kind === 'station') {
      this.stationDialog()?.handleAction(action);
    } else if (kind === 'sound') {
      this.soundSettings()?.handleAction(action);
    }
  }
}
