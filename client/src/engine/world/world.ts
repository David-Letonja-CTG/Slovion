import { ActionState } from '../input/action-state';
import { directionOf, stepOf } from '../input/actions';
import { Player } from './player';
import { Gate, Obstacles, WorldMap } from './world-map';
import { WorldTime, worldTimeAt } from './world-time';

/** The in-game clock as the server reported it. */
export interface WorldClock {
  readonly minutes: number;
  readonly gameMinutesPerSecond: number;
}

/** What the world tells its host. */
export interface WorldListeners {
  /** The in-game minute changed (once per in-game minute, and after a re-sync). */
  readonly onTimeChange?: (time: WorldTime) => void;
  /** The player's tile lies in another area (also reported on the first update). */
  readonly onAreaChange?: (areaId: string) => void;
  readonly onTorchChange?: (on: boolean) => void;
}

/** Without a server clock the world stands still at noon: daylight, no tint. */
const STILL_NOON: WorldClock = { minutes: 12 * 60, gameMinutesPerSecond: 0 };

/**
 * The world asks the host to handle an interaction; the server decides the outcome (D3): a conversation
 * with the NPC the player faces, the spot the player faces, or a search of the habitat the player stands in.
 */
export type Interaction =
  | { readonly kind: 'npc'; readonly mapId: string; readonly npcId: string }
  | { readonly kind: 'spot'; readonly mapId: string; readonly spotId: string }
  | { readonly kind: 'search'; readonly mapId: string; readonly x: number; readonly y: number };

/**
 * Simulation of one map: the player, movement, interaction, which gates the save's flags open, and the in-game
 * clock between server syncs (docs/decisions.md D8; the server decides what can be found).
 */
export class World implements Obstacles {
  readonly player: Player;
  private openFlags: ReadonlySet<string> = new Set();
  private minutes: number;
  private readonly gameMinutesPerSecond: number;
  private conditions: WorldTime;
  private torch = false;
  /** The area of the player's tile when last checked; `null` before the first update. */
  private area: string | undefined | null = null;

  constructor(
    readonly map: WorldMap,
    private readonly onInteract: (interaction: Interaction) => void,
    private readonly onOpenMenu: () => void = () => undefined,
    clock: WorldClock = STILL_NOON,
    private readonly listeners: WorldListeners = {},
  ) {
    this.player = new Player(map.spawn);
    this.minutes = clock.minutes;
    this.gameMinutesPerSecond = clock.gameMinutesPerSecond;
    this.conditions = worldTimeAt(this.minutes);
  }

  /** Whether the player's torch is lit; it only shows in the evening and at night. */
  get torchOn(): boolean {
    return this.torch;
  }

  /** Switches the torch, e.g. from an on-screen button; the host hears back through `onTorchChange`. */
  setTorch(on: boolean): void {
    if (this.torch === on) return;
    this.torch = on;
    this.listeners.onTorchChange?.(on);
  }

  /** The current in-game time. */
  get time(): WorldTime {
    return this.conditions;
  }

  /** Re-syncs the clock with the server, e.g. after the page was hidden. */
  setWorldTime(minutes: number): void {
    this.minutes = minutes;
    this.refreshConditions();
  }

  /** The save's progress flags, as the server reported them; they open gates. */
  setOpenFlags(flags: Iterable<string>): void {
    this.openFlags = new Set(flags);
  }

  /** Gates the save's flags don't open yet. */
  get closedGates(): readonly Gate[] {
    return this.map.gates.filter((gate) => !this.openFlags.has(gate.flag));
  }

  /** Map collision, NPCs and closed gates. */
  isBlocked(x: number, y: number): boolean {
    const gate = this.map.gateAt(x, y);
    return (
      this.map.isBlocked(x, y) ||
      this.map.npcAt(x, y) !== undefined ||
      (gate !== undefined && !this.openFlags.has(gate.flag))
    );
  }

  /** Advances one fixed simulation step using the actions gathered since the last step. */
  update(input: ActionState, stepMs: number): void {
    this.minutes += (stepMs / 1000) * this.gameMinutesPerSecond;
    this.refreshConditions();

    const presses = input.takePresses();

    if (presses.includes('OpenMenu')) {
      this.onOpenMenu();
    }

    if (presses.includes('Torch')) {
      this.setTorch(!this.torch);
    }

    if (presses.includes('Interact') && !this.player.isStepping) {
      this.interact();
    }

    const tappedDirection = presses
      .map(directionOf)
      .filter((direction) => direction !== undefined)
      .at(-1);
    this.player.update(
      { heldDirection: input.heldDirection, tappedDirection, running: input.isHeld('Run') },
      stepMs,
      this,
    );

    // The location follows the player's tile: report it on the first update and whenever it changes.
    const area = this.map.areaAt(this.player.tileX, this.player.tileY);
    if (area !== this.area) {
      this.area = area;
      if (area !== undefined) this.listeners.onAreaChange?.(area);
    }
  }

  /** Recomputes the time and tells the host whenever the in-game minute changed. */
  private refreshConditions(): void {
    const previous = this.conditions;
    this.conditions = worldTimeAt(this.minutes);
    if (previous.minutes !== this.conditions.minutes) {
      this.listeners.onTimeChange?.(this.conditions);
    }
  }

  private interact(): void {
    const { dx, dy } = stepOf(this.player.facing);
    const { tileX: x, tileY: y } = this.player;
    const npc = this.map.npcAt(x + dx, y + dy);
    const spot = this.map.spotAt(x + dx, y + dy);
    if (npc) {
      this.onInteract({ kind: 'npc', mapId: this.map.id, npcId: npc.npcId });
    } else if (spot) {
      this.onInteract({ kind: 'spot', mapId: this.map.id, spotId: spot.spotId });
    } else if (this.map.habitatAt(x, y)) {
      this.onInteract({ kind: 'search', mapId: this.map.id, x, y });
    }
  }
}
