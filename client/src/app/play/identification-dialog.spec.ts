import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { Encounter } from '../api/game-api';
import { provideTestLocalization } from '../i18n/localization.testing';
import { IdentificationDialog } from './identification-dialog';

const DANDELION: Encounter = {
  encounterId: 'e1',
  group: 'plant',
  clues: ['Rumeni jezičasti cvetovi.', 'Listna rozeta.', 'Bel sok.'],
  candidates: [
    { speciesId: 'lepus_europaeus', name: 'poljski zajec' },
    { speciesId: 'taraxacum_officinale', name: 'navadni regrat' },
    { speciesId: 'salvia_pratensis', name: 'travniška kadulja' },
    { speciesId: 'papilio_machaon', name: 'lastovičar' },
  ],
};

@Component({
  imports: [IdentificationDialog],
  template: `<app-identification-dialog
    [encounter]="encounter"
    (answered)="answers.push($event)"
    (left)="leaves.set(leaves() + 1)"
  />`,
})
class Host {
  readonly encounter = DANDELION;
  readonly answers: string[] = [];
  readonly leaves = signal(0);
  readonly dialog = viewChild.required(IdentificationDialog);
}

async function render() {
  TestBed.configureTestingModule({ imports: [Host], providers: [provideTestLocalization({ sl })] });
  await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    clues: () =>
      [...root.querySelectorAll('.identification__clues li')].map((li) => li.textContent?.trim()),
    buttons: () => [...root.querySelectorAll<HTMLButtonElement>('.identification__options button')],
    press: async (...actions: Parameters<IdentificationDialog['handleAction']>[0][]) => {
      actions.forEach((action) => fixture.componentInstance.dialog().handleAction(action));
      await fixture.whenStable();
    },
  };
}

describe('IdentificationDialog', () => {
  it('shows the group heading, the first clue and the candidates', async () => {
    const { fixture, clues, buttons } = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h2')?.textContent?.trim()).toBe(sl.identification.heading.plant);
    expect(clues()).toEqual(['Rumeni jezičasti cvetovi.']);
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      sl.identification.nextClue,
      'poljski zajec',
      'navadni regrat',
      'travniška kadulja',
      'lastovičar',
      sl.identification.leave,
    ]);
  });

  it('reveals clues one by one until all are shown', async () => {
    const { clues, buttons, fixture } = await render();

    buttons()[0].click();
    await fixture.whenStable();
    buttons()[0].click();
    await fixture.whenStable();

    expect(clues()).toHaveLength(3);
    expect(buttons().some((b) => b.dataset['kind'] === 'clue')).toBe(false);
  });

  it('chooses a candidate with the keyboard', async () => {
    const { host, press } = await render();

    await press('MoveDown', 'MoveDown', 'Confirm'); // next clue → zajec → regrat

    expect(host.answers).toEqual(['taraxacum_officinale']);
  });

  it('wraps the selection around', async () => {
    const { host, press } = await render();

    await press('MoveUp', 'Confirm'); // from the first option up to "Odidi"

    expect(host.leaves()).toBe(1);
  });

  it('reveals a clue with the keyboard', async () => {
    const { clues, press } = await render();

    await press('Confirm');

    expect(clues()).toHaveLength(2);
  });

  it('chooses a candidate with the mouse', async () => {
    const { host, buttons } = await render();

    buttons()[4].click();

    expect(host.answers).toEqual(['papilio_machaon']);
  });

  it('leaves with Cancel without answering', async () => {
    const { host, press } = await render();

    await press('Cancel');

    expect(host.leaves()).toBe(1);
    expect(host.answers).toEqual([]);
  });

  it('moves focus with the selection', async () => {
    const { buttons, press } = await render();

    await press('MoveDown');

    expect(document.activeElement).toBe(buttons()[1]);
  });
});
