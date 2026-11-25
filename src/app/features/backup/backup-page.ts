import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { BackupFile, BackupService, ValidationResult } from '../../core/services/backup.service';
import { DbService } from '../../core/services/db.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ActivityService } from '../../core/services/activity.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { BackupRecord } from '../../core/models/business';
import { PageHeader } from '../../shared/components/page-header';
import { Icon } from '../../shared/components/icon';
import { Badge } from '../../shared/components/badge';

@Component({
  selector: 'app-backup-page',
  imports: [PageHeader, Icon, Badge],
  template: `
    <app-page-header [title]="lang.t('Backup & restore', 'النسخ الاحتياطي والاستعادة')" [subtitle]="lang.t('Database version ', 'نسخة قاعدة البيانات ') + cfg.dbVersion + ' · App ' + cfg.appVersion" />

    <div class="card card-pad mb-3 text-[13px]" style="border-inline-start: 4px solid var(--warning)">
      <b>{{ lang.t('Important', 'مهم') }}</b>
      <div class="text-muted mt-1">{{ lang.t('Your data lives only in this browser on this device (IndexedDB). Clearing site data, changing browser/profile or a disk failure can erase it. Browser storage is not a substitute for external backups — download a backup regularly and keep copies elsewhere.', 'بياناتك محفوظة فقط في هذا المتصفح على هذا الجهاز (IndexedDB). مسح بيانات الموقع أو تغيير المتصفح/الحساب أو عطل القرص قد يمحوها. تخزين المتصفح ليس بديلًا عن النسخ الخارجية — حمّل نسخة احتياطية بانتظام واحفظ نسخًا في مكان آخر.') }}</div>
    </div>

    <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
      <div class="card card-pad">
        <div class="card-title mb-2">{{ lang.t('Export full database', 'تصدير قاعدة البيانات كاملة') }}</div>
        <p class="text-muted text-[13px] mt-0">{{ lang.t('Downloads a JSON file with all your records (Excel report files are regenerable and excluded).', 'ينزّل ملف JSON بكل سجلاتك (ملفات تقارير إكسل يمكن إعادة توليدها وهي مستبعدة).') }}</p>
        <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="exportNow()"><app-icon name="download" [size]="15" /> {{ lang.t('Download backup', 'تنزيل نسخة احتياطية') }}</button>
      </div>

      <div class="card card-pad">
        <div class="card-title mb-2">{{ lang.t('Import / restore', 'استيراد / استعادة') }}</div>
        <input class="input" type="file" accept=".json,application/json" (change)="onFile($any($event.target))" />
        @if (result(); as r) {
          <div class="mt-3 text-[13px]">
            <div class="font-semibold">{{ fileName() }}</div>
            @if (r.ok) {
              <div style="color: var(--success)">✓ {{ lang.t('Backup is valid', 'النسخة الاحتياطية سليمة') }} · {{ lang.t('exported ', 'صُدّرت ') }}{{ lang.dateTime(r.file?.meta?.exportedAt) }} · v{{ r.file?.meta?.dbVersion }}</div>
              <div class="text-muted mt-1">{{ lang.t('Records: ', 'السجلات: ') }}{{ totalRecords() }}</div>
              @for (w of r.warnings; track $index) {<div style="color: var(--warning)">⚠ {{ w }}</div>}
              <div class="flex flex-wrap gap-2 mt-3">
                <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="restore('replace')">{{ lang.t('Replace all data…', 'استبدال كل البيانات…') }}</button>
                <button class="btn" type="button" [disabled]="busy()" (click)="restore('merge')">{{ lang.t('Merge (add missing business records)', 'دمج (إضافة السجلات التجارية الناقصة)') }}</button>
              </div>
              <div class="text-[12px] text-muted mt-2">{{ lang.t('Merge skips records that already exist (no duplicates) and never merges accounting data, to keep the ledger consistent.', 'الدمج يتخطى السجلات الموجودة (بدون تكرار) ولا يدمج بيانات المحاسبة للحفاظ على سلامة الدفتر.') }}</div>
            } @else {
              <div style="color: var(--danger)">✗ {{ lang.t('Backup rejected — nothing was changed:', 'تم رفض النسخة — لم يتغير شيء:') }}</div>
              @for (e of r.errors; track $index) {<div style="color: var(--danger)">• {{ e }}</div>}
            }
          </div>
        }
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-title p-4 pb-2">{{ lang.t('Backup history', 'سجل النسخ الاحتياطي') }}</div>
      @if (!history().length) {
        <div class="px-4 pb-4 text-muted text-[13px]">{{ lang.t('No backups yet. ', 'لا توجد نسخ بعد. ') }}{{ lang.t('Last backup: ', 'آخر نسخة: ') }}{{ lastBackup() ? lang.dateTime(lastBackup()) : lang.t('never', 'لم تتم') }}</div>
      } @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>{{ lang.t('When', 'التاريخ') }}</th><th>{{ lang.t('Action', 'العملية') }}</th><th>{{ lang.t('File', 'الملف') }}</th><th class="num">{{ lang.t('Records', 'السجلات') }}</th></tr></thead>
          <tbody>
            @for (h of history(); track h.id) {
              <tr><td>{{ lang.dateTime(h.at) }}</td>
                <td><app-badge [color]="h.kind === 'export' ? 'green' : h.kind === 'import' ? 'blue' : 'red'">{{ kind(h) }}</app-badge></td>
                <td>{{ h.fileName || '—' }}</td><td class="num">{{ lang.num(h.records) }}</td></tr>
            }
          </tbody>
        </table></div>
      }
    </div>
  `,
})
export class BackupPage implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly backup = inject(BackupService);
  private readonly db = inject(DbService).db;
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);

  protected readonly cfg = APP_CONFIG;
  protected readonly busy = signal(false);
  protected readonly result = signal<ValidationResult | null>(null);
  protected readonly fileName = signal('');
  protected readonly history = signal<BackupRecord[]>([]);
  protected readonly lastBackup = signal('');
  protected readonly totalRecords = computed(() => Object.values(this.result()?.counts || {}).reduce((a, b) => a + b, 0));

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.history.set((await this.db.backups.toArray()).sort((a, b) => b.at.localeCompare(a.at)));
    const r = await this.db.settings.get('lastBackupAt');
    this.lastBackup.set(r?.value || '');
  }

  protected kind(h: BackupRecord): string {
    return h.kind === 'export' ? this.lang.t('Export', 'تصدير') : h.kind === 'import' ? this.lang.t('Restore (', 'استعادة (') + (h.note === 'merge' ? this.lang.t('merge', 'دمج') : this.lang.t('replace', 'استبدال')) + ')' : this.lang.t('Reset', 'مسح كامل');
  }

  protected async exportNow(): Promise<void> {
    this.busy.set(true);
    try {
      const name = await this.backup.exportAndDownload();
      this.toast.success(this.lang.t('Backup downloaded: ', 'تم تنزيل النسخة: ') + name);
      await this.load();
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async onFile(input: HTMLInputElement): Promise<void> {
    const f = input.files?.[0];
    if (!f) return;
    this.fileName.set(f.name);
    try {
      this.result.set(this.backup.validate(await f.text()));
    } catch (e: any) {
      this.result.set({ ok: false, errors: [String(e?.message || e)], warnings: [], counts: {} });
    }
  }

  protected async restore(mode: 'replace' | 'merge'): Promise<void> {
    const file: BackupFile | undefined = this.result()?.file;
    if (!file) return;
    const name = this.fileName();
    const r = await this.confirm.ask({
      titleEn: mode === 'replace' ? 'Replace ALL current data?' : 'Merge backup into current data?',
      titleAr: mode === 'replace' ? 'استبدال كل البيانات الحالية؟' : 'دمج النسخة في البيانات الحالية؟',
      messageEn: mode === 'replace' ? 'All current records will be erased and replaced by the backup. A safety backup of the current data will be downloaded first.' : 'Missing business records from the backup will be added. Existing records are kept.',
      messageAr: mode === 'replace' ? 'سيتم مسح كل السجلات الحالية واستبدالها بالنسخة. سيتم تنزيل نسخة أمان من البيانات الحالية أولًا.' : 'ستُضاف السجلات التجارية الناقصة من النسخة. السجلات الموجودة تبقى كما هي.',
      danger: mode === 'replace',
      requireText: mode === 'replace' ? 'RESTORE' : undefined,
      confirmEn: mode === 'replace' ? 'Replace data' : 'Merge',
      confirmAr: mode === 'replace' ? 'استبدال البيانات' : 'دمج',
    });
    if (!r.ok) return;
    this.busy.set(true);
    try {
      if (mode === 'replace') {
        await this.backup.exportAndDownload(); // نسخة أمان قبل الاستبدال
        const n = await this.backup.restoreReplace(file, name);
        await this.activity.log('restore', 'system', undefined, 'Database restored from backup (' + n + ' records)', 'تمت استعادة قاعدة البيانات من نسخة احتياطية (' + n + ' سجل)');
        this.toast.success(this.lang.t('Restore completed: ', 'اكتملت الاستعادة: ') + n);
      } else {
        const m = await this.backup.restoreMerge(file, name);
        this.toast.success(this.lang.t('Merged: added ', 'تم الدمج: أُضيف ') + m.added + this.lang.t(', skipped ', '، وتم تخطي ') + m.skipped);
      }
      this.result.set(null);
      await this.load();
    } catch (e: any) {
      console.error(e);
      this.toast.error(this.lang.t('Restore failed: ', 'فشلت الاستعادة: ') + String(e?.message || e));
    } finally {
      this.busy.set(false);
    }
  }
}
