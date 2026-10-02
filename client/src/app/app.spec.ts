import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Translation, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../public/i18n/sl.json';
import { App } from './app';
import { GAME_FACTORY } from './game/game-canvas';
import { provideTestLocalization } from './i18n/localization.testing';

/** Test-only second language with the same keys as the shipped Slovenian catalog. */
const en: Translation = {
  app: { title: 'Slovion (EN)' },
  shell: { tagline: 'Discover the living nature of Slovenia' },
  game: { viewportLabel: 'Game world' },
};

async function renderShell(catalogs: Record<string, Translation>, lang = 'sl') {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([]),
      provideTestLocalization(catalogs),
      // The engine needs a real canvas, which jsdom lacks; it is tested on its own.
      {
        provide: GAME_FACTORY,
        useValue: () => ({ start: () => undefined, stop: () => undefined }),
      },
    ],
  });
  const transloco = TestBed.inject(TranslocoService);
  transloco.setActiveLang(lang);
  await firstValueFrom(transloco.load(lang));

  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('App shell', () => {
  it('renders its title and tagline from the Slovenian catalog', async () => {
    const shell = await renderShell({ sl });

    expect(shell.querySelector('h1')?.textContent).toBe(sl.app.title);
    expect(shell.querySelector('.shell__tagline')?.textContent).toBe(sl.shell.tagline);
  });

  it('shows whatever the catalog defines for the key', async () => {
    const edited = { ...sl, app: { title: 'Spremenjen naslov' } };

    const shell = await renderShell({ sl: edited });

    expect(shell.querySelector('h1')?.textContent).toBe('Spremenjen naslov');
  });

  it('renders a second language from its own catalog without code changes', async () => {
    const shell = await renderShell({ sl, en }, 'en');

    expect(shell.querySelector('h1')?.textContent).toBe('Slovion (EN)');
    expect(shell.querySelector('.shell__tagline')?.textContent).toBe(
      'Discover the living nature of Slovenia',
    );
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('en');
  });
});
