import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
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

/** Fetches a map from the API's content files plus the images it needs (design §6–7). */
@Injectable({ providedIn: 'root' })
export class WorldLoader {
  private readonly http = inject(HttpClient);
  private readonly loadImage = inject(IMAGE_LOADER);
  private readonly document = inject(DOCUMENT);

  /** @throws when the map cannot be fetched, is invalid, or its images fail to load. */
  async load(mapId: string): Promise<LoadedWorld> {
    const mapUrl = `/content/maps/${mapId}.json`;
    const map = parseTiledMap(mapId, await firstValueFrom(this.http.get<unknown>(mapUrl)));

    // The tileset path in the map is relative to the map file.
    const tilesetUrl = new URL(map.tileset.image, new URL(mapUrl, this.document.baseURI)).pathname;
    const [tileset, playerSprite] = await Promise.all([
      this.loadImage(tilesetUrl),
      this.loadImage(PLAYER_SPRITE_URL),
    ]);
    return { map, tileset, playerSprite };
  }
}
