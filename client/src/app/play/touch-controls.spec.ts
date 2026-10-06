import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { provideTestLocalization } from '../i18n/localization.testing';
import { TouchControls } from './touch-controls';

@Component({
  imports: [TouchControls],
  template: `<app-touch-controls
    (pressed)="log.push('+' + $event.join('+'))"
    (released)="log.push('-' + $event.join('+'))"
  />`,
})
class Host {
  readonly log: string[] = [];
}

/** jsdom has no PointerEvent: a mouse event with the pointer's id and type. */
function pointer(type: string, target: Element, { id = 1, x = 50, y = 50 } = {}): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  target.dispatchEvent(event);
  return event;
}

async function render() {
  TestBed.configureTestingModule({ imports: [Host], providers: [provideTestLocalization({ sl })] });
  await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const pad = root.querySelector<HTMLElement>('.touch__pad')!;
  // A 100 × 100 pad at the page's origin: its centre is (50, 50).
  pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
  const button = (id: 'a' | 'b') => root.querySelector<HTMLElement>(`[data-button="${id}"]`)!;
  return { fixture, root, pad, button, log: fixture.componentInstance.log };
}

describe('TouchControls', () => {
  it.each([
    ['right', 95, 50, 'MoveRight'],
    ['left', 5, 50, 'MoveLeft'],
    ['top', 50, 5, 'MoveUp'],
    ['bottom', 50, 95, 'MoveDown'],
  ] as const)('holds a direction while the %s of the D-pad is touched', async (_, x, y, move) => {
    const { pad, log } = await render();

    pointer('pointerdown', pad, { x, y });
    pointer('pointerup', pad, { x, y });

    expect(log).toEqual([`+${move}`, `-${move}`]);
  });

  it('turns when the finger slides to another side, without lifting', async () => {
    const { pad, log, fixture } = await render();

    pointer('pointerdown', pad, { x: 50, y: 5 });
    pointer('pointermove', pad, { x: 48, y: 10 });
    pointer('pointermove', pad, { x: 5, y: 45 });
    await fixture.whenStable();

    expect(log).toEqual(['+MoveUp', '-MoveUp', '+MoveLeft']);
    expect(pad.querySelector('.touch__arrow--held')?.getAttribute('data-move')).toBe('MoveLeft');
  });

  it('holds no direction near the centre', async () => {
    const { pad, log } = await render();

    pointer('pointerdown', pad, { x: 55, y: 48 });
    pointer('pointermove', pad, { x: 95, y: 50 });
    pointer('pointermove', pad, { x: 50, y: 52 });

    expect(log).toEqual(['+MoveRight', '-MoveRight']);
  });

  it.each([
    ['a', 'Interact+Confirm'],
    ['b', 'Cancel+Run'],
  ] as const)('presses %s as %s until the finger lifts', async (id, actions) => {
    const { button, log, fixture } = await render();

    const down = pointer('pointerdown', button(id), { id: 2 });
    await fixture.whenStable();
    expect(log).toEqual([`+${actions}`]);
    expect(down.defaultPrevented).toBe(true);
    expect(button(id).classList).toContain('touch__button--held');

    pointer('pointerup', button(id), { id: 2 });
    expect(log).toEqual([`+${actions}`, `-${actions}`]);
  });

  it('follows each finger on its own: walking while B is held, and B lifted first', async () => {
    const { pad, button, log } = await render();

    pointer('pointerdown', pad, { id: 1, x: 95, y: 50 });
    pointer('pointerdown', button('b'), { id: 2 });
    // Another finger on the D-pad, or the first finger's events on B, change nothing.
    pointer('pointerdown', pad, { id: 3, x: 5, y: 50 });
    pointer('pointerup', button('b'), { id: 1 });
    pointer('pointerup', button('b'), { id: 2 });

    expect(log).toEqual(['+MoveRight', '+Cancel+Run', '-Cancel+Run']);
  });

  it.each(['pointercancel', 'lostpointercapture'])('releases on %s', async (type) => {
    const { pad, button, log } = await render();

    pointer('pointerdown', pad, { id: 1, x: 95, y: 50 });
    pointer('pointerdown', button('a'), { id: 2 });
    pointer(type, pad, { id: 1 });
    pointer(type, button('a'), { id: 2 });

    expect(log).toEqual(['+MoveRight', '+Interact+Confirm', '-MoveRight', '-Interact+Confirm']);
  });

  it('releases everything when the window loses focus', async () => {
    const { pad, button, log } = await render();
    pointer('pointerdown', pad, { id: 1, x: 50, y: 95 });
    pointer('pointerdown', button('a'), { id: 2 });

    window.dispatchEvent(new Event('blur'));

    expect(log).toEqual(['+MoveDown', '+Interact+Confirm', '-MoveDown', '-Interact+Confirm']);
  });

  it('opens no long-press menu', async () => {
    const { root } = await render();
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    root.querySelector('.touch')!.dispatchEvent(menu);

    expect(menu.defaultPrevented).toBe(true);
  });

  it('labels the controls for screen readers', async () => {
    const { pad, button } = await render();

    expect(pad.getAttribute('aria-label')).toBe(sl.touch.pad);
    expect(button('a').getAttribute('aria-label')).toBe(sl.touch.a.name);
    expect(button('a').textContent?.trim()).toBe(sl.touch.a.label);
    expect(button('b').getAttribute('aria-label')).toBe(sl.touch.b.name);
  });
});
