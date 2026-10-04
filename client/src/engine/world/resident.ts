import { Direction, stepOf } from '../input/actions';
import { seededRandom } from './random';

/** How a resident reacts to a lit torch in the dark (fictional gameplay data, D6). */
export type TorchReaction = 'curious' | 'shy' | 'calm';

/** A resident animal as the server lists it for a map (D3, D8). */
export interface ResidentInfo {
  readonly spotId: string;
  readonly speciesId: string;
  readonly torch: TorchReaction;
  /** An aquatic animal lives and wanders on water tiles only. */
  readonly aquatic?: boolean;
  /** A perched animal stays on its home tile, which may be blocked (e.g. a nest on a roof). */
  readonly perched?: boolean;
  /** Whether its species is around at the save's in-game time. */
  readonly present: boolean;
}

/** Residents wander within this many tiles of home. */
export const RESIDENT_RANGE = 3;
/** A lit torch reaches residents within this many tiles. */
export const TORCH_REACH = 4;
/** One resident step takes this long. */
export const RESIDENT_STEP_MS = 300;

/** What a resident needs to know about the world around it when deciding where to go. */
export interface Surroundings {
  /** Whether the resident may step onto the tile (walkable, no player, NPC, closed gate or other resident). */
  isFreeFor(resident: Resident, x: number, y: number): boolean;
  readonly player: { readonly x: number; readonly y: number };
  /** The torch is on and it is evening or night. */
  readonly torchLit: boolean;
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * A resident animal: wanders around its home spot one tile at a time, waits next to the player, and reacts
 * to a lit torch in the dark; a perched one never leaves home. It always occupies its tile, plus the target tile while
 * stepping.
 */
export class Resident {
  /** The direction the sprite faces horizontally; sprites face right and are mirrored for left. */
  facingLeft = false;
  private tile: { x: number; y: number };
  private step: { readonly to: { x: number; y: number }; progress: number } | undefined;
  private untilDecision: number;
  private readonly random: () => number;

  constructor(
    readonly spotId: string,
    readonly speciesId: string,
    readonly torch: TorchReaction,
    readonly home: { readonly x: number; readonly y: number },
    readonly aquatic = false,
    readonly perched = false,
  ) {
    this.tile = { ...home };
    this.random = seededRandom(spotId);
    this.untilDecision = this.nextDelay(false);
  }

  get tileX(): number {
    return this.tile.x;
  }

  get tileY(): number {
    return this.tile.y;
  }

  /** Position in tiles, between two tiles while stepping. */
  get position(): { x: number; y: number } {
    if (!this.step) return { ...this.tile };
    const p = this.step.progress;
    return {
      x: this.tile.x + (this.step.to.x - this.tile.x) * p,
      y: this.tile.y + (this.step.to.y - this.tile.y) * p,
    };
  }

  /** The second walk frame during the second half of a step. */
  get walkFrame(): 0 | 1 {
    return this.step && this.step.progress >= 0.5 ? 1 : 0;
  }

  occupies(x: number, y: number): boolean {
    return (
      (this.tile.x === x && this.tile.y === y) || (this.step?.to.x === x && this.step?.to.y === y)
    );
  }

  update(stepMs: number, world: Surroundings): void {
    if (this.perched) return;
    if (this.step) {
      this.step.progress += stepMs / RESIDENT_STEP_MS;
      if (this.step.progress >= 1) {
        this.tile = { ...this.step.to };
        this.step = undefined;
      }
      return;
    }
    this.untilDecision -= stepMs;
    if (this.untilDecision > 0) return;
    const reacting = this.decide(world);
    this.untilDecision = this.nextDelay(reacting);
  }

  /** Takes one decision; returns whether the resident is reacting to the torch (it then decides faster). */
  private decide(world: Surroundings): boolean {
    const toPlayer = distance(this.tile, world.player);
    if (world.torchLit && toPlayer <= TORCH_REACH && this.torch !== 'calm') {
      if (this.torch === 'curious' && toPlayer > 1) {
        this.stepBy(world, (to) => -distance(to, world.player));
      } else if (this.torch === 'shy') {
        this.stepBy(world, (to) => distance(to, world.player));
      }
      return true;
    }
    if (toPlayer === 1) return false; // wait so the player can talk to it
    if (distance(this.tile, this.home) > RESIDENT_RANGE) {
      this.stepBy(world, (to) => -distance(to, this.home));
      return false;
    }
    if (this.random() < 0.5) return false; // idle a while
    const options = this.neighbours().filter(
      (to) => world.isFreeFor(this, to.x, to.y) && distance(to, this.home) <= RESIDENT_RANGE,
    );
    if (options.length > 0) this.start(options[Math.floor(this.random() * options.length)]);
    return false;
  }

  /** Steps to the free neighbour that scores highest, if it improves on staying put. */
  private stepBy(world: Surroundings, score: (to: { x: number; y: number }) => number): void {
    const here = score(this.tile);
    let best: { x: number; y: number } | undefined;
    for (const to of this.neighbours()) {
      if (!world.isFreeFor(this, to.x, to.y)) continue;
      if (score(to) > here && (!best || score(to) > score(best))) best = to;
    }
    if (best) this.start(best);
  }

  private neighbours(): { x: number; y: number }[] {
    return DIRECTIONS.map((direction) => {
      const { dx, dy } = stepOf(direction);
      return { x: this.tile.x + dx, y: this.tile.y + dy };
    });
  }

  private start(to: { x: number; y: number }): void {
    if (to.x !== this.tile.x) this.facingLeft = to.x < this.tile.x;
    this.step = { to, progress: 0 };
  }

  /** Reacting residents decide often; wandering ones every 0.8–2.4 s. */
  private nextDelay(reacting: boolean): number {
    return reacting ? 400 : 800 + this.random() * 1600;
  }
}
