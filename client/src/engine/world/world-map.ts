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
  /** Frame animations by tile index (Tiled tile animations); tiles without one are still. */
  readonly animations?: ReadonlyMap<number, readonly TileFrame[]>;
  /** Tile indexes marked `wadeable`: blocked tiles a player with boots can wade through. */
  readonly wadeable?: ReadonlySet<number>;
  /** Tile indexes marked `swimmable`: blocked tiles (shallow sea) a player with the snorkel can swim in. */
  readonly swimmable?: ReadonlySet<number>;
}

/** One frame of a tile animation: the tile index to show and for how long. */
export interface TileFrame {
  readonly tile: number;
  readonly ms: number;
}

/** The tile index to draw for `index` at `elapsedMs` of game time. */
export function animatedTile(tileset: Tileset, index: number, elapsedMs: number): number {
  const frames = tileset.animations?.get(index);
  if (!frames || frames.length === 0) return index;
  const cycle = frames.reduce((sum, frame) => sum + frame.ms, 0);
  let at = elapsedMs % cycle;
  for (const frame of frames) {
    if (at < frame.ms) return frame.tile;
    at -= frame.ms;
  }
  return index;
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

/** Tiles (inclusive) belonging to a named place; its name is content, loaded by the host (D7). */
export interface AreaZone {
  readonly areaId: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** An underground area (a cave) is dark at any time of day. */
  readonly underground?: boolean;
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

/** The signpost drawn with tileset tile `gid`: it blocks its tile and opens the travel map. */
export interface Signpost {
  readonly x: number;
  readonly y: number;
  readonly gid: number;
}

/** A research station drawn with tileset tile `gid`: it blocks its tile and opens the station's dialog. */
export interface MapStation {
  readonly stationId: string;
  readonly x: number;
  readonly y: number;
  readonly gid: number;
}

/** A lamp post drawn with tileset tile `gid`: it blocks its tile and lights the area around it in the evening and at night. */
export interface MapLamp {
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
    readonly areas: readonly AreaZone[] = [],
    readonly signposts: readonly Signpost[] = [],
    readonly stations: readonly MapStation[] = [],
    readonly lamps: readonly MapLamp[] = [],
  ) {}

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Tiles outside the map count as blocked. NPCs, gates, signposts, stations and lamps are handled by the world. */
  isBlocked(x: number, y: number): boolean {
    return !this.inBounds(x, y) || this.blocked[y * this.width + x];
  }

  /** Whether any layer's tile at the cell is wadeable (shallow water). */
  isWadeable(x: number, y: number): boolean {
    return this.hasTileIn(this.tileset.wadeable, x, y);
  }

  /** Whether any layer's tile at the cell is swimmable (shallow sea). */
  isSwimmable(x: number, y: number): boolean {
    return this.hasTileIn(this.tileset.swimmable, x, y);
  }

  npcAt(x: number, y: number): MapNpc | undefined {
    return this.npcs.find((npc) => npc.x === x && npc.y === y);
  }

  gateAt(x: number, y: number): Gate | undefined {
    return this.gates.find((gate) => gate.x === x && gate.y === y);
  }

  signpostAt(x: number, y: number): Signpost | undefined {
    return this.signposts.find((signpost) => signpost.x === x && signpost.y === y);
  }

  stationAt(x: number, y: number): MapStation | undefined {
    return this.stations.find((station) => station.x === x && station.y === y);
  }

  lampAt(x: number, y: number): MapLamp | undefined {
    return this.lamps.find((lamp) => lamp.x === x && lamp.y === y);
  }

  spotAt(x: number, y: number): Spot | undefined {
    return this.spots.find((spot) => spot.x === x && spot.y === y);
  }

  /** The area whose zone contains the tile, if any. */
  /** Whether the tile lies in an area marked underground. */
  isUnderground(x: number, y: number): boolean {
    return (
      this.areas.find(
        (zone) => x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY,
      )?.underground === true
    );
  }

  areaAt(x: number, y: number): string | undefined {
    return this.areas.find(
      (zone) => x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY,
    )?.areaId;
  }

  /** The habitat whose zone contains the tile, if any. */
  habitatAt(x: number, y: number): string | undefined {
    return this.habitats.find(
      (zone) => x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY,
    )?.habitatId;
  }

  private hasTileIn(tiles: ReadonlySet<number> | undefined, x: number, y: number): boolean {
    if (!tiles || !this.inBounds(x, y)) return false;
    return this.layers.some((layer) => {
      const gid = layer.tiles[y * this.width + x];
      return gid >= this.tileset.firstGid && tiles.has(gid - this.tileset.firstGid);
    });
  }
}
