import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { ThemeService } from '../../core/services/theme.service';
import { SettingsService } from '../../core/services/settings.service';
import { BackupService } from '../../core/services/backup.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { PageHeader } from '../../shared/components/page-header';

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader],
  template: `
    <app-page-header [title]="lang.t('Settings', 'الإعدادات')" />
    <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
      <div class="card card-pad flex flex-col gap-3">
        <div class="card-title">{{ lang.t('General', 'عام') }}</div>
        <div><label class="label">{{ lang.t('Company name', 'اسم الشركة') }}</label>
          <div class="flex gap-2"><input class="input" [value]="company()" (input)="company.set($any($event.target).value)" /><button class="btn btn-primary" type="button" (click)="saveCompany()">{{ lang.t('Save', 'حفظ') }}</button></div></div>
        <div><label class="label">{{ lang.t('Language', 'اللغة') }}</label>
          <div class="flex gap-2"><button class="btn" [class.btn-primary]="!lang.isArabic()" type="button" (click)="lang.set('en')">English (LTR)</button><button class="btn" [class.btn-primary]="lang.isArabic()" type="button" (click)="lang.set('ar')">العربية (RTL)</button></div></div>
        <div><label class="label">{{ lang.t('Theme', 'المظهر') }}</label>
          <div class="flex gap-2"><button class="btn" [class.btn-primary]="theme.theme() === 'light'" type="button" (click)="setTheme('light')">{{ lang.t('Light', 'فاتح') }}</button><button class="btn" [class.btn-primary]="theme.theme() === 'dark'" type="button" (click)="setTheme('dark')">{{ lang.t('Dark', 'داكن') }}</button></div></div>
      </div>
      <div class="card card-pad flex flex-col gap-2 text-[13px]">
        <div class="card-title">{{ lang.t('System information', 'معلومات النظام') }}</div>
        <div class="flex justify-between"><span class="text-muted">{{ lang.t('Application', 'التطبيق') }}</span><b>{{ cfg.name }} {{ cfg.appVersion }}</b></div>
        <div class="flex justify-between"><span class="text-muted">{{ lang.t('Company', 'الشركة') }}</span><b>{{ cfg.company }}</b></div>
        <div class="flex justify-between"><span class="text-muted">{{ lang.t('Currency', 'العملة') }}</span><b>{{ cfg.currency }}</b></div>
        <div class="flex justify-between"><span class="text-muted">{{ lang.t('Timezone', 'المنطقة الزمنية') }}</span><b>{{ cfg.timezone }}</b></div>
        <div class="flex justify-between"><span class="text-muted">{{ lang.t('Database', 'قاعدة البيانات') }}</span><b>IndexedDB (Dexie) v{{ cfg.dbVersion }}</b></div>
        <div class="text-muted text-[12px] mt-2">{{ lang.t('Single-device app: no login, no server, no sync. Data belongs to this browser and site address.', 'تطبيق لجهاز واحد: بلا تسجيل دخول ولا خادم ولا مزامنة. البيانات تخص هذا المتصفح وعنوان الموقع.') }}</div>
      </div>
      <div class="card card-pad lg:col-span-2" style="border-color: var(--danger)">
        <div class="card-title" style="color: var(--danger)">{{ lang.t('Danger zone', 'منطقة الخطر') }}</div>
        <p class="text-muted text-[13px]">{{ lang.t('Erase ALL data on this device (clients, accounting, reports…) and return to first-time setup. Download a backup first.', 'مسح كل البيانات على هذا الجهاز (العملاء والمحاسبة والتقارير…) والعودة للإعداد الأولي. حمّل نسخة احتياطية أولًا.') }}</p>
        <div class="flex gap-2">
          <button class="btn" type="button" (click)="backupNow()">{{ lang.t('Download backup first', 'تنزيل نسخة احتياطية أولًا') }}</button>
          <button class="btn btn-danger" type="button" (click)="reset()">{{ lang.t('Erase all data…', 'مسح كل البيانات…') }}</button>
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage {
  protected readonly lang = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  private readonly settings = inject(SettingsService);
  private readonly backup = inject(BackupService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly cfg = APP_CONFIG;
  protected readonly company = signal(this.settings.setup().companyName);

  protected setTheme(t: 'light' | 'dark'): void {
    if (this.theme.theme() !== t) this.theme.toggle();
  }

  protected async saveCompany(): Promise<void> {
    const name = this.company().trim();
    if (!name) return void this.toast.warning(this.lang.t('Company name is required', 'اسم الشركة مطلوب'));
    await this.settings.saveSetup({ ...this.settings.setup(), companyName: name });
    this.toast.success(this.lang.t('Saved', 'تم الحفظ'));
  }

  protected async backupNow(): Promise<void> {
    try {
      await this.backup.exportAndDownload();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  protected async reset(): Promise<void> {
    const r = await this.confirm.ask({ titleEn: 'Erase all data', titleAr: 'مسح كل البيانات', messageEn: 'This permanently deletes everything stored on this device. This cannot be undone.', messageAr: 'سيتم حذف كل ما هو مخزّن على هذا الجهاز نهائيًا. لا يمكن التراجع.', danger: true, requireText: 'RESET', confirmEn: 'Erase everything', confirmAr: 'مسح كل شيء' });
    if (!r.ok) return;
    try {
      await this.backup.resetAll();
      this.toast.success(this.lang.t('All data erased', 'تم مسح كل البيانات'));
      await this.router.navigateByUrl('/setup');
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}
