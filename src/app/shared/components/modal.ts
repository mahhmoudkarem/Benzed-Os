import { Component, HostListener, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `
    <div class="backdrop" (mousedown)="onBackdrop($event)">
      <div class="modal" [class.wide]="wide()" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h3 class="font-semibold text-base m-0">{{ title() }}</h3>
          <button class="icon-btn" type="button" (click)="closed.emit()" aria-label="Close"><app-icon name="x" /></button>
        </div>
        <div class="p-5"><ng-content /></div>
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input('');
  readonly wide = input(false);
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.closed.emit();
  }

  onBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('backdrop')) this.closed.emit();
  }
}
