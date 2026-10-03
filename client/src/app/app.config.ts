import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { gameApiInterceptor } from './api/game-api.interceptor';
import { routes } from './app.routes';
import { provideLocalization } from './i18n/localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([gameApiInterceptor])),
    provideRouter(routes),
    provideLocalization(),
    // Installable app: caches the built app so it opens without a connection (production builds only).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
