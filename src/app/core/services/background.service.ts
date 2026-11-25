import { Injectable, inject } from '@angular/core';
import { AccountingService } from '../accounting/accounting.service';
import { NotificationService } from './notification.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { ToastService } from './toast.service';
import { addMonths, cairoDate } from '../utils/date';

/** مهام الصيانة عند فتح التطبيق وبشكل دوري أثناء كونه مفتوحًا */
@Injectable({ providedIn: 'root' })
export class BackgroundService {
  private readonly accounting = inject(AccountingService);
  private readonly notify = inject(NotificationService);
  private readonly scheduler = inject(ReportSchedulerService);
  private readonly toast = inject(ToastService);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.maintenance();
    this.scheduler.start();
    setInterval(() => void this.maintenance(), 30 * 60_000);
  }

  async maintenance(): Promise<void> {
    try {
      const today = cairoDate();
      const created = await this.accounting.generateRecurring(today);
      const dep = await this.accounting.runDepreciation(addMonths(today.slice(0, 7), -1));
      if (created) this.toast.info('Recurring expenses generated: ' + created);
      if (dep) this.toast.info('Depreciation posted: ' + dep);
      await this.notify.generate();
    } catch (e) {
      console.error('Maintenance failed', e);
    }
  }
}
