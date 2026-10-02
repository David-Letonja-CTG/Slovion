import { DOCUMENT, registerLocaleData } from '@angular/common';
import localeSl from '@angular/common/locales/sl';
import {
  EnvironmentProviders,
  LOCALE_ID,
  Type,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import {
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
  provideTranslocoMissingHandler,
} from '@jsverse/transloco';
import { HttpTranslationLoader } from './http-translation-loader';
import { StrictMissingHandler } from './strict-missing-handler';

export const DEFAULT_LANG = 'sl';
export const SHIPPED_LANGS = [DEFAULT_LANG];

export interface LocalizationOptions {
  /** Languages that may be activated. Defaults to the shipped languages. */
  availableLangs?: string[];
  /** Catalog loader. Defaults to loading `public/i18n/<lang>.json` over HTTP. */
  loader?: Type<TranslocoLoader>;
}

/** Slovenian-first localization: translation catalogs, locale formatting and document language. */
export function provideLocalization(options: LocalizationOptions = {}): EnvironmentProviders {
  registerLocaleData(localeSl);

  return makeEnvironmentProviders([
    { provide: LOCALE_ID, useValue: DEFAULT_LANG },
    provideTransloco({
      config: {
        availableLangs: options.availableLangs ?? SHIPPED_LANGS,
        defaultLang: DEFAULT_LANG,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: false, logMissingKey: false },
      },
      loader: options.loader ?? HttpTranslationLoader,
    }),
    provideTranslocoMissingHandler(StrictMissingHandler),
    provideEnvironmentInitializer(syncDocumentWithActiveLanguage),
  ]);
}

/** Keeps `<html lang>` and the document title in sync with the active language. */
function syncDocumentWithActiveLanguage(): void {
  const transloco = inject(TranslocoService);
  const document = inject(DOCUMENT);
  const title = inject(Title);

  transloco.langChanges$
    .pipe(takeUntilDestroyed())
    .subscribe((lang) => (document.documentElement.lang = lang));
  transloco
    .selectTranslate<string>('app.title')
    .pipe(takeUntilDestroyed())
    .subscribe((text) => title.setTitle(text));
}
