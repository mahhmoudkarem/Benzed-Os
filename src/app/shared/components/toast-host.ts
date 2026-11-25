import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  template: `
    <div class="fixed bottom-4 end-4 z-[80] flex flex-col gap-2 max-w-[92vw] w-[360px]">
      @for (t of toast.toasts(); track t.id) {
        <div class="card flex items-start gap-2.5 p-3" [style.border-inline-start]="'4px solid ' + color(t.kind)">
          <span [style.color]="color(t.kind)"><app-icon [name]="t.kind === 'success' ? 'check' : t.kind === 'info' ? 'info' : 'alert'" /></span>
          <div class="flex-1 text-sm">{{ t.message }}</div>
          <button class="icon-btn" style="width: 24px; height: 24px" type="button" (click)="toast.dismiss(t.id)"><app-icon name="x" [size]="14" /></button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toast = inject(ToastService);
  protected color(k: string): string {
    return k === 'success' ? 'var(--success)' : k === 'error' ? 'var(--danger)' : k === 'warning' ? 'var(--warning)' : 'var(--primary)';
  }
}
