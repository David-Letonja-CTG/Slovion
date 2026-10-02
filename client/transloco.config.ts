import type { TranslocoGlobalConfig } from '@jsverse/transloco-utils';

const config: TranslocoGlobalConfig = {
  rootTranslationsPath: 'public/i18n/',
  langs: ['sl'],
  keysManager: {
    input: ['src/app'],
    output: 'public/i18n',
  },
};

export default config;
