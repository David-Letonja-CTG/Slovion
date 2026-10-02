import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Translation, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import sl from '../../public/i18n/sl.json';
import { routes } from './app.routes';
import { provideTestLocalization } from './i18n/localization.testing';

/** Test-only second language with the same keys as the shipped Slovenian catalog. */
const en: Translation = {
  ...sl,
  app: { title: 'Slovion (EN)' },
  shell: { tagline: 'Discover the living nature of Slovenia' },
};

/** Renders the app's start page (the title screen) with the given catalogs. */
async function renderStart(catalogs: Record<string, Translation>, lang = 'sl') {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideTestLocalization(catalogs)],
  });
  const transloco = TestBed.inject(TranslocoService);
  transloco.setActiveLang(lang);
  await firstValueFrom(transloco.load(lang));

  const harness = await RouterTestingHarness.create('/');
  return harness.routeNativeElement as HTMLElement;
}

describe('App localization', () => {
  it('renders the start page from the Slovenian catalog', async () => {
    const page = await renderStart({ sl });

    expect(page.querySelector('h1')?.textContent).toBe(sl.app.title);
    expect(page.querySelector('.title__tagline')?.textContent).toBe(sl.shell.tagline);
  });

  it('shows whatever the catalog defines for the key', async () => {
    const edited = { ...sl, app: { title: 'Spremenjen naslov' } };

    const page = await renderStart({ sl: edited });

    expect(page.querySelector('h1')?.textContent).toBe('Spremenjen naslov');
  });

  it('renders a second language from its own catalog without code changes', async () => {
    const page = await renderStart({ sl, en }, 'en');

    expect(page.querySelector('h1')?.textContent).toBe('Slovion (EN)');
    expect(page.querySelector('.title__tagline')?.textContent).toBe(
      'Discover the living nature of Slovenia',
    );
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('en');
  });
});
