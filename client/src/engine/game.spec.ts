import { createGame } from './game';
import { TIME_TINT, TORCH_INNER_RADIUS, TORCH_OUTER_RADIUS } from './render/world-renderer';
import { COMPACT_VIEW, UPRIGHT_VIEWS } from './viewport';
import { STEP_MS } from './game-loop';
import { Action } from './input/actions';
import { FakeEnvironment } from './testing/fake-environment';
import { Interaction } from './world/world';
import { textMap } from './world/testing';

interface Draw {
  image: string;
  /** The fill style of a fillRect: a colour, or a radial gradient for the torch. */
  style?: unknown;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

/** Minimal stand-in for a 2D context that records draws; jsdom has no canvas implementation. */
function fakeContext(name = 'view') {
  return {
    canvas: { name, width: 0, height: 0 },
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    transform: [1, 0, 0, 1, 0, 0],
    draws: [] as Draw[],
    setTransform(...matrix: number[]) {
      this.transform = matrix;
    },
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
      const stops: [number, string][] = [];
      return {
        kind: 'radial',
        x0,
        y0,
        r0,
        r1,
        stops,
        addColorStop: (at: number, color: string) => stops.push([at, color]),
      };
    },
    clearRect() {
      this.draws.push({ image: 'clear', sx: 0, sy: 0, dx: 0, dy: 0 });
    },
    // The debug view's outlines and state; not recorded.
    save: () => undefined,
    restore: () => undefined,
    strokeRect: () => undefined,
    fillRect() {
      const image = this.globalCompositeOperation === 'destination-out' ? 'hole' : 'backdrop';
      this.draws.push({ image, style: this.fillStyle, sx: 0, sy: 0, dx: 0, dy: 0 });
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

function setup(rows: readonly string[] = ['#S*#', '....'], debug = false) {
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
    debug,
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

    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    expect([canvas.style.width, canvas.style.height]).toEqual(['1000px', '562px']);
    expect([canvas.style.left, canvas.style.top]).toEqual(['0px', '69px']);
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

  it('switches to other view sizes at once, e.g. when a phone is turned, using the one that fits largest', () => {
    const { environment, canvas, context, game } = setup();
    game.start();
    environment.resize(1280, 720);

    // In a wide area the 4:3 view fits larger than the 3:4 one.
    game.setViews(UPRIGHT_VIEWS);
    expect(COMPACT_VIEW).toEqual({ width: 240, height: 180 });

    expect([canvas.width, canvas.height]).toEqual([960, 720]);
    expect([canvas.style.left, canvas.style.top]).toEqual(['160px', '0px']);
    expect(context.transform).toEqual([4, 0, 0, 4, 0, 0]);
  });

  it('between two integer scales, draws at the scale above and resamples only the canvas smoothly', () => {
    const { environment, canvas, context, game } = setup();
    game.start();

    environment.resize(1000, 700);

    expect(context.imageSmoothingEnabled).toBe(false);
    expect(canvas.style.imageRendering).toBe('auto');
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

  it('in the debug view, tells where the player stands and faces (for tests on generated maps)', () => {
    const debug = setup(['#S..', '....'], true);
    const plain = setup(['#S..', '....']);
    for (const { environment, game } of [debug, plain]) {
      game.start();
      environment.input.press('MoveRight');
      for (let i = 0; i < 40; i++) environment.frames.frame(STEP_MS);
      environment.input.release('MoveRight');
      environment.frames.frame(STEP_MS);
    }

    expect(debug.canvas.dataset['player']).toBe('3,0,right');
    expect(plain.canvas.dataset['player']).toBeUndefined();
  });

  it('draws closed gates and NPCs above the map and below the player', () => {
    const { environment, context, game } = setup(['#SND', '....']);
    game.start();

    environment.frames.frame(STEP_MS);

    // Tile 6 (gate) is the 6th tile of an 8-column tileset, tile 5 (NPC) the 5th; positions are
    // relative to the map's first tile, since the camera centres a map smaller than the view.
    const origin = context.draws.find((draw) => draw.image === 'tileset')!.dx;
    const tail = context.draws.slice(-3).map((draw) => [draw.image, draw.sx, draw.dx - origin]);
    expect(tail).toEqual([
      ['tileset', 5 * 16, 3 * 16],
      ['tileset', 4 * 16, 2 * 16],
      ['player', 0, 16],
    ]);
  });

  it('stops drawing a gate once its flag is open', () => {
    const { environment, context, game } = setup(['#SND', '....']);
    game.start();

    game.setOpenFlags(['gate_open']);
    environment.frames.frame(STEP_MS);

    expect(context.draws.filter((draw) => draw.image === 'tileset' && draw.sx === 5 * 16)).toEqual(
      [],
    );
  });

  it('starts with the flags it is given', () => {
    const environment = new FakeEnvironment();
    const canvas = document.createElement('canvas');
    const context = fakeContext();
    canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
    const game = createGame(document.createElement('div'), canvas, {
      environment,
      world: {
        map: textMap(['#SD.']),
        tileset: { name: 'tileset' } as unknown as CanvasImageSource,
        playerSprite: { name: 'player' } as unknown as CanvasImageSource,
      },
      onInteract: () => undefined,
      openFlags: ['gate_open'],
    });
    game.start();
    environment.input.press('MoveRight');

    for (let i = 0; i < 40; i++) environment.frames.frame(STEP_MS);

    const lastFrameStart = context.draws.map((draw) => draw.image).lastIndexOf('backdrop');
    const frame = context.draws.slice(lastFrameStart);
    const firstTile = frame.find((draw) => draw.image === 'tileset')!.dx;
    expect(frame.at(-1)!.dx - firstTile).toBe(3 * 16); // walked through the open gate
  });

  it('tints the whole view at night, after the player', () => {
    const environment = new FakeEnvironment();
    const canvas = document.createElement('canvas');
    const context = fakeContext();
    canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
    const game = createGame(document.createElement('div'), canvas, {
      environment,
      world: {
        map: textMap(['#S.#']),
        tileset: { name: 'tileset' } as unknown as CanvasImageSource,
        playerSprite: { name: 'player' } as unknown as CanvasImageSource,
      },
      onInteract: () => undefined,
      worldTime: { minutes: 22 * 60, gameMinutesPerSecond: 0 },
    });
    game.start();

    environment.frames.frame(STEP_MS);
    expect(context.draws.at(-1)).toMatchObject({ image: 'backdrop', style: TIME_TINT.night });

    game.setWorldTime(12 * 60); // noon: no tint
    environment.frames.frame(STEP_MS);
    expect(context.draws.at(-1)?.image).toBe('player');
  });

  it('lights a circle around the player at night while the torch is on', () => {
    const environment = new FakeEnvironment();
    const canvas = document.createElement('canvas');
    const context = fakeContext();
    canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
    // The darkness layer: an offscreen canvas made on first use.
    const layer = fakeContext('darkness');
    const layerCanvas = document.createElement('canvas');
    layerCanvas.getContext = (() => layer) as unknown as typeof canvas.getContext;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(layerCanvas);
    const game = createGame(document.createElement('div'), canvas, {
      environment,
      world: {
        map: textMap(['#S.#']),
        tileset: { name: 'tileset' } as unknown as CanvasImageSource,
        playerSprite: { name: 'player' } as unknown as CanvasImageSource,
      },
      onInteract: () => undefined,
      worldTime: { minutes: 22 * 60, gameMinutesPerSecond: 0 },
    });
    game.start();

    game.setTorch(true);
    environment.frames.frame(STEP_MS);
    createElement.mockRestore();
    const player = [...context.draws].reverse().find((draw) => draw.image === 'player')!;

    // The tint goes into the layer, the circle is cut out of it, and the layer is drawn over the view.
    expect(layer.draws.map((draw) => draw.image)).toEqual(['clear', 'backdrop', 'hole']);
    expect(layer.draws[1].style).toBe(TIME_TINT.night);
    expect(layer.draws[2].style).toMatchObject({
      kind: 'radial',
      x0: player.dx + 8,
      y0: player.dy + 8,
      r0: TORCH_INNER_RADIUS,
      r1: TORCH_OUTER_RADIUS,
      stops: [
        [0, 'rgba(0, 0, 0, 1)'],
        [1, 'rgba(0, 0, 0, 0)'],
      ],
    });
    expect(context.draws.at(-1)!.image).toBe('darkness');
    // The layer follows the canvas's size and maps logical pixels like the view.
    expect([layer.canvas.width, layer.canvas.height]).toEqual([canvas.width, canvas.height]);
    expect(layer.transform).toEqual(context.transform);

    game.setTorch(false);
    environment.frames.frame(STEP_MS);
    expect(context.draws.at(-1)!.style).toBe(TIME_TINT.night);
  });

  it('shows no light by day even with the torch on', () => {
    const { environment, context, game } = setup();
    game.start();

    game.setTorch(true);
    environment.frames.frame(STEP_MS);

    expect(context.draws.at(-1)?.image).toBe('player');
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

    expect(interactions).toEqual([{ kind: 'spot', mapId: 'test_map', spotId: 'spot' }]);
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

  it('takes presses from another input source like keys, and stops walking once released', () => {
    const { environment, context, game, interactions } = setup(['S.......', '*.......']);
    const playerX = () => context.draws.filter((draw) => draw.image === 'player').at(-1)!.dx;
    game.start();

    game.press(['MoveRight']);
    for (let i = 0; i < 40; i++) environment.frames.frame(STEP_MS);
    game.release(['MoveRight']);
    for (let i = 0; i < 40; i++) environment.frames.frame(STEP_MS);
    const stopped = playerX();
    for (let i = 0; i < 40; i++) environment.frames.frame(STEP_MS);

    expect(stopped).toBeGreaterThan(0);
    expect(playerX()).toBe(stopped);
    expect(interactions).toEqual([]);
  });

  it('routes presses from another input source to UI overlays while they have input', () => {
    const { environment, game, interactions } = setup();
    const ui: Action[] = [];
    game.onUiAction((action) => ui.push(action));
    game.start();

    game.setActionConsumer('ui');
    game.press(['Interact', 'Confirm']);
    game.release(['Interact', 'Confirm']);
    environment.frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
    expect(ui).toEqual(['Interact', 'Confirm']);
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
