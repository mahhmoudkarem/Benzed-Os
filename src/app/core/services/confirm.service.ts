import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  confirmEn?: string;
  confirmAr?: string;
  danger?: boolean;
  /** لو موجود، المستخدم لازم يكتب النص ده بالظبط للتأكيد */
  requireText?: string;
  /** حقل سبب اختياري/إجباري (للقيود العكسية مثلًا) */
  askReason?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (r: { ok: boolean; reason: string }) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(opts: ConfirmOptions): Promise<{ ok: boolean; reason: string }> {
    return new Promise((resolve) => {
      this.state.set({
        ...opts,
        resolve: (r) => {
          this.state.set(null);
          resolve(r);
        },
      });
    });
  }

  async confirm(opts: ConfirmOptions): Promise<boolean> {
    return (await this.ask(opts)).ok;
  }
}
