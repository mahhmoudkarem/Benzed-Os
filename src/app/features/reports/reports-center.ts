import { Component, OnInit, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DbService } from '../../core/services/db.service';
import { SettingsService } from '../../core/services/settings.service';
import { ReportSchedulerService } from '../../core/services/report-scheduler.service';
import { BackupService } from '../../core/services/backup.service';
import { ToastService } from '../../core/services/toast.service';
import { DailyReport } from '../../core/models/business';
import { cairoDate } from '../../core/utils/date';
import { PageHeader } from '../../shared/components/page-header';
import { Badge } from '../../shared/components/badge';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-reports-center',
  imports: [PageHeader, Badge, Icon, EmptyState, Loading],
  template: `
    <app-page-header [title]="lang.t('Reports center', 'مركز التقارير')" [subtitle]="lang.t('Daily Excel reports — report date uses Africa/Cairo time.', 'تقارير إكسل يومية — تاريخ التقرير بتوقيت القاهرة.')" />

    <div class="card card-pad mb-3 text-[13px]" style="border-inline-start: 4px solid var(--warning)">
      <b>{{ lang.t('How scheduling works', 'كيف تعمل الجدولة') }}</b>
      <div class="text-muted mt-1">
        {{ lang.t('This is a frontend-only app: reports are generated only while BENZED OS is open. After midnight (Cairo) the report for the finished day is generated automatically. When you open the app, any missed days are generated (up to 31 days). One report per date; nothing runs while the browser is closed.', 'هذا تطبيق واجهة فقط: التقارير تُنشأ فقط أثناء فتح BENZED OS. بعد منتصف الليل (بتوقيت القاهرة) يُنشأ تقرير اليوم المنتهي تلقائيًا. عند فتح التطبيق تُنشأ الأيام الفائتة (حتى 31 يومًا). تقرير واحد لكل تاريخ؛ ولا يعمل شيء والمتصفح مغلق.') }}
      </div>
    </div>

    <div class="card card-pad mb-3 flex flex-wrap items-center gap-3">
      <label class="flex items-center gap-2 text-[13px]"><input type="checkbox" [checked]="enabled()" (change)="toggle($any($event.target).checked)" /> {{ lang.t('Automatic daily generation', 'الإنشاء اليومي التلقائي') }}</label>
      <div class="flex-1"></div>
      <input class="input" style="width: auto" type="date" [value]="date()" [max]="today" (change)="date.set($any($event.target).value)" />
      <button class="btn btn-primary" type="button" [disabled]="scheduler.running()" (click)="generate(date())"><app-icon name="file" [size]="15" /> {{ lang.t('Generate for this date', 'إنشاء لهذا التاريخ') }}</button>
      <button class="btn" type="button" [disabled]="scheduler.running()" (click)="check()"><app-icon name="refresh" [size]="15" /> {{ lang.t('Check missed days', 'فحص الأيام الفائتة') }}</button>
    </div>

    <div class="card">
      <div class="card-title p-4 pb-2">{{ lang.t('Report history', 'سجل التقارير') }}</div>
      @if (loading()) { <app-loading /> }
      @else if (!reports().length) { <app-empty-state icon="file" [title]="lang.t('No reports yet', 'لا توجد تقارير بعد')" [text]="lang.t('The first report is generated after the first midnight, or generate one now.', 'يُنشأ أول تقرير بعد أول منتصف ليل، أو أنشئ واحدًا الآن.')" /> }
      @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('Report date', 'تاريخ التقرير') }}</th><th>{{ lang.t('Status', 'الحالة') }}</th><th>{{ lang.t('Trigger', 'السبب') }}</th><th>{{ lang.t('Language', 'اللغة') }}</th><th>{{ lang.t('Generated at', 'وقت الإنشاء') }}</th><th class="num">{{ lang.t('Size', 'الحجم') }}</th><th></th></tr></thead>
          <tbody>
            @for (r of reports(); track r.id) {
              <tr>
                <td><b>{{ lang.date(r.date) }}</b> @if (r.partial) {<app-badge color="amber">{{ lang.t('Partial day', 'يوم جزئي') }}</app-badge>}</td>
                <td>@if (r.status === 'generated') {<app-badge color="green">{{ lang.t('Generated', 'تم الإنشاء') }}</app-badge>} @else {<app-badge color="red">{{ lang.t('Failed', 'فشل') }}</app-badge> <span class="text-[12px] text-muted">{{ r.error }}</span>}</td>
                <td>{{ trigger(r.trigger) }}</td>
                <td>{{ r.lang === 'ar' ? 'العربية' : 'English' }}</td>
                <td>{{ lang.dateTime(r.generatedAt) }}</td>
                <td class="num">{{ lang.num(r.size / 1024, 0) }} KB</td>
                <td>
                  <div class="flex justify-end gap-1">
                    @if (r.status === 'generated' && r.data) {<button class="btn btn-sm" type="button" (click)="download(r)"><app-icon name="download" [size]="14" /> {{ lang.t('Excel', 'إكسل') }}</button>}
                    <button class="btn btn-sm" type="button" [disabled]="scheduler.running()" (click)="generate(r.date)"><app-icon name="refresh" [size]="14" /> {{ lang.t('Regenerate', 'إعادة إنشاء') }}</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </div>
  `,
})
export class ReportsCenter implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly db = inject(DbService).db;
  private readonly settings = inject(SettingsService);
  protected readonly scheduler = inject(ReportSchedulerService);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);

  protected readonly today = cairoDate();
  protected readonly loading = signal(true);
  protected readonly reports = signal<DailyReport[]>([]);
  protected readonly enabled = signal(true);
  protected readonly date = signal(cairoDate());

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const list = await this.db.dailyReports.toArray();
    this.reports.set(list.sort((a, b) => b.date.localeCompare(a.date)));
    this.enabled.set(await this.settings.get<boolean>('reports.enabled', true));
    this.loading.set(false);
  }

  protected trigger(t: string): string {
    return t === 'manual' ? this.lang.t('Manual', 'يدوي') : t === 'catchup' ? this.lang.t('Missed day (catch-up)', 'يوم فائت') : this.lang.t('Automatic', 'تلقائي');
  }

  protected async toggle(v: boolean): Promise<void> {
    this.enabled.set(v);
    await this.settings.set('reports.enabled', v);
  }

  protected async generate(date: string): Promise<void> {
    if (!date) return;
    const ok = await this.scheduler.generate(date, 'manual');
    if (ok) this.toast.success(this.lang.t('Report generated', 'تم إنشاء التقرير'));
    else this.toast.error(this.lang.t('Report generation failed — see history', 'فشل إنشاء التقرير — راجع السجل'));
    await this.load();
  }

  protected async check(): Promise<void> {
    await this.scheduler.check();
    await this.load();
    this.toast.info(this.lang.t('Check finished', 'اكتمل الفحص'));
  }

  protected download(r: DailyReport): void {
    if (!r.data) return;
    this.backup.download(r.fileName, new Blob([r.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }
}
