import { Action, ActionSink, Direction, directionOf } from './actions';

/**
 * The world's view of input: which actions are held, which were pressed since the last simulation
 * step (so taps shorter than a step are not lost), and the active movement direction.
 */
export class ActionState implements ActionSink {
  private readonly held = new Set<Action>();
  private presses: Action[] = [];
  /** Held directions, most recently pressed last. */
  private directions: Direction[] = [];

  press(action: Action): void {
    if (this.held.has(action)) return;
    this.held.add(action);
    this.presses.push(action);

    const direction = directionOf(action);
    if (direction) {
      this.directions = [...this.directions.filter((d) => d !== direction), direction];
    }
  }

  pressAll(actions: readonly Action[]): void {
    actions.forEach((action) => this.press(action));
  }

  release(action: Action): void {
    this.held.delete(action);
    const direction = directionOf(action);
    if (direction) {
      this.directions = this.directions.filter((d) => d !== direction);
    }
  }

  releaseAll(): void {
    this.held.clear();
    this.directions = [];
    this.presses = [];
  }

  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  /** The most recently pressed direction that is still held. */
  get heldDirection(): Direction | undefined {
    return this.directions.at(-1);
  }

  /** Actions pressed since the previous call, in order. Call once per simulation step. */
  takePresses(): readonly Action[] {
    const presses = this.presses;
    this.presses = [];
    return presses;
  }
}
