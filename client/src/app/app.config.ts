import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { gameApiInterceptor } from './api/game-api.interceptor';
import { AudioService } from './audio/audio.service';
import { routes } from './app.routes';
import { provideLocalization } from './i18n/localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([gameApiInterceptor])),
    provideRouter(routes),
    provideLocalization(),
    // Sound waits for the first click or key press anywhere, including the one on the title screen.
    provideAppInitializer(() => void inject(AudioService)),
    // Installable app: caches the built app so it opens without a connection (production builds only).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
