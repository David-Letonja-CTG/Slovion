import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DEVICE_STORAGE } from '../session/save-token-store';
import { AudioContextLike } from './synth/audio-context-like';
import { Effect } from './synth/effects';
import { Track, TrackFile, parseTrack } from './synth/music';
import { SoundEngine } from './synth/sound-engine';
import { CAVE_MUSIC, Scene, Soundscapes, soundFor } from './synth/soundscape';

/** Makes the audio context on the first gesture; `null` where the browser has no Web Audio (no sound then). */
export const AUDIO_CONTEXT_FACTORY = new InjectionToken<(() => AudioContextLike) | null>(
  'AUDIO_CONTEXT_FACTORY',
  {
    providedIn: 'root',
    factory: () => {
      const view = inject(DOCUMENT).defaultView as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      } | null;
      const Context = view?.AudioContext ?? view?.webkitAudioContext;
      return Context ? () => new Context() : null;
    },
  },
);

/** Volumes in percent (0–100) and the mute switch, remembered on the device. */
export interface SoundSettings {
  readonly music: number;
  readonly sounds: number;
  readonly nature: number;
  readonly muted: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  music: 50,
  sounds: 70,
  nature: 60,
  muted: false,
};

/**
 * The game's sound (docs/architecture.md): starts on the player's first click, tap or key press, as browsers require;
 * plays the music and ambience of the current scene and the effects the play screen asks for; stops while the page
 * is hidden. Without Web Audio it does nothing.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  static readonly storageKey = 'slovion.sound';

  readonly settings = signal<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  /** Whether the browser can play sound at all. */
  readonly available: boolean;

  private readonly createContext = inject(AUDIO_CONTEXT_FACTORY);
  private readonly http = inject(HttpClient);
  private readonly storage = inject(DEVICE_STORAGE);
  private readonly document = inject(DOCUMENT);
  private engine: SoundEngine | undefined;
  private soundscapes: Soundscapes = {};
  private starting: Promise<void> | undefined;
  private scene: Scene | undefined;
  private ducked = false;

  constructor() {
    this.available = this.createContext !== null;
    this.settings.set(this.load());
    if (!this.available) return;

    const unlock = () => void this.start();
    const onVisibility = () => {
      const context = this.engine?.context;
      if (!context) return;
      if (this.document.visibilityState === 'hidden') void context.suspend();
      else void context.resume();
    };
    this.document.addEventListener('pointerdown', unlock, { capture: true });
    this.document.addEventListener('keydown', unlock, { capture: true });
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('pointerdown', unlock, { capture: true });
      this.document.removeEventListener('keydown', unlock, { capture: true });
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.engine?.stop();
    });
  }

  /** The theme now playing and the ambience layers once sound has started, for tests and debugging. */
  get state(): SoundEngine['state'] | undefined {
    return this.engine?.state;
  }

  /** Creates the audio context and loads the music, once; later gestures resume a suspended context. */
  start(): Promise<void> {
    if (this.engine) {
      if (this.engine.context.state === 'suspended' && this.document.visibilityState !== 'hidden') {
        void this.engine.context.resume();
      }
      return Promise.resolve();
    }
    if (!this.createContext) return Promise.resolve();
    this.starting ??= this.begin(this.createContext).catch((cause: unknown) => {
      // Sound is a nice-to-have: the game goes on silently.
      console.error('Sound could not start.', cause);
    });
    return this.starting;
  }

  /** Where the player is: picks the music and the ambience. */
  setScene(scene: Scene): void {
    this.scene = scene;
    this.engine?.setScene(soundFor(scene, this.soundscapes));
  }

  play(effect: Effect): void {
    this.engine?.play(effect);
  }

  /** Turns the music down while a dialog is open. */
  duck(on: boolean): void {
    this.ducked = on;
    this.engine?.duck(on);
  }

  update(changes: Partial<SoundSettings>): void {
    const settings = { ...this.settings(), ...changes };
    this.settings.set(settings);
    try {
      this.storage?.setItem(AudioService.storageKey, JSON.stringify(settings));
    } catch {
      // Storage blocked: the settings still apply for this visit.
    }
    this.applyVolumes();
  }

  private async begin(createContext: () => AudioContextLike): Promise<void> {
    // The context is made in the gesture itself, as browsers require; the data follows.
    const context = createContext();
    if (context.state === 'suspended') void context.resume();
    const soundscapes = await firstValueFrom(this.http.get<Soundscapes>('/audio/soundscapes.json'));
    const ids = [
      ...new Set([...Object.values(soundscapes).map((soundscape) => soundscape.music), CAVE_MUSIC]),
    ];
    const files = await Promise.all(
      ids.map((id) => firstValueFrom(this.http.get<TrackFile>(`/audio/music/${id}.json`))),
    );
    const tracks = new Map<string, Track>(files.map((file) => [file.id, parseTrack(file)]));
    this.soundscapes = soundscapes;
    this.engine = new SoundEngine(context, tracks);
    this.applyVolumes();
    this.engine.duck(this.ducked);
    if (this.scene) this.setScene(this.scene);
  }

  private applyVolumes(): void {
    const { music, sounds, nature, muted } = this.settings();
    this.engine?.setVolumes({
      music: music / 100,
      sounds: sounds / 100,
      nature: nature / 100,
      muted,
    });
  }

  private load(): SoundSettings {
    try {
      const stored = this.storage?.getItem(AudioService.storageKey);
      if (!stored) return DEFAULT_SOUND_SETTINGS;
      const parsed = JSON.parse(stored) as Partial<SoundSettings>;
      const percent = (value: unknown, fallback: number) =>
        typeof value === 'number' && value >= 0 && value <= 100 ? value : fallback;
      return {
        music: percent(parsed.music, DEFAULT_SOUND_SETTINGS.music),
        sounds: percent(parsed.sounds, DEFAULT_SOUND_SETTINGS.sounds),
        nature: percent(parsed.nature, DEFAULT_SOUND_SETTINGS.nature),
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SOUND_SETTINGS.muted,
      };
    } catch {
      return DEFAULT_SOUND_SETTINGS;
    }
  }
}
