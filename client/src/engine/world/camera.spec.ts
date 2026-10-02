import { cameraOffset } from './camera';

const VIEW = { width: 320, height: 180 };
const MAP = { width: 512, height: 320 }; // 32×20 tiles

describe('cameraOffset', () => {
  it('centres the player far from the edges', () => {
    const focus = { x: 256, y: 160 };

    const offset = cameraOffset(focus, MAP, VIEW);

    expect(offset).toEqual({ x: 96, y: 70 });
    expect([focus.x - offset.x, focus.y - offset.y]).toEqual([160, 90]); // view centre
  });

  it('stops at the top-left corner', () => {
    expect(cameraOffset({ x: 8, y: 8 }, MAP, VIEW)).toEqual({ x: 0, y: 0 });
  });

  it('stops at the bottom-right corner', () => {
    expect(cameraOffset({ x: 504, y: 312 }, MAP, VIEW)).toEqual({ x: 192, y: 140 });
  });

  it('centres a map that is smaller than the view along that dimension', () => {
    const offset = cameraOffset({ x: 100, y: 40 }, { width: 640, height: 80 }, VIEW);

    expect(offset).toEqual({ x: 0, y: -50 });
  });

  it('returns whole pixels', () => {
    const offset = cameraOffset({ x: 250.4, y: 150.6 }, MAP, VIEW);

    expect(Number.isInteger(offset.x) && Number.isInteger(offset.y)).toBe(true);
  });
});
