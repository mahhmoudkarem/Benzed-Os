import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(kind: Toast['kind'], message: string, ms = 4500): void {
    const id = ++this.seq;
    this.toasts.update((l) => [...l, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  success(m: string) {
    this.show('success', m);
  }
  error(m: string) {
    this.show('error', m, 7000);
  }
  info(m: string) {
    this.show('info', m);
  }
  warning(m: string) {
    this.show('warning', m, 6000);
  }
  dismiss(id: number): void {
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }
}
