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

/** A non-player character standing on a tile, drawn with tileset tile `gid`. It blocks its tile. */
export interface MapNpc {
  readonly npcId: string;
  readonly x: number;
  readonly y: number;
  readonly gid: number;
}

/** A gate drawn with tileset tile `gid`; it blocks its tile until the save has `flag` (set by the server, D3). */
export interface Gate {
  readonly flag: string;
  readonly x: number;
  readonly y: number;
  readonly gid: number;
}

/** Anything that can say whether a tile can be entered. */
export interface Obstacles {
  isBlocked(x: number, y: number): boolean;
}

export interface Spawn {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

/** A loaded, validated map. Coordinates are in tiles. */
export class WorldMap implements Obstacles {
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
    readonly npcs: readonly MapNpc[] = [],
    readonly gates: readonly Gate[] = [],
  ) {}

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Tiles outside the map count as blocked. NPCs and gates are handled by the world, which knows the flags. */
  isBlocked(x: number, y: number): boolean {
    return !this.inBounds(x, y) || this.blocked[y * this.width + x];
  }

  npcAt(x: number, y: number): MapNpc | undefined {
    return this.npcs.find((npc) => npc.x === x && npc.y === y);
  }

  gateAt(x: number, y: number): Gate | undefined {
    return this.gates.find((gate) => gate.x === x && gate.y === y);
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
