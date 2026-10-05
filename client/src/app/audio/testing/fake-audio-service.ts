import { signal } from '@angular/core';
import { DEFAULT_SOUND_SETTINGS, SoundSettings } from '../audio.service';
import { Effect } from '../synth/effects';
import { Scene } from '../synth/soundscape';

/** Stands in for `AudioService` in screen tests: records what the screen asks for and plays nothing. */
export class FakeAudioService {
  readonly available = true;
  readonly settings = signal<SoundSettings>(DEFAULT_SOUND_SETTINGS);
  readonly scenes: Scene[] = [];
  readonly effects: Effect[] = [];
  ducked = false;

  setScene(scene: Scene): void {
    this.scenes.push(scene);
  }

  play(effect: Effect): void {
    this.effects.push(effect);
  }

  duck(on: boolean): void {
    this.ducked = on;
  }

  update(changes: Partial<SoundSettings>): void {
    this.settings.update((settings) => ({ ...settings, ...changes }));
  }
}
