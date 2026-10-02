import { ActionDispatcher } from './action-dispatcher';
import { ActionState } from './action-state';
import { Action } from './actions';
import { attachKeyboard } from './keyboard';

function setup() {
  const world = new ActionState();
  const dispatcher = new ActionDispatcher(world);
  const ui: Action[] = [];
  dispatcher.onUiAction((action) => ui.push(action));
  return { world, dispatcher, ui };
}

describe('ActionDispatcher', () => {
  it('delivers to the world by default', () => {
    const { world, dispatcher, ui } = setup();

    dispatcher.press('MoveUp');

    expect(world.heldDirection).toBe('up');
    expect(ui).toEqual([]);
  });

  it('delivers only to the UI while the UI is the consumer', () => {
    const { world, dispatcher, ui } = setup();
    dispatcher.setConsumer('ui');

    dispatcher.press('MoveUp');

    expect(world.heldDirection).toBeUndefined();
    expect(world.takePresses()).toEqual([]);
    expect(ui).toEqual(['MoveUp']);
  });

  it('releases held world input when the UI takes over', () => {
    const { world, dispatcher } = setup();
    dispatcher.press('MoveRight');

    dispatcher.setConsumer('ui');
    dispatcher.setConsumer('world');

    expect(world.heldDirection).toBeUndefined();
  });

  it('turns Enter into Interact for the world and Confirm for the UI', () => {
    const { world, dispatcher, ui } = setup();
    const detach = attachKeyboard(window, dispatcher);
    const enter = (type: 'keydown' | 'keyup') =>
      window.dispatchEvent(new KeyboardEvent(type, { code: 'Enter' }));

    enter('keydown');
    enter('keyup');
    expect(world.takePresses()).toContain('Interact');

    dispatcher.setConsumer('ui');
    enter('keydown');
    enter('keyup');
    expect(ui).toContain('Confirm');

    detach();
  });

  it('sends every action of one key press to the same consumer', () => {
    const { world, dispatcher, ui } = setup();
    // Closing the overlay on Cancel hands input back to the world mid-press.
    dispatcher.onUiAction((action) => {
      if (action === 'Cancel') dispatcher.setConsumer('world');
    });
    dispatcher.setConsumer('ui');

    dispatcher.pressAll(['Cancel', 'OpenMenu']);

    expect(ui).toEqual(['Cancel', 'OpenMenu']);
    expect(world.takePresses()).toEqual([]);
  });

  it('stops notifying a UI listener after it unsubscribes', () => {
    const world = new ActionState();
    const dispatcher = new ActionDispatcher(world);
    const received: Action[] = [];
    const unsubscribe = dispatcher.onUiAction((action) => received.push(action));
    dispatcher.setConsumer('ui');

    unsubscribe();
    dispatcher.press('Cancel');

    expect(received).toEqual([]);
  });
});
