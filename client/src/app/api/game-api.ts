import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Season, TimeOfDay } from '../../engine';

export interface SourceInfo {
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessed: string;
  readonly licence: string;
}

/** Localized, sourced species information as served by the API. */
export interface SpeciesInfo {
  readonly name: string;
  readonly scientificName: string;
  readonly family: string;
  readonly habitat: string;
  readonly distribution: string;
  readonly season: string;
  readonly characteristics: readonly string[];
  readonly sources: readonly SourceInfo[];
}

/**
 * Species groups; labels are looked up dynamically:
 * t(species.group.plant, species.group.mammal, species.group.bird, species.group.insect)
 * t(identification.heading.plant, identification.heading.mammal, identification.heading.bird, identification.heading.insect)
 * t(naturedex.season.plant, naturedex.season.mammal, naturedex.season.bird, naturedex.season.insect)
 * t(naturedex.habitat.plant, naturedex.habitat.mammal, naturedex.habitat.bird, naturedex.habitat.insect)
 */
export type SpeciesGroup = 'plant' | 'mammal' | 'bird' | 'insect';

/** A species in the save's NatureDex; `species` is only present once identified. */
export interface NatureDexEntry {
  readonly speciesId: string;
  readonly group: SpeciesGroup;
  readonly status: 'observed' | 'identified';
  readonly observedAt: string;
  readonly identifiedAt: string | null;
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

export interface AlreadyIdentified {
  readonly alreadyIdentified: true;
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
export interface Conversation {
  readonly npcName: string;
  readonly lines: readonly string[];
  readonly quest: QuestInfo;
  /** The save's progress flags after the conversation. */
  readonly flags: readonly string[];
}

/** The save's progress flags (they open gates) and its started quests. */
export interface PlayerProgress {
  readonly flags: readonly string[];
  readonly quests: readonly QuestInfo[];
}

export interface AnswerResult {
  readonly correct: boolean;
  /** The correct species, revealed after answering. */
  readonly species: Candidate;
  readonly entry: NatureDexEntry | null;
}

/**
 * Error codes the client shows messages for; each has a key `errors.<code>`, used dynamically:
 * t(errors.invalid_save_token, errors.unknown_spot, errors.unknown_encounter, errors.unknown_habitat, errors.unknown_npc, errors.network, errors.error)
 */
export type ApiErrorCode =
  | 'invalid_save_token'
  | 'unknown_spot'
  | 'unknown_encounter'
  | 'unknown_habitat'
  | 'unknown_npc'
  | 'network'
  | 'error';

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'invalid_save_token',
  'unknown_spot',
  'unknown_encounter',
  'unknown_habitat',
  'unknown_npc',
];

/** Maps any failure to a code with a translated message. */
export function apiErrorCode(error: unknown): ApiErrorCode {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'network';
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
