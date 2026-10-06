import {
  FakeAudioContext,
  FakeBufferSource,
  FakeGain,
  FakeOscillator,
} from '../testing/fake-audio-context';
import { AmbiencePlayer } from './ambience';
import { EFFECTS, playEffect } from './effects';
import { DUCKED, Mixer } from './mixer';
import { Timers } from './music';
import { Scene, Soundscapes, soundFor } from './soundscape';

const SOUNDSCAPES: Soundscapes = {
  meadow_map: { music: 'meadow', day: ['breeze', 'birds'], night: ['breeze', 'crickets'] },
};
const scene = (changes: Partial<Scene> = {}): Scene => ({
  mapId: 'meadow_map',
  timeOfDay: 'day',
  weather: 'clear',
  underground: false,
  ...changes,
});

describe('soundFor', () => {
  it('plays the theme and day layers by day, and the night arrangement and night layers at night', () => {
    expect(soundFor(scene(), SOUNDSCAPES)).toEqual({
      music: 'meadow',
      night: false,
      layers: ['breeze', 'birds'],
      natureLevel: 1,
    });
    expect(soundFor(scene({ timeOfDay: 'evening' }), SOUNDSCAPES).night).toBe(false);
    expect(soundFor(scene({ timeOfDay: 'night' }), SOUNDSCAPES)).toMatchObject({
      night: true,
      layers: ['breeze', 'crickets'],
    });
  });

  it('adds rain and thins out the birds in rain; silences birds and crickets in snow; softens fog', () => {
    expect(soundFor(scene({ weather: 'rain' }), SOUNDSCAPES).layers).toEqual([
      'breeze',
      'rain',
      'birds-sparse',
    ]);
    expect(soundFor(scene({ weather: 'snow' }), SOUNDSCAPES).layers).toEqual(['breeze']);
    expect(soundFor(scene({ weather: 'snow', timeOfDay: 'night' }), SOUNDSCAPES).layers).toEqual([
      'breeze',
    ]);
    expect(soundFor(scene({ weather: 'fog' }), SOUNDSCAPES).natureLevel).toBe(0.8);
  });

  it('plays the cave underground, whatever the time and weather', () => {
    expect(
      soundFor(scene({ underground: true, weather: 'rain', timeOfDay: 'night' }), SOUNDSCAPES),
    ).toEqual({
      music: 'cave',
      night: false,
      layers: ['drips', 'cave-air'],
      natureLevel: 1,
    });
  });
});

describe('AmbiencePlayer', () => {
  function setup() {
    const context = new FakeAudioContext();
    const timeouts: { callback: () => void; ms: number }[] = [];
    const timers: Timers = {
      setInterval: () => 0,
      clearInterval: () => undefined,
      setTimeout: (callback, ms) => timeouts.push({ callback, ms }),
      clearTimeout: () => undefined,
    };
    const player = new AmbiencePlayer(
      context.asContext(),
      context.createGain() as unknown as AudioNode,
      timers,
      7,
    );
    return { context, player, timeouts };
  }

  it('loops filtered noise for air and water and schedules birdsong at random intervals', () => {
    const { context, player, timeouts } = setup();

    player.set(['breeze', 'birds']);

    expect(player.active).toEqual(['breeze', 'birds']);
    const noise = context.nodes.filter(
      (node): node is FakeBufferSource => node instanceof FakeBufferSource,
    );
    expect(noise).toHaveLength(1);
    expect(noise[0].loop).toBe(true);
    expect(timeouts).toHaveLength(1);
    expect(timeouts[0].ms).toBeGreaterThanOrEqual(1200);
    expect(timeouts[0].ms).toBeLessThanOrEqual(4500);

    timeouts[0].callback(); // a phrase of chirps, then the next one is scheduled
    const chirps = context.tones.filter(
      (tone) =>
        tone.type === 'sine' && tone.frequency.calls.some((c) => c.method === 'exponential'),
    );
    expect(chirps.length).toBeGreaterThanOrEqual(2);
    expect(timeouts).toHaveLength(2);
  });

  it('fades out layers that are no longer wanted', () => {
    const { context, player, timeouts } = setup();
    player.set(['breeze']);
    const layerGain = context.nodes.filter((node) => node instanceof FakeGain)[1] as FakeGain;

    context.currentTime = 10;
    player.set(['crickets']);

    expect(player.active).toEqual(['crickets']);
    expect(layerGain.gain.calls.at(-1)).toMatchObject({ method: 'linear', value: 0 });
    timeouts.find((timeout) => timeout.ms === 1600)!.callback(); // the fade is over: the layer stops
    expect(layerGain.disconnected).toBe(true);
  });
});

describe('effects', () => {
  it('plays every effect, and right and wrong answers sound different', () => {
    for (const effect of EFFECTS) {
      const context = new FakeAudioContext();
      playEffect(context.asContext(), context.createGain() as unknown as AudioNode, effect);
      expect(context.nodes.length, effect).toBeGreaterThan(1);
    }
    const notesOf = (effect: 'correct' | 'wrong') => {
      const context = new FakeAudioContext();
      playEffect(context.asContext(), context.createGain() as unknown as AudioNode, effect);
      return context.tones.map((tone: FakeOscillator) => Math.round(tone.frequency.calls[0].value));
    };
    expect(notesOf('correct')).not.toEqual(notesOf('wrong'));
    const correct = notesOf('correct');
    expect(correct[3]).toBeGreaterThan(correct[0]); // rising
    const wrong = notesOf('wrong');
    expect(wrong[1]).toBeLessThan(wrong[0]); // falling
  });
});

describe('Mixer', () => {
  it('sets each bus, mutes the master and ducks the music', () => {
    const context = new FakeAudioContext();
    const mixer = new Mixer(context.asContext());
    const [master, music, sounds, nature] = context.nodes as FakeGain[];

    mixer.setVolumes({ music: 0.5, sounds: 0.7, nature: 0.6, muted: false });
    expect([master.gain.value, music.gain.value, sounds.gain.value, nature.gain.value]).toEqual([
      1, 0.5, 0.7, 0.6,
    ]);

    mixer.duck(true);
    expect(music.gain.value).toBeCloseTo(0.5 * DUCKED);
    mixer.setVolumes({ music: 0.5, sounds: 0.7, nature: 0.6, muted: true });
    expect(master.gain.value).toBe(0);
  });
});
