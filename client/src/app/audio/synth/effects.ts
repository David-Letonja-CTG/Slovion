import { AudioContextLike, Wave } from './audio-context-like';
import { frequencyOf, midiOf } from './music';
import { playNoiseBurst, playTone } from './voices';

/** The game moments that have a sound. */
export const EFFECTS = [
  'observe',
  'correct',
  'wrong',
  'research',
  'quest',
  'tool',
  'certificate',
  'travel',
  'torch',
  'search',
] as const;
export type Effect = (typeof EFFECTS)[number];

/** A short melody: [pitch, start in seconds, length in seconds]. */
type Phrase = readonly (readonly [string, number, number])[];

const PHRASES: Partial<
  Record<Effect, { readonly wave: Wave; readonly volume: number; readonly notes: Phrase }>
> = {
  observe: {
    wave: 'pulse25',
    volume: 0.07,
    notes: [
      ['G5', 0, 0.07],
      ['C6', 0.08, 0.12],
    ],
  },
  correct: {
    wave: 'pulse25',
    volume: 0.08,
    notes: [
      ['C5', 0, 0.1],
      ['E5', 0.1, 0.1],
      ['G5', 0.2, 0.1],
      ['C6', 0.3, 0.32],
    ],
  },
  wrong: {
    wave: 'triangle',
    volume: 0.12,
    notes: [
      ['E4', 0, 0.16],
      ['C4', 0.18, 0.3],
    ],
  },
  research: {
    wave: 'sine',
    volume: 0.07,
    notes: [
      ['C6', 0, 0.07],
      ['E6', 0.07, 0.07],
      ['G6', 0.14, 0.07],
      ['C7', 0.21, 0.2],
    ],
  },
  quest: {
    wave: 'pulse25',
    volume: 0.08,
    notes: [
      ['G4', 0, 0.12],
      ['C5', 0.13, 0.12],
      ['E5', 0.26, 0.12],
      ['G5', 0.39, 0.12],
      ['C6', 0.55, 0.45],
    ],
  },
  tool: {
    wave: 'pulse12',
    volume: 0.08,
    notes: [
      ['E5', 0, 0.1],
      ['G5', 0.11, 0.1],
      ['B5', 0.22, 0.25],
    ],
  },
  certificate: {
    wave: 'pulse25',
    volume: 0.08,
    notes: [
      ['C5', 0, 0.16],
      ['G5', 0.17, 0.16],
      ['C6', 0.34, 0.16],
      ['E6', 0.51, 0.5],
    ],
  },
};

/** Plays an effect into `output`, starting now. */
export function playEffect(context: AudioContextLike, output: AudioNode, effect: Effect): void {
  const now = context.currentTime + 0.01;
  const phrase = PHRASES[effect];
  if (phrase) {
    for (const [pitch, at, length] of phrase.notes) {
      playTone(context, output, {
        wave: phrase.wave,
        frequency: frequencyOf(midiOf(pitch)),
        start: now + at,
        duration: length,
        volume: phrase.volume,
      });
    }
    // The bigger moments get a soft bass under the melody.
    if (effect === 'quest' || effect === 'certificate' || effect === 'correct') {
      playTone(context, output, {
        wave: 'triangle',
        frequency: frequencyOf(midiOf('C3')),
        start: now,
        duration: 0.6,
        volume: 0.1,
      });
    }
    return;
  }
  if (effect === 'travel') {
    playNoiseBurst(context, output, {
      start: now,
      duration: 0.7,
      volume: 0.12,
      filter: 'bandpass',
      frequency: 300,
      sweepTo: 2200,
    });
  } else if (effect === 'torch') {
    playNoiseBurst(context, output, {
      start: now,
      duration: 0.03,
      volume: 0.15,
      filter: 'highpass',
      frequency: 3000,
    });
  } else if (effect === 'search') {
    for (const at of [0, 0.09, 0.2]) {
      playNoiseBurst(context, output, {
        start: now + at,
        duration: 0.08,
        volume: 0.07,
        filter: 'bandpass',
        frequency: 3200,
      });
    }
  }
}
