import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { Action } from '../../engine';
import { provideTestLocalization } from '../i18n/localization.testing';
import { AudioService } from './audio.service';
import { SoundSettingsDialog } from './sound-settings-dialog';
import { FakeAudioService } from './testing/fake-audio-service';

@Component({
  imports: [SoundSettingsDialog],
  template: `<app-sound-settings-dialog (closed)="closes.set(closes() + 1)" />`,
})
class Host {
  readonly closes = signal(0);
  readonly dialog = viewChild.required(SoundSettingsDialog);
}

async function render() {
  const audio = new FakeAudioService();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideTestLocalization({ sl }), { provide: AudioService, useValue: audio }],
  });
  await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const slider = (volume: string) =>
    root.querySelector<HTMLInputElement>(`input[data-volume="${volume}"]`)!;
  return {
    audio,
    fixture,
    root,
    host: fixture.componentInstance,
    slider,
    mute: () => root.querySelector<HTMLInputElement>('input[type="checkbox"]')!,
    press: async (...actions: Action[]) => {
      actions.forEach((action) => fixture.componentInstance.dialog().handleAction(action));
      await fixture.whenStable();
    },
  };
}

describe('SoundSettingsDialog', () => {
  it('shows the three volumes with their values, the mute switch and the hint', async () => {
    const { root, slider, mute } = await render();
    const labels = [...root.querySelectorAll('.sound__label')].map((label) => label.textContent);

    expect(root.querySelector('h2')?.textContent).toBe(sl.sound.title);
    expect(labels).toEqual([sl.sound.music, sl.sound.effects, sl.sound.nature]);
    expect([slider('music').value, slider('sounds').value, slider('nature').value]).toEqual([
      '50',
      '70',
      '60',
    ]);
    expect(root.querySelector('.sound__mute')?.textContent?.trim()).toBe(sl.sound.mute);
    expect(mute().checked).toBe(false);
    expect(root.querySelector('.sound__hint')?.textContent).toBe(sl.sound.hint);
  });

  it('focuses the music volume when it opens', async () => {
    const { slider } = await render();

    expect(document.activeElement).toBe(slider('music'));
  });

  it('applies a volume as the slider moves', async () => {
    const { audio, slider, fixture } = await render();

    slider('music').value = '0';
    slider('music').dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(audio.settings().music).toBe(0);
    expect(audio.settings().sounds).toBe(70);
  });

  it('mutes and unmutes with the switch', async () => {
    const { audio, mute, fixture } = await render();

    mute().click();
    await fixture.whenStable();
    expect(audio.settings().muted).toBe(true);
    expect(mute().checked).toBe(true);

    mute().click();
    await fixture.whenStable();
    expect(audio.settings().muted).toBe(false);
  });

  it('chooses a volume with up and down and changes it with left and right, within 0–100', async () => {
    const { audio, press, slider } = await render();

    await press('MoveRight');
    expect(audio.settings().music).toBe(60);

    await press('MoveDown', 'MoveRight', 'MoveRight', 'MoveRight', 'MoveRight');
    expect(audio.settings().sounds).toBe(100);
    expect(document.activeElement).toBe(slider('sounds'));

    await press('MoveDown', ...Array<Action>(7).fill('MoveLeft'));
    expect(audio.settings().nature).toBe(0);

    await press('MoveDown');
    expect(document.activeElement).toBe(slider('music'));
    await press('MoveUp');
    expect(document.activeElement).toBe(slider('nature'));
  });

  it('mutes with Confirm and closes with Cancel or the close button', async () => {
    const { audio, host, press, root } = await render();

    await press('Confirm');
    expect(audio.settings().muted).toBe(true);

    await press('Cancel');
    expect(host.closes()).toBe(1);
    root.querySelector<HTMLButtonElement>('.sound__header button')!.click();
    expect(host.closes()).toBe(2);
  });
});
