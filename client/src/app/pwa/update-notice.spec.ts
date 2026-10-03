import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { provideTestLocalization } from '../i18n/localization.testing';
import { settle } from '../testing/test-app';
import { PAGE_RELOAD } from './app-updates';
import { UpdateNotice } from './update-notice';

const VERSION_READY: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
};

async function renderNotice(isEnabled = true) {
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<UnrecoverableStateEvent>();
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideTestLocalization({ sl }),
      { provide: SwUpdate, useValue: { isEnabled, versionUpdates, unrecoverable } },
      { provide: PAGE_RELOAD, useValue: reload },
    ],
  });
  const fixture = TestBed.createComponent(UpdateNotice);
  await settle(fixture);
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, versionUpdates, unrecoverable, reload };
}

describe('Update notice', () => {
  it('stays hidden while no new version is ready', async () => {
    const { root, fixture, versionUpdates } = await renderNotice();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    await settle(fixture);

    expect(root.querySelector('.update')).toBeNull();
  });

  it('offers to reload once a new version is ready', async () => {
    const { root, fixture, versionUpdates, reload } = await renderNotice();

    versionUpdates.next(VERSION_READY);
    await settle(fixture);

    expect(root.querySelector('.update__text')?.textContent).toBe(sl.app.updateReady);
    const button = root.querySelector('button')!;
    expect(button.textContent?.trim()).toBe(sl.app.reload);
    button.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('offers to reload when the cached version can no longer be used', async () => {
    const { root, fixture, unrecoverable } = await renderNotice();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing files' });
    await settle(fixture);

    expect(root.querySelector('.update')).not.toBeNull();
  });

  it('does nothing without a service worker', async () => {
    const { root, fixture, versionUpdates } = await renderNotice(false);

    versionUpdates.next(VERSION_READY);
    await settle(fixture);

    expect(root.querySelector('.update')).toBeNull();
  });
});
