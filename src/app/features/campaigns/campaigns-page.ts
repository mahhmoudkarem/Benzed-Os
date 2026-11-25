import { Component, ViewChild, inject, signal } from '@angular/core';
import { EntityPage } from '../../shared/entity/entity-page';
import { PageHeader } from '../../shared/components/page-header';
import { Modal } from '../../shared/components/modal';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { Repositories } from '../../core/repositories/repositories';
import { ToastService } from '../../core/services/toast.service';
import { ActivityService } from '../../core/services/activity.service';
import { BackupService } from '../../core/services/backup.service';
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUS, PLATFORMS } from '../../core/constants/options';
import { campaignConfig } from './campaigns.config';
import { EntityConfig, EntityPageApi } from '../../shared/entity/entity.types';
import { cairoDate } from '../../core/utils/date';

const ALIASES: Record<string, string> = {
  name: 'name', campaign: 'name', 'campaign name': 'name', 'اسم الحملة': 'name', الحملة: 'name',
  client: 'client', 'client name': 'client', العميل: 'client',
  platform: 'platform', المنصة: 'platform',
  objective: 'objective', الهدف: 'objective',
  status: 'status', الحالة: 'status',
  start: 'startDate', 'start date': 'startDate', 'تاريخ البدء': 'startDate',
  end: 'endDate', 'end date': 'endDate', 'تاريخ الانتهاء': 'endDate',
  budget: 'budget', الميزانية: 'budget',
  spend: 'actualSpend', 'actual spend': 'actualSpend', الإنفاق: 'actualSpend',
  audience: 'audience', الجمهور: 'audience',
  reach: 'reach', الوصول: 'reach',
  impressions: 'impressions', 'مرات الظهور': 'impressions',
  clicks: 'clicks', النقرات: 'clicks',
  leads: 'leads', 'العملاء المحتملون': 'leads',
  purchases: 'purchases', المشتريات: 'purchases',
  revenue: 'revenue', الإيراد: 'revenue',
};

@Component({
  selector: 'app-campaigns-page',
  imports: [EntityPage, PageHeader, Modal],
  template: `
    <app-page-header [title]="lang.t('Campaigns', 'الحملات')" [subtitle]="lang.t('Enter metrics manually or import them from Excel. CPM, CPC, CTR, CPL, CPA and ROAS are calculated.', 'أدخل المقاييس يدويًا أو استوردها من إكسل. تُحسب CPM وCPC وCTR وCPL وCPA وROAS تلقائيًا.')" />
    <app-entity-page #page [config]="config" [embedded]="true" />
    @if (report()) {
      <app-modal [title]="lang.t('Excel import result', 'نتيجة الاستيراد من إكسل')" (closed)="report.set(null)">
        <p class="m-0">{{ lang.t('Imported', 'تم استيراد') }}: <b>{{ report()!.ok }}</b> · {{ lang.t('Skipped', 'تم تخطي') }}: <b>{{ report()!.errors.length }}</b></p>
        @if (report()!.errors.length) {
          <ul class="mt-3 text-[13px]" style="color: var(--danger); padding-inline-start: 18px">
            @for (e of report()!.errors; track $index) {<li>{{ e }}</li>}
          </ul>
        }
      </app-modal>
    }
  `,
})
export class CampaignsPage {
  protected readonly lang = inject(LanguageService);
  private readonly repos = inject(Repositories);
  private readonly toast = inject(ToastService);
  private readonly activity = inject(ActivityService);
  private readonly backup = inject(BackupService);
  @ViewChild('page') private page?: EntityPage;

  protected readonly report = signal<{ ok: number; errors: string[] } | null>(null);
  protected readonly config: EntityConfig = {
    ...campaignConfig(),
    toolbar: [
      { icon: 'upload', label: { en: 'Import Excel', ar: 'استيراد إكسل' }, run: (api) => this.pick(api) },
      { icon: 'download', label: { en: 'Template', ar: 'نموذج' }, run: () => this.template() },
    ],
  };

  private async excel(): Promise<any> {
    const mod: any = await import('exceljs');
    return mod.default ?? mod;
  }

  private async template(): Promise<void> {
    try {
      const ExcelJS = await this.excel();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Campaigns');
      const headers = ['name', 'client', 'platform', 'objective', 'status', 'start date', 'end date', 'budget', 'spend', 'audience', 'reach', 'impressions', 'clicks', 'leads', 'purchases', 'revenue'];
      ws.addRow(headers);
      ws.addRow(['Ramadan Offer', 'Client name exactly as saved', 'facebook', 'sales', 'active', cairoDate(), cairoDate(), 5000, 3200, 'Women 22-40 Cairo', 120000, 310000, 4200, 130, 45, 21000]);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((c: any) => (c.width = 18));
      const buf: ArrayBuffer = await wb.xlsx.writeBuffer();
      this.backup.download('campaigns-import-template.xlsx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }

  private pick(api: EntityPageApi): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) void this.importFile(f, api);
    };
    input.click();
  }

  private cellText(v: any): string {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') return String(v.text ?? v.result ?? '');
    return String(v).trim();
  }

  private matchOption(list: { value: string; label: { en: string; ar: string } }[], raw: string): string | undefined {
    const r = raw.toLowerCase();
    return list.find((o) => o.value === r || o.label.en.toLowerCase() === r || o.label.ar === raw)?.value;
  }

  private async importFile(file: File, api: EntityPageApi): Promise<void> {
    const errors: string[] = [];
    let ok = 0;
    try {
      const ExcelJS = await this.excel();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('The workbook is empty.');
      const cols: Record<number, string> = {};
      ws.getRow(1).eachCell((cell: any, n: number) => {
        const key = ALIASES[this.cellText(cell.value).toLowerCase()];
        if (key) cols[n] = key;
      });
      if (!Object.values(cols).includes('name')) throw new Error('Header "name" was not found in the first row.');
      const clients = await this.repos.clients.list();
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const rec: Record<string, any> = {};
        for (const n of Object.keys(cols)) rec[cols[+n]] = this.cellText(row.getCell(+n).value);
        if (!rec['name']) continue;
        const client = clients.find((c) => c.name.toLowerCase() === String(rec['client'] || '').toLowerCase());
        if (!client) {
          errors.push(this.lang.t('Row ', 'صف ') + r + ': ' + this.lang.t('client not found — ', 'العميل غير موجود — ') + (rec['client'] || '∅'));
          continue;
        }
        const platform = this.matchOption(PLATFORMS, String(rec['platform'] || ''));
        if (!platform) {
          errors.push(this.lang.t('Row ', 'صف ') + r + ': ' + this.lang.t('unknown platform', 'منصة غير معروفة'));
          continue;
        }
        const n = (k: string) => Math.max(0, Number(String(rec[k] ?? '').replace(/,/g, '')) || 0);
        const start = /^\d{4}-\d{2}-\d{2}$/.test(rec['startDate']) ? rec['startDate'] : cairoDate();
        const end = /^\d{4}-\d{2}-\d{2}$/.test(rec['endDate']) ? rec['endDate'] : start;
        if (end < start) {
          errors.push(this.lang.t('Row ', 'صف ') + r + ': ' + this.lang.t('end date before start date', 'تاريخ الانتهاء قبل البداية'));
          continue;
        }
        await this.repos.campaigns.create({
          clientId: client.id,
          platform,
          name: rec['name'],
          objective: this.matchOption(CAMPAIGN_OBJECTIVES, String(rec['objective'] || '')) || 'awareness',
          status: this.matchOption(CAMPAIGN_STATUS, String(rec['status'] || '')) || 'draft',
          startDate: start,
          endDate: end,
          budget: n('budget'),
          actualSpend: n('actualSpend'),
          audience: rec['audience'] || '',
          reach: n('reach'),
          impressions: n('impressions'),
          clicks: n('clicks'),
          leads: n('leads'),
          purchases: n('purchases'),
          revenue: n('revenue'),
        });
        ok++;
      }
      await this.activity.log('campaigns_imported', 'campaign', undefined, 'Campaigns imported from Excel: ' + ok, 'تم استيراد حملات من إكسل: ' + ok);
      this.report.set({ ok, errors });
      await api.reload();
    } catch (e: any) {
      console.error(e);
      this.toast.error(this.lang.t('Import failed: ', 'فشل الاستيراد: ') + String(e?.message || e));
    }
  }
}
