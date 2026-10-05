import { AmbiencePlayer } from './ambience';
import { AudioContextLike } from './audio-context-like';
import { Effect, playEffect } from './effects';
import { Mixer, Volumes } from './mixer';
import { MusicPlayer, Timers, Track, browserTimers, nightArrangement } from './music';
import { SceneSound } from './soundscape';

/** Music, ambience and effects on one audio context, mixed on three buses. */
export class SoundEngine {
  private readonly mixer: Mixer;
  private readonly music: MusicPlayer;
  private readonly ambience: AmbiencePlayer;
  private readonly nights = new Map<string, Track>();

  constructor(
    readonly context: AudioContextLike,
    private readonly tracks: ReadonlyMap<string, Track>,
    timers: Timers = browserTimers,
  ) {
    this.mixer = new Mixer(context);
    this.music = new MusicPlayer(context, this.mixer.music, timers);
    this.ambience = new AmbiencePlayer(context, this.mixer.nature, timers);
  }

  /** The theme now playing and the ambience layers, for tests and debugging. */
  get state(): { readonly music: string | undefined; readonly layers: readonly string[] } {
    return { music: this.music.current, layers: this.ambience.active };
  }

  setScene(sound: SceneSound): void {
    const track = this.tracks.get(sound.music);
    this.music.play(track && sound.night ? this.nightOf(track) : track);
    this.ambience.set(sound.layers);
    this.mixer.setNatureLevel(sound.natureLevel);
  }

  play(effect: Effect): void {
    playEffect(this.context, this.mixer.sounds, effect);
  }

  duck(on: boolean): void {
    this.mixer.duck(on);
  }

  setVolumes(volumes: Volumes): void {
    this.mixer.setVolumes(volumes);
  }

  /** Stops the music and the ambience and their timers. */
  stop(): void {
    this.music.stop();
    this.ambience.stop();
  }

  private nightOf(track: Track): Track {
    let night = this.nights.get(track.id);
    if (!night) {
      night = nightArrangement(track);
      this.nights.set(track.id, night);
    }
    return night;
  }
}
