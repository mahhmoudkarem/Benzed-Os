import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { BackupService } from '../../core/services/backup.service';
import { ToastService } from '../../core/services/toast.service';
import { Snapshot } from '../../core/accounting/snapshot';
import { balanceSheet, cashBasisPL, cashFlowStatement, profitAndLoss, trialBalance } from '../../core/accounting/ledger';
import { cashAccountIds, daysLate, remaining, summary, unpaidExpenses } from '../../core/accounting/metrics';
import { EXPENSE_CATEGORIES, optionLabel } from '../../core/constants/options';
import { DateRange, cairoDate, daysBetween, rangeFor } from '../../core/utils/date';
import { fromCents, toCents } from '../../core/utils/money';
import { PageHeader } from '../../shared/components/page-header';
import { DateRangeFilter } from '../../shared/components/date-range-filter';
import { ChartView } from '../../shared/components/chart';
import { Icon } from '../../shared/components/icon';
import { Loading } from '../../shared/components/state-views';
import { exportTableXlsx } from './xlsx-export';

type Tab = 'pl' | 'bs' | 'cf' | 'tb' | 'ar' | 'ap' | 'exp' | 'rev' | 'cap';

interface RRow {
  cells: (string | number)[];
  kind?: 'section' | 'total' | 'note';
}
interface Report {
  headers: string[];
  rows: RRow[];
  money: number[];
  notes: string[];
  chart?: { labels: string[]; values: number[] };
}

const SOURCE_LABEL: Record<string, [string, string]> = {
  payment: ['Customer payments', 'مدفوعات العملاء'],
  income: ['Other income received', 'إيرادات أخرى مستلمة'],
  expense: ['Expenses paid', 'مصروفات مدفوعة'],
  expense_payment: ['Payables settled', 'سداد مستحقات'],
  manual: ['Manual entries', 'قيود يدوية'],
  asset: ['Equipment purchases', 'شراء معدات'],
  capital: ['Owner capital contributions', 'مساهمات رأس المال'],
  withdrawal: ['Owner withdrawals', 'مسحوبات المالك'],
  invoice: ['Invoices', 'فواتير'],
  depreciation: ['Depreciation', 'إهلاك'],
};

@Component({
  selector: 'app-financial-reports',
  imports: [PageHeader, DateRangeFilter, ChartView, Icon, Loading],
  template: `
    <app-page-header [title]="lang.t('Financial reports', 'التقارير المالية')" [subtitle]="lang.t('All reports are generated from the journal and source documents.', 'كل التقارير مولّدة من دفتر اليومية والمستندات المصدرية.')">
      <app-date-range-filter (changed)="range.set($event)" />
      <button class="btn" type="button" (click)="exportXlsx()"><app-icon name="download" [size]="15" /> {{ lang.t('Export Excel', 'تصدير إكسل') }}</button>
    </app-page-header>
    <div class="tabs mb-3">
      @for (t of tabs; track t.id) {
        <button class="tab" [class.active]="tab() === t.id" type="button" (click)="tab.set(t.id)">{{ lang.t(t.en, t.ar) }}</button>
      }
    </div>
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else {
      <div class="text-[12.5px] text-muted mb-2">{{ lang.date(range().from) }} → {{ lang.date(range().to) }}</div>
      <div class="card">
        <div class="table-wrap"><table class="table">
          <thead><tr>
            @for (h of rep().headers; track $index; let i = $index) {<th [class.num]="rep().money.includes(i)">{{ h }}</th>}
          </tr></thead>
          <tbody>
            @for (r of rep().rows; track $index) {
              @if (r.kind === 'section') {
                <tr><td [attr.colspan]="rep().headers.length" style="background: var(--primary-soft); color: var(--primary); font-weight: 700">{{ r.cells[0] }}</td></tr>
              } @else {
                <tr [style.font-weight]="r.kind === 'total' ? 700 : 400" [style.background]="r.kind === 'total' ? 'var(--surface-2)' : ''">
                  @for (c of r.cells; track $index; let i = $index) {
                    <td [class.num]="rep().money.includes(i)">{{ rep().money.includes(i) && c !== '' ? lang.money(+c) : c }}</td>
                  }
                </tr>
              }
            } @empty {
              <tr><td [attr.colspan]="rep().headers.length" class="empty">{{ lang.t('No data for this period', 'لا توجد بيانات لهذه الفترة') }}</td></tr>
            }
          </tbody>
        </table></div>
      </div>
      @if (rep().chart && rep().chart!.values.length) {
        <div class="card card-pad mt-3"><app-chart type="doughnut" [labels]="rep().chart!.labels" [datasets]="[{ label: '', data: rep().chart!.values }]" [height]="260" /></div>
      }
      @for (n of rep().notes; track $index) {
        <div class="text-[12.5px] text-muted mt-2">• {{ n }}</div>
      }
    }
  `,
})
export class FinancialReports implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);

  protected readonly tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'pl', en: 'Profit & Loss', ar: 'الأرباح والخسائر' },
    { id: 'bs', en: 'Balance Sheet', ar: 'الميزانية العمومية' },
    { id: 'cf', en: 'Cash Flow', ar: 'التدفقات النقدية' },
    { id: 'tb', en: 'Trial Balance', ar: 'ميزان المراجعة' },
    { id: 'ar', en: 'Receivables', ar: 'العملاء (مدينون)' },
    { id: 'ap', en: 'Payables', ar: 'الموردون (دائنون)' },
    { id: 'exp', en: 'Expense Breakdown', ar: 'تفصيل المصروفات' },
    { id: 'rev', en: 'Revenue Breakdown', ar: 'تفصيل الإيرادات' },
    { id: 'cap', en: 'Capital Report', ar: 'تقرير رأس المال' },
  ];
  protected readonly tab = signal<Tab>('pl');
  protected readonly loading = signal(true);
  protected readonly range = signal<DateRange>(rangeFor('month', cairoDate()));
  private readonly snap = signal<Snapshot | null>(null);

  protected readonly rep = computed<Report>(() => {
    const s = this.snap();
    const empty: Report = { headers: [], rows: [], money: [], notes: [] };
    if (!s) return empty;
    this.lang.lang();
    return this.build(s, this.tab(), this.range().from, this.range().to);
  });

  ngOnInit(): void {
    void this.data.snapshot().then((s) => {
      this.snap.set(s);
      this.loading.set(false);
    });
  }

  private n(en: string, ar: string): string {
    return this.lang.t(en, ar);
  }
  private acct(a: { nameEn: string; nameAr: string; code: string }): string {
    return a.code + ' · ' + (this.lang.isArabic() ? a.nameAr : a.nameEn);
  }

  private build(s: Snapshot, tab: Tab, from: string, to: string): Report {
    const L = this.lang.lang();
    const asOf = to > s.today ? s.today : to;
    const rows: RRow[] = [];
    const notes: string[] = [];
    switch (tab) {
      case 'pl': {
        const pl = profitAndLoss(s.accounts, s.lines, from, to);
        const cb = cashBasisPL(s.invoices, s.payments, s.transactions, from, to);
        rows.push({ cells: [this.n('Revenue', 'الإيرادات')], kind: 'section' });
        pl.revenue.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount, ''] }));
        rows.push({ cells: [this.n('Total revenue', 'إجمالي الإيرادات'), pl.totalRevenue, cb.revenue], kind: 'total' });
        rows.push({ cells: [this.n('Expenses', 'المصروفات')], kind: 'section' });
        pl.expenses.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount, ''] }));
        cb.expensesByCategory.forEach((r) => rows.push({ cells: ['   ' + optionLabel(EXPENSE_CATEGORIES, r.category, L) + ' (' + this.n('cash', 'نقدي') + ')', '', r.amount] }));
        rows.push({ cells: [this.n('Total expenses', 'إجمالي المصروفات'), pl.totalExpenses, cb.expenses], kind: 'total' });
        rows.push({ cells: [this.n('Net profit / (loss)', 'صافي الربح / (الخسارة)'), pl.netIncome, cb.net], kind: 'total' });
        notes.push(this.n('Accrual: revenue when invoiced/earned, expenses when incurred (incl. depreciation). Cash: money received (excluding tax) and paid; equipment purchases are shown in Cash Flow (investing).', 'الاستحقاق: الإيراد عند الفوترة والمصروف عند حدوثه (شامل الإهلاك). النقدي: الأموال المستلمة (بدون ضريبة) والمدفوعة؛ مشتريات المعدات تظهر في التدفقات (استثماري).'));
        return { headers: [this.n('Item', 'البند'), this.n('Accrual basis', 'أساس الاستحقاق'), this.n('Cash basis', 'الأساس النقدي')], rows, money: [1, 2], notes };
      }
      case 'bs': {
        const bs = balanceSheet(s.accounts, s.lines, asOf);
        rows.push({ cells: [this.n('Assets', 'الأصول')], kind: 'section' });
        bs.assets.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount] }));
        rows.push({ cells: [this.n('Total assets', 'إجمالي الأصول'), bs.totalAssets], kind: 'total' });
        rows.push({ cells: [this.n('Liabilities', 'الالتزامات')], kind: 'section' });
        bs.liabilities.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount] }));
        rows.push({ cells: [this.n('Total liabilities', 'إجمالي الالتزامات'), bs.totalLiabilities], kind: 'total' });
        rows.push({ cells: [this.n("Owner's equity", 'حقوق الملكية')], kind: 'section' });
        bs.equity.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount] }));
        rows.push({ cells: [this.n('Retained earnings (cumulative profit)', 'الأرباح المحتجزة (الربح التراكمي)'), bs.retainedEarnings] });
        rows.push({ cells: [this.n("Total owner's equity", 'إجمالي حقوق الملكية'), bs.totalEquity], kind: 'total' });
        rows.push({ cells: [this.n('Liabilities + Equity', 'الالتزامات + حقوق الملكية'), fromCents(toCents(bs.totalLiabilities) + toCents(bs.totalEquity))], kind: 'total' });
        notes.push((bs.balanced ? '✓ ' : '✗ ') + this.n('Assets = Liabilities + Equity', 'الأصول = الالتزامات + حقوق الملكية') + ' · ' + this.n('as of ', 'في ') + this.lang.date(asOf));
        return { headers: [this.n('Item', 'البند'), this.n('Amount', 'المبلغ')], rows, money: [1], notes };
      }
      case 'cf': {
        const cf = cashFlowStatement(cashAccountIds(s.accounts), s.lines, from, to);
        rows.push({ cells: [this.n('Opening cash balance', 'رصيد النقدية الافتتاحي'), '', '', cf.opening], kind: 'total' });
        for (const sec of ['operating', 'investing', 'financing'] as const) {
          const title = sec === 'operating' ? this.n('Operating activities', 'الأنشطة التشغيلية') : sec === 'investing' ? this.n('Investing activities', 'الأنشطة الاستثمارية') : this.n('Financing activities', 'الأنشطة التمويلية');
          rows.push({ cells: [title], kind: 'section' });
          cf.rows.filter((r) => r.section === sec).forEach((r) => rows.push({ cells: [this.n(SOURCE_LABEL[r.source]?.[0] || r.source, SOURCE_LABEL[r.source]?.[1] || r.source), r.inflow, r.outflow, r.net] }));
          rows.push({ cells: [this.n('Net ', 'صافي ') + title, '', '', cf[sec]], kind: 'total' });
        }
        rows.push({ cells: [this.n('Net change in cash', 'صافي التغير في النقدية'), '', '', cf.netChange], kind: 'total' });
        rows.push({ cells: [this.n('Closing cash balance', 'رصيد النقدية الختامي'), '', '', cf.closing], kind: 'total' });
        notes.push((cf.reconciled ? '✓ ' : '✗ ') + this.n('Opening + net change = closing', 'الافتتاحي + صافي التغير = الختامي'));
        return { headers: [this.n('Activity', 'النشاط'), this.n('Inflow', 'تدفق داخل'), this.n('Outflow', 'تدفق خارج'), this.n('Net', 'الصافي')], rows, money: [1, 2, 3], notes };
      }
      case 'tb': {
        const tb = trialBalance(s.accounts, s.lines, asOf);
        tb.rows.forEach((r) => rows.push({ cells: [this.acct(r.account), r.debit || '', r.credit || ''] }));
        rows.push({ cells: [this.n('Totals', 'الإجماليات'), tb.totalDebit, tb.totalCredit], kind: 'total' });
        notes.push((tb.balanced ? '✓ ' : '✗ ') + this.n('Total debits = total credits', 'إجمالي المدين = إجمالي الدائن') + ' · ' + this.n('as of ', 'في ') + this.lang.date(asOf));
        return { headers: [this.n('Account', 'الحساب'), this.n('Debit', 'مدين'), this.n('Credit', 'دائن')], rows, money: [1, 2], notes };
      }
      case 'ar': {
        const open = s.invoices.filter((i) => (i.status === 'issued' || i.status === 'partial') && remaining(i) > 0.004);
        const name = (id: string) => s.clients.find((c) => c.id === id)?.name || '—';
        const bucket = (d: number) => (d <= 0 ? this.n('Not due', 'غير مستحق') : d <= 30 ? '1–30' : d <= 60 ? '31–60' : d <= 90 ? '61–90' : '90+');
        open.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).forEach((i) => rows.push({ cells: [i.number, name(i.clientId), this.lang.date(i.dueDate), bucket(daysLate(i, s.today)), remaining(i)] }));
        rows.push({ cells: [this.n('Total receivable', 'إجمالي المستحق'), '', '', '', fromCents(open.reduce((a, i) => a + toCents(remaining(i)), 0))], kind: 'total' });
        notes.push(this.n('Receivables are current open invoices as of today (days late = today − due date).', 'المستحقات هي الفواتير المفتوحة حاليًا (أيام التأخير = اليوم − تاريخ الاستحقاق).'));
        return { headers: [this.n('Invoice', 'الفاتورة'), this.n('Client', 'العميل'), this.n('Due', 'الاستحقاق'), this.n('Days overdue', 'أيام التأخير'), this.n('Remaining', 'المتبقي')], rows, money: [4], notes };
      }
      case 'ap': {
        const list = unpaidExpenses(s).sort((a, b) => a.date.localeCompare(b.date));
        list.forEach((t) => rows.push({ cells: [this.lang.date(t.date), t.description || '—', t.supplier || '—', optionLabel(EXPENSE_CATEGORIES, t.category, L), t.amount] }));
        rows.push({ cells: [this.n('Total payable', 'إجمالي المستحق للسداد'), '', '', '', fromCents(list.reduce((a, t) => a + toCents(t.amount), 0))], kind: 'total' });
        return { headers: [this.n('Date', 'التاريخ'), this.n('Description', 'الوصف'), this.n('Supplier', 'المورد'), this.n('Category', 'التصنيف'), this.n('Amount', 'المبلغ')], rows, money: [4], notes };
      }
      case 'exp': {
        const pl = profitAndLoss(s.accounts, s.lines, from, to);
        pl.expenses.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount, pl.totalExpenses ? (r.amount / pl.totalExpenses) * 100 : 0] }));
        rows.push({ cells: [this.n('Total', 'الإجمالي'), pl.totalExpenses, 100], kind: 'total' });
        const r2 = rows.map((r) => ({ ...r, cells: r.cells.map((c, i) => (i === 2 && typeof c === 'number' ? c.toFixed(1) + '%' : c)) }));
        return { headers: [this.n('Expense account', 'حساب المصروف'), this.n('Amount', 'المبلغ'), this.n('Share', 'النسبة')], rows: r2, money: [1], notes, chart: { labels: pl.expenses.map((r) => this.acct(r.account)), values: pl.expenses.map((r) => r.amount) } };
      }
      case 'rev': {
        const pl = profitAndLoss(s.accounts, s.lines, from, to);
        rows.push({ cells: [this.n('By revenue account', 'حسب حساب الإيراد')], kind: 'section' });
        pl.revenue.forEach((r) => rows.push({ cells: [this.acct(r.account), r.amount] }));
        rows.push({ cells: [this.n('Total', 'الإجمالي'), pl.totalRevenue], kind: 'total' });
        const byClient = new Map<string, number>();
        s.invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && i.issueDate >= from && i.issueDate <= to).forEach((i) => byClient.set(i.clientId, (byClient.get(i.clientId) || 0) + toCents(i.netAmount)));
        rows.push({ cells: [this.n('Invoiced revenue by client (net of tax)', 'الإيراد المفوتر حسب العميل (بدون ضريبة)')], kind: 'section' });
        const list = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]);
        list.forEach(([id, c]) => rows.push({ cells: [s.clients.find((x) => x.id === id)?.name || '—', fromCents(c)] }));
        return { headers: [this.n('Item', 'البند'), this.n('Amount', 'المبلغ')], rows, money: [1], notes, chart: { labels: list.map(([id]) => s.clients.find((x) => x.id === id)?.name || '—'), values: list.map(([, c]) => fromCents(c)) } };
      }
      default: {
        const sm = summary(s, '0000-01-01', asOf);
        rows.push({ cells: [this.n('Initial capital', 'رأس المال الابتدائي'), sm.initialCapital] });
        rows.push({ cells: [this.n('Additional capital', 'رأس مال إضافي'), sm.additionalCapital] });
        rows.push({ cells: [this.n('Owner withdrawals', 'مسحوبات المالك'), -sm.withdrawals] });
        rows.push({ cells: [this.n('Retained earnings (cumulative profit)', 'الأرباح المحتجزة (الربح التراكمي)'), sm.retainedEarnings] });
        rows.push({ cells: [this.n("Owner's equity", 'حقوق الملكية'), sm.equity], kind: 'total' });
        rows.push({ cells: [this.n('Total assets', 'إجمالي الأصول'), sm.totalAssets] });
        rows.push({ cells: [this.n('Total liabilities', 'إجمالي الالتزامات'), sm.totalLiabilities] });
        s.capital.filter((c) => c.date >= from && c.date <= to && !c.voided).forEach((c) => rows.push({ cells: [this.lang.date(c.date) + ' · ' + c.type, c.type === 'withdrawal' ? -c.amount : c.amount] }));
        notes.push(this.n('Totals are cumulative up to the end date; the list shows entries inside the selected period.', 'الإجماليات تراكمية حتى تاريخ النهاية؛ والقائمة تعرض الحركات داخل الفترة المحددة.'));
        return { headers: [this.n('Item', 'البند'), this.n('Amount', 'المبلغ')], rows, money: [1], notes };
      }
    }
  }

  protected async exportXlsx(): Promise<void> {
    try {
      const r = this.rep();
      const tabName = this.tabs.find((t) => t.id === this.tab());
      const name = this.lang.t(tabName?.en || 'Report', tabName?.ar || 'تقرير');
      const blob = await exportTableXlsx(name, name, r.headers, r.rows.map((x) => x.cells), this.lang.isArabic(), r.money);
      this.backup.download('BENZED-' + this.tab() + '-' + this.range().from + '_' + this.range().to + '.xlsx', blob);
    } catch (e: any) {
      this.toast.error(String(e?.message || e));
    }
  }
}

export { daysBetween };
