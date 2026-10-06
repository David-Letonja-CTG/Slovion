import { AudioContextLike, Random, seededRandom } from './audio-context-like';
import { Timers, browserTimers } from './music';
import { noiseBuffer, playTone } from './voices';

/**
 * The ambience layers a soundscape can use. Every one is synthesized: filtered noise for air and water, and short
 * generic calls for birds and insects that never imitate or name a real species (D6).
 */
export const LAYER_KINDS = [
  'breeze',
  'wind',
  'stream',
  'lake',
  'waves',
  'rain',
  'birds',
  'birds-sparse',
  'gulls-generic',
  'crickets',
  'drips',
  'cave-air',
] as const;
export type LayerKind = (typeof LAYER_KINDS)[number];

/** Noise layers: filter, level and a slow swell (a low-frequency oscillator on the level). */
const NOISE_LAYERS: Partial<
  Record<
    LayerKind,
    {
      readonly filter: BiquadFilterType;
      readonly frequency: number;
      readonly q: number;
      readonly level: number;
      readonly swellHz: number;
      readonly swell: number;
    }
  >
> = {
  breeze: { filter: 'bandpass', frequency: 450, q: 0.6, level: 0.035, swellHz: 0.09, swell: 0.02 },
  wind: { filter: 'bandpass', frequency: 300, q: 0.7, level: 0.06, swellHz: 0.07, swell: 0.04 },
  stream: { filter: 'bandpass', frequency: 1400, q: 0.5, level: 0.03, swellHz: 2.3, swell: 0.008 },
  lake: { filter: 'lowpass', frequency: 520, q: 0.7, level: 0.035, swellHz: 0.18, swell: 0.015 },
  waves: { filter: 'lowpass', frequency: 750, q: 0.6, level: 0.05, swellHz: 0.11, swell: 0.045 },
  rain: { filter: 'highpass', frequency: 2600, q: 0.5, level: 0.03, swellHz: 0.3, swell: 0.005 },
  'cave-air': {
    filter: 'lowpass',
    frequency: 130,
    q: 0.8,
    level: 0.07,
    swellHz: 0.05,
    swell: 0.02,
  },
};

/** Timed layers: how often (seconds, a random range) they make a sound, and the sound. */
const TIMED_LAYERS: Partial<
  Record<
    LayerKind,
    {
      readonly every: readonly [number, number];
      readonly play: (
        context: AudioContextLike,
        output: AudioNode,
        at: number,
        random: Random,
      ) => void;
    }
  >
> = {
  birds: { every: [1.2, 4.5], play: chirps },
  'birds-sparse': { every: [5, 12], play: chirps },
  'gulls-generic': { every: [9, 22], play: gull },
  crickets: { every: [0.5, 1.4], play: trill },
  drips: { every: [1.8, 6.5], play: drip },
};

/** A short phrase of rising and falling chirps: a generic bird, not any species. */
function chirps(context: AudioContextLike, output: AudioNode, at: number, random: Random): void {
  const count = 2 + Math.floor(random() * 4);
  const base = 2400 + random() * 1600;
  for (let n = 0; n < count; n++) {
    const start = at + n * (0.09 + random() * 0.07);
    const up = random() < 0.6;
    playTone(context, output, {
      wave: 'sine',
      frequency: up ? base : base * 1.4,
      glideTo: up ? base * (1.25 + random() * 0.3) : base * 0.9,
      start,
      duration: 0.05 + random() * 0.05,
      volume: 0.025,
    });
  }
}

/** A falling call over the water, two or three times. */
function gull(context: AudioContextLike, output: AudioNode, at: number, random: Random): void {
  const count = 2 + Math.floor(random() * 2);
  for (let n = 0; n < count; n++) {
    playTone(context, output, {
      wave: 'triangle',
      frequency: 950 + random() * 150,
      glideTo: 620,
      start: at + n * 0.38,
      duration: 0.28,
      volume: 0.03,
    });
  }
}

/** A cricket's trill: a few very short high pulses. */
function trill(context: AudioContextLike, output: AudioNode, at: number, random: Random): void {
  const pulses = 3 + Math.floor(random() * 4);
  const frequency = 4200 + random() * 500;
  for (let n = 0; n < pulses; n++) {
    playTone(context, output, {
      wave: 'sine',
      frequency,
      start: at + n * 0.045,
      duration: 0.022,
      volume: 0.012,
    });
  }
}

/** A water drop in a cave, with a faint echo. */
function drip(context: AudioContextLike, output: AudioNode, at: number, random: Random): void {
  const frequency = 1100 + random() * 1100;
  playTone(context, output, {
    wave: 'sine',
    frequency,
    glideTo: frequency * 1.6,
    start: at,
    duration: 0.07,
    volume: 0.05,
  });
  playTone(context, output, {
    wave: 'sine',
    frequency,
    glideTo: frequency * 1.6,
    start: at + 0.28,
    duration: 0.07,
    volume: 0.015,
  });
}

/** Layers fade in and out over this time. */
const FADE_SECONDS = 1.5;

interface ActiveLayer {
  readonly gain: GainNode;
  readonly stop: () => void;
}

/** Plays a set of ambience layers into `output`; changing the set fades layers in and out. */
export class AmbiencePlayer {
  private readonly layers = new Map<LayerKind, ActiveLayer>();
  private readonly random: Random;

  constructor(
    private readonly context: AudioContextLike,
    private readonly output: AudioNode,
    private readonly timers: Timers = browserTimers,
    seed = 2026,
  ) {
    this.random = seededRandom(seed);
  }

  /** The layers now playing, in a stable order. */
  get active(): readonly LayerKind[] {
    return LAYER_KINDS.filter((kind) => this.layers.has(kind));
  }

  set(kinds: readonly LayerKind[]): void {
    const wanted = new Set(kinds);
    const now = this.context.currentTime;
    for (const [kind, layer] of this.layers) {
      if (wanted.has(kind)) continue;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
      layer.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      this.timers.setTimeout(() => layer.stop(), FADE_SECONDS * 1000 + 100);
      this.layers.delete(kind);
    }
    for (const kind of wanted) {
      if (this.layers.has(kind)) continue;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
      gain.connect(this.output);
      this.layers.set(kind, { gain, stop: this.start(kind, gain) });
    }
  }

  stop(): void {
    this.set([]);
  }

  /** Starts one layer into `gain`; returns how to stop it. */
  private start(kind: LayerKind, gain: GainNode): () => void {
    const noise = NOISE_LAYERS[kind];
    if (noise) {
      const source = this.context.createBufferSource();
      source.buffer = noiseBuffer(this.context);
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = noise.filter;
      filter.frequency.value = noise.frequency;
      filter.Q.value = noise.q;
      const level = this.context.createGain();
      level.gain.value = noise.level;
      const swell = this.context.createOscillator();
      swell.type = 'sine';
      swell.frequency.value = noise.swellHz;
      const swellDepth = this.context.createGain();
      swellDepth.gain.value = noise.swell;
      swell.connect(swellDepth);
      swellDepth.connect(level.gain);
      source.connect(filter);
      filter.connect(level);
      level.connect(gain);
      // Start at a random point of the buffer, so two noise layers never line up.
      source.start(this.context.currentTime, this.random() * 1.9);
      swell.start(this.context.currentTime);
      return () => {
        source.stop();
        swell.stop();
        gain.disconnect();
      };
    }

    const timed = TIMED_LAYERS[kind]!;
    let handle: number | undefined;
    const next = () => {
      const [min, max] = timed.every;
      handle = this.timers.setTimeout(
        () => {
          timed.play(this.context, gain, this.context.currentTime + 0.05, this.random);
          next();
        },
        (min + this.random() * (max - min)) * 1000,
      );
    };
    next();
    return () => {
      if (handle !== undefined) this.timers.clearTimeout(handle);
      gain.disconnect();
    };
  }
}
