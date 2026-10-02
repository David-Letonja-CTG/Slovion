import {
  EnvironmentProviders,
  Injectable,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { provideLocalization } from './localization';

const TEST_CATALOGS = new InjectionToken<Record<string, Translation>>('TEST_CATALOGS');

@Injectable()
class InlineTranslationLoader implements TranslocoLoader {
  private readonly catalogs = inject(TEST_CATALOGS);

  getTranslation(lang: string) {
    return of(this.catalogs[lang]);
  }
}

/** Real localization setup with catalogs supplied in memory instead of over HTTP. */
export function provideTestLocalization(
  catalogs: Record<string, Translation>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TEST_CATALOGS, useValue: catalogs },
    provideLocalization({ availableLangs: Object.keys(catalogs), loader: InlineTranslationLoader }),
  ]);
}
