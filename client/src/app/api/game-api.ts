import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ResidentInfo, Season, TimeOfDay, Weather } from '../../engine';

export interface SourceInfo {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessed: string;
  readonly licence: string;
}

/** Localized, sourced species information as served by the API. */
/**
 * Localized, sourced species information as far as the save's research has revealed it: `habitat` and
 * `distribution` from research level 2, `season` at level 3. The sources are those of the revealed facts.
 */
export interface SpeciesInfo {
  readonly name: string;
  readonly scientificName: string;
  readonly family: string;
  readonly habitat: string | null;
  readonly distribution: string | null;
  readonly season: string | null;
  readonly characteristics: readonly string[];
  readonly sources: readonly SourceInfo[];
}

/**
 * Species groups; labels are looked up dynamically:
 * t(species.group.plant, species.group.mammal, species.group.bird, species.group.insect, species.group.amphibian)
 * t(identification.heading.plant, identification.heading.mammal, identification.heading.bird, identification.heading.insect, identification.heading.amphibian)
 * t(naturedex.season.plant, naturedex.season.mammal, naturedex.season.bird, naturedex.season.insect, naturedex.season.amphibian)
 * t(naturedex.habitat.plant, naturedex.habitat.mammal, naturedex.habitat.bird, naturedex.habitat.insect, naturedex.habitat.amphibian)
 */
export type SpeciesGroup = 'plant' | 'mammal' | 'bird' | 'insect' | 'amphibian';

/** A species in the save's NatureDex; `species` is only present once identified. */
export interface NatureDexEntry {
  readonly speciesId: string;
  readonly group: SpeciesGroup;
  readonly status: 'observed' | 'identified';
  readonly observedAt: string;
  readonly identifiedAt: string | null;
  /** 1–3 once identified, null before. */
  readonly researchLevel: number | null;
  readonly species: SpeciesInfo | null;
}

/** A species in a habitat section of the NatureDex; `entry` is null while it is unknown to the save. */
export interface NatureDexSlot {
  readonly speciesId: string;
  readonly status: 'unknown' | 'observed' | 'identified';
  readonly entry: NatureDexEntry | null;
}

/** A habitat's part of the NatureDex: its name and every species it lists. */
export interface NatureDexSection {
  readonly habitatId: string;
  readonly name: string;
  readonly species: readonly NatureDexSlot[];
}

export interface Candidate {
  readonly speciesId: string;
  readonly name: string;
}

/** An open observation. It never says which candidate is correct. */
export interface Encounter {
  readonly encounterId: string;
  readonly group: SpeciesGroup;
  readonly clues: readonly string[];
  readonly candidates: readonly Candidate[];
}

/** A sighting of an identified species; `researched` says whether it raised the research level. */
export interface AlreadyIdentified {
  readonly alreadyIdentified: true;
  readonly researched: boolean;
  readonly entry: NatureDexEntry;
}

/** The save's in-game time (docs/decisions.md D8); `minutes` count from day 1 00:00. */
export interface WorldTimeInfo {
  readonly minutes: number;
  readonly day: number;
  readonly season: Season;
  readonly timeOfDay: TimeOfDay;
  readonly gameMinutesPerSecond: number;
}

/** A search that found nothing, or a spot whose species is not around right now. */
export interface NothingFound {
  readonly found: false;
}

/** A quest as the player sees it; its texts are content in the save's language. */
export interface QuestInfo {
  readonly questId: string;
  readonly title: string;
  readonly summary: string;
  readonly returnHint: string;
  readonly status: 'active' | 'completed';
  readonly progress: number;
  readonly goal: number;
}

/** What an NPC says; the server decided it and any quest change (D3). */
/** A field tool the save owns, in the request's language (D3). */
export interface ItemInfo {
  readonly itemId: string;
  readonly name: string;
  readonly description: string;
}

export interface Conversation {
  readonly npcName: string;
  readonly lines: readonly string[];
  readonly quest: QuestInfo;
  /** The save's progress flags after the conversation. */
  readonly flags: readonly string[];
  /** The save's tools after the conversation. */
  readonly items: readonly ItemInfo[];
}

/** The save's progress flags (they open gates), its started quests and its tools. */
export interface PlayerProgress {
  readonly flags: readonly string[];
  readonly quests: readonly QuestInfo[];
  /** The save's field tools: start tools, then quest rewards. */
  readonly items: readonly ItemInfo[];
}

/**
 * A region for the save (D3). `x` and `y` are percent of the travel map. `identified` and `required` are set
 * for species-count rules only; `lockedHint` only while the region is locked.
 */
export interface RegionInfo {
  readonly regionId: string;
  readonly name: string;
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly unlocked: boolean;
  readonly identified: number | null;
  readonly required: number | null;
  readonly lockedHint: string | null;
}

/**
 * The weather of a map's region now (D11), and the in-game minute (counted from day 1 00:00, like
 * `WorldTimeInfo.minutes`) at which it next changes.
 */
export interface WeatherInfo {
  readonly weather: Weather;
  readonly changesAtMinutes: number;
}

/** The save's current region and every region in travel-list order. */
export interface RegionsInfo {
  readonly currentRegionId: string;
  readonly regions: readonly RegionInfo[];
}

export interface AnswerResult {
  readonly correct: boolean;
  /** The correct species, revealed after answering. */
  readonly species: Candidate;
  readonly entry: NatureDexEntry | null;
}

/**
 * Error codes the client shows messages for; each has a key `errors.<code>`, used dynamically:
 * t(errors.invalid_save_token, errors.unknown_spot, errors.unknown_encounter, errors.unknown_habitat, errors.unknown_npc, errors.unknown_map, errors.unknown_region, errors.region_locked, errors.network, errors.error)
 */
export type ApiErrorCode =
  | 'invalid_save_token'
  | 'unknown_spot'
  | 'unknown_encounter'
  | 'unknown_habitat'
  | 'unknown_npc'
  | 'unknown_map'
  | 'unknown_region'
  | 'region_locked'
  | 'network'
  | 'error';

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'invalid_save_token',
  'unknown_spot',
  'unknown_encounter',
  'unknown_habitat',
  'unknown_npc',
  'unknown_map',
  'unknown_region',
  'region_locked',
];

/** Maps any failure to a code with a translated message. */
export function apiErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof HttpErrorResponse) {
    // No response, or a gateway that couldn't reach the server: the service worker answers
    // requests it can't send while offline with 504, and a proxy in front of a stopped API with 502.
    if (error.status === 0 || error.status === 502 || error.status === 504) return 'network';
    const code = (error.error as { code?: unknown } | null)?.code;
    return KNOWN_CODES.find((known) => known === code) ?? 'error';
  }
  return 'error';
}

/** Typed calls to the game API. Headers are added by `gameApiInterceptor`. */
@Injectable({ providedIn: 'root' })
export class GameApi {
  private readonly http = inject(HttpClient);

  createSave(): Observable<{ token: string }> {
    return this.http.post<{ token: string }>('/api/saves', null);
  }

  /**
   * Observes the species at a spot; already identified species open no encounter, and species that are not
   * around at the save's in-game time answer `found: false`.
   */
  startEncounter(
    mapId: string,
    spotId: string,
  ): Observable<Encounter | AlreadyIdentified | NothingFound> {
    return this.http.post<Encounter | AlreadyIdentified | NothingFound>('/api/save/encounters', {
      mapId,
      spotId,
    });
  }

  /** The map's resident animals and which are around at the save's in-game time (D3, D8). */
  wildlife(mapId: string): Observable<{ animals: ResidentInfo[] }> {
    return this.http.get<{ animals: ResidentInfo[] }>('/api/save/wildlife', { params: { mapId } });
  }

  /** The weather of the map's region now; the server decides it (D3, D11). */
  weather(mapId: string): Observable<WeatherInfo> {
    return this.http.get<WeatherInfo>('/api/save/weather', { params: { mapId } });
  }

  time(): Observable<WorldTimeInfo> {
    return this.http.get<WorldTimeInfo>('/api/save/time');
  }

  /** Searches the habitat at a tile; the server decides whether and what is found. */
  search(
    mapId: string,
    x: number,
    y: number,
  ): Observable<Encounter | AlreadyIdentified | NothingFound> {
    return this.http.post<Encounter | AlreadyIdentified | NothingFound>('/api/save/searches', {
      mapId,
      x,
      y,
    });
  }

  /** Talks to an NPC; the server decides what is said and every quest change. */
  talk(mapId: string, npcId: string): Observable<Conversation> {
    return this.http.post<Conversation>('/api/save/conversations', { mapId, npcId });
  }

  /** The save's current region and which regions it may travel to. */
  regions(): Observable<RegionsInfo> {
    return this.http.get<RegionsInfo>('/api/save/regions');
  }

  /** Travels to an unlocked region; the server decides and remembers it (D3). */
  travel(regionId: string): Observable<RegionInfo> {
    return this.http.post<RegionInfo>('/api/save/travel', { regionId });
  }

  progress(): Observable<PlayerProgress> {
    return this.http.get<PlayerProgress>('/api/save/progress');
  }

  answer(encounterId: string, speciesId: string): Observable<AnswerResult> {
    return this.http.post<AnswerResult>(
      `/api/save/encounters/${encodeURIComponent(encounterId)}/identification`,
      { speciesId },
    );
  }

  /** Every species per habitat, with the save's progress on each. */
  natureDex(): Observable<{ habitats: NatureDexSection[] }> {
    return this.http.get<{ habitats: NatureDexSection[] }>('/api/save/naturedex');
  }
}
