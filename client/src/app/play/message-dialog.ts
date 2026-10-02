import { Component, ElementRef, afterNextRender, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** A modal message with a close button. The message is projected by the host. */
@Component({
  selector: 'app-message-dialog',
  imports: [TranslocoPipe],
  template: `
    <div class="overlay">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="message-dialog-text">
        <div id="message-dialog-text" class="dialog__text"><ng-content /></div>
        <button #close type="button" class="button button--primary" (click)="closed.emit()">
          {{ 'common.close' | transloco }}
        </button>
      </section>
    </div>
  `,
  styleUrl: './overlay.css',
})
export class MessageDialog {
  readonly closed = output<void>();
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('close');

  constructor() {
    afterNextRender(() => this.closeButton().nativeElement.focus());
  }
}
