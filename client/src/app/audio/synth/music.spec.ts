import { FakeAudioContext, FakeGain } from '../testing/fake-audio-context';
import {
  CROSSFADE_SECONDS,
  MusicPlayer,
  Timers,
  frequencyOf,
  midiOf,
  nightArrangement,
  parseTrack,
} from './music';

/** Timers that only run when the test says so. */
function manualTimers() {
  const intervals = new Map<number, () => void>();
  let next = 1;
  const timers: Timers = {
    setInterval: (callback) => {
      intervals.set(next, callback);
      return next++;
    },
    clearInterval: (handle) => void intervals.delete(handle),
    setTimeout: () => next++,
    clearTimeout: () => undefined,
  };
  return {
    timers,
    tick: () => [...intervals.values()].forEach((callback) => callback()),
    intervals,
  };
}

const TWO_BARS = {
  id: 'test',
  tempo: 120, // an eighth is 0.25 s
  channels: [
    { wave: 'pulse25' as const, volume: 0.3, notes: 'C5:2 -:2 E5:4 G5:8' },
    { wave: 'triangle' as const, volume: 0.4, notes: 'C3:4 G2:4 C3:4 G2:4' },
  ],
};

describe('notes', () => {
  it('turns pitches into MIDI numbers and frequencies', () => {
    expect([midiOf('C4'), midiOf('A4'), midiOf('F#3'), midiOf('Bb5')]).toEqual([60, 69, 54, 82]);
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBeCloseTo(880);
  });

  it('parses channels into timed notes and rests', () => {
    const track = parseTrack(TWO_BARS);

    expect(track.length).toBe(16);
    expect(track.channels[0].events).toEqual([
      { at: 0, length: 2, midi: 72 },
      { at: 2, length: 2, midi: null },
      { at: 4, length: 4, midi: 76 },
      { at: 8, length: 8, midi: 79 },
    ]);
  });

  it('rejects unknown pitches, bad lengths and channels of different lengths', () => {
    const broken = (notes: string) =>
      parseTrack({ id: 'bad', tempo: 100, channels: [{ wave: 'square', volume: 1, notes }] });

    expect(() => broken('H4:2')).toThrow("bad: channel 1: unknown pitch in 'H4:2'");
    expect(() => broken('C4:0')).toThrow("bad: channel 1: bad length in 'C4:0'");
    expect(() =>
      parseTrack({
        ...TWO_BARS,
        channels: [TWO_BARS.channels[0], { wave: 'square', volume: 1, notes: 'C3:4' }],
      }),
    ).toThrow('test: channel 2 lasts 4 eighths, channel 1 lasts 16');
  });

  it('derives a slower, softer night arrangement', () => {
    const night = nightArrangement(parseTrack(TWO_BARS));

    expect([night.id, night.tempo]).toEqual(['test:night', 90]);
    expect(night.channels[0].wave).toBe('triangle');
    expect(night.channels[0].events.map((event) => event.midi)).toEqual([60, null, 64, 67]);
    expect(night.channels[1].events.map((event) => event.midi)).toEqual([48, null, 48, null]);
    expect(night.channels[0].volume).toBeCloseTo(0.21);
  });
});

describe('MusicPlayer', () => {
  it('schedules the notes ahead on the audio clock and loops', () => {
    const context = new FakeAudioContext();
    const { timers, tick } = manualTimers();
    const player = new MusicPlayer(
      context.asContext(),
      context.createGain() as unknown as AudioNode,
      timers,
    );

    player.play(parseTrack(TWO_BARS));
    for (let t = 0; t <= 4.2; t += 0.025) {
      context.currentTime = t;
      tick();
    }

    // Loop of 16 eighths = 4 s; notes start 0.05 s after play().
    const melody = context.tones
      .filter((tone) => tone.type === 'custom')
      .map((tone) => tone.startedAt!);
    expect(melody.slice(0, 4)).toEqual([0.05, 1.05, 2.05, 4.05]);
    const bass = context.tones.filter((tone) => tone.type === 'triangle');
    expect(bass[0].frequency.calls[0].value).toBeCloseTo(frequencyOf(48));
  });

  it('crossfades to a new theme and stops scheduling the old one after the fade', () => {
    const context = new FakeAudioContext();
    const { timers, tick, intervals } = manualTimers();
    const output = context.createGain() as unknown as AudioNode;
    const player = new MusicPlayer(context.asContext(), output, timers);

    player.play(parseTrack(TWO_BARS));
    const first = context.nodes.filter((node) => node instanceof FakeGain)[1] as FakeGain;
    context.currentTime = 1;
    player.play(parseTrack({ ...TWO_BARS, id: 'other' }));

    expect(player.current).toBe('other');
    expect(first.gain.calls.at(-1)).toEqual({
      method: 'linear',
      value: 0,
      time: 1 + CROSSFADE_SECONDS,
    });
    context.currentTime = 1 + CROSSFADE_SECONDS + 0.1;
    tick();
    expect(first.disconnected).toBe(true);

    player.stop();
    context.currentTime += CROSSFADE_SECONDS + 0.1;
    tick();
    expect(intervals.size).toBe(0);
  });

  it('ignores playing the same theme again', () => {
    const context = new FakeAudioContext();
    const player = new MusicPlayer(
      context.asContext(),
      context.createGain() as unknown as AudioNode,
      manualTimers().timers,
    );
    const track = parseTrack(TWO_BARS);

    player.play(track);
    const gains = context.nodes.length;
    player.play(track);

    expect(context.nodes.length).toBe(gains);
  });
});
