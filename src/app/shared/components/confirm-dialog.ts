import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Modal } from './modal';

@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  template: `
    @if (svc.state(); as s) {
      <app-modal [title]="lang.t(s.titleEn, s.titleAr)" (closed)="cancel()">
        <p class="m-0 text-sm" style="white-space: pre-line">{{ lang.t(s.messageEn, s.messageAr) }}</p>
        @if (s.askReason) {
          <div class="mt-4">
            <label class="label">{{ lang.t('Reason (required)', 'السبب (مطلوب)') }}</label>
            <input class="input" [value]="reason()" (input)="reason.set(val($event))" />
          </div>
        }
        @if (s.requireText) {
          <div class="mt-4">
            <label class="label">{{ lang.t('Type', 'اكتب') }} <b>{{ s.requireText }}</b> {{ lang.t('to confirm', 'للتأكيد') }}</label>
            <input class="input" [value]="typed()" (input)="typed.set(val($event))" />
          </div>
        }
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn" type="button" (click)="cancel()">{{ lang.t('Cancel', 'إلغاء') }}</button>
          <button class="btn" [class.btn-danger]="s.danger" [class.btn-primary]="!s.danger" type="button" [disabled]="!canConfirm()" (click)="ok()">
            {{ lang.t(s.confirmEn || 'Confirm', s.confirmAr || 'تأكيد') }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmDialog {
  protected readonly svc = inject(ConfirmService);
  protected readonly lang = inject(LanguageService);
  protected readonly reason = signal('');
  protected readonly typed = signal('');

  protected readonly canConfirm = computed(() => {
    const s = this.svc.state();
    if (!s) return false;
    if (s.askReason && !this.reason().trim()) return false;
    if (s.requireText && this.typed().trim() !== s.requireText) return false;
    return true;
  });

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected ok(): void {
    const s = this.svc.state();
    if (!s || !this.canConfirm()) return;
    const reason = this.reason();
    this.reason.set('');
    this.typed.set('');
    s.resolve({ ok: true, reason });
  }

  protected cancel(): void {
    const s = this.svc.state();
    this.reason.set('');
    this.typed.set('');
    s?.resolve({ ok: false, reason: '' });
  }
}
