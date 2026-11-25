import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { SettingsService } from './settings.service';
import { SeedService } from './seed.service';
import { APP_CONFIG } from '../config/app-config';
import { BACKUP_TABLES, ledgerGuard } from '../db/benzed-db';
import { cairoDate, isoNow } from '../utils/date';
import { uid } from '../utils/id';
import { toCents } from '../utils/money';

export interface BackupFile {
  meta: {
    app: string;
    dbVersion: number;
    appVersion: string;
    exportedAt: string;
    counts: Record<string, number>;
  };
  data: Record<string, any[]>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: Record<string, number>;
  file?: BackupFile;
}

const BUSINESS_MERGE_TABLES = ['clients', 'employees', 'projects', 'tasks', 'taskComments', 'taskHistory', 'workSessions', 'packages', 'clientPackages', 'packageUsage', 'contentItems', 'socialAccounts', 'campaigns', 'activities'];

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(DbService).db;
  private readonly settings = inject(SettingsService);
  private readonly seed = inject(SeedService);

  async buildExport(): Promise<{ json: string; counts: Record<string, number>; records: number }> {
    const data: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    for (const name of BACKUP_TABLES) {
      let rows: any[] = await (this.db as any)[name].toArray();
      if (name === 'dailyReports') rows = rows.map((r) => ({ ...r, data: undefined })); // ملفات الإكسل تُعاد توليدها
      data[name] = rows;
      counts[name] = rows.length;
    }
    const file: BackupFile = {
      meta: { app: APP_CONFIG.name, dbVersion: APP_CONFIG.dbVersion, appVersion: APP_CONFIG.appVersion, exportedAt: isoNow(), counts },
      data,
    };
    return { json: JSON.stringify(file), counts, records: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  async exportAndDownload(): Promise<string> {
    const { json, records } = await this.buildExport();
    const fileName = 'BENZED-OS-backup-' + cairoDate() + '-' + new Date().toISOString().slice(11, 19).replace(/:/g, '') + '.json';
    this.download(fileName, new Blob([json], { type: 'application/json' }));
    const now = isoNow();
    await this.db.backups.add({ id: uid(), kind: 'export', fileName, size: json.length, at: now, note: '', records, createdAt: now, updatedAt: now });
    await this.settings.set('lastBackupAt', now);
    return fileName;
  }

  download(fileName: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** التحقق من هيكل الملف ونسخة قاعدة البيانات وسلامة العلاقات والقيود */
  validate(text: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let file: BackupFile;
    try {
      file = JSON.parse(text);
    } catch {
      return { ok: false, errors: ['The file is not valid JSON.'], warnings, counts: {} };
    }
    if (!file || typeof file !== 'object' || !file.meta || !file.data) return { ok: false, errors: ['Missing "meta" or "data" sections.'], warnings, counts: {} };
    if (file.meta.app !== APP_CONFIG.name) errors.push('This file was not created by ' + APP_CONFIG.name + '.');
    if (typeof file.meta.dbVersion !== 'number') errors.push('Missing database version.');
    else if (file.meta.dbVersion > APP_CONFIG.dbVersion) errors.push('Backup database version (' + file.meta.dbVersion + ') is newer than this app supports (' + APP_CONFIG.dbVersion + ').');
    else if (file.meta.dbVersion < APP_CONFIG.dbVersion) warnings.push('Backup is from an older database version and will be imported as-is.');

    const counts: Record<string, number> = {};
    for (const name of BACKUP_TABLES) {
      const rows = file.data[name];
      if (rows === undefined) {
        warnings.push('Table "' + name + '" is missing in the backup.');
        counts[name] = 0;
        continue;
      }
      if (!Array.isArray(rows)) {
        errors.push('Table "' + name + '" is not a list.');
        continue;
      }
      counts[name] = rows.length;
      const key = name === 'settings' ? 'key' : 'id';
      const seen = new Set<string>();
      for (const r of rows) {
        if (!r || typeof r !== 'object' || typeof r[key] !== 'string') {
          errors.push('Table "' + name + '" has a record without a valid "' + key + '".');
          break;
        }
        if (seen.has(r[key])) {
          errors.push('Table "' + name + '" has duplicate id ' + r[key] + '.');
          break;
        }
        seen.add(r[key]);
      }
    }
    if (errors.length) return { ok: false, errors, warnings, counts };

    // سلامة دفتر الأستاذ
    const entries: any[] = file.data['journalEntries'] || [];
    const lines: any[] = file.data['journalLines'] || [];
    const entryIds = new Set(entries.map((e) => e.id));
    const sums = new Map<string, number>();
    for (const l of lines) {
      if (!entryIds.has(l.entryId)) {
        errors.push('Journal line references a missing entry (' + l.entryId + ').');
        break;
      }
      sums.set(l.entryId, (sums.get(l.entryId) || 0) + toCents(l.debit) - toCents(l.credit));
    }
    sums.forEach((v, id) => {
      if (v !== 0 && errors.length < 5) errors.push('Journal entry ' + id + ' is not balanced (debits ≠ credits).');
    });
    const accIds = new Set((file.data['accounts'] || []).map((a: any) => a.id));
    if (lines.some((l) => !accIds.has(l.accountId))) errors.push('Some journal lines reference accounts that are not in the backup.');

    // العلاقات
    const ids = (t: string) => new Set((file.data[t] || []).map((r: any) => r.id));
    const invIds = ids('invoices');
    const clientIds = ids('clients');
    if ((file.data['payments'] || []).some((p: any) => !invIds.has(p.invoiceId))) warnings.push('Some payments reference missing invoices.');
    if ((file.data['invoices'] || []).some((i: any) => !clientIds.has(i.clientId))) warnings.push('Some invoices reference missing clients.');
    if ((file.data['projects'] || []).some((p: any) => p.clientId && !clientIds.has(p.clientId))) warnings.push('Some projects reference missing clients.');

    return { ok: errors.length === 0, errors, warnings, counts, file };
  }

  /** استعادة كاملة: بتمسح كل البيانات الحالية وتستبدلها (داخل transaction واحدة) */
  async restoreReplace(file: BackupFile, fileName: string): Promise<number> {
    let total = 0;
    ledgerGuard.bypass = true;
    try {
      await this.db.transaction('rw', this.db.tables, async () => {
        for (const name of BACKUP_TABLES) {
          const table = (this.db as any)[name];
          await table.clear();
          const rows = file.data[name] || [];
          if (rows.length) await table.bulkPut(rows);
          total += rows.length;
        }
      });
    } finally {
      ledgerGuard.bypass = false;
    }
    await this.settings.load();
    const now = isoNow();
    await this.db.backups.add({ id: uid(), kind: 'import', fileName, size: 0, at: now, note: 'replace', records: total, createdAt: now, updatedAt: now });
    return total;
  }

  /** دمج: بيضيف السجلات التجارية الناقصة فقط (بدون تكرار). بيانات المحاسبة لا تُدمج للحفاظ على سلامة الدفتر. */
  async restoreMerge(file: BackupFile, fileName: string): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const name of BUSINESS_MERGE_TABLES) {
        const table = (this.db as any)[name];
        const rows: any[] = file.data[name] || [];
        const existing = new Set((await table.toCollection().primaryKeys()) as string[]);
        const fresh = rows.filter((r) => !existing.has(r.id));
        skipped += rows.length - fresh.length;
        if (fresh.length) await table.bulkAdd(fresh);
        added += fresh.length;
      }
    });
    const now = isoNow();
    await this.db.backups.add({ id: uid(), kind: 'import', fileName, size: 0, at: now, note: 'merge', records: added, createdAt: now, updatedAt: now });
    return { added, skipped };
  }

  /** مسح كل البيانات (يبقي سجل النسخ الاحتياطية) ثم إعادة تهيئة دليل الحسابات */
  async resetAll(): Promise<void> {
    ledgerGuard.bypass = true;
    try {
      await this.db.transaction('rw', this.db.tables, async () => {
        for (const name of BACKUP_TABLES) await (this.db as any)[name].clear();
      });
    } finally {
      ledgerGuard.bypass = false;
    }
    await this.seed.ensureAccounts();
    await this.settings.load();
    const now = isoNow();
    await this.db.backups.add({ id: uid(), kind: 'reset', fileName: '', size: 0, at: now, note: 'reset', records: 0, createdAt: now, updatedAt: now });
  }
}
