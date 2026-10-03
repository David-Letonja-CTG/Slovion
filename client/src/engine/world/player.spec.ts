import { GameLoop, STEP_MS } from '../game-loop';
import { ActionState } from '../input/action-state';
import { FakeFrames } from '../testing/fake-environment';
import { textMap } from './testing';
import { Interaction, World } from './world';

const OPEN = [
  '###########################',
  '#S........................#',
  '###########################',
];

function setup(rows: readonly string[] = OPEN) {
  const input = new ActionState();
  const interactions: Interaction[] = [];
  const world = new World(textMap(rows), (interaction) => interactions.push(interaction));
  const frames = new FakeFrames();
  const loop = new GameLoop(
    { update: (ms) => world.update(input, ms), render: () => undefined },
    frames,
    frames,
  );
  loop.start();
  return { input, world, frames, interactions, player: world.player };
}

describe('Player movement', () => {
  it.each([30, 144])('walks exactly 4 tiles in one second at %i fps', (fps) => {
    const { input, frames, player } = setup();
    input.press('MoveRight');

    frames.frames(fps, 1000);

    expect(player.position).toEqual({ x: 5, y: 1 });
  });

  it.each([30, 144])('runs exactly 8 tiles in one second at %i fps', (fps) => {
    const { input, frames, player } = setup();
    input.press('Run');
    input.press('MoveRight');

    frames.frames(fps, 1000);

    expect(player.position).toEqual({ x: 9, y: 1 });
  });

  it('makes exactly one step for a single-frame tap', () => {
    const { input, frames, player } = setup();

    input.press('MoveRight');
    frames.frame(STEP_MS);
    input.release('MoveRight');
    frames.frames(60, 1000);

    expect(player.position).toEqual({ x: 2, y: 1 });
    expect(player.isStepping).toBe(false);
  });

  it('makes one step even if pressed and released between two simulation steps', () => {
    const { input, frames, player } = setup();

    input.press('MoveRight');
    input.release('MoveRight');
    frames.frames(60, 1000);

    expect(player.position).toEqual({ x: 2, y: 1 });
  });

  it('completes a started step after the key is released', () => {
    const { input, frames, player } = setup();
    input.press('MoveRight');
    frames.frames(3, 3 * STEP_MS);

    input.release('MoveRight');
    frames.frames(30, 500);

    expect(player.position).toEqual({ x: 2, y: 1 });
  });

  it('cannot walk through an NPC', () => {
    const { input, frames, player } = setup(['#SN.#']);
    input.press('MoveRight');

    frames.frames(60, 1000);

    expect(player.position).toEqual({ x: 1, y: 0 });
    expect(player.facing).toBe('right');
  });

  it('cannot pass a closed gate until its flag opens it', () => {
    const { input, frames, player, world } = setup(['#SD.#']);
    input.press('MoveRight');
    frames.frames(60, 500);
    expect(player.position).toEqual({ x: 1, y: 0 });

    world.setOpenFlags(['gate_open']);
    frames.frames(60, 1000);

    expect(player.position).toEqual({ x: 3, y: 0 });
    expect(world.closedGates).toEqual([]);
  });

  it('ignores flags that open no gate', () => {
    const { world } = setup(['#SD.#']);

    world.setOpenFlags(['something_else']);

    expect(world.isBlocked(2, 0)).toBe(true);
    expect(world.closedGates).toHaveLength(1);
  });

  it('only turns when pressing towards a blocked tile', () => {
    const { input, frames, player } = setup();

    input.press('MoveUp');
    frames.frames(30, 500);

    expect(player.position).toEqual({ x: 1, y: 1 });
    expect(player.facing).toBe('up');
  });

  it('does not leave the map at its edge', () => {
    const { input, frames, player } = setup(['S..', '...']);

    input.press('MoveLeft');
    frames.frames(60, 1000);

    expect(player.position).toEqual({ x: 0, y: 0 });
    expect(player.facing).toBe('left');
  });

  it('takes the most recent direction for the next step', () => {
    const { input, frames, player } = setup(['S...', '....', '....']);
    input.press('MoveRight');
    frames.frames(7, 7 * STEP_MS); // halfway through the first step right

    input.press('MoveDown'); // right is still held, down is newer
    frames.frames(23, 23 * STEP_MS); // finish the step right, then one step down

    expect(player.position).toEqual({ x: 1, y: 1 });
  });

  it('alternates walk frames while moving', () => {
    const { input, frames, player } = setup();
    input.press('MoveRight');
    const seen = new Set<number>();

    for (let i = 0; i < 30; i++) {
      frames.frame(STEP_MS);
      seen.add(player.walkFrame);
    }

    expect([...seen].sort()).toEqual([0, 1]);
  });
});

describe('Interaction', () => {
  it('interacts with the spot on the faced tile', () => {
    const { input, frames, interactions } = setup(['#S*#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'spot', mapId: 'test_map', spotId: 'spot' }]);
  });

  it('does nothing when facing a tile without a spot', () => {
    const { input, frames, interactions } = setup(['#S.*']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
  });

  it('ignores Interact while mid-step', () => {
    const { input, frames, interactions } = setup(['S..*']);
    input.press('MoveRight');
    frames.frame(STEP_MS);
    input.release('MoveRight');

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
  });

  it('searches when standing in tall grass and facing no spot', () => {
    const { input, frames, interactions } = setup(['#G..#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'search', mapId: 'test_map', x: 1, y: 0 }]);
  });

  it('talks to the NPC on the faced tile', () => {
    const { input, frames, interactions } = setup(['#SN#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'npc', mapId: 'test_map', npcId: 'vera' }]);
  });

  it('opens the travel map at the faced signpost, which blocks its tile', () => {
    const { input, frames, interactions, world } = setup(['#GP#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'signpost', mapId: 'test_map' }]);
    expect(world.isBlocked(2, 0)).toBe(true);
  });

  it('prefers a faced NPC over searching the grass underfoot', () => {
    const { input, frames, interactions } = setup(['#GN#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'npc', mapId: 'test_map', npcId: 'vera' }]);
  });

  it('prefers a faced spot over searching the grass underfoot', () => {
    const { input, frames, interactions } = setup(['#G*#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'spot', mapId: 'test_map', spotId: 'spot' }]);
  });

  it('searches at a faced tree inside a habitat zone, from outside the zone', () => {
    const { input, frames, interactions } = setup(['#ST#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'search', mapId: 'test_map', x: 2, y: 0 }]);
  });

  it('searches at the faced tree before the grass underfoot', () => {
    const { input, frames, interactions } = setup(['#GT#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([{ kind: 'search', mapId: 'test_map', x: 2, y: 0 }]);
  });

  it('does not search at a blocked tile outside every habitat zone', () => {
    const { input, frames, interactions } = setup(['#S##']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
  });

  it('does not search when only the faced tile is grass', () => {
    const { input, frames, interactions } = setup(['#Sg.#']);

    input.press('Interact');
    frames.frame(STEP_MS);

    expect(interactions).toEqual([]);
  });

  it('reports OpenMenu to the host', () => {
    const input = new ActionState();
    const opened = vi.fn();
    const world = new World(textMap(['S.']), () => undefined, opened);

    input.press('OpenMenu');
    world.update(input, STEP_MS);
    world.update(input, STEP_MS);

    expect(opened).toHaveBeenCalledOnce();
  });

  it('interacts once per press', () => {
    const { input, frames, interactions } = setup(['#S*#']);

    input.press('Interact');
    frames.frames(10, 10 * STEP_MS);

    expect(interactions).toHaveLength(1);
  });
});
