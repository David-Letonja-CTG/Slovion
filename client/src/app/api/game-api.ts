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

export interface NatureDexEntry {
  readonly speciesId: string;
  readonly discoveredAt: string;
  readonly species: SpeciesInfo;
}

export interface DiscoveryResult extends NatureDexEntry {
  readonly isNew: boolean;
}

/**
 * Error codes the client shows messages for; each has a key `errors.<code>`, used dynamically:
 * t(errors.invalid_save_token, errors.unknown_spot, errors.network, errors.error)
 */
export type ApiErrorCode = 'invalid_save_token' | 'unknown_spot' | 'network' | 'error';

const KNOWN_CODES: readonly ApiErrorCode[] = ['invalid_save_token', 'unknown_spot'];

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

  discover(mapId: string, spotId: string): Observable<DiscoveryResult> {
    return this.http.post<DiscoveryResult>('/api/save/discoveries', { mapId, spotId });
  }

  natureDex(): Observable<{ entries: NatureDexEntry[] }> {
    return this.http.get<{ entries: NatureDexEntry[] }>('/api/save/naturedex');
  }
}
