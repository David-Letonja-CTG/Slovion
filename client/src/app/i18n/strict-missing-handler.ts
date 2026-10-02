import { Injectable, isDevMode } from '@angular/core';
import { TranslocoMissingHandler } from '@jsverse/transloco';

/**
 * Missing translations are errors during development and tests, so they are caught before release.
 * In production the key is shown instead of breaking the page.
 */
@Injectable()
export class StrictMissingHandler implements TranslocoMissingHandler {
  handle(key: string): string {
    if (isDevMode()) {
      throw new Error(`Missing translation key: "${key}"`);
    }
    return key;
  }
}
