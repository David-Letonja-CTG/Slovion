import { Routes } from '@angular/router';
import { PlayScreen } from './play/play-screen';
import { playGuard } from './session/game-session';
import { TitleScreen } from './title/title-screen';

export const routes: Routes = [
  { path: '', component: TitleScreen },
  { path: 'play', component: PlayScreen, canActivate: [playGuard] },
  { path: '**', redirectTo: '' },
];
