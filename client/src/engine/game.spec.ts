import { createGame } from './game';
import { FakeEnvironment } from './testing/fake-environment';

/** Minimal stand-in for a 2D context; jsdom has no canvas implementation. */
function fakeContext() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    transform: [1, 0, 0, 1, 0, 0],
    fillRects: 0,
    setTransform(...matrix: number[]) {
      this.transform = matrix;
    },
    fillRect() {
      this.fillRects++;
    },
  };
}

function setup() {
  const environment = new FakeEnvironment();
  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  const context = fakeContext();
  canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
  const game = createGame(container, canvas, { environment });
  return { environment, canvas, context, game };
}

describe('createGame', () => {
  it('sizes the canvas for the available area when started', () => {
    const { environment, canvas, game } = setup();
    game.start();

    environment.resize(1280, 720);

    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    expect([canvas.style.width, canvas.style.height]).toEqual(['1280px', '720px']);
  });

  it('recomputes the layout when the area changes, before the next frame', () => {
    const { environment, canvas, game } = setup();
    game.start();
    environment.resize(1280, 720);

    environment.resize(1000, 700);

    expect([canvas.width, canvas.height]).toEqual([960, 540]);
    expect([canvas.style.left, canvas.style.top]).toEqual(['20px', '80px']);
  });

  it('recomputes the layout when the device pixel ratio changes', () => {
    const { environment, canvas, game } = setup();
    game.start();
    environment.resize(1280, 720);

    environment.changePixelRatio(2);

    expect(canvas.width).toBe(2560);
    expect(canvas.style.width).toBe('1280px');
  });

  it('renders crisp pixels: smoothing off, pixelated scaling, integer draw scale', () => {
    const { environment, canvas, context, game } = setup();
    game.start();

    environment.resize(1280, 720);

    expect(context.imageSmoothingEnabled).toBe(false);
    expect(canvas.style.imageRendering).toBe('pixelated');
    expect(context.transform).toEqual([4, 0, 0, 4, 0, 0]);
  });

  it('draws a frame on every display frame', () => {
    const { environment, context, game } = setup();
    game.start();
    environment.resize(1280, 720);

    environment.frames.frame(16);

    expect(context.fillRects).toBeGreaterThan(0);
  });

  it('pauses while the page is hidden and resumes when shown', () => {
    const { environment, game } = setup();
    game.start();

    environment.setHidden(true);
    expect(environment.frames.pendingCount).toBe(0);

    environment.setHidden(false);
    expect(environment.frames.pendingCount).toBe(1);
  });

  it('cancels the scheduled frame and removes every listener on stop', () => {
    const { environment, context, game } = setup();
    game.start();
    expect(environment.listenerCount).toBe(3);
    expect(environment.frames.pendingCount).toBe(1);

    game.stop();
    const drawn = context.fillRects;
    environment.frames.frame(1000);

    expect(environment.frames.pendingCount).toBe(0);
    expect(environment.listenerCount).toBe(0);
    expect(context.fillRects).toBe(drawn);
  });

  it('can be stopped twice safely', () => {
    const { game } = setup();
    game.start();

    game.stop();

    expect(() => game.stop()).not.toThrow();
  });
});
