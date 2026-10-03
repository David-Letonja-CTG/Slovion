import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { LoadedWorld, parseTiledMap } from '../../engine';

export type ImageLoader = (url: string) => Promise<CanvasImageSource>;

/** Loads an image and waits until it can be drawn; replaceable in tests (jsdom cannot decode). */
export const IMAGE_LOADER = new InjectionToken<ImageLoader>('IMAGE_LOADER', {
  providedIn: 'root',
  factory: () => async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  },
});

export const PLAYER_SPRITE_URL = '/sprites/player.png';

/** A loaded map plus the names of its places in the player's language (content, D7). */
export interface LoadedPlace extends LoadedWorld {
  readonly areaNames: Readonly<Record<string, string>>;
}

interface AreaFile {
  readonly text?: Readonly<Record<string, { readonly name?: string } | undefined>>;
}

/** Fetches a map from the API's content files plus the images it needs (design §6–7). */
@Injectable({ providedIn: 'root' })
export class WorldLoader {
  private readonly http = inject(HttpClient);
  private readonly loadImage = inject(IMAGE_LOADER);
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  /** @throws when the map, its images or its area names cannot be loaded, or the map is invalid. */
  async load(mapId: string): Promise<LoadedPlace> {
    const mapUrl = `/content/maps/${mapId}.json`;
    const map = parseTiledMap(mapId, await firstValueFrom(this.http.get<unknown>(mapUrl)));

    // The tileset path in the map is relative to the map file.
    const tilesetUrl = new URL(map.tileset.image, new URL(mapUrl, this.document.baseURI)).pathname;
    const areaIds = [...new Set(map.areas.map((area) => area.areaId))];
    const [tileset, playerSprite, ...areaFiles] = await Promise.all([
      this.loadImage(tilesetUrl),
      this.loadImage(PLAYER_SPRITE_URL),
      ...areaIds.map((id) =>
        firstValueFrom(this.http.get<AreaFile>(`/content/areas/${encodeURIComponent(id)}.json`)),
      ),
    ]);

    // Names in the active language, falling back to Slovenian like all content.
    const language = this.transloco.getActiveLang();
    const areaNames = Object.fromEntries(
      areaIds.map((id, i) => {
        const text = (areaFiles[i] as AreaFile).text;
        return [id, text?.[language]?.name ?? text?.['sl']?.name ?? id];
      }),
    );
    return { map, tileset, playerSprite, areaNames };
  }
}
