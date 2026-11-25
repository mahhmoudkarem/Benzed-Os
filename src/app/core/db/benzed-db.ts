import Dexie, { Table } from 'dexie';
import { APP_CONFIG } from '../config/app-config';
import {
  Account,
  Asset,
  CapitalTx,
  FinTransaction,
  FinancialPeriod,
  Invoice,
  JournalEntry,
  JournalLine,
  Payment,
  RecurringExpense,
} from '../models/accounting';
import {
  ActivityRecord,
  AppNotification,
  BackupRecord,
  Campaign,
  Client,
  ClientPackage,
  ContentItem,
  DailyReport,
  Employee,
  PackagePlan,
  PackageUsage,
  Project,
  SettingRecord,
  SocialAccount,
  Task,
  TaskComment,
  TaskHistory,
  WorkSession,
} from '../models/business';

/** يُفعَّل فقط أثناء الاستعادة الكاملة أو المسح الكامل (بعد تأكيد المستخدم) */
export const ledgerGuard = { bypass: false };

/**
 * قاعدة بيانات BENZED OS (IndexedDB عبر Dexie).
 * رقم النسخة لازم يتطابق مع APP_CONFIG.dbVersion. لإضافة تعديلات مستقبلًا:
 *   this.version(2).stores({...}).upgrade(tx => {...})  ثم زوّد APP_CONFIG.dbVersion.
 */
export class BenzedDb extends Dexie {
  settings!: Table<SettingRecord, string>;
  clients!: Table<Client, string>;
  employees!: Table<Employee, string>;
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  taskComments!: Table<TaskComment, string>;
  taskHistory!: Table<TaskHistory, string>;
  workSessions!: Table<WorkSession, string>;
  packages!: Table<PackagePlan, string>;
  clientPackages!: Table<ClientPackage, string>;
  packageUsage!: Table<PackageUsage, string>;
  contentItems!: Table<ContentItem, string>;
  socialAccounts!: Table<SocialAccount, string>;
  campaigns!: Table<Campaign, string>;
  accounts!: Table<Account, string>;
  journalEntries!: Table<JournalEntry, string>;
  journalLines!: Table<JournalLine, string>;
  periods!: Table<FinancialPeriod, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<Payment, string>;
  transactions!: Table<FinTransaction, string>;
  recurringExpenses!: Table<RecurringExpense, string>;
  assets!: Table<Asset, string>;
  capitalTx!: Table<CapitalTx, string>;
  activities!: Table<ActivityRecord, string>;
  notifications!: Table<AppNotification, string>;
  dailyReports!: Table<DailyReport, string>;
  backups!: Table<BackupRecord, string>;

  constructor() {
    super(APP_CONFIG.dbName);

    this.version(1).stores({
      settings: 'key',
      clients: 'id, name, status, accountManagerId, archived',
      employees: 'id, fullName, department, employmentStatus, archived',
      projects: 'id, clientId, status, deadline, archived',
      tasks: 'id, clientId, projectId, assigneeId, status, priority, dueDate',
      taskComments: 'id, taskId',
      taskHistory: 'id, taskId',
      workSessions: 'id, employeeId, taskId, date',
      packages: 'id',
      clientPackages: 'id, clientId, packageId, status',
      packageUsage: 'id, clientPackageId, clientId, month, &[clientPackageId+month]',
      contentItems: 'id, clientId, assigneeId, publishDate, status',
      socialAccounts: 'id, clientId, platform',
      campaigns: 'id, clientId, status, startDate',
      accounts: 'id, &code, type',
      journalEntries: 'id, &number, date, source, sourceId',
      journalLines: 'id, entryId, accountId, date',
      periods: 'id, &key',
      invoices: 'id, &number, clientId, projectId, status, issueDate, dueDate',
      payments: 'id, invoiceId, clientId, date',
      transactions: 'id, type, category, date, clientId, projectId, employeeId, paid',
      recurringExpenses: 'id, active',
      assets: 'id, status',
      capitalTx: 'id, type, date',
      activities: 'id, at, entityType, entityId',
      notifications: 'id, &key, read, at',
      dailyReports: 'id, &date, status',
      backups: 'id, at',
    });

    // القيود المحاسبية المرحّلة لا تُحذف ولا تُعدّل (التصحيح بقيد عكسي فقط).
    // الاستثناء الوحيد: الاستعادة الكاملة/المسح الكامل بعد تأكيد صريح من المستخدم (ledgerGuard.bypass).
    this.journalEntries.hook('deleting', () => {
      if (ledgerGuard.bypass) return;
      throw new Error('Posted journal entries cannot be deleted. Use a reversal entry.');
    });
    this.journalEntries.hook('updating', (mods: any) => {
      if (ledgerGuard.bypass) return undefined;
      const keys = Object.keys(mods || {});
      const allowed = ['reversedBy'];
      if (keys.some((k) => !allowed.includes(k))) {
        throw new Error('Posted journal entries cannot be modified. Use a reversal entry.');
      }
      return undefined;
    });
    this.journalLines.hook('deleting', () => {
      if (ledgerGuard.bypass) return;
      throw new Error('Posted journal lines cannot be deleted. Use a reversal entry.');
    });
    this.journalLines.hook('updating', () => {
      if (ledgerGuard.bypass) return undefined;
      throw new Error('Posted journal lines cannot be modified. Use a reversal entry.');
    });
  }
}

/** كل الجداول اللي بتدخل في النسخ الاحتياطي (بالترتيب) */
export const BACKUP_TABLES = [
  'settings',
  'clients',
  'employees',
  'projects',
  'tasks',
  'taskComments',
  'taskHistory',
  'workSessions',
  'packages',
  'clientPackages',
  'packageUsage',
  'contentItems',
  'socialAccounts',
  'campaigns',
  'accounts',
  'journalEntries',
  'journalLines',
  'periods',
  'invoices',
  'payments',
  'transactions',
  'recurringExpenses',
  'assets',
  'capitalTx',
  'activities',
  'notifications',
  'dailyReports',
] as const;
