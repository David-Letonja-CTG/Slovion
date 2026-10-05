import { AudioContextLike } from './audio-context-like';

/** Volumes 0–1 per bus, and the mute switch. */
export interface Volumes {
  readonly music: number;
  readonly sounds: number;
  readonly nature: number;
  readonly muted: boolean;
}

/** While a dialog is open, music plays at this share of its volume. */
export const DUCKED = 0.4;
/** Volume changes glide over about this long, so they never click. */
const SMOOTHING = 0.08;

/** The buses: music, sounds and nature, each with its own volume, into a master that mutes. */
export class Mixer {
  readonly music: GainNode;
  readonly sounds: GainNode;
  readonly nature: GainNode;
  private readonly master: GainNode;
  private volumes: Volumes = { music: 0.5, sounds: 0.7, nature: 0.6, muted: false };
  private ducked = false;
  private naturelevel = 1;

  constructor(private readonly context: AudioContextLike) {
    this.master = context.createGain();
    this.master.connect(context.destination);
    this.music = this.bus();
    this.sounds = this.bus();
    this.nature = this.bus();
    this.apply();
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = volumes;
    this.apply();
  }

  /** Turns the music down while a dialog is open. */
  duck(on: boolean): void {
    this.ducked = on;
    this.apply();
  }

  /** Scales the nature bus for the weather (fog softens everything a little). */
  setNatureLevel(level: number): void {
    this.naturelevel = level;
    this.apply();
  }

  private bus(): GainNode {
    const gain = this.context.createGain();
    gain.connect(this.master);
    return gain;
  }

  private apply(): void {
    const now = this.context.currentTime;
    const set = (node: GainNode, value: number) => node.gain.setTargetAtTime(value, now, SMOOTHING);
    set(this.master, this.volumes.muted ? 0 : 1);
    set(this.music, this.volumes.music * (this.ducked ? DUCKED : 1));
    set(this.sounds, this.volumes.sounds);
    set(this.nature, this.volumes.nature * this.naturelevel);
  }
}
