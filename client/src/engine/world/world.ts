import { ActionState } from '../input/action-state';
import { directionOf, stepOf } from '../input/actions';
import { Player } from './player';
import { Gate, Obstacles, WorldMap } from './world-map';

/**
 * The world asks the host to handle an interaction; the server decides the outcome (D3): a conversation
 * with the NPC the player faces, the spot the player faces, or a search of the habitat the player stands in.
 */
export type Interaction =
  | { readonly kind: 'npc'; readonly mapId: string; readonly npcId: string }
  | { readonly kind: 'spot'; readonly mapId: string; readonly spotId: string }
  | { readonly kind: 'search'; readonly mapId: string; readonly x: number; readonly y: number };

/** Simulation of one map: the player, movement, interaction, and which gates the save's flags open. */
export class World implements Obstacles {
  readonly player: Player;
  private openFlags: ReadonlySet<string> = new Set();

  constructor(
    readonly map: WorldMap,
    private readonly onInteract: (interaction: Interaction) => void,
    private readonly onOpenMenu: () => void = () => undefined,
  ) {
    this.player = new Player(map.spawn);
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
    const presses = input.takePresses();

    if (presses.includes('OpenMenu')) {
      this.onOpenMenu();
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
