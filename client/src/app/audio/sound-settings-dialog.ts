import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Action } from '../../engine';
import { AudioService, SoundSettings } from './audio.service';

type Volume = 'music' | 'sounds' | 'nature';

/** How much one arrow press changes a volume. */
const STEP = 10;

/**
 * Sound settings: a volume for music, sound effects and nature sounds, and the mute switch. Mouse and touch use
 * the controls directly; keyboard input arrives as UI actions from the play screen (the game keeps the arrow keys):
 * up and down choose a volume, left and right change it, `Confirm` mutes or unmutes, `Cancel` closes.
 */
@Component({
  selector: 'app-sound-settings-dialog',
  imports: [TranslocoPipe],
  template: `
    <div class="overlay">
      <section class="dialog sound" role="dialog" aria-modal="true" aria-labelledby="sound-title">
        <header class="sound__header">
          <h2 id="sound-title">{{ 'sound.title' | transloco }}</h2>
          <button type="button" class="button" (click)="closed.emit()">
            {{ 'common.close' | transloco }}
          </button>
        </header>
        @for (volume of volumes; track volume.key; let i = $index) {
          <label class="sound__row" [class.sound__row--selected]="selected() === i">
            <span class="sound__label">{{ volume.label | transloco }}</span>
            <input
              #slider
              type="range"
              min="0"
              max="100"
              step="5"
              [attr.data-volume]="volume.key"
              [value]="settings()[volume.key]"
              (input)="set(volume.key, $event)"
              (focus)="selected.set(i)"
            />
            <span class="sound__value">{{ settings()[volume.key] }} %</span>
          </label>
        }
        <label class="sound__row sound__mute">
          <input
            type="checkbox"
            [checked]="settings().muted"
            (change)="audio.update({ muted: !settings().muted })"
          />
          <span>{{ 'sound.mute' | transloco }}</span>
        </label>
        <p class="sound__hint">{{ 'sound.hint' | transloco }}</p>
      </section>
    </div>
  `,
  styleUrl: '../play/overlay.css',
  styles: `
    .sound {
      width: min(26rem, 100%);
      text-align: left;
    }

    .sound__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .sound__header h2 {
      margin: 0;
    }

    .sound__row {
      display: grid;
      grid-template-columns: 6rem 1fr 3.5rem;
      align-items: center;
      gap: 0.75rem;
      padding: 0.3rem 0.5rem;
    }

    .sound input {
      accent-color: var(--color-accent);
    }

    .sound__row--selected {
      outline: 2px solid var(--color-accent);
    }

    .sound__value {
      text-align: right;
      color: var(--color-text-muted);
    }

    .sound__mute {
      display: flex;
    }

    .sound__hint {
      margin: 0.5rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
  `,
})
export class SoundSettingsDialog {
  readonly closed = output<void>();
  protected readonly audio = inject(AudioService);
  protected readonly settings = this.audio.settings;
  /** The volume the arrow keys change. */
  protected readonly selected = signal(0);
  protected readonly volumes: readonly { readonly key: Volume; readonly label: string }[] = [
    { key: 'music', label: 'sound.music' },
    { key: 'sounds', label: 'sound.effects' },
    { key: 'nature', label: 'sound.nature' },
  ];
  private readonly sliders = viewChildren<ElementRef<HTMLInputElement>>('slider');

  constructor() {
    afterNextRender(() => this.sliders()[0]?.nativeElement.focus());
  }

  protected set(key: Volume, event: Event): void {
    this.audio.update({
      [key]: Number((event.target as HTMLInputElement).value),
    } as Partial<SoundSettings>);
  }

  /** Keyboard input routed from the play screen while the dialog is open. */
  handleAction(action: Action): void {
    const count = this.volumes.length;
    if (action === 'Cancel') {
      this.closed.emit();
    } else if (action === 'MoveUp' || action === 'MoveDown') {
      this.selected.update((index) => (index + (action === 'MoveDown' ? 1 : count - 1)) % count);
      this.sliders()[this.selected()]?.nativeElement.focus();
    } else if (action === 'MoveLeft' || action === 'MoveRight') {
      const key = this.volumes[this.selected()].key;
      const value = this.settings()[key] + (action === 'MoveRight' ? STEP : -STEP);
      this.audio.update({ [key]: Math.max(0, Math.min(100, value)) } as Partial<SoundSettings>);
    } else if (action === 'Confirm') {
      this.audio.update({ muted: !this.settings().muted });
    }
  }
}
