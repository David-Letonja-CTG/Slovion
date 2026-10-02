import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { gameApiInterceptor } from './api/game-api.interceptor';
import { routes } from './app.routes';
import { provideLocalization } from './i18n/localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([gameApiInterceptor])),
    provideRouter(routes),
    provideLocalization(),
  ],
};
