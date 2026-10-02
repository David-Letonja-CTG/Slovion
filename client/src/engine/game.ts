import { GameLoop } from './game-loop';
import { renderPlaceholder } from './placeholder-renderer';
import { GameEnvironment, Unsubscribe, browserEnvironment } from './platform';
import { LOGICAL_WIDTH, ViewportLayout, computeViewport } from './viewport';

export interface Game {
  /** Starts the loop and begins tracking size, pixel ratio and page visibility. */
  start(): void;
  /** Stops the loop and releases every listener. Safe to call more than once. */
  stop(): void;
}

export interface GameOptions {
  /** Platform services. Defaults to the browser. */
  environment?: GameEnvironment;
}

/**
 * Creates the game inside `container`, drawing to `canvas`. The canvas is sized and centred within
 * the container so the logical resolution is shown with crisp, integer scaling.
 */
export function createGame(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  options: GameOptions = {},
): Game {
  const environment = options.environment ?? browserEnvironment(window);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is not available.');
  }

  let availableWidth = container.clientWidth;
  let availableHeight = container.clientHeight;
  let subscriptions: Unsubscribe[] = [];

  const loop = new GameLoop(
    {
      update: () => {
        // No simulation yet; world updates arrive with the first gameplay change.
      },
      render: () => renderPlaceholder(context),
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
      ];
      applyLayout();
      loop.start();
    },

    stop() {
      loop.stop();
      subscriptions.forEach((unsubscribe) => unsubscribe());
      subscriptions = [];
    },
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
