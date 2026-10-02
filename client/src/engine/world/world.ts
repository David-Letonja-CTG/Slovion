import { ActionState } from '../input/action-state';
import { directionOf, stepOf } from '../input/actions';
import { Player } from './player';
import { WorldMap } from './world-map';

/**
 * The world asks the host to handle an interaction; the server decides the outcome (D3): either the
 * spot the player faces, or a search of the habitat the player stands in.
 */
export type Interaction =
  | { readonly kind: 'spot'; readonly mapId: string; readonly spotId: string }
  | { readonly kind: 'search'; readonly mapId: string; readonly x: number; readonly y: number };

/** Simulation of one map: the player, movement and interaction. */
export class World {
  readonly player: Player;

  constructor(
    readonly map: WorldMap,
    private readonly onInteract: (interaction: Interaction) => void,
    private readonly onOpenMenu: () => void = () => undefined,
  ) {
    this.player = new Player(map.spawn);
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
      this.map,
    );
  }

  private interact(): void {
    const { dx, dy } = stepOf(this.player.facing);
    const { tileX: x, tileY: y } = this.player;
    const spot = this.map.spotAt(x + dx, y + dy);
    if (spot) {
      this.onInteract({ kind: 'spot', mapId: this.map.id, spotId: spot.spotId });
    } else if (this.map.habitatAt(x, y)) {
      this.onInteract({ kind: 'search', mapId: this.map.id, x, y });
    }
  }
}
