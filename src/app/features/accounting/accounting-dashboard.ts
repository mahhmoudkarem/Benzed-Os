import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { AccountingSummary, MonthPoint, monthSeries, summary } from '../../core/accounting/metrics';
import { DateRange, addMonths, cairoDate, cairoMonth, monthsList, rangeFor } from '../../core/utils/date';
import { fmt } from '../../core/utils/format';
import { Snapshot } from '../../core/accounting/snapshot';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { DateRangeFilter } from '../../shared/components/date-range-filter';
import { ChartView } from '../../shared/components/chart';
import { Icon } from '../../shared/components/icon';
import { Loading } from '../../shared/components/state-views';

@Component({
  selector: 'app-accounting-dashboard',
  imports: [RouterLink, PageHeader, StatCard, DateRangeFilter, ChartView, Icon, Loading],
  template: `
    <app-page-header [title]="lang.t('Accounting', 'المحاسبة')" [subtitle]="lang.t('Profit and cash are different: profit includes unpaid invoices, cash does not.', 'الربح والنقدية شيئان مختلفان: الربح يشمل الفواتير غير المدفوعة والنقدية لا تشملها.')">
      <app-date-range-filter (changed)="onRange($event)" />
    </app-page-header>
    <div class="flex flex-wrap gap-2 mb-3">
      <a class="btn btn-sm" routerLink="/accounting/invoices"><app-icon name="file" [size]="14" /> {{ lang.t('Invoices', 'الفواتير') }}</a>
      <a class="btn btn-sm" routerLink="/accounting/transactions"><app-icon name="trend" [size]="14" /> {{ lang.t('Income & expenses', 'الإيرادات والمصروفات') }}</a>
      <a class="btn btn-sm" routerLink="/accounting/capital"><app-icon name="layers" [size]="14" /> {{ lang.t('Capital', 'رأس المال') }}</a>
      <a class="btn btn-sm" routerLink="/accounting/assets"><app-icon name="cpu" [size]="14" /> {{ lang.t('Assets', 'الأصول') }}</a>
      <a class="btn btn-sm" routerLink="/accounting/reports"><app-icon name="bar" [size]="14" /> {{ lang.t('Reports', 'التقارير') }}</a>
    </div>
    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (s(); as s) {
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card icon="layers" [label]="lang.t('Initial capital', 'رأس المال الابتدائي')" [value]="lang.money(s.initialCapital)" />
        <app-stat-card icon="plus" [label]="lang.t('Additional capital', 'رأس مال إضافي')" [value]="lang.money(s.additionalCapital)" />
        <app-stat-card icon="trend" tone="good" [label]="lang.t('Total revenue', 'إجمالي الإيرادات')" [value]="lang.money(s.revenue)" [hint]="lang.t('Accrual, selected period', 'استحقاق، الفترة المحددة')" />
        <app-stat-card icon="wallet" [label]="lang.t('Total expenses', 'إجمالي المصروفات')" [value]="lang.money(s.expenses)" [hint]="lang.t('Accrual, selected period', 'استحقاق، الفترة المحددة')" />
        <app-stat-card icon="dollar" tone="good" [label]="lang.t('Net profit', 'صافي الربح')" [value]="lang.money(s.netProfit)" />
        <app-stat-card icon="alert" [tone]="s.netLoss > 0 ? 'bad' : 'default'" [label]="lang.t('Net loss', 'صافي الخسارة')" [value]="lang.money(s.netLoss)" />
        <app-stat-card icon="database" [label]="lang.t('Cash balance', 'رصيد النقدية')" [value]="lang.money(s.cashBalance)" [hint]="lang.t('Not the same as profit', 'ليس هو الربح')" />
        <app-stat-card icon="bar" [label]="lang.t('Profit margin', 'هامش الربح')" [value]="lang.pct(s.margin)" />
        <app-stat-card icon="file" tone="warn" [label]="lang.t('Accounts receivable', 'العملاء (مدينون)')" [value]="lang.money(s.receivable)" />
        <app-stat-card icon="file" tone="warn" [label]="lang.t('Accounts payable', 'الموردون (دائنون)')" [value]="lang.money(s.payable)" />
        <app-stat-card icon="upload" [label]="lang.t('Owner withdrawals', 'مسحوبات المالك')" [value]="lang.money(s.withdrawals)" />
        <app-stat-card icon="trend" [label]="lang.t('Retained earnings', 'الأرباح المحتجزة')" [value]="lang.money(s.retainedEarnings)" [hint]="lang.t('Cumulative profit to date', 'الربح التراكمي حتى اليوم')" />
        <app-stat-card icon="wallet" [label]="lang.t('Total assets', 'إجمالي الأصول')" [value]="lang.money(s.totalAssets)" />
        <app-stat-card icon="layers" [label]="lang.t('Total liabilities', 'إجمالي الالتزامات')" [value]="lang.money(s.totalLiabilities)" />
        <app-stat-card icon="users" tone="good" [label]="lang.t('Owner’s equity', 'حقوق الملكية')" [value]="lang.money(s.equity)" [hint]="s.balanced ? lang.t('Assets = Liabilities + Equity ✓', 'الأصول = الالتزامات + الملكية ✓') : lang.t('Imbalance detected', 'يوجد عدم توازن')" />
        <app-stat-card icon="clock" [label]="lang.t('Monthly burn rate', 'معدل الصرف الشهري')" [value]="s.burn.hasData ? lang.money(s.burn.value) : '—'" [hint]="burnHint(s)" />
        <app-stat-card icon="refresh" [label]="lang.t('Cash runway', 'مدة كفاية السيولة')" [value]="s.runway === null ? '—' : lang.num(s.runway, 1) + ' ' + lang.t('months', 'شهر')" [hint]="s.runway === null ? lang.t('Not enough data', 'بيانات غير كافية') : ''" />
      </div>

      <div class="grid gap-3 mt-3 grid-cols-1 lg:grid-cols-2">
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Accrual vs cash (selected period)', 'الاستحقاق مقابل النقدي (الفترة المحددة)') }}</div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th></th><th class="num">{{ lang.t('Accrual', 'استحقاق') }}</th><th class="num">{{ lang.t('Cash', 'نقدي') }}</th></tr></thead>
            <tbody>
              <tr><td>{{ lang.t('Revenue', 'الإيراد') }}</td><td class="num">{{ lang.money(s.revenue) }}</td><td class="num">{{ lang.money(s.cashBasis.revenue) }}</td></tr>
              <tr><td>{{ lang.t('Expenses', 'المصروفات') }}</td><td class="num">{{ lang.money(s.expenses) }}</td><td class="num">{{ lang.money(s.cashBasis.expenses) }}</td></tr>
              <tr style="font-weight: 700"><td>{{ lang.t('Net', 'الصافي') }}</td><td class="num">{{ lang.money(s.net) }}</td><td class="num">{{ lang.money(s.cashBasis.net) }}</td></tr>
            </tbody>
          </table></div>
          <div class="text-[12px] text-muted mt-2">{{ lang.t('All cash movements in the period (incl. capital and equipment): ', 'كل حركات النقدية في الفترة (شاملة رأس المال والمعدات): ') }}<b>{{ lang.money(s.cashFlowNet) }}</b></div>
        </div>
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Profit vs cash flow — last 6 months', 'الربح مقابل التدفق النقدي — آخر 6 أشهر') }}</div>
          <app-chart type="bar" [labels]="labels()" [datasets]="series()" />
        </div>
      </div>
    }
  `,
})
export class AccountingDashboard implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);

  protected readonly loading = signal(true);
  protected readonly s = signal<AccountingSummary | null>(null);
  protected readonly labels = signal<string[]>([]);
  protected readonly series = signal<{ label: string; data: number[]; color?: string }[]>([]);
  private range: DateRange = rangeFor('month', cairoDate());
  private snap: Snapshot | null = null;

  ngOnInit(): void {
    void this.data.snapshot().then((snap) => {
      this.snap = snap;
      this.compute();
    });
  }

  protected onRange(r: DateRange): void {
    this.range = r;
    this.compute();
  }

  protected burnHint(s: AccountingSummary): string {
    if (!s.burn.hasData) return this.lang.t('Not enough data', 'بيانات غير كافية');
    return s.burn.partial ? this.lang.t('Current month only', 'الشهر الحالي فقط') : this.lang.t('Avg of last ', 'متوسط آخر ') + s.burn.months + this.lang.t(' full month(s)', ' شهر مكتمل');
  }

  private compute(): void {
    const snap = this.snap;
    if (!snap) return;
    const { from, to } = this.range;
    const asOf = to > snap.today ? snap.today : to;
    const sm = summary(snap, from, to);
    sm.cashBalance = summary(snap, from, asOf).cashBalance;
    this.s.set(sm);
    const months = monthsList(addMonths(cairoMonth(), -5), cairoMonth());
    const pts: MonthPoint[] = monthSeries(snap, months);
    this.labels.set(months.map((m) => fmt.monthShort(m, this.lang.lang())));
    this.series.set([
      { label: this.lang.t('Net profit (accrual)', 'صافي الربح (استحقاق)'), data: pts.map((p) => p.profit), color: '#14919e' },
      { label: this.lang.t('Net cash flow (operating)', 'صافي التدفق النقدي (تشغيلي)'), data: pts.map((p) => p.cashIn - p.cashOut), color: '#16a34a' },
    ]);
    this.loading.set(false);
  }
}
