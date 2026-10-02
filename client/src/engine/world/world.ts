import { ActionState } from '../input/action-state';
import { directionOf, stepOf } from '../input/actions';
import { Player } from './player';
import { WorldMap } from './world-map';

/** The world asks the host to handle an interaction; the server decides the outcome (D3). */
export interface Interaction {
  readonly mapId: string;
  readonly spotId: string;
}

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
    const spot = this.map.spotAt(this.player.tileX + dx, this.player.tileY + dy);
    if (spot) {
      this.onInteract({ mapId: this.map.id, spotId: spot.spotId });
    }
  }
}
