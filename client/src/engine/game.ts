import { Weather } from './render/weather';
import { GameLoop } from './game-loop';
import { ActionConsumer, ActionDispatcher } from './input/action-dispatcher';
import { ActionState } from './input/action-state';
import { Action } from './input/actions';
import { GameEnvironment, Unsubscribe, browserEnvironment } from './platform';
import { WorldImages, renderWorld } from './render/world-renderer';
import { ViewSize, ViewportLayout, WIDE_VIEW, chooseView, computeViewport } from './viewport';
import { ResidentInfo } from './world/resident';
import { Interaction, World, WorldClock } from './world/world';
import { WorldTime } from './world/world-time';
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
  /**
   * Presses actions from an input source outside the engine, e.g. on-screen touch controls; they are routed like key
   * presses (to the world or the UI) and stay held until released.
   */
  press(actions: readonly Action[]): void;
  /** Releases actions pressed with `press`. */
  release(actions: readonly Action[]): void;
  /** Replaces the save's progress flags, which open gates (the server sets them, D3). */
  setOpenFlags(flags: readonly string[]): void;
  /** Re-syncs the in-game clock with the server (D8). */
  setWorldTime(minutes: number): void;
  /** Switches the player's torch; changes are reported through `onTorchChange`. */
  setTorch(on: boolean): void;
  /** Replaces the map's resident animals as the server lists them (D3, D8). */
  setResidents(residents: readonly ResidentInfo[]): void;
  /** Sets the current region's weather as the server reported it (D11). */
  setWeather(weather: Weather): void;
  /** Replaces the save's field tools as the server reported them (D3). */
  setTools(tools: readonly string[]): void;
  /**
   * Replaces the world view sizes the game may use, e.g. when a phone is turned; it shows the one that fits the
   * container largest, and the canvas is laid out again at once.
   */
  setViews(views: readonly ViewSize[]): void;
}

export interface GameOptions {
  readonly world: LoadedWorld;
  /** Called when the player interacts with a spot; the host asks the server what happens. */
  readonly onInteract: (interaction: Interaction) => void;
  /** Called when the player opens the menu from the world. */
  readonly onOpenMenu?: () => void;
  /** Called when the player opens the bag from the world (the Inventory action). */
  readonly onOpenInventory?: () => void;
  /** The save's field tools when the game starts. */
  readonly tools?: readonly string[];
  /** The save's progress flags when the game starts. */
  readonly openFlags?: readonly string[];
  /** The map's resident animals when the game starts. */
  readonly residents?: readonly ResidentInfo[];
  /** The save's in-game clock as the server reported it; without it the world stands still at noon. */
  readonly worldTime?: WorldClock;
  /** Called once per in-game minute (and after a re-sync) with the current in-game time. */
  readonly onTimeChange?: (time: WorldTime) => void;
  /** Called when the player's tile lies in another area, including at the start. */
  readonly onAreaChange?: (areaId: string) => void;
  /** Called when the torch is switched on or off. */
  readonly onTorchChange?: (on: boolean) => void;
  /** The current region's weather when the game starts; clear by default. */
  readonly weather?: Weather;
  /** Draws weather without movement, for players who prefer reduced motion. */
  readonly reducedMotion?: boolean;
  /** The world view sizes the game may use, at the start; it shows the one that fits largest. 320×180 by default. */
  readonly views?: readonly ViewSize[];
  /** Platform services. Defaults to the browser. */
  readonly environment?: GameEnvironment;
}

/**
 * Creates the game inside `container`, drawing to `canvas`. The canvas is sized and centred within
 * the container so the world view fills it as far as its shape allows, drawn crisply at an integer scale.
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

  // The darkness layer is made the first time a light is cut out of the tint, and follows the canvas's size.
  let darkness: CanvasRenderingContext2D | null = null;
  const darknessLayer = (): CanvasRenderingContext2D => {
    darkness ??= canvas.ownerDocument.createElement('canvas').getContext('2d');
    if (!darkness) throw new Error('Canvas 2D context is not available.');
    const layer = darkness.canvas;
    if (layer.width !== canvas.width) layer.width = canvas.width;
    if (layer.height !== canvas.height) layer.height = canvas.height;
    const drawScale = canvas.width / view.width;
    darkness.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    return darkness;
  };

  const input = new ActionState();
  const dispatcher = new ActionDispatcher(input);
  const world = new World(
    options.world.map,
    options.onInteract,
    options.onOpenMenu,
    options.worldTime,
    {
      onTimeChange: options.onTimeChange,
      onAreaChange: options.onAreaChange,
      onTorchChange: options.onTorchChange,
      onOpenInventory: options.onOpenInventory,
    },
  );
  world.setOpenFlags(options.openFlags ?? []);
  world.setResidents(options.residents ?? []);
  world.setWeather(options.weather ?? 'clear');
  world.setTools(options.tools ?? []);
  world.reducedMotion = options.reducedMotion ?? false;

  let views = options.views ?? [WIDE_VIEW];
  let view = views[0];
  let availableWidth = container.clientWidth;
  let availableHeight = container.clientHeight;
  let subscriptions: Unsubscribe[] = [];

  const loop = new GameLoop(
    {
      update: (stepMs) => world.update(input, stepMs),
      render: () => renderWorld(context, world, options.world, darknessLayer, view),
    },
    environment.clock,
    environment.scheduler,
  );

  canvas.style.position = 'absolute';

  const applyLayout = (): void => {
    const ratio = environment.devicePixelRatio();
    view = chooseView(views, availableWidth, availableHeight);
    const layout = computeViewport(availableWidth, availableHeight, ratio, view);
    resizeCanvas(canvas, context, layout, view);
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
    press: (actions) => dispatcher.pressAll(actions),
    release: (actions) => actions.forEach((action) => dispatcher.release(action)),
    setOpenFlags: (flags) => world.setOpenFlags(flags),
    setWorldTime: (minutes) => world.setWorldTime(minutes),
    setTorch: (on) => world.setTorch(on),
    setResidents: (residents) => world.setResidents(residents),
    setWeather: (weather) => world.setWeather(weather),
    setTools: (tools) => world.setTools(tools),
    setViews(next) {
      views = next.length > 0 ? next : [WIDE_VIEW];
      applyLayout();
    },
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  layout: ViewportLayout,
  view: ViewSize,
): void {
  if (canvas.width !== layout.backingWidth) canvas.width = layout.backingWidth;
  if (canvas.height !== layout.backingHeight) canvas.height = layout.backingHeight;

  canvas.style.width = `${layout.cssWidth}px`;
  canvas.style.height = `${layout.cssHeight}px`;
  canvas.style.left = `${layout.cssLeft}px`;
  canvas.style.top = `${layout.cssTop}px`;
  // Game pixels stay square at an integer scale; between two scales, smoothing only blends their edges.
  canvas.style.imageRendering = layout.smooth ? 'auto' : 'pixelated';

  // Resizing the backing store resets context state, so re-apply it every time.
  // Drawing happens in logical pixels; the transform maps them onto the backing store.
  const drawScale = layout.backingWidth / view.width;
  context.setTransform(drawScale, 0, 0, drawScale, 0, 0);
  context.imageSmoothingEnabled = false;
}
