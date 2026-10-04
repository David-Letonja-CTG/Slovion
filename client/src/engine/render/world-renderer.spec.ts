import { textMap } from '../world/testing';
import { World } from '../world/world';
import { animatedTile } from '../world/world-map';
import {
  CAVE_TINT,
  TIME_TINT,
  TORCH_INNER_RADIUS,
  TORCH_OUTER_RADIUS,
  WorldImages,
  renderWorld,
} from './world-renderer';

interface Call {
  readonly op: string;
  readonly image?: string;
  readonly args: readonly number[];
  readonly style?: unknown;
}

/** Records canvas calls; jsdom has no canvas implementation. */
function recordingContext(name = 'view') {
  const calls: Call[] = [];
  const context = {
    canvas: { name },
    fillStyle: '' as unknown,
    globalCompositeOperation: 'source-over',
    calls,
    clearRect: (...args: number[]) => calls.push({ op: 'clearRect', args }),
    fillRect: (...args: number[]) =>
      calls.push({
        op: context.globalCompositeOperation === 'destination-out' ? 'cut' : 'fillRect',
        args,
        style: context.fillStyle,
      }),
    createRadialGradient: (...args: number[]) => ({ args, addColorStop: () => undefined }),
    drawImage: (image: { name: string }, ...args: number[]) =>
      calls.push({ op: 'drawImage', image: image.name, args }),
    save: () => calls.push({ op: 'save', args: [] }),
    restore: () => calls.push({ op: 'restore', args: [] }),
    translate: (...args: number[]) => calls.push({ op: 'translate', args }),
    scale: (...args: number[]) => calls.push({ op: 'scale', args }),
  };
  return context;
}

const image = (name: string) => ({ name }) as unknown as CanvasImageSource;
const IMAGES: WorldImages = {
  tileset: image('tileset'),
  playerSprite: image('player'),
  npcSprites: { vera: image('vera') },
  wildlifeSprites: { lepus_europaeus: image('hare') },
  lampSprite: image('lamp'),
};

/** Renders one frame; the darkness layer, if the frame needed one, records into `layers`. */
function render(world: World, layers: ReturnType<typeof recordingContext>[] = []) {
  const context = recordingContext();
  renderWorld(context as unknown as CanvasRenderingContext2D, world, IMAGES, () => {
    const layer = recordingContext('darkness');
    layers.push(layer);
    return layer as unknown as CanvasRenderingContext2D;
  });
  return context.calls;
}

const AT_NIGHT = { minutes: 22 * 60, gameMinutesPerSecond: 0 };

const drawsOf = (calls: readonly Call[], name: string) =>
  calls.filter((call) => call.op === 'drawImage' && call.image === name);

describe('animatedTile', () => {
  const tileset = {
    firstGid: 1,
    columns: 8,
    tileCount: 24,
    image: 'tiles.png',
    animations: new Map([
      [
        5,
        [
          { tile: 5, ms: 900 },
          { tile: 20, ms: 900 },
        ],
      ],
    ]),
  };

  it('shows each frame for its duration and loops', () => {
    expect([0, 899, 900, 1799, 1800].map((ms) => animatedTile(tileset, 5, ms))).toEqual([
      5, 5, 20, 20, 5,
    ]);
  });

  it('leaves tiles without an animation alone', () => {
    expect(animatedTile(tileset, 3, 1234)).toBe(3);
  });
});

describe('renderWorld', () => {
  it('draws an NPC from its sheet, in the row of its facing', () => {
    const world = new World(textMap(['#SN#']), () => undefined);

    const [vera] = drawsOf(render(world), 'vera');

    expect(vera.args.slice(0, 2)).toEqual([0, 0]); // frame 0, row "down"
  });

  it('draws residents from their walk sprite, mirrored when they face left', () => {
    const world = new World(textMap(['#S.R.#']), () => undefined);
    world.setResidents([
      { spotId: 'hare', speciesId: 'lepus_europaeus', torch: 'calm', present: true },
    ]);

    expect(drawsOf(render(world), 'hare')).toHaveLength(1);

    world.residents[0].facingLeft = true;
    const calls = render(world);
    const mirrored = calls.findIndex((call) => call.op === 'scale');
    expect(calls[mirrored].args).toEqual([-1, 1]);
    expect(calls[mirrored + 1]).toMatchObject({ op: 'drawImage', image: 'hare' });
    expect(calls[mirrored + 2].op).toBe('restore');
  });

  it('darkens an underground area by day and draws no weather there', () => {
    const world = new World(
      textMap(['#S.#'], 'right', () => 'cave'),
      () => undefined,
    );
    world.setWeather('rain');

    const calls = render(world);

    expect(calls.some((call) => call.op === 'fillRect' && call.style === CAVE_TINT)).toBe(true);
    // Rain would be drawn with strokes this recorder does not support; rendering finished without them.
    expect(world.isUnderground).toBe(true);
  });

  it('draws the lamp after the player only while the torch is on', () => {
    const world = new World(textMap(['#S.#']), () => undefined);
    expect(drawsOf(render(world), 'lamp')).toEqual([]);

    world.setTorch(true);
    const calls = render(world);

    const player = calls.findIndex((call) => call.image === 'player');
    const lamp = calls.findIndex((call) => call.image === 'lamp');
    expect(lamp).toBeGreaterThan(player);
  });

  it('cuts a circle of light around every lamp post at night, and around the lit torch', () => {
    const world = new World(
      textMap(['L.S..L']),
      () => undefined,
      () => undefined,
      AT_NIGHT,
    );
    world.setTorch(true);
    const layers: ReturnType<typeof recordingContext>[] = [];

    const calls = render(world, layers);

    expect(layers).toHaveLength(1);
    const [layer] = layers;
    expect(layer.calls.find((call) => call.op === 'fillRect')?.style).toBe(TIME_TINT.night);
    const cuts = layer.calls.filter((call) => call.op === 'cut');
    expect(cuts).toHaveLength(3); // the torch, then the two lamps
    const centres = cuts.map((cut) => (cut.style as { args: number[] }).args);
    const [torch, ...lamps] = centres;
    expect(lamps.map((args) => args[0] - torch[0])).toEqual([-2 * 16, 3 * 16]);
    expect(torch.slice(2)).toEqual([TORCH_INNER_RADIUS, torch[0], torch[1], TORCH_OUTER_RADIUS]);
    expect(layer.globalCompositeOperation).toBe('source-over');
    expect(calls.at(-1)).toMatchObject({ op: 'drawImage', image: 'darkness' });
  });

  it('lights the lamps without the torch', () => {
    const world = new World(
      textMap(['L.S..L']),
      () => undefined,
      () => undefined,
      AT_NIGHT,
    );
    const layers: ReturnType<typeof recordingContext>[] = [];

    render(world, layers);

    expect(layers[0].calls.filter((call) => call.op === 'cut')).toHaveLength(2);
  });

  it('draws lamp posts by day without a darkness layer', () => {
    const world = new World(textMap(['L.S..L']), () => undefined);
    const layers: ReturnType<typeof recordingContext>[] = [];

    const calls = render(world, layers);

    expect(layers).toEqual([]);
    expect(drawsOf(calls, 'tileset').length).toBe(6 + 2); // six ground tiles and two lamp posts
    expect(calls.some((call) => call.op === 'fillRect' && call.style === TIME_TINT.night)).toBe(
      false,
    );
  });
});
