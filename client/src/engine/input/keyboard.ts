import type { Unsubscribe } from '../platform';
import { Action, ActionSink } from './actions';

/** Physical key (`KeyboardEvent.code`) → logical actions. */
export type KeyMap = Readonly<Record<string, readonly Action[]>>;

const CONFIRM_KEYS: readonly Action[] = ['Interact', 'Confirm'];

/**
 * Default mapping. Codes name physical key positions, so `KeyW`/`KeyA`/`KeyS`/`KeyD` work on any
 * keyboard layout. One key may mean different things to the world and to the UI (e.g. `Enter`).
 */
export const DEFAULT_KEY_MAP: KeyMap = {
  ArrowUp: ['MoveUp'],
  KeyW: ['MoveUp'],
  ArrowDown: ['MoveDown'],
  KeyS: ['MoveDown'],
  ArrowLeft: ['MoveLeft'],
  KeyA: ['MoveLeft'],
  ArrowRight: ['MoveRight'],
  KeyD: ['MoveRight'],
  ShiftLeft: ['Run'],
  ShiftRight: ['Run'],
  KeyE: CONFIRM_KEYS,
  Enter: CONFIRM_KEYS,
  NumpadEnter: CONFIRM_KEYS,
  Space: CONFIRM_KEYS,
  Escape: ['Cancel', 'OpenMenu'],
  KeyM: ['OpenMenu'],
  KeyL: ['Torch'],
  KeyI: ['Inventory'],
};

/**
 * Turns keyboard events on `target` into action presses and releases. Auto-repeat is ignored, an
 * action stays held while any key mapped to it is held, and everything is released when the window
 * loses focus or the page is hidden.
 */
export function attachKeyboard(
  target: Window,
  sink: ActionSink,
  keyMap: KeyMap = DEFAULT_KEY_MAP,
): Unsubscribe {
  const heldCodes = new Set<string>();
  const isHeld = (action: Action) => [...heldCodes].some((code) => keyMap[code]?.includes(action));

  const onKeyDown = (event: KeyboardEvent) => {
    const actions = keyMap[event.code];
    if (!actions) return;
    // Mapped keys belong to the game: no page scrolling or native button activation.
    event.preventDefault();
    if (event.repeat || heldCodes.has(event.code)) return;

    const newlyHeld = actions.filter((action) => !isHeld(action));
    heldCodes.add(event.code);
    sink.pressAll(newlyHeld);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const actions = keyMap[event.code];
    if (!actions || !heldCodes.delete(event.code)) return;
    actions.filter((action) => !isHeld(action)).forEach((action) => sink.release(action));
  };

  const releaseAll = () => {
    heldCodes.clear();
    sink.releaseAll();
  };
  const onVisibilityChange = () => {
    if (target.document.visibilityState === 'hidden') releaseAll();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', releaseAll);
  target.document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', releaseAll);
    target.document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
