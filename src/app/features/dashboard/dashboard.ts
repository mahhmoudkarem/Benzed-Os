import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/LanguageService/language-service';
import { DataService } from '../../core/services/data.service';
import { SettingsService } from '../../core/services/settings.service';
import { DbService } from '../../core/services/db.service';
import { Snapshot } from '../../core/accounting/snapshot';
import { monthSeries, outstandingInvoices, remaining, summary, AccountingSummary } from '../../core/accounting/metrics';
import { profitAndLoss } from '../../core/accounting/ledger';
import { analyze, Insight } from '../../core/intelligence/analyzer';
import { PROJECT_STATUS, TASK_STATUS } from '../../core/constants/options';
import { DateRange, addDays, datesList, daysBetween, isoToCairoDate, monthsList, rangeFor, cairoDate } from '../../core/utils/date';
import { fmt } from '../../core/utils/format';
import { fromCents, toCents } from '../../core/utils/money';
import { projectProgress } from '../../core/utils/progress';
import { ActivityRecord } from '../../core/models/business';
import { PageHeader } from '../../shared/components/page-header';
import { StatCard } from '../../shared/components/stat-card';
import { ChartView } from '../../shared/components/chart';
import { DateRangeFilter } from '../../shared/components/date-range-filter';
import { EmptyState, ErrorState, Loading } from '../../shared/components/state-views';
import { Icon } from '../../shared/components/icon';
import { Badge } from '../../shared/components/badge';

interface Deadline {
  kind: 'task' | 'project' | 'invoice';
  title: string;
  date: string;
  link: string;
}

interface Kpis {
  totalClients: number;
  activeClients: number;
  newClients: number;
  activeProjects: number;
  completedProjects: number;
  pendingTasks: number;
  overdueTasks: number;
  completedTasks: number;
  outstanding: number;
  acc: AccountingSummary;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, PageHeader, StatCard, ChartView, DateRangeFilter, EmptyState, ErrorState, Loading, Icon, Badge],
  template: `
    <app-page-header [title]="lang.t('Dashboard', 'لوحة التحكم')" [subtitle]="lang.t('All figures are calculated from your local records.', 'كل الأرقام محسوبة من سجلاتك المحلية.')">
      <app-date-range-filter (changed)="onRange($event)" />
    </app-page-header>

    @if (loading()) {
      <div class="card"><app-loading /></div>
    } @else if (error()) {
      <div class="card"><app-error-state [message]="error()"><button class="btn" type="button" (click)="load()">{{ lang.t('Retry', 'إعادة المحاولة') }}</button></app-error-state></div>
    } @else if (k(); as k) {
      <div class="text-[12.5px] text-muted mb-2">{{ lang.date(range().from) }} → {{ lang.date(range().to) }}</div>
      <div class="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <app-stat-card icon="users" [label]="lang.t('Total clients', 'إجمالي العملاء')" [value]="lang.num(k.totalClients)" />
        <app-stat-card icon="users" tone="good" [label]="lang.t('Active clients', 'العملاء النشطون')" [value]="lang.num(k.activeClients)" />
        <app-stat-card icon="plus" [label]="lang.t('New clients (period)', 'عملاء جدد (الفترة)')" [value]="lang.num(k.newClients)" />
        <app-stat-card icon="briefcase" [label]="lang.t('Active projects', 'مشاريع جارية')" [value]="lang.num(k.activeProjects)" />
        <app-stat-card icon="check" tone="good" [label]="lang.t('Completed projects (period)', 'مشاريع مكتملة (الفترة)')" [value]="lang.num(k.completedProjects)" />
        <app-stat-card icon="tasks" [label]="lang.t('Pending tasks', 'مهام معلقة')" [value]="lang.num(k.pendingTasks)" />
        <app-stat-card icon="alert" [tone]="k.overdueTasks ? 'bad' : 'default'" [label]="lang.t('Overdue tasks', 'مهام متأخرة')" [value]="lang.num(k.overdueTasks)" />
        <app-stat-card icon="check" tone="good" [label]="lang.t('Completed tasks (period)', 'مهام مكتملة (الفترة)')" [value]="lang.num(k.completedTasks)" />
        <app-stat-card icon="trend" [label]="lang.t('Total revenue', 'إجمالي الإيرادات')" [value]="lang.money(k.acc.revenue)" [hint]="lang.t('Accrual basis', 'أساس الاستحقاق')" />
        <app-stat-card icon="wallet" [label]="lang.t('Total expenses', 'إجمالي المصروفات')" [value]="lang.money(k.acc.expenses)" [hint]="lang.t('Accrual basis', 'أساس الاستحقاق')" />
        <app-stat-card icon="dollar" [tone]="k.acc.net < 0 ? 'bad' : 'good'" [label]="k.acc.net < 0 ? lang.t('Net loss', 'صافي الخسارة') : lang.t('Net profit', 'صافي الربح')" [value]="lang.money(k.acc.net)" />
        <app-stat-card icon="database" [label]="lang.t('Cash balance', 'رصيد النقدية')" [value]="lang.money(k.acc.cashBalance)" [hint]="lang.t('Available cash — not the same as profit', 'النقدية المتاحة — ليست هي الربح')" />
        <app-stat-card icon="file" tone="warn" [label]="lang.t('Outstanding invoices', 'الفواتير المستحقة')" [value]="lang.money(k.outstanding)" />
      </div>

      <div class="grid gap-3 mt-3 grid-cols-1 lg:grid-cols-2">
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Revenue vs expenses', 'الإيرادات مقابل المصروفات') }}</div>
          <app-chart type="bar" [labels]="labels()" [datasets]="revExp()" />
        </div>
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Profit trend', 'اتجاه الربح') }}</div>
          <app-chart type="line" [labels]="labels()" [datasets]="profit()" />
        </div>
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Project status', 'حالة المشاريع') }}</div>
          @if (hasProjects()) {
            <app-chart type="doughnut" [labels]="projectChart().labels" [datasets]="[{ label: '', data: projectChart().data }]" [height]="230" />
          } @else {
            <app-empty-state icon="briefcase" [title]="lang.t('No projects yet', 'لا توجد مشاريع بعد')" />
          }
        </div>
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Tasks overview', 'نظرة على المهام') }}</div>
          @if (hasTasks()) {
            <app-chart type="bar" [labels]="taskChart().labels" [datasets]="[{ label: lang.t('Tasks', 'المهام'), data: taskChart().data }]" [height]="230" />
          } @else {
            <app-empty-state icon="tasks" [title]="lang.t('No tasks yet', 'لا توجد مهام بعد')" />
          }
        </div>
      </div>

      <div class="grid gap-3 mt-3 grid-cols-1 lg:grid-cols-3">
        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Business performance', 'ملخص الأداء') }}</div>
          <div class="flex flex-col gap-3 text-[13px]">
            <div>
              <div class="flex justify-between"><span class="text-muted">{{ lang.t('Profit margin', 'هامش الربح') }}</span><b>{{ lang.pct(k.acc.margin) }}</b></div>
              <div class="progress mt-1"><div [style.width.%]="clamp(k.acc.margin)"></div></div>
            </div>
            <div>
              <div class="flex justify-between"><span class="text-muted">{{ lang.t('Task completion rate', 'نسبة إنجاز المهام') }}</span><b>{{ lang.pct(taskRate()) }}</b></div>
              <div class="progress mt-1"><div [style.width.%]="clamp(taskRate())"></div></div>
            </div>
            <div>
              <div class="flex justify-between"><span class="text-muted">{{ lang.t('Avg. active project progress', 'متوسط تقدم المشاريع الجارية') }}</span><b>{{ lang.pct(projRate()) }}</b></div>
              <div class="progress mt-1"><div [style.width.%]="clamp(projRate())"></div></div>
            </div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Receivables (ledger)', 'مستحقات العملاء (الدفتر)') }}</span><b>{{ lang.money(k.acc.receivable) }}</b></div>
            <div class="flex justify-between"><span class="text-muted">{{ lang.t('Cash runway', 'مدة كفاية السيولة') }}</span><b>{{ k.acc.runway === null ? '—' : lang.num(k.acc.runway, 1) + ' ' + lang.t('months', 'شهر') }}</b></div>
          </div>
        </div>

        <div class="card card-pad">
          <div class="flex items-center justify-between mb-2">
            <div class="card-title">{{ lang.t('Financial alerts', 'تنبيهات مالية') }}</div>
            <a routerLink="/intelligence" class="text-[12px]">{{ lang.t('All insights', 'كل التحليلات') }}</a>
          </div>
          @for (a of alerts(); track a.id) {
            <div class="py-2 border-b border-line last:border-0">
              <app-badge [color]="sevColor(a.severity)">{{ lang.l(a.title) }}</app-badge>
              <div class="text-[12.5px] text-muted mt-1">{{ lang.l(a.message) }}</div>
            </div>
          } @empty {
            <app-empty-state icon="check" [title]="lang.t('No alerts', 'لا توجد تنبيهات')" />
          }
        </div>

        <div class="card card-pad">
          <div class="card-title mb-2">{{ lang.t('Upcoming deadlines (14 days)', 'مواعيد قادمة (14 يوم)') }}</div>
          @for (d of deadlines(); track d.kind + d.title + d.date) {
            <a [routerLink]="d.link" class="flex items-center justify-between gap-2 py-2 border-b border-line last:border-0 no-underline text-fg">
              <span class="flex items-center gap-2 min-w-0">
                <app-icon [name]="d.kind === 'task' ? 'tasks' : d.kind === 'project' ? 'briefcase' : 'file'" [size]="15" />
                <span class="truncate text-[13px]">{{ d.title }}</span>
              </span>
              <span class="text-[12px] text-muted whitespace-nowrap">{{ lang.date(d.date) }}</span>
            </a>
          } @empty {
            <app-empty-state icon="calendar" [title]="lang.t('No upcoming deadlines', 'لا توجد مواعيد قادمة')" />
          }
        </div>
      </div>

      <div class="card card-pad mt-3">
        <div class="flex items-center justify-between mb-2">
          <div class="card-title">{{ lang.t('Recent activity', 'آخر الأنشطة') }}</div>
          <a routerLink="/activity" class="text-[12px]">{{ lang.t('View all', 'عرض الكل') }}</a>
        </div>
        @for (a of activities(); track a.id) {
          <div class="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0 text-[13px]">
            <span>{{ lang.isArabic() ? a.messageAr : a.messageEn }}</span>
            <span class="text-muted text-[12px] whitespace-nowrap">{{ lang.dateTime(a.at) }}</span>
          </div>
        } @empty {
          <app-empty-state icon="clock" [title]="lang.t('No activity yet', 'لا يوجد نشاط بعد')" />
        }
      </div>
    }
  `,
})
export class Dashboard implements OnInit {
  protected readonly lang = inject(LanguageService);
  private readonly data = inject(DataService);
  private readonly settings = inject(SettingsService);
  private readonly db = inject(DbService).db;

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly range = signal<DateRange>(rangeFor('month', cairoDate()));
  protected readonly k = signal<Kpis | null>(null);
  protected readonly labels = signal<string[]>([]);
  protected readonly revExp = signal<{ label: string; data: number[]; color?: string }[]>([]);
  protected readonly profit = signal<{ label: string; data: number[]; color?: string }[]>([]);
  protected readonly projectChart = signal<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  protected readonly taskChart = signal<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  protected readonly hasProjects = computed(() => this.projectChart().data.some((x) => x > 0));
  protected readonly hasTasks = computed(() => this.taskChart().data.some((x) => x > 0));
  protected readonly alerts = signal<Insight[]>([]);
  protected readonly deadlines = signal<Deadline[]>([]);
  protected readonly activities = signal<ActivityRecord[]>([]);
  protected readonly taskRate = signal(0);
  protected readonly projRate = signal(0);

  ngOnInit(): void {
    void this.load();
  }

  protected onRange(r: DateRange): void {
    this.range.set(r);
    void this.load();
  }

  protected clamp(n: number): number {
    return Math.max(0, Math.min(100, n || 0));
  }

  protected sevColor(s: string): string {
    return s === 'high' ? 'red' : s === 'medium' ? 'amber' : s === 'good' ? 'green' : 'blue';
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const s: Snapshot = await this.data.snapshot();
      const { from, to } = this.range();
      const today = s.today;
      const asOf = to > today ? today : to;
      const acc = summary(s, from, to);
      acc.cashBalance = summary(s, from, asOf).cashBalance;

      const live = (c: { archived: boolean }) => !c.archived;
      const open = outstandingInvoices(s);
      const pending = s.tasks.filter((t) => t.status !== 'completed');
      this.k.set({
        totalClients: s.clients.filter(live).length,
        activeClients: s.clients.filter((c) => live(c) && c.status === 'active').length,
        newClients: s.clients.filter((c) => { const d = isoToCairoDate(c.createdAt); return d >= from && d <= to; }).length,
        activeProjects: s.projects.filter((p) => live(p) && p.status === 'active').length,
        completedProjects: s.projects.filter((p) => p.completedDate && p.completedDate >= from && p.completedDate <= to).length,
        pendingTasks: pending.length,
        overdueTasks: pending.filter((t) => t.dueDate && t.dueDate < today).length,
        completedTasks: s.tasks.filter((t) => t.completedAt && isoToCairoDate(t.completedAt) >= from && isoToCairoDate(t.completedAt) <= to).length,
        outstanding: fromCents(open.reduce((a, i) => a + toCents(remaining(i)), 0)),
        acc,
      });

      // الرسوم: يومي لو الفترة ≤ 31 يوم وإلا شهري
      const days = daysBetween(from, to) + 1;
      const L = this.lang.lang();
      const labels: string[] = [];
      const rev: number[] = [];
      const exp: number[] = [];
      const prof: number[] = [];
      if (days <= 31) {
        for (const d of datesList(from, to)) {
          const pl = profitAndLoss(s.accounts, s.lines, d, d);
          labels.push(d.slice(8));
          rev.push(pl.totalRevenue);
          exp.push(pl.totalExpenses);
          prof.push(pl.netIncome);
        }
      } else {
        for (const p of monthSeries(s, monthsList(from.slice(0, 7), to.slice(0, 7)))) {
          labels.push(fmt.monthShort(p.month, L));
          rev.push(p.revenue);
          exp.push(p.expenses);
          prof.push(p.profit);
        }
      }
      this.labels.set(labels);
      this.revExp.set([
        { label: this.lang.t('Revenue', 'الإيرادات'), data: rev, color: '#16a34a' },
        { label: this.lang.t('Expenses', 'المصروفات'), data: exp, color: '#ef4444' },
      ]);
      this.profit.set([{ label: this.lang.t('Net profit', 'صافي الربح'), data: prof, color: '#14919e' }]);

      this.projectChart.set({
        labels: PROJECT_STATUS.map((o) => this.lang.l(o.label)),
        data: PROJECT_STATUS.map((o) => s.projects.filter((p) => !p.archived && p.status === o.value).length),
      });
      this.taskChart.set({
        labels: TASK_STATUS.map((o) => this.lang.l(o.label)),
        data: TASK_STATUS.map((o) => s.tasks.filter((t) => t.status === o.value).length),
      });
      this.taskRate.set(s.tasks.length ? (s.tasks.filter((t) => t.status === 'completed').length / s.tasks.length) * 100 : 0);
      const act = s.projects.filter((p) => !p.archived && p.status === 'active');
      this.projRate.set(act.length ? act.reduce((a, p) => a + projectProgress(p, s.tasks), 0) / act.length : 0);

      const target = await this.settings.get<number>('profitTarget', 0);
      this.alerts.set(analyze(s, target).filter((i) => i.severity !== 'good').slice(0, 4));

      const horizon = addDays(today, 14);
      const dl: Deadline[] = [];
      for (const t of pending) if (t.dueDate && t.dueDate >= today && t.dueDate <= horizon) dl.push({ kind: 'task', title: t.title, date: t.dueDate, link: '/tasks/' + t.id });
      for (const p of s.projects) if (!p.archived && p.status !== 'completed' && p.status !== 'cancelled' && p.deadline && p.deadline >= today && p.deadline <= horizon) dl.push({ kind: 'project', title: p.name, date: p.deadline, link: '/projects/' + p.id });
      for (const i of open) if (i.dueDate >= today && i.dueDate <= horizon) dl.push({ kind: 'invoice', title: i.number, date: i.dueDate, link: '/accounting/invoices' });
      this.deadlines.set(dl.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8));

      const recent = await this.db.activities.orderBy('at').reverse().limit(8).toArray();
      this.activities.set(recent);
    } catch (e: any) {
      console.error(e);
      this.error.set(this.lang.t('Failed to load the dashboard: ', 'فشل تحميل لوحة التحكم: ') + String(e?.message || e));
    } finally {
      this.loading.set(false);
    }
  }
}
