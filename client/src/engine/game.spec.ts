import { createGame } from './game';
import { STEP_MS } from './game-loop';
import { Action } from './input/actions';
import { FakeEnvironment } from './testing/fake-environment';
import { Interaction } from './world/world';
import { textMap } from './world/testing';

interface Draw {
  image: string;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

/** Minimal stand-in for a 2D context that records draws; jsdom has no canvas implementation. */
function fakeContext() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    transform: [1, 0, 0, 1, 0, 0],
    draws: [] as Draw[],
    setTransform(...matrix: number[]) {
      this.transform = matrix;
    },
    fillRect() {
      this.draws.push({ image: 'backdrop', sx: 0, sy: 0, dx: 0, dy: 0 });
    },
    drawImage(
      image: { name: string },
      sx: number,
      sy: number,
      _sw: number,
      _sh: number,
      dx: number,
      dy: number,
    ) {
      this.draws.push({ image: image.name, sx, sy, dx, dy });
    },
  };
}

function setup(rows: readonly string[] = ['#S*#', '....']) {
  const environment = new FakeEnvironment();
  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  const context = fakeContext();
  canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
  const interactions: Interaction[] = [];
  const game = createGame(container, canvas, {
    environment,
    world: {
      map: textMap(rows),
      tileset: { name: 'tileset' } as unknown as CanvasImageSource,
      playerSprite: { name: 'player' } as unknown as CanvasImageSource,
    },
    onInteract: (interaction) => interactions.push(interaction),
  });
  return { environment, canvas, context, game, interactions };
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

  it('draws the backdrop, then the map, then the player on top', () => {
    const { environment, context, game } = setup();
    game.start();

    environment.frames.frame(STEP_MS);

    const order = context.draws.map((draw) => draw.image);
    expect(order[0]).toBe('backdrop');
    expect(order.at(-1)).toBe('player');
    expect(order.filter((image) => image === 'tileset')).toHaveLength(8); // 4×2 map, all tiles
  });

  it('draws at whole pixel positions while walking', () => {
    const { environment, context, game } = setup(['S.......', '........']);
    game.start();
    environment.input.press('MoveRight');

    for (let i = 0; i < 20; i++) environment.frames.frame(STEP_MS);

    for (const draw of context.draws) {
      expect(Number.isInteger(draw.dx) && Number.isInteger(draw.dy)).toBe(true);
    }
  });

  it('reports interactions with spots to the host', () => {
    const { environment, game, interactions } = setup();
    game.start();

    environment.input.press('Interact');
    environment.frames.frame(STEP_MS);

    expect(interactions).toEqual([{ mapId: 'test_map', spotId: 'spot' }]);
  });

  it('gives input to UI overlays instead of the world when asked', () => {
    const { environment, game, interactions } = setup();
    const ui: Action[] = [];
    game.onUiAction((action) => ui.push(action));
    game.start();

    game.setActionConsumer('ui');
    environment.input.press('Interact');
    environment.frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
    expect(ui).toEqual(['Interact']);
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
    expect(environment.listenerCount).toBe(4);
    expect(environment.frames.pendingCount).toBe(1);

    game.stop();
    const drawn = context.draws.length;
    environment.frames.frame(1000);

    expect(environment.frames.pendingCount).toBe(0);
    expect(environment.listenerCount).toBe(0);
    expect(context.draws.length).toBe(drawn);
  });

  it('can be stopped twice safely', () => {
    const { game } = setup();
    game.start();

    game.stop();

    expect(() => game.stop()).not.toThrow();
  });
});
