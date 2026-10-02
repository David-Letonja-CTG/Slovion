import { ActionState } from './action-state';

describe('ActionState', () => {
  it('uses the most recently pressed direction and falls back when it is released', () => {
    const state = new ActionState();

    state.press('MoveRight');
    expect(state.heldDirection).toBe('right');

    state.press('MoveUp');
    expect(state.heldDirection).toBe('up');

    state.release('MoveUp');
    expect(state.heldDirection).toBe('right');

    state.release('MoveRight');
    expect(state.heldDirection).toBeUndefined();
  });

  it('remembers presses until the next step, even if already released', () => {
    const state = new ActionState();

    state.press('MoveDown');
    state.release('MoveDown');

    expect(state.takePresses()).toEqual(['MoveDown']);
    expect(state.takePresses()).toEqual([]);
  });

  it('counts a press once while held', () => {
    const state = new ActionState();

    state.press('Interact');
    state.press('Interact');

    expect(state.takePresses()).toEqual(['Interact']);
    expect(state.isHeld('Interact')).toBe(true);
  });

  it('forgets everything on releaseAll', () => {
    const state = new ActionState();
    state.press('MoveLeft');
    state.press('Run');

    state.releaseAll();

    expect(state.heldDirection).toBeUndefined();
    expect(state.isHeld('Run')).toBe(false);
    expect(state.takePresses()).toEqual([]);
  });
});
