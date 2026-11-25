import { Injectable, inject } from '@angular/core';
import { DbService } from '../services/db.service';
import { Repo } from './base.repository';

@Injectable({ providedIn: 'root' })
export class Repositories {
  private readonly d = inject(DbService).db;

  readonly clients = new Repo(this.d.clients);
  readonly employees = new Repo(this.d.employees);
  readonly projects = new Repo(this.d.projects);
  readonly tasks = new Repo(this.d.tasks);
  readonly taskComments = new Repo(this.d.taskComments);
  readonly taskHistory = new Repo(this.d.taskHistory);
  readonly workSessions = new Repo(this.d.workSessions);
  readonly packages = new Repo(this.d.packages);
  readonly clientPackages = new Repo(this.d.clientPackages);
  readonly packageUsage = new Repo(this.d.packageUsage);
  readonly contentItems = new Repo(this.d.contentItems);
  readonly socialAccounts = new Repo(this.d.socialAccounts);
  readonly campaigns = new Repo(this.d.campaigns);
  readonly invoices = new Repo(this.d.invoices);
  readonly payments = new Repo(this.d.payments);
  readonly transactions = new Repo(this.d.transactions);
  readonly recurringExpenses = new Repo(this.d.recurringExpenses);
  readonly assets = new Repo(this.d.assets);
  readonly capitalTx = new Repo(this.d.capitalTx);
  readonly activities = new Repo(this.d.activities);
  readonly notifications = new Repo(this.d.notifications);
  readonly dailyReports = new Repo(this.d.dailyReports);
  readonly backups = new Repo(this.d.backups);

  /** جدول بالاسم (للـ lookups العامة في الفورم) */
  table(name: string) {
    return (this.d as any)[name];
  }
}
