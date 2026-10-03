import { Direction, stepOf } from '../input/actions';
import { Obstacles, Spawn } from './world-map';

export const WALK_TILES_PER_SECOND = 4;
export const RUN_TILES_PER_SECOND = 8;

// Absorbs floating-point drift so e.g. 15 steps of 1/15 tile complete exactly one tile.
const EPSILON = 1e-9;

export interface MovementInput {
  /** The most recently pressed direction that is still held. */
  readonly heldDirection?: Direction;
  /** A direction pressed since the last step, even if already released (a quick tap). */
  readonly tappedDirection?: Direction;
  readonly running: boolean;
}

interface Step {
  readonly direction: Direction;
  /** 0 → 1 between the start and target tile. */
  progress: number;
}

/**
 * Tile-by-tile movement. The player always occupies one tile; a started step always completes, and
 * leftover progress carries into the next step so speed is exact at any frame rate.
 */
export class Player {
  private tile: { x: number; y: number };
  private step: Step | undefined;
  private distance = 0;
  facing: Direction;

  constructor(spawn: Spawn) {
    this.tile = { x: spawn.x, y: spawn.y };
    this.facing = spawn.facing;
  }

  get tileX(): number {
    return this.tile.x;
  }

  get tileY(): number {
    return this.tile.y;
  }

  get isStepping(): boolean {
    return this.step !== undefined;
  }

  /** The tile a step is heading to, while stepping. */
  get targetTile(): { x: number; y: number } | undefined {
    if (!this.step) return undefined;
    const { dx, dy } = stepOf(this.step.direction);
    return { x: this.tile.x + dx, y: this.tile.y + dy };
  }

  /** Position in tiles, including progress of the current step. */
  get position(): { readonly x: number; readonly y: number } {
    if (!this.step) return { ...this.tile };
    const { dx, dy } = stepOf(this.step.direction);
    return { x: this.tile.x + dx * this.step.progress, y: this.tile.y + dy * this.step.progress };
  }

  /** Alternates every half tile while moving, for a two-frame walk cycle. */
  get walkFrame(): 0 | 1 {
    return Math.floor((this.distance + (this.step?.progress ?? 0)) * 2) % 2 === 1 ? 1 : 0;
  }

  update(input: MovementInput, stepMs: number, map: Obstacles): void {
    if (!this.step) {
      const direction = input.heldDirection ?? input.tappedDirection;
      if (!direction || !this.tryStart(direction, map)) return;
    }

    const speed = input.running ? RUN_TILES_PER_SECOND : WALK_TILES_PER_SECOND;
    this.step!.progress += (stepMs / 1000) * speed;

    while (this.step && this.step.progress + EPSILON >= 1) {
      const carry = Math.max(0, this.step.progress - 1);
      const { dx, dy } = stepOf(this.step.direction);
      this.tile = { x: this.tile.x + dx, y: this.tile.y + dy };
      this.distance += 1;
      this.step = undefined;

      // Keep walking only while a direction is still held; a tap makes exactly one step.
      if (input.heldDirection && this.tryStart(input.heldDirection, map)) {
        this.step!.progress = carry;
      }
    }
  }

  /** Faces `direction` and starts a step if the target tile is free. */
  private tryStart(direction: Direction, map: Obstacles): boolean {
    this.facing = direction;
    const { dx, dy } = stepOf(direction);
    if (map.isBlocked(this.tile.x + dx, this.tile.y + dy)) return false;
    this.step = { direction, progress: 0 };
    return true;
  }
}
