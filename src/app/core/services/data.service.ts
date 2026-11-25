import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { SettingsService } from './settings.service';
import { Snapshot } from '../accounting/snapshot';
import { cairoDate } from '../utils/date';

/** بيحمّل لقطة كاملة من البيانات للحسابات والتحليل (الحجم صغير لأن التطبيق على جهاز واحد) */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly db = inject(DbService).db;
  private readonly settings = inject(SettingsService);

  async snapshot(): Promise<Snapshot> {
    const [accounts, lines, entries, invoices, payments, transactions, assets, capital, recurring, clients, employees, projects, tasks, campaigns, content] = await Promise.all([
      this.db.accounts.toArray(),
      this.db.journalLines.toArray(),
      this.db.journalEntries.toArray(),
      this.db.invoices.toArray(),
      this.db.payments.toArray(),
      this.db.transactions.toArray(),
      this.db.assets.toArray(),
      this.db.capitalTx.toArray(),
      this.db.recurringExpenses.toArray(),
      this.db.clients.toArray(),
      this.db.employees.toArray(),
      this.db.projects.toArray(),
      this.db.tasks.toArray(),
      this.db.campaigns.toArray(),
      this.db.contentItems.toArray(),
    ]);
    return {
      today: cairoDate(),
      setupDate: this.settings.setup().completedAt || cairoDate(),
      accounts,
      lines,
      entries,
      invoices,
      payments,
      transactions,
      assets,
      capital,
      recurring,
      clients,
      employees,
      projects,
      tasks,
      campaigns,
      content,
    };
  }
}
