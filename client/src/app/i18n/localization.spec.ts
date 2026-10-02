import { DOCUMENT, formatNumber } from '@angular/common';
import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { config as rxjsConfig, firstValueFrom } from 'rxjs';
import sl from '../../../public/i18n/sl.json';
import { provideTestLocalization } from './localization.testing';

// Held in a variable so the CI key check does not treat this deliberately missing key as a real one.
const MISSING_KEY = 'does.not.exist';

@Component({
  imports: [TranslocoPipe],
  template: `{{ key | transloco }}`,
})
class MissingKeyHost {
  protected readonly key = MISSING_KEY;
}

describe('localization', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTestLocalization({ sl })] });
    await firstValueFrom(TestBed.inject(TranslocoService).load('sl'));
  });

  it('starts in Slovenian and declares the document language', () => {
    const transloco = TestBed.inject(TranslocoService);

    expect(transloco.getActiveLang()).toBe('sl');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('sl');
    expect(TestBed.inject(Title).getTitle()).toBe(sl.app.title);
  });

  it('formats numbers with Slovenian separators', () => {
    const locale = TestBed.inject(LOCALE_ID);

    expect(formatNumber(1234.5, locale, '1.1-1')).toBe('1.234,5');
  });

  it('fails when a template uses a key missing from the catalog', async () => {
    // The pipe resolves keys inside an RxJS subscription, which reports errors asynchronously.
    const errors: unknown[] = [];
    rxjsConfig.onUnhandledError = (error) => errors.push(error);
    try {
      TestBed.createComponent(MissingKeyHost).detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    } finally {
      rxjsConfig.onUnhandledError = null;
    }

    expect(errors).toEqual([new Error('Missing translation key: "does.not.exist"')]);
  });

  it('fails when code translates a key missing from the catalog', () => {
    const transloco = TestBed.inject(TranslocoService);

    expect(() => transloco.translate(MISSING_KEY)).toThrow(
      'Missing translation key: "does.not.exist"',
    );
  });
});
