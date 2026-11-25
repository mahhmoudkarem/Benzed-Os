import { Injectable, inject } from '@angular/core';
import { DataService } from './data.service';
import { SettingsService } from './settings.service';
import { Lang, fmt } from '../utils/format';
import { analyze } from '../intelligence/analyzer';
import { computeDaily } from '../accounting/daily-report.data';
import { Snapshot } from '../accounting/snapshot';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PLATFORMS } from '../constants/options';
import { optionLabel } from '../constants/options';
import { APP_CONFIG } from '../config/app-config';

/**
 * بناء ملف Excel للتقرير اليومي (5 أوراق). ExcelJS بيتحمّل ديناميكيًا عشان ما يتقلش الـ bundle الأساسي.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly data = inject(DataService);
  private readonly settings = inject(SettingsService);

  async build(date: string, lang: Lang): Promise<{ buffer: ArrayBuffer; fileName: string; partial: boolean }> {
    const snap: Snapshot = await this.data.snapshot();
    const s: Snapshot = date <= snap.today ? { ...snap, today: date } : snap; // أرقام "اليوم" محسوبة كأن التاريخ هو يوم التقرير
    const d = computeDaily(s, date);
    const target = await this.settings.get<number>('profitTarget', 0);
    const insights = analyze(s, target);
    const company = this.settings.setup().companyName || APP_CONFIG.company;

    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const ar = lang === 'ar';
    const L = (en: string, a: string) => (ar ? a : en);
    const MONEY = ar ? '#,##0.00 "ج.م"' : '"EGP" #,##0.00';
    const wb = new ExcelJS.Workbook();
    wb.creator = APP_CONFIG.name;
    wb.created = new Date();

    const NAVY = 'FF1E1B4B';
    const HEAD = 'FF4F46E5';
    const SOFT = 'FFEEF2FF';
    const toDate = (x: string) => {
      const [y, m, dd] = x.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, dd));
    };

    const sheet = (name: string, widths: number[]) => {
      const ws = wb.addWorksheet(name, { views: [{ rightToLeft: ar, showGridLines: false }] });
      ws.columns = widths.map((w) => ({ width: w }));
      return ws;
    };
    const title = (ws: any, text: string, sub: string, cols: number) => {
      ws.mergeCells(1, 1, 1, cols);
      const c = ws.getCell(1, 1);
      c.value = text;
      c.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      c.alignment = { vertical: 'middle', horizontal: ar ? 'right' : 'left' };
      ws.getRow(1).height = 30;
      ws.mergeCells(2, 1, 2, cols);
      const c2 = ws.getCell(2, 1);
      c2.value = sub;
      c2.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
      c2.alignment = { horizontal: ar ? 'right' : 'left' };
      return 4;
    };
    const section = (ws: any, row: number, text: string, cols: number) => {
      ws.mergeCells(row, 1, row, cols);
      const c = ws.getCell(row, 1);
      c.value = text;
      c.font = { bold: true, size: 12, color: { argb: HEAD } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      c.alignment = { horizontal: ar ? 'right' : 'left' };
      return row + 1;
    };
    /** formats: صيغة كل عمود ('money' | 'date' | 'pct' | 'int' | undefined) */
    const table = (ws: any, row: number, headers: string[], rows: any[][], formats: (string | undefined)[], totals?: number[]) => {
      headers.forEach((h, i) => {
        const c = ws.getCell(row, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFC7D2FE' } } };
      });
      let r = row + 1;
      if (!rows.length) {
        ws.mergeCells(r, 1, r, headers.length);
        ws.getCell(r, 1).value = L('No records', 'لا توجد سجلات');
        ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF94A3B8' } };
        return r + 2;
      }
      const first = r;
      for (const rowVals of rows) {
        rowVals.forEach((v, i) => {
          const c = ws.getCell(r, i + 1);
          const f = formats[i];
          if (f === 'date' && typeof v === 'string' && v) {
            c.value = toDate(v);
            c.numFmt = 'yyyy-mm-dd';
          } else {
            c.value = v;
            if (f === 'money') c.numFmt = MONEY;
            if (f === 'pct') c.numFmt = '0.0"%"';
            if (f === 'int') c.numFmt = '#,##0';
          }
          c.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
          if (r % 2 === 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
        r++;
      }
      if (totals && totals.length) {
        const tr = r;
        ws.getCell(tr, 1).value = L('Total', 'الإجمالي');
        ws.getCell(tr, 1).font = { bold: true };
        for (const ci of totals) {
          const col = String.fromCharCode(65 + ci);
          const c = ws.getCell(tr, ci + 1);
          c.value = { formula: `SUM(${col}${first}:${col}${r - 1})` };
          c.numFmt = formats[ci] === 'money' ? MONEY : '#,##0';
          c.font = { bold: true };
        }
        for (let i = 1; i <= headers.length; i++) ws.getCell(tr, i).border = { top: { style: 'thin', color: { argb: NAVY } } };
        r++;
      }
      return r + 1;
    };
    const kv = (ws: any, row: number, label: string, vals: any[], fmtStr: string | undefined, bold = false) => {
      ws.getCell(row, 1).value = label;
      vals.forEach((v, i) => {
        const c = ws.getCell(row, i + 2);
        c.value = v;
        if (fmtStr) c.numFmt = fmtStr;
        if (bold) c.font = { bold: true };
      });
      if (bold) ws.getCell(row, 1).font = { bold: true };
      for (let i = 1; i <= vals.length + 1; i++) ws.getCell(row, i).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      return row + 1;
    };

    const dateLabel = fmt.date(date, lang);
    const sub = (d.partial ? L('PARTIAL day — report generated before the day ended · ', 'يوم جزئي — التقرير أُنشئ قبل نهاية اليوم · ') : '') +
      L('Reporting date: ', 'تاريخ التقرير: ') + dateLabel + ' · ' + L('Timezone: ', 'المنطقة الزمنية: ') + APP_CONFIG.timezone + ' · ' + L('Generated: ', 'تاريخ الإنشاء: ') + fmt.dateTime(new Date().toISOString(), lang);

    // ---------------- 1) الملخص المالي
    {
      const ws = sheet(L('Financial Summary', 'الملخص المالي'), [44, 22, 22, 22]);
      let r = title(ws, company + ' — ' + L('Daily Financial Summary', 'الملخص المالي اليومي'), sub, 4);
      r = section(ws, r, L('Accrual basis (revenue when earned, expenses when incurred)', 'أساس الاستحقاق (الإيراد عند الاستحقاق والمصروف عند حدوثه)'), 4);
      [L('Metric', 'البند'), L('Day', 'اليوم'), L('Month to date', 'الشهر حتى اليوم')].forEach((h, i) => {
        const c = ws.getCell(r, i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
        c.alignment = { horizontal: 'center' };
      });
      r += 1;
      r = kv(ws, r, L('Total Revenue', 'إجمالي الإيرادات'), [d.fin.dayRevenue, d.fin.mtdRevenue], MONEY);
      r = kv(ws, r, L('Total Expenses', 'إجمالي المصروفات'), [d.fin.dayExpenses, d.fin.mtdExpenses], MONEY);
      r = kv(ws, r, L('Net Profit', 'صافي الربح'), [d.fin.dayNet, d.fin.mtdNet], MONEY, true);
      r += 1;
      r = section(ws, r, L('Cash basis (money actually received / paid)', 'الأساس النقدي (الأموال المستلمة / المدفوعة فعليًا)'), 4);
      r = kv(ws, r, L('Cash received (excl. tax)', 'النقدية المستلمة (بدون الضريبة)'), [d.fin.dayCashIn, d.fin.mtdCashIn], MONEY);
      r = kv(ws, r, L('Cash paid (expenses)', 'النقدية المدفوعة (مصروفات)'), [d.fin.dayCashOut, d.fin.mtdCashOut], MONEY);
      r = kv(ws, r, L('Net cash result', 'صافي النتيجة النقدية'), [d.fin.dayCashNet, d.fin.mtdCashNet], MONEY, true);
      r = kv(ws, r, L('Cash Flow (all cash movements, ledger)', 'التدفق النقدي (كل حركات النقدية - دفتر الأستاذ)'), [d.fin.dayLedgerCashChange], MONEY);
      r += 1;
      r = section(ws, r, L('Position at end of day', 'المركز في نهاية اليوم'), 4);
      r = kv(ws, r, L('Cash Balance', 'رصيد النقدية'), [d.fin.cashBalance], MONEY, true);
      r = kv(ws, r, L('Outstanding Invoices (receivable)', 'الفواتير المستحقة (العملاء)'), [d.fin.outstanding], MONEY, true);
      r += 1;
      r = section(ws, r, L('New Payments', 'المدفوعات الجديدة'), 4);
      r = table(ws, r, [L('Payment', 'الدفعة'), L('Client / Invoice', 'العميل / الفاتورة'), L('Method', 'الطريقة'), L('Amount', 'المبلغ')],
        d.newPayments.map((p) => [p.number, p.client + ' / ' + p.invoice, optionLabel(PAYMENT_METHODS, p.method, lang), p.amount]), [undefined, undefined, undefined, 'money'], [3]);
      r = section(ws, r, L('New Expenses', 'المصروفات الجديدة'), 4);
      table(ws, r, [L('Description', 'الوصف'), L('Category', 'التصنيف'), L('Status', 'الحالة'), L('Amount', 'المبلغ')],
        d.newExpenses.map((e) => [e.description, optionLabel(EXPENSE_CATEGORIES, e.category, lang), e.paid ? L('Paid', 'مدفوع') : L('Payable', 'مستحق'), e.amount]), [undefined, undefined, undefined, 'money'], [3]);
    }

    // ---------------- 2) العملاء والإيرادات
    {
      const ws = sheet(L('Clients & Revenue', 'العملاء والإيرادات'), [36, 22, 22, 24]);
      let r = title(ws, L('Clients & Revenue', 'العملاء والإيرادات'), sub, 4);
      r = kv(ws, r, L('New clients (today)', 'عملاء جدد (اليوم)'), [d.clients.newClients], '#,##0');
      r = kv(ws, r, L('Active clients', 'العملاء النشطون'), [d.clients.activeClients], '#,##0');
      r += 1;
      r = section(ws, r, L('Client revenue, payments and balances', 'إيرادات العملاء والمدفوعات والأرصدة'), 4);
      table(ws, r, [L('Client', 'العميل'), L('Invoiced today', 'المفوتر اليوم'), L('Paid today', 'المدفوع اليوم'), L('Outstanding balance', 'الرصيد المستحق')],
        d.clients.rows.map((c) => [c.name, c.invoiced, c.paid, c.outstanding]), [undefined, 'money', 'money', 'money'], [1, 2, 3]);
    }

    // ---------------- 3) المهام والفريق
    {
      const ws = sheet(L('Tasks & Team', 'المهام والفريق'), [34, 18, 20, 18]);
      let r = title(ws, L('Tasks & Team', 'المهام والفريق'), sub, 4);
      r = kv(ws, r, L('New tasks', 'مهام جديدة'), [d.tasks.newTasks], '#,##0');
      r = kv(ws, r, L('Completed tasks', 'مهام مكتملة'), [d.tasks.completed], '#,##0');
      r = kv(ws, r, L('Pending tasks', 'مهام معلقة'), [d.tasks.pending], '#,##0');
      r = kv(ws, r, L('Overdue tasks', 'مهام متأخرة'), [d.tasks.overdue], '#,##0');
      r += 1;
      r = section(ws, r, L('Employee task summary', 'ملخص مهام الموظفين'), 4);
      table(ws, r, [L('Employee', 'الموظف'), L('Open tasks', 'مهام مفتوحة'), L('Completed today', 'أُنجزت اليوم'), L('Overdue', 'متأخرة')],
        d.tasks.employees.map((e) => [e.name, e.open, e.completedToday, e.overdue]), [undefined, 'int', 'int', 'int'], [1, 2, 3]);
    }

    // ---------------- 4) المشروعات والتسويق
    {
      const ws = sheet(L('Projects & Marketing', 'المشاريع والتسويق'), [34, 26, 18, 18, 18]);
      let r = title(ws, L('Projects & Marketing', 'المشاريع والتسويق'), sub, 5);
      r = kv(ws, r, L('Active projects', 'مشاريع جارية'), [d.projects.active], '#,##0');
      r = kv(ws, r, L('Projects completed today', 'مشاريع اكتملت اليوم'), [d.projects.completed], '#,##0');
      r = kv(ws, r, L('Campaign spending (active campaigns, cumulative)', 'إنفاق الحملات (الحملات النشطة، تراكمي)'), [d.projects.campaignSpendTotal], MONEY);
      r = kv(ws, r, L('Content published today', 'محتوى منشور اليوم'), [d.projects.published.length], '#,##0');
      r += 1;
      r = section(ws, r, L('Project progress', 'تقدم المشاريع'), 5);
      r = table(ws, r, [L('Project', 'المشروع'), L('Client', 'العميل'), L('Progress %', 'التقدم %'), L('Deadline', 'الموعد النهائي')],
        d.projects.rows.map((p) => [p.name, p.client, p.progress, p.deadline]), [undefined, undefined, 'pct', 'date']);
      r = section(ws, r, L('Campaigns', 'الحملات'), 5);
      r = table(ws, r, [L('Campaign', 'الحملة'), L('Client / Platform', 'العميل / المنصة'), L('Budget', 'الميزانية'), L('Actual spend', 'الإنفاق الفعلي')],
        d.projects.campaigns.map((c) => [c.name, c.client + ' / ' + optionLabel(PLATFORMS, c.platform, lang), c.budget, c.spend]), [undefined, undefined, 'money', 'money'], [2, 3]);
      r = section(ws, r, L('Content published today', 'المحتوى المنشور اليوم'), 5);
      table(ws, r, [L('Title', 'العنوان'), L('Client', 'العميل'), L('Platform', 'المنصة')],
        d.projects.published.map((c) => [c.title, c.client, optionLabel(PLATFORMS, c.platform, lang)]), []);
    }

    // ---------------- 5) التحليلات والتوصيات
    {
      const ws = sheet(L('Insights & Recommendations', 'التحليلات والتوصيات'), [30, 70, 40]);
      let r = title(ws, L('Financial Insights & Recommendations', 'التحليلات المالية والتوصيات'), sub, 3);
      r = section(ws, r, L('Changes vs previous day', 'التغيّر عن اليوم السابق'), 3);
      r = kv(ws, r, L('Revenue: previous day → today', 'الإيراد: اليوم السابق ← اليوم'), [d.fin.prevDayRevenue, d.fin.dayRevenue], MONEY);
      r = kv(ws, r, L('Expenses: previous day → today', 'المصروفات: اليوم السابق ← اليوم'), [d.fin.prevDayExpenses, d.fin.dayExpenses], MONEY);
      r += 1;
      r = section(ws, r, L('Alerts, profitability insights and recommendations (from recorded data)', 'التنبيهات والربحية والتوصيات (من البيانات المسجلة)'), 3);
      const sevLabel: Record<string, string> = { high: L('High', 'عالية'), medium: L('Medium', 'متوسطة'), low: L('Low', 'منخفضة'), info: L('Info', 'معلومة'), good: L('Positive', 'إيجابي') };
      r = table(ws, r, [L('Title', 'العنوان'), L('Details', 'التفاصيل'), L('Supporting data', 'البيانات الداعمة')],
        insights.map((i) => [sevLabel[i.severity] + ' — ' + i.title[lang], i.message[lang], i.evidence.map((e) => e.label[lang] + ': ' + e.value[lang]).join('\n')]), []);
      ws.eachRow((row: any) => row.eachCell((c: any) => (c.alignment = { ...(c.alignment || {}), wrapText: true, vertical: 'top' })));
      ws.getCell(r, 1).value = L('Note: figures reflect records stored in this browser at generation time.', 'ملحوظة: الأرقام تعكس السجلات المحفوظة في هذا المتصفح وقت إنشاء التقرير.');
      ws.getCell(r, 1).font = { italic: true, color: { argb: 'FF64748B' } };
    }

    const buffer: ArrayBuffer = await wb.xlsx.writeBuffer();
    return { buffer, fileName: 'BENZED-Daily-Report-' + date + '.xlsx', partial: d.partial };
  }
}

