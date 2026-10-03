import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateNotice } from './pwa/update-notice';

@Component({
  imports: [RouterOutlet, UpdateNotice],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
