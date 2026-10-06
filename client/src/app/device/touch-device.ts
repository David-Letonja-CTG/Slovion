import { DOCUMENT } from '@angular/common';
import { InjectionToken, Signal, inject, signal } from '@angular/core';

/**
 * Whether the player uses a touch screen: true on devices whose main pointer is coarse (phones, tablets), and on any
 * other device from its first touch (a laptop with a touch screen). Replaceable in tests.
 */
export const TOUCH_DEVICE = new InjectionToken<Signal<boolean>>('TOUCH_DEVICE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    const touch = signal(document.defaultView?.matchMedia?.('(pointer: coarse)').matches ?? false);
    if (!touch()) {
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'touch') return;
        touch.set(true);
        document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      };
      document.addEventListener('pointerdown', onPointerDown, { capture: true });
    }
    return touch.asReadonly();
  },
});
