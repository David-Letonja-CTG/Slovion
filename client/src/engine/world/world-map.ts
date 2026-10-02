import { Direction } from '../input/actions';

export const TILE_SIZE = 16;

/** One drawable tile layer. `0` means empty; other values are tileset global IDs. */
export interface TileLayer {
  readonly name: string;
  readonly tiles: readonly number[];
}

export interface Tileset {
  readonly firstGid: number;
  readonly columns: number;
  readonly tileCount: number;
  /** Image path relative to the map file. */
  readonly image: string;
}

/** An interactive place. The server decides what it holds (docs/decisions.md D3). */
export interface Spot {
  readonly spotId: string;
  readonly x: number;
  readonly y: number;
}

/** Tiles (inclusive) belonging to a habitat; the server decides what can be found there (D3). */
export interface HabitatZone {
  readonly habitatId: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Spawn {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

/** A loaded, validated map. Coordinates are in tiles. */
export class WorldMap {
  constructor(
    readonly id: string,
    readonly width: number,
    readonly height: number,
    readonly layers: readonly TileLayer[],
    private readonly blocked: readonly boolean[],
    readonly spawn: Spawn,
    readonly spots: readonly Spot[],
    readonly tileset: Tileset,
    readonly habitats: readonly HabitatZone[] = [],
  ) {}

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Tiles outside the map count as blocked. */
  isBlocked(x: number, y: number): boolean {
    return !this.inBounds(x, y) || this.blocked[y * this.width + x];
  }

  spotAt(x: number, y: number): Spot | undefined {
    return this.spots.find((spot) => spot.x === x && spot.y === y);
  }

  /** The habitat whose zone contains the tile, if any. */
  habitatAt(x: number, y: number): string | undefined {
    return this.habitats.find(
      (zone) => x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY,
    )?.habitatId;
  }
}
