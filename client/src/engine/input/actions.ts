/** Logical game actions. Gameplay and UI react only to these, never to physical keys. */
export type Action =
  | 'MoveUp'
  | 'MoveDown'
  | 'MoveLeft'
  | 'MoveRight'
  | 'Run'
  | 'Interact'
  | 'Confirm'
  | 'Cancel'
  | 'OpenMenu'
  | 'Torch'
  | 'Inventory';

export type Direction = 'up' | 'down' | 'left' | 'right';

const MOVE_DIRECTIONS: Partial<Record<Action, Direction>> = {
  MoveUp: 'up',
  MoveDown: 'down',
  MoveLeft: 'left',
  MoveRight: 'right',
};

/** The direction of a movement action, or `undefined` for other actions. */
export function directionOf(action: Action): Direction | undefined {
  return MOVE_DIRECTIONS[action];
}

/** Tile offset of one step in a direction. */
export function stepOf(direction: Direction): { readonly dx: number; readonly dy: number } {
  switch (direction) {
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'right':
      return { dx: 1, dy: 0 };
  }
}

/** Receives action presses and releases from an input device. */
export interface ActionSink {
  press(action: Action): void;
  /** Presses several actions caused by one physical input (e.g. Escape = Cancel + OpenMenu). */
  pressAll(actions: readonly Action[]): void;
  release(action: Action): void;
  /** Releases everything, e.g. when focus is lost. */
  releaseAll(): void;
}
