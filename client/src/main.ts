import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Safari on iPhone and iPad zooms on a pinch whatever the viewport meta tag and touch-action say (styles.css); its own
// gesture event can still be stopped.
document.addEventListener('gesturestart', (event) => event.preventDefault());

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
