import type { Unsubscribe } from '../platform';
import { Action, ActionSink } from './actions';

/** Who receives input: the game world, or the topmost UI overlay. */
export type ActionConsumer = 'world' | 'ui';

/**
 * Routes input to exactly one consumer. While the UI has input, the world receives nothing, so
 * the player cannot walk behind an open dialog.
 */
export class ActionDispatcher implements ActionSink {
  private consumer: ActionConsumer = 'world';
  private readonly uiListeners = new Set<(action: Action) => void>();

  constructor(private readonly world: ActionSink) {}

  get currentConsumer(): ActionConsumer {
    return this.consumer;
  }

  setConsumer(consumer: ActionConsumer): void {
    if (consumer === this.consumer) return;
    // Keys held when the world loses input must not keep the player walking later.
    this.world.releaseAll();
    this.consumer = consumer;
  }

  /** UI overlays listen here; they receive presses only while the UI is the consumer. */
  onUiAction(listener: (action: Action) => void): Unsubscribe {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  press(action: Action): void {
    this.pressAll([action]);
  }

  /**
   * All actions of one physical input go to the consumer that had input when it was pressed, even if
   * handling the first action switches consumers (e.g. Escape: Cancel closes a dialog, and the
   * OpenMenu from the same key press must not then reopen the menu in the world).
   */
  pressAll(actions: readonly Action[]): void {
    const consumer = this.consumer;
    for (const action of actions) {
      if (consumer === 'world') {
        this.world.press(action);
      } else {
        this.uiListeners.forEach((listener) => listener(action));
      }
    }
  }

  release(action: Action): void {
    if (this.consumer === 'world') this.world.release(action);
  }

  releaseAll(): void {
    this.world.releaseAll();
  }
}
