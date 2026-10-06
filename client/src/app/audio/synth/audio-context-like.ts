/**
 * The part of the Web Audio API the sound engine uses. The browser passes a real `AudioContext`; tests pass a
 * recording fake (`testing/fake-audio-context.ts`). Nothing in `synth/` imports Angular.
 */
export type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'destination'
  | 'sampleRate'
  | 'state'
  | 'createGain'
  | 'createOscillator'
  | 'createBiquadFilter'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createPeriodicWave'
  | 'resume'
  | 'suspend'
>;

/** Waveforms of the chiptune voices. */
export type Wave = 'square' | 'pulse25' | 'pulse12' | 'triangle' | 'sine';

/** A pseudo-random source returning numbers in [0, 1); seeded in tests. */
export type Random = () => number;

/** Mulberry32: a small seeded random source, so ambience is deterministic in tests. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
