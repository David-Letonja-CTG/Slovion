import { Weather } from '../render/weather';
import { ActionState } from '../input/action-state';
import { Direction, directionOf, stepOf } from '../input/actions';
import { Player } from './player';
import { seededRandom } from './random';
import { Resident, ResidentInfo, Surroundings } from './resident';
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
  /** The player asked for the bag (the Inventory action). */
  readonly onOpenInventory?: () => void;
}

interface NpcState {
  facing: Direction;
  untilTurn: number;
  readonly random: () => number;
}

/** NPCs look down, left or right while idle (never away), turning every 3–6 s. */
const IDLE_FACINGS: readonly Direction[] = ['down', 'left', 'right'];
const npcTurnDelay = (random: () => number) => 3000 + random() * 3000;
/** After turning to the player, an NPC keeps facing them this long. */
const NPC_HOLD_MS = 6000;
const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** How far the binoculars reach, in tiles straight ahead. */
const BINOCULARS_RANGE = 3;

/** Without a server clock the world stands still at noon: daylight, no tint. */
const STILL_NOON: WorldClock = { minutes: 12 * 60, gameMinutesPerSecond: 0 };

/**
 * The world asks the host to handle an interaction; the server decides the outcome (D3): a conversation
 * with the NPC the player faces, the travel map at the signpost, a research station's dialog, the spot the player faces, or a search of the
 * habitat at the tree (or other blocked tile) the player faces or the ground the player stands on.
 */
export type Interaction =
  | { readonly kind: 'npc'; readonly mapId: string; readonly npcId: string }
  | { readonly kind: 'signpost'; readonly mapId: string }
  | { readonly kind: 'station'; readonly mapId: string; readonly stationId: string }
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
  private currentWeather: Weather = 'clear';
  /** The save's field tools, as the server reported them (D3). */
  private tools: ReadonlySet<string> = new Set();
  /** Weather particles stand still for players who prefer reduced motion. */
  reducedMotion = false;
  /** The area of the player's tile when last checked; `null` before the first update. */
  private area: string | undefined | null = null;
  private residentList: Resident[] = [];
  /** Spots whose species is an animal: only reachable through their resident, never as fixed spots. */
  private animalSpots: ReadonlySet<string> = new Set();
  private readonly npcStates = new Map<string, NpcState>();
  private elapsed = 0;

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
    for (const npc of map.npcs) {
      const random = seededRandom(`npc:${npc.npcId}`);
      this.npcStates.set(npc.npcId, { facing: 'down', untilTurn: npcTurnDelay(random), random });
    }
  }

  /** Game time since the world started, for tile animations. */
  get elapsedMs(): number {
    return this.elapsed;
  }

  /** The residents present now. */
  get residents(): readonly Resident[] {
    return this.residentList;
  }

  /** The direction an NPC faces. */
  npcFacing(npcId: string): Direction {
    return this.npcStates.get(npcId)?.facing ?? 'down';
  }

  /**
   * The map's residents as the server lists them: new ones appear at home, present ones keep their
   * position, absent ones leave. Every listed spot stops being a fixed spot.
   */
  setResidents(list: readonly ResidentInfo[]): void {
    this.animalSpots = new Set(list.map((info) => info.spotId));
    const kept = new Map(this.residentList.map((resident) => [resident.spotId, resident]));
    this.residentList = list
      .filter((info) => info.present)
      .flatMap((info) => {
        const existing = kept.get(info.spotId);
        if (existing) return [existing];
        const home = this.map.spots.find((spot) => spot.spotId === info.spotId);
        return home
          ? [new Resident(info.spotId, info.speciesId, info.torch, home, info.aquatic === true)]
          : [];
      });
  }

  /** Whether the player's torch is lit; it only shows in the evening and at night. */
  /** The save's field tools, as the server reported them; boots and binoculars change movement and reach. */
  setTools(tools: Iterable<string>): void {
    this.tools = new Set(tools);
  }

  /** The current region's weather, as the server reported it (D11). */
  get weather(): Weather {
    return this.currentWeather;
  }

  setWeather(weather: Weather): void {
    this.currentWeather = weather;
  }

  /** Whether the player stands in an underground area (a cave): dark at any time of day. */
  get isUnderground(): boolean {
    return this.map.isUnderground(this.player.tileX, this.player.tileY);
  }

  /** Dark enough for the torch to matter: evening, night, or underground. */
  get isDark(): boolean {
    const timeOfDay = this.conditions.timeOfDay;
    return timeOfDay === 'evening' || timeOfDay === 'night' || this.isUnderground;
  }

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

  /** Map collision, NPCs, the signpost, research stations, residents and closed gates. */
  isBlocked(x: number, y: number): boolean {
    return this.isFixedObstacle(x, y) || this.residentList.some((r) => r.occupies(x, y));
  }

  /** Like `isBlocked`, but with boots the player wades through wadeable water; animals never do. */
  isBlockedForPlayer(x: number, y: number): boolean {
    if (!(this.tools.has('boots') && this.map.isWadeable(x, y))) return this.isBlocked(x, y);
    const gate = this.map.gateAt(x, y);
    return (
      this.map.npcAt(x, y) !== undefined ||
      this.map.signpostAt(x, y) !== undefined ||
      this.map.stationAt(x, y) !== undefined ||
      (gate !== undefined && !this.openFlags.has(gate.flag)) ||
      this.residentList.some((r) => r.occupies(x, y))
    );
  }

  /** A water tile an aquatic resident may swim into: wadeable, with no NPC, signpost, station or gate on it. */
  private isOpenWater(x: number, y: number): boolean {
    return (
      this.map.isWadeable(x, y) &&
      this.map.npcAt(x, y) === undefined &&
      this.map.signpostAt(x, y) === undefined &&
      this.map.stationAt(x, y) === undefined &&
      this.map.gateAt(x, y) === undefined
    );
  }

  private isFixedObstacle(x: number, y: number): boolean {
    const gate = this.map.gateAt(x, y);
    return (
      this.map.isBlocked(x, y) ||
      this.map.npcAt(x, y) !== undefined ||
      this.map.signpostAt(x, y) !== undefined ||
      this.map.stationAt(x, y) !== undefined ||
      (gate !== undefined && !this.openFlags.has(gate.flag))
    );
  }

  /** Advances one fixed simulation step using the actions gathered since the last step. */
  update(input: ActionState, stepMs: number): void {
    this.elapsed += stepMs;
    this.minutes += (stepMs / 1000) * this.gameMinutesPerSecond;
    this.refreshConditions();
    this.updateNpcs(stepMs);
    this.updateResidents(stepMs);

    const presses = input.takePresses();

    if (presses.includes('OpenMenu')) {
      this.onOpenMenu();
    }

    if (presses.includes('Inventory')) {
      this.listeners.onOpenInventory?.();
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
      { isBlocked: (x, y) => this.isBlockedForPlayer(x, y) },
    );

    // The location follows the player's tile: report it on the first update and whenever it changes.
    const area = this.map.areaAt(this.player.tileX, this.player.tileY);
    if (area !== this.area) {
      this.area = area;
      if (area !== undefined) this.listeners.onAreaChange?.(area);
    }
  }

  private updateNpcs(stepMs: number): void {
    for (const state of this.npcStates.values()) {
      state.untilTurn -= stepMs;
      if (state.untilTurn > 0) continue;
      const options = IDLE_FACINGS.filter((facing) => facing !== state.facing);
      state.facing = options[Math.floor(state.random() * options.length)];
      state.untilTurn = npcTurnDelay(state.random);
    }
  }

  private updateResidents(stepMs: number): void {
    const player = this.player;
    const surroundings: Surroundings = {
      player: { x: player.tileX, y: player.tileY },
      torchLit: this.torch && this.isDark,
      isFreeFor: (resident, x, y) =>
        (resident.aquatic ? this.isOpenWater(x, y) : !this.isFixedObstacle(x, y)) &&
        !(player.tileX === x && player.tileY === y) &&
        !(player.targetTile?.x === x && player.targetTile?.y === y) &&
        !this.residentList.some((other) => other !== resident && other.occupies(x, y)),
    };
    for (const resident of this.residentList) resident.update(stepMs, surroundings);
  }

  /** Recomputes the time and tells the host whenever the in-game minute changed. */
  private refreshConditions(): void {
    const previous = this.conditions;
    this.conditions = worldTimeAt(this.minutes);
    if (previous.minutes !== this.conditions.minutes) {
      this.listeners.onTimeChange?.(this.conditions);
    }
  }

  /**
   * With the binoculars, the nearest resident 2 or 3 tiles straight ahead, if nothing between blocks the view
   * (map collision, an NPC or the signpost).
   */
  private residentInSight(x: number, y: number, dx: number, dy: number): Resident | undefined {
    if (!this.tools.has('binoculars')) return undefined;
    for (let distance = 2; distance <= BINOCULARS_RANGE; distance++) {
      const [bx, by] = [x + dx * (distance - 1), y + dy * (distance - 1)];
      if (
        this.map.isBlocked(bx, by) ||
        this.map.npcAt(bx, by) ||
        this.map.signpostAt(bx, by) ||
        this.map.stationAt(bx, by)
      )
        return undefined;
      const [tx, ty] = [x + dx * distance, y + dy * distance];
      const resident = this.residentList.find((r) => r.tileX === tx && r.tileY === ty);
      if (resident) return resident;
    }
    return undefined;
  }

  private interact(): void {
    const { dx, dy } = stepOf(this.player.facing);
    const { tileX: x, tileY: y } = this.player;
    const npc = this.map.npcAt(x + dx, y + dy);
    const resident = this.residentList.find((r) => r.tileX === x + dx && r.tileY === y + dy);
    const fixed = this.map.spotAt(x + dx, y + dy);
    const spot = fixed && !this.animalSpots.has(fixed.spotId) ? fixed : undefined;
    if (npc) {
      // The NPC turns to face the player and holds still a while.
      const state = this.npcStates.get(npc.npcId);
      if (state) {
        state.facing = OPPOSITE[this.player.facing];
        state.untilTurn = NPC_HOLD_MS;
      }
      this.onInteract({ kind: 'npc', mapId: this.map.id, npcId: npc.npcId });
    } else if (this.map.signpostAt(x + dx, y + dy)) {
      this.onInteract({ kind: 'signpost', mapId: this.map.id });
    } else if (this.map.stationAt(x + dx, y + dy)) {
      this.onInteract({
        kind: 'station',
        mapId: this.map.id,
        stationId: this.map.stationAt(x + dx, y + dy)!.stationId,
      });
    } else if (resident) {
      this.onInteract({ kind: 'spot', mapId: this.map.id, spotId: resident.spotId });
    } else if (spot) {
      this.onInteract({ kind: 'spot', mapId: this.map.id, spotId: spot.spotId });
    } else if (this.residentInSight(x, y, dx, dy)) {
      this.onInteract({
        kind: 'spot',
        mapId: this.map.id,
        spotId: this.residentInSight(x, y, dx, dy)!.spotId,
      });
    } else if (this.map.isBlocked(x + dx, y + dy) && this.map.habitatAt(x + dx, y + dy)) {
      // A tree, shrub or rock inside a habitat zone is searched like the grass around it.
      this.onInteract({ kind: 'search', mapId: this.map.id, x: x + dx, y: y + dy });
    } else if (this.map.habitatAt(x, y)) {
      this.onInteract({ kind: 'search', mapId: this.map.id, x, y });
    }
  }
}
