import { Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty">
      <div class="inline-flex mb-2 opacity-60"><app-icon [name]="icon()" [size]="34" /></div>
      <div class="font-semibold text-fg">{{ title() }}</div>
      @if (text()) {
        <div class="mt-1 text-[13px]">{{ text() }}</div>
      }
      <div class="mt-3"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('layers');
  readonly title = input.required<string>();
  readonly text = input('');
}

@Component({
  selector: 'app-loading',
  template: `
    <div class="p-5 flex flex-col gap-3">
      @for (i of rows; track i) {
        <div class="skeleton" [style.width.%]="60 + ((i * 13) % 40)"></div>
      }
    </div>
  `,
})
export class Loading {
  protected readonly rows = [1, 2, 3, 4, 5];
}

@Component({
  selector: 'app-error-state',
  imports: [Icon],
  template: `
    <div class="empty">
      <div class="inline-flex mb-2" style="color: var(--danger)"><app-icon name="alert" [size]="30" /></div>
      <div class="font-semibold text-fg">{{ message() }}</div>
      <div class="mt-3"><ng-content /></div>
    </div>
  `,
})
export class ErrorState {
  readonly message = input.required<string>();
}
