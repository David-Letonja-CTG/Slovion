import { textMap } from '../world/testing';
import {
  DEBUG_COLLISION,
  DEBUG_SPAWN,
  DEBUG_SPOT,
  debugColour,
  drawDebugOverlay,
} from './debug-overlay';

/** Records the fills and outlines drawn, with the style in effect. */
function recording() {
  const calls: { op: string; style: unknown; args: number[] }[] = [];
  const context = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    globalAlpha: 1,
    save: () => undefined,
    restore: () => undefined,
    fillRect: (...args: number[]) => calls.push({ op: 'fill', style: context.fillStyle, args }),
    strokeRect: (...args: number[]) =>
      calls.push({ op: 'stroke', style: context.strokeStyle, args }),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

describe('drawDebugOverlay', () => {
  it('draws blocked tiles, spots and the spawn', () => {
    const map = textMap(['#S*#']);
    const { context, calls } = recording();

    drawDebugOverlay(context, map, { x: 0, y: 0 }, { width: 320, height: 180 });

    expect(
      calls.filter((call) => call.style === DEBUG_COLLISION).map((call) => call.args[0]),
    ).toEqual([0, 48]);
    expect(calls.some((call) => call.op === 'stroke' && call.style === DEBUG_SPAWN)).toBe(true);
    expect(map.spots).toHaveLength(1);
    expect(calls.filter((call) => call.style === DEBUG_SPOT)).toHaveLength(1);
  });

  it('gives each habitat a stable colour', () => {
    expect(debugColour('fir_beech_forest')).toBe(debugColour('fir_beech_forest'));
    expect(debugColour('fir_beech_forest')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
