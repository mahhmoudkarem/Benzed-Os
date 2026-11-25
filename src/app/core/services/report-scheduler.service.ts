import { Injectable, inject, signal } from '@angular/core';
import { DbService } from './db.service';
import { SettingsService } from './settings.service';
import { ReportService } from './report.service';
import { LanguageService } from './LanguageService/language-service';
import { NotificationService } from './notification.service';
import { ActivityService } from './activity.service';
import { addDays, cairoDate, datesList, isoNow } from '../utils/date';
import { uid } from '../utils/id';
import { fmt } from '../utils/format';

/**
 * جدولة التقارير اليومية (محلية).
 * مهم: ده مش scheduler في الخلفية. التقارير بتتولّد فقط لما التطبيق يكون مفتوح:
 *  - عند فتح التطبيق: بنكتشف الأيام الفايتة (من تاريخ الإعداد لحد أمس) ونولّدها.
 *  - والتطبيق مفتوح: كل دقيقة بنقارن تاريخ القاهرة، ولما اليوم يتغير (بعد 00:00) نولّد تقرير اليوم اللي خلص.
 * منع التكرار: فهرس فريد على التاريخ + قفل بين التبويبات + فحص قبل التوليد.
 */
@Injectable({ providedIn: 'root' })
export class ReportSchedulerService {
  private readonly db = inject(DbService).db;
  private readonly settings = inject(SettingsService);
  private readonly reports = inject(ReportService);
  private readonly lang = inject(LanguageService);
  private readonly notify = inject(NotificationService);
  private readonly activity = inject(ActivityService);

  readonly running = signal(false);
  readonly lastCheck = signal<string>('');
  private started = false;
  private busy = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.check();
    setInterval(() => void this.check(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check();
    });
  }

  async check(): Promise<void> {
    if (this.busy) return;
    const enabled = await this.settings.get<boolean>('reports.enabled', true);
    if (!enabled) return;
    this.busy = true;
    try {
      const nav: any = navigator;
      if (nav.locks && typeof nav.locks.request === 'function') {
        await nav.locks.request('benzed-report-scheduler', { ifAvailable: true }, async (lock: any) => {
          if (lock) await this.catchUp();
        });
      } else {
        await this.catchUp();
      }
    } catch (e) {
      console.error('Report scheduler error', e);
    } finally {
      this.busy = false;
      this.lastCheck.set(new Date().toISOString());
    }
  }

  /** يولّد كل التقارير الناقصة من تاريخ الإعداد (بحد أقصى 31 يوم) حتى أمس بتوقيت القاهرة */
  private async catchUp(): Promise<void> {
    const today = cairoDate();
    const yesterday = addDays(today, -1);
    const setup = this.settings.setup().completedAt || today;
    const earliest = addDays(today, -31);
    const from = setup > earliest ? setup : earliest;
    if (from > yesterday) return;
    const have = new Set((await this.db.dailyReports.toArray()).filter((r) => r.status === 'generated').map((r) => r.date));
    const missing = datesList(from, yesterday).filter((d) => !have.has(d));
    for (const d of missing) {
      const trigger = missing.length > 1 || d !== yesterday ? 'catchup' : 'auto';
      await this.generate(d, trigger);
    }
  }

  /** توليد (أو إعادة توليد) تقرير لتاريخ معين. التاريخ الواحد = تقرير واحد دائمًا. */
  async generate(date: string, trigger: 'auto' | 'catchup' | 'manual'): Promise<boolean> {
    this.running.set(true);
    try {
      const lang = this.lang.lang();
      const existing = await this.db.dailyReports.where('date').equals(date).first();
      const now = isoNow();
      try {
        const { buffer, fileName, partial } = await this.reports.build(date, lang);
        const rec = {
          id: existing?.id || uid(),
          date,
          status: 'generated' as const,
          trigger,
          lang,
          fileName,
          size: buffer.byteLength,
          partial,
          error: undefined,
          generatedAt: now,
          data: buffer,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await this.db.dailyReports.put(rec);
        await this.notify.add({
          key: 'report:' + date + ':' + now.slice(0, 16),
          kind: 'daily_report',
          severity: 'info',
          titleEn: 'Daily report generated',
          titleAr: 'تم إنشاء التقرير اليومي',
          bodyEn: 'Report for ' + fmt.date(date, 'en') + (trigger === 'catchup' ? ' (missed day, generated on open)' : ''),
          bodyAr: 'تقرير ' + fmt.date(date, 'ar') + (trigger === 'catchup' ? ' (يوم فائت، تم إنشاؤه عند الفتح)' : ''),
          link: '/reports',
        });
        await this.notify.refreshCount();
        await this.activity.log('report_generated', 'report', rec.id, 'Daily report generated for ' + date, 'تم إنشاء التقرير اليومي بتاريخ ' + date);
        return true;
      } catch (e: any) {
        console.error('Report generation failed', e);
        const rec = {
          id: existing?.id || uid(),
          date,
          status: 'failed' as const,
          trigger,
          lang,
          fileName: existing?.fileName || '',
          size: existing?.size || 0,
          partial: false,
          error: String(e?.message || e),
          generatedAt: now,
          data: existing?.data,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await this.db.dailyReports.put(rec);
        return false;
      }
    } finally {
      this.running.set(false);
    }
  }
}
