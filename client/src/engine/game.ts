import { GameLoop } from './game-loop';
import { ActionConsumer, ActionDispatcher } from './input/action-dispatcher';
import { ActionState } from './input/action-state';
import { Action } from './input/actions';
import { GameEnvironment, Unsubscribe, browserEnvironment } from './platform';
import { WorldImages, renderWorld } from './render/world-renderer';
import { LOGICAL_WIDTH, ViewportLayout, computeViewport } from './viewport';
import { Interaction, World } from './world/world';
import { WorldMap } from './world/world-map';

/** Everything needed to show a map: loaded by the host, never fetched by the engine. */
export interface LoadedWorld extends WorldImages {
  readonly map: WorldMap;
}

export interface Game {
  /** Starts the loop and begins tracking size, pixel ratio, visibility and input. */
  start(): void;
  /** Stops the loop and releases every listener. Safe to call more than once. */
  stop(): void;
  /** Routes input to the world or to UI overlays (never both). */
  setActionConsumer(consumer: ActionConsumer): void;
  /** UI overlays receive actions here while they are the consumer. */
  onUiAction(listener: (action: Action) => void): Unsubscribe;
  /** Replaces the save's progress flags, which open gates (the server sets them, D3). */
  setOpenFlags(flags: readonly string[]): void;
}

export interface GameOptions {
  readonly world: LoadedWorld;
  /** Called when the player interacts with a spot; the host asks the server what happens. */
  readonly onInteract: (interaction: Interaction) => void;
  /** Called when the player opens the menu from the world. */
  readonly onOpenMenu?: () => void;
  /** The save's progress flags when the game starts. */
  readonly openFlags?: readonly string[];
  /** Platform services. Defaults to the browser. */
  readonly environment?: GameEnvironment;
}

/**
 * Creates the game inside `container`, drawing to `canvas`. The canvas is sized and centred within
 * the container so the logical resolution is shown with crisp, integer scaling.
 */
export function createGame(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  options: GameOptions,
): Game {
  const environment = options.environment ?? browserEnvironment(window);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available.');
  }

  const input = new ActionState();
  const dispatcher = new ActionDispatcher(input);
  const world = new World(options.world.map, options.onInteract, options.onOpenMenu);
  world.setOpenFlags(options.openFlags ?? []);

  let availableWidth = container.clientWidth;
  let availableHeight = container.clientHeight;
  let subscriptions: Unsubscribe[] = [];

  const loop = new GameLoop(
    {
      update: (stepMs) => world.update(input, stepMs),
      render: () => renderWorld(context, world, options.world),
    },
    environment.clock,
    environment.scheduler,
  );

  canvas.style.position = 'absolute';
  canvas.style.imageRendering = 'pixelated';

  const applyLayout = (): void => {
    const layout = computeViewport(availableWidth, availableHeight, environment.devicePixelRatio());
    resizeCanvas(canvas, context, layout);
  };

  return {
    start() {
      if (subscriptions.length > 0) return;
      subscriptions = [
        environment.observeSize(container, (width, height) => {
          availableWidth = width;
          availableHeight = height;
          applyLayout();
        }),
        environment.observeDevicePixelRatio(applyLayout),
        environment.observeVisibility((hidden) => (hidden ? loop.pause() : loop.resume())),
        environment.attachInput(dispatcher),
      ];
      applyLayout();
      loop.start();
    },

    stop() {
      loop.stop();
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions = [];
    },

    setActionConsumer: (consumer) => dispatcher.setConsumer(consumer),
    onUiAction: (listener) => dispatcher.onUiAction(listener),
    setOpenFlags: (flags) => world.setOpenFlags(flags),
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  layout: ViewportLayout,
): void {
  if (canvas.width !== layout.backingWidth) canvas.width = layout.backingWidth;
  if (canvas.height !== layout.backingHeight) canvas.height = layout.backingHeight;

  canvas.style.width = `${layout.cssWidth}px`;
  canvas.style.height = `${layout.cssHeight}px`;
  canvas.style.left = `${layout.cssLeft}px`;
  canvas.style.top = `${layout.cssTop}px`;

  // Resizing the backing store resets context state, so re-apply it every time.
  // Drawing happens in logical pixels; the transform maps them onto the backing store.
  const drawScale = layout.backingWidth / LOGICAL_WIDTH;
  context.setTransform(drawScale, 0, 0, drawScale, 0, 0);
  context.imageSmoothingEnabled = false;
}
