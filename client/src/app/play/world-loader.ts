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

/** Where map files live; tileset paths inside them are relative to it. */
const MAPS_FOLDER = '/content/maps/';

export const PLAYER_SPRITE_URL = '/sprites/player.png';
export const LAMP_SPRITE_URL = '/sprites/lamp.png';

/** A loaded map plus the names of its places in the player's language (content, D7). */
export interface LoadedPlace extends LoadedWorld {
  readonly areaNames: Readonly<Record<string, string>>;
  /** How a generated map was made (seed, version, biomes); the server sends it in development only. */
  readonly worldDetails?: string;
}

interface AreaFile {
  readonly text?: Readonly<Record<string, { readonly name?: string } | undefined>>;
}

/**
 * Fetches the save's map from the API plus the images it needs (design §6–7). Natural maps are generated per save on
 * the server (docs/decisions.md D13); the engine parses them like any Tiled map.
 */
@Injectable({ providedIn: 'root' })
export class WorldLoader {
  private readonly http = inject(HttpClient);
  private readonly loadImage = inject(IMAGE_LOADER);
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  /** @throws when the map, its images or its area names cannot be loaded, or the map is invalid. */
  async load(mapId: string): Promise<LoadedPlace> {
    const mapUrl = `/api/save/maps/${encodeURIComponent(mapId)}`;
    const response = await firstValueFrom(this.http.get<unknown>(mapUrl, { observe: 'response' }));
    const map = parseTiledMap(mapId, response.body);

    // The tileset path in a map file is relative to the content maps folder (the server sends it absolute).
    const tilesetUrl = new URL(map.tileset.image, new URL(MAPS_FOLDER, this.document.baseURI))
      .pathname;
    const areaIds = [...new Set(map.areas.map((area) => area.areaId))];
    const npcIds = [...new Set(map.npcs.map((npc) => npc.npcId))];
    const [tileset, playerSprite, lampSprite, npcSheets, ...areaFiles] = await Promise.all([
      this.loadImage(tilesetUrl),
      this.loadImage(PLAYER_SPRITE_URL),
      this.loadImage(LAMP_SPRITE_URL),
      this.loadImages('/content/npc-sprites', npcIds),
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
    return {
      map,
      tileset: tileset as CanvasImageSource,
      playerSprite: playerSprite as CanvasImageSource,
      lampSprite: lampSprite as CanvasImageSource,
      npcSprites: npcSheets as Record<string, CanvasImageSource>,
      areaNames,
      worldDetails: response.headers.get('X-World') ?? undefined,
    };
  }

  /** The walk sprites of the given animal species. */
  wildlifeSprites(speciesIds: readonly string[]): Promise<Record<string, CanvasImageSource>> {
    return this.loadImages('/content/wildlife-sprites', [...new Set(speciesIds)]);
  }

  private async loadImages(
    folder: string,
    ids: readonly string[],
  ): Promise<Record<string, CanvasImageSource>> {
    const images = await Promise.all(
      ids.map((id) => this.loadImage(`${folder}/${encodeURIComponent(id)}.png`)),
    );
    return Object.fromEntries(ids.map((id, i) => [id, images[i]]));
  }
}
