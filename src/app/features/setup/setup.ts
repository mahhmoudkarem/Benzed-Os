import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { ThemeService } from '../../core/services/theme.service';
import { SettingsService } from '../../core/services/settings.service';
import { AccountingService } from '../../core/accounting/accounting.service';
import { ActivityService } from '../../core/services/activity.service';
import { ToastService } from '../../core/services/toast.service';
import { PAYMENT_METHODS } from '../../core/constants/options';
import { cairoDate } from '../../core/utils/date';
import { Icon } from '../../shared/components/icon';
import { ToastHost } from '../../shared/components/toast-host';
import { BrandLogo } from '../../shared/components/brand-logo';

@Component({
  selector: 'app-setup',
  imports: [Icon, ToastHost, BrandLogo],
  template: `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card w-full" style="max-width: 560px">
        <div class="flex items-center justify-between p-5 border-b border-line">
          <div class="flex items-center gap-3">
            <app-brand-logo [size]="46" />
            <div>
              <div class="font-bold text-lg leading-tight">BENZED OS</div>
              <div class="text-muted text-xs">{{ lang.t('First-time setup', 'الإعداد الأولي') }}</div>
            </div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-sm" type="button" (click)="lang.toggle()"><app-icon name="globe" [size]="14" /> {{ lang.isArabic() ? 'English' : 'العربية' }}</button>
            <button class="icon-btn" type="button" (click)="theme.toggle()"><app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" /></button>
          </div>
        </div>
        <div class="p-5 flex flex-col gap-4">
          <p class="m-0 text-muted text-[13px]">
            {{ lang.t('Enter your company’s real starting capital. The system will post it as the opening accounting entry. Nothing is pre-filled or assumed.', 'أدخل رأس مال الشركة الفعلي عند البداية. سيتم ترحيله كقيد افتتاحي. لا توجد قيم افتراضية أو مُفترضة.') }}
          </p>
          <div>
            <label class="label">{{ lang.t('Company name', 'اسم الشركة') }} *</label>
            <input class="input" [class.invalid]="errors().name" [value]="name()" (input)="name.set($any($event.target).value)" />
            @if (errors().name) {<div class="field-error">{{ errors().name }}</div>}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="label">{{ lang.t('Initial capital (EGP)', 'رأس المال الابتدائي (ج.م)') }} *</label>
              <input class="input" type="number" min="0" step="0.01" [class.invalid]="errors().capital" [value]="capital()" (input)="capital.set($any($event.target).value)" placeholder="0.00" />
              @if (errors().capital) {<div class="field-error">{{ errors().capital }}</div>}
            </div>
            <div>
              <label class="label">{{ lang.t('Capital date', 'تاريخ رأس المال') }} *</label>
              <input class="input" type="date" [value]="date()" (change)="date.set($any($event.target).value)" />
            </div>
            <div>
              <label class="label">{{ lang.t('Held as', 'محتفَظ به كـ') }}</label>
              <select class="select" (change)="method.set($any($event.target).value)">
                @for (m of methods; track m.value) {
                  <option [value]="m.value" [selected]="method() === m.value">{{ lang.l(m.label) }}</option>
                }
              </select>
            </div>
          </div>
          @if (error()) {<div class="field-error">{{ error() }}</div>}
          <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="submit()">
            {{ busy() ? lang.t('Setting up…', 'جارِ الإعداد…') : lang.t('Start using BENZED OS', 'ابدأ استخدام BENZED OS') }}
          </button>
        </div>
      </div>
    </div>
    <app-toast-host />
  `,
})
export class Setup {
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);
  private readonly accounting = inject(AccountingService);
  private readonly activity = inject(ActivityService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly methods = PAYMENT_METHODS.filter((m) => m.value === 'cash' || m.value === 'bank');
  protected readonly name = signal('BENZED X Marketing');
  protected readonly capital = signal('');
  protected readonly date = signal(cairoDate());
  protected readonly method = signal('bank');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly errors = signal<{ name?: string; capital?: string }>({});

  protected async submit(): Promise<void> {
    const errs: { name?: string; capital?: string } = {};
    if (!this.name().trim()) errs.name = this.lang.t('Company name is required', 'اسم الشركة مطلوب');
    const raw = this.capital().trim();
    const amount = Number(raw);
    if (raw === '' || !Number.isFinite(amount) || amount < 0) errs.capital = this.lang.t('Enter the initial capital (0 or more)', 'أدخل رأس المال الابتدائي (صفر أو أكثر)');
    this.errors.set(errs);
    this.error.set('');
    if (errs.name || errs.capital) return;
    this.busy.set(true);
    try {
      if (amount > 0) {
        await this.accounting.recordCapital({ type: 'initial', amount, date: this.date(), method: this.method(), notes: 'Initial setup' });
      }
      await this.settings.saveSetup({ done: true, companyName: this.name().trim(), completedAt: cairoDate() });
      await this.activity.log('setup', 'system', undefined, 'System setup completed', 'تم إكمال إعداد النظام');
      this.toast.success(this.lang.t('Setup completed', 'تم الإعداد بنجاح'));
      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      console.error(e);
      this.error.set(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }
}
