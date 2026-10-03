import { Action, ActionSink } from './actions';
import { DEFAULT_KEY_MAP, KeyMap, attachKeyboard } from './keyboard';

class RecordingSink implements ActionSink {
  readonly events: string[] = [];
  press(action: Action) {
    this.events.push(`+${action}`);
  }
  pressAll(actions: readonly Action[]) {
    actions.forEach((action) => this.press(action));
  }
  release(action: Action) {
    this.events.push(`-${action}`);
  }
  releaseAll() {
    this.events.push('releaseAll');
  }
}

function setup(keyMap: KeyMap = DEFAULT_KEY_MAP) {
  const sink = new RecordingSink();
  const detach = attachKeyboard(window, sink, keyMap);
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false) => {
    const event = new KeyboardEvent(type, { code, repeat, cancelable: true });
    window.dispatchEvent(event);
    return event;
  };
  return { sink, detach, key };
}

describe('attachKeyboard', () => {
  let detach: (() => void) | undefined;
  afterEach(() => detach?.());

  it.each([
    ['ArrowRight', 'MoveRight'],
    ['KeyD', 'MoveRight'],
    ['KeyW', 'MoveUp'],
    ['ShiftLeft', 'Run'],
    ['KeyM', 'OpenMenu'],
    ['KeyL', 'Torch'],
    ['KeyI', 'Inventory'],
  ])('maps %s to %s', (code, action) => {
    const keyboard = setup();
    detach = keyboard.detach;

    keyboard.key('keydown', code);

    expect(keyboard.sink.events).toEqual([`+${action}`]);
  });

  it('maps Enter to both Interact and Confirm, and Escape to both Cancel and OpenMenu', () => {
    const keyboard = setup();
    detach = keyboard.detach;

    keyboard.key('keydown', 'Enter');
    keyboard.key('keydown', 'Escape');

    expect(keyboard.sink.events).toEqual(['+Interact', '+Confirm', '+Cancel', '+OpenMenu']);
  });

  it('uses a custom mapping without any gameplay change', () => {
    const keyboard = setup({ KeyK: ['MoveUp'] });
    detach = keyboard.detach;

    keyboard.key('keydown', 'KeyK');
    keyboard.key('keydown', 'ArrowUp');

    expect(keyboard.sink.events).toEqual(['+MoveUp']);
  });

  it('ignores operating-system auto-repeat', () => {
    const keyboard = setup();
    detach = keyboard.detach;

    keyboard.key('keydown', 'KeyE');
    keyboard.key('keydown', 'KeyE', true);
    keyboard.key('keydown', 'KeyE', true);

    expect(keyboard.sink.events).toEqual(['+Interact', '+Confirm']);
  });

  it('keeps an action held while any of its keys is held', () => {
    const keyboard = setup();
    detach = keyboard.detach;

    keyboard.key('keydown', 'ArrowUp');
    keyboard.key('keydown', 'KeyW');
    keyboard.key('keyup', 'ArrowUp');
    expect(keyboard.sink.events).toEqual(['+MoveUp']);

    keyboard.key('keyup', 'KeyW');
    expect(keyboard.sink.events).toEqual(['+MoveUp', '-MoveUp']);
  });

  it('releases everything when the window loses focus', () => {
    const keyboard = setup();
    detach = keyboard.detach;
    keyboard.key('keydown', 'ArrowLeft');

    window.dispatchEvent(new Event('blur'));
    keyboard.key('keydown', 'ArrowLeft');

    expect(keyboard.sink.events).toEqual(['+MoveLeft', 'releaseAll', '+MoveLeft']);
  });

  it('releases everything when the page becomes hidden', () => {
    const keyboard = setup();
    detach = keyboard.detach;
    keyboard.key('keydown', 'ArrowLeft');
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    document.dispatchEvent(new Event('visibilitychange'));
    visibility.mockRestore();

    expect(keyboard.sink.events).toEqual(['+MoveLeft', 'releaseAll']);
  });

  it('prevents the browser default only for mapped keys', () => {
    const keyboard = setup();
    detach = keyboard.detach;

    expect(keyboard.key('keydown', 'Space').defaultPrevented).toBe(true);
    expect(keyboard.key('keydown', 'Tab').defaultPrevented).toBe(false);
  });

  it('stops listening when detached', () => {
    const keyboard = setup();

    keyboard.detach();
    keyboard.key('keydown', 'ArrowUp');

    expect(keyboard.sink.events).toEqual([]);
  });
});
