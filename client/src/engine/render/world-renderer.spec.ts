import { textMap } from '../world/testing';
import { World } from '../world/world';
import { animatedTile } from '../world/world-map';
import { WorldImages, renderWorld } from './world-renderer';

interface Call {
  readonly op: string;
  readonly image?: string;
  readonly args: readonly number[];
}

/** Records canvas calls; jsdom has no canvas implementation. */
function recordingContext() {
  const calls: Call[] = [];
  const context = {
    fillStyle: '' as unknown,
    calls,
    fillRect: (...args: number[]) => calls.push({ op: 'fillRect', args }),
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

function render(world: World) {
  const context = recordingContext();
  renderWorld(context as unknown as CanvasRenderingContext2D, world, IMAGES);
  return context.calls;
}

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

  it('draws the lamp after the player only while the torch is on', () => {
    const world = new World(textMap(['#S.#']), () => undefined);
    expect(drawsOf(render(world), 'lamp')).toEqual([]);

    world.setTorch(true);
    const calls = render(world);

    const player = calls.findIndex((call) => call.image === 'player');
    const lamp = calls.findIndex((call) => call.image === 'lamp');
    expect(lamp).toBeGreaterThan(player);
  });
});
