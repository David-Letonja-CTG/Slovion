import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

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

/** A search that found nothing. */
export interface NothingFound {
  readonly found: false;
}

export interface AnswerResult {
  readonly correct: boolean;
  /** The correct species, revealed after answering. */
  readonly species: Candidate;
  readonly entry: NatureDexEntry | null;
}

/**
 * Error codes the client shows messages for; each has a key `errors.<code>`, used dynamically:
 * t(errors.invalid_save_token, errors.unknown_spot, errors.unknown_encounter, errors.unknown_habitat, errors.network, errors.error)
 */
export type ApiErrorCode =
  | 'invalid_save_token'
  | 'unknown_spot'
  | 'unknown_encounter'
  | 'unknown_habitat'
  | 'network'
  | 'error';

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'invalid_save_token',
  'unknown_spot',
  'unknown_encounter',
  'unknown_habitat',
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

  /** Observes the species at a spot; already identified species open no encounter. */
  startEncounter(mapId: string, spotId: string): Observable<Encounter | AlreadyIdentified> {
    return this.http.post<Encounter | AlreadyIdentified>('/api/save/encounters', { mapId, spotId });
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

  answer(encounterId: string, speciesId: string): Observable<AnswerResult> {
    return this.http.post<AnswerResult>(
      `/api/save/encounters/${encodeURIComponent(encounterId)}/identification`,
      { speciesId },
    );
  }

  natureDex(): Observable<{ entries: NatureDexEntry[] }> {
    return this.http.get<{ entries: NatureDexEntry[] }>('/api/save/naturedex');
  }
}
