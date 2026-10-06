import { AudioContextLike, Wave } from './audio-context-like';

/** A note to play: frequency in Hz, start and length in seconds on the audio clock, peak volume 0–1. */
export interface Tone {
  readonly wave: Wave;
  readonly frequency: number;
  readonly start: number;
  readonly duration: number;
  readonly volume: number;
  /** Optional glide to this frequency by the end of the note (birdsong, whooshes). */
  readonly glideTo?: number;
}

/** Soft attack and release keep the chiptune gentle. */
const ATTACK = 0.012;
const RELEASE = 0.06;

const pulseWaves = new WeakMap<AudioContextLike, Map<string, PeriodicWave>>();

/** A pulse wave with the given duty cycle, built once per context from its Fourier series. */
function pulseWave(context: AudioContextLike, duty: number): PeriodicWave {
  let byDuty = pulseWaves.get(context);
  if (!byDuty) {
    byDuty = new Map();
    pulseWaves.set(context, byDuty);
  }
  const key = String(duty);
  let wave = byDuty.get(key);
  if (!wave) {
    const harmonics = 32;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++)
      real[n] = (2 * Math.sin(Math.PI * n * duty)) / (Math.PI * n);
    wave = context.createPeriodicWave(real, imag);
    byDuty.set(key, wave);
  }
  return wave;
}

/** Plays one tone into `output`; the oscillator stops itself after its release. */
export function playTone(context: AudioContextLike, output: AudioNode, tone: Tone): void {
  const oscillator = context.createOscillator();
  if (tone.wave === 'pulse25' || tone.wave === 'pulse12') {
    oscillator.setPeriodicWave(pulseWave(context, tone.wave === 'pulse25' ? 0.25 : 0.125));
  } else {
    oscillator.type = tone.wave;
  }
  oscillator.frequency.setValueAtTime(tone.frequency, tone.start);
  if (tone.glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(tone.glideTo, tone.start + tone.duration);
  }

  const gain = context.createGain();
  const end = tone.start + Math.max(tone.duration, ATTACK);
  gain.gain.setValueAtTime(0, tone.start);
  gain.gain.linearRampToValueAtTime(tone.volume, tone.start + ATTACK);
  gain.gain.setValueAtTime(tone.volume, Math.max(tone.start + ATTACK, end - RELEASE));
  gain.gain.linearRampToValueAtTime(0, end);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(tone.start);
  oscillator.stop(end + 0.01);
}

const noiseBuffers = new WeakMap<AudioContextLike, AudioBuffer>();

/** Two seconds of white noise, made once per context and looped by the layers that need it. */
export function noiseBuffer(context: AudioContextLike): AudioBuffer {
  let buffer = noiseBuffers.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, Math.round(context.sampleRate * 2), context.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed linear congruential sequence: noise that is the same on every run.
    let state = 12345;
    for (let i = 0; i < data.length; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (state / 0x7fffffff) * 2 - 1;
    }
    noiseBuffers.set(context, buffer);
  }
  return buffer;
}

/** A short burst of filtered noise (rustles, clicks, whooshes) into `output`. */
export function playNoiseBurst(
  context: AudioContextLike,
  output: AudioNode,
  burst: {
    readonly start: number;
    readonly duration: number;
    readonly volume: number;
    readonly filter: BiquadFilterType;
    readonly frequency: number;
    readonly sweepTo?: number;
  },
): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = burst.filter;
  filter.frequency.setValueAtTime(burst.frequency, burst.start);
  if (burst.sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(burst.sweepTo, burst.start + burst.duration);
  }
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, burst.start);
  gain.gain.linearRampToValueAtTime(burst.volume, burst.start + burst.duration * 0.3);
  gain.gain.linearRampToValueAtTime(0, burst.start + burst.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(burst.start);
  source.stop(burst.start + burst.duration + 0.01);
}
