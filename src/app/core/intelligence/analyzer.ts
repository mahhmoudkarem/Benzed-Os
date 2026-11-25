import { LocalizedText } from '../models/common';
import { Snapshot } from '../accounting/snapshot';
import {
  burnRate,
  cashBalanceAt,
  clientProfitability,
  daysLate,
  monthSeries,
  outstandingInvoices,
  overdueInvoices,
  projectProfitability,
  remaining,
  runwayMonths,
  serviceProfitability,
  unpaidExpenses,
  firstActivityMonth,
} from '../accounting/metrics';
import { addMonths, monthsList } from '../utils/date';
import { fmt } from '../utils/format';
import { round2, toCents, fromCents } from '../utils/money';
import { SERVICE_TYPES } from '../constants/options';

export type Severity = 'high' | 'medium' | 'low' | 'info' | 'good';

export interface Insight {
  id: string;
  severity: Severity;
  title: LocalizedText;
  message: LocalizedText;
  /** البيانات والحساب اللي بُنيت عليهم التوصية (شفافية) */
  evidence: { label: LocalizedText; value: LocalizedText }[];
  link?: string;
}

export const lt = (en: string, ar: string): LocalizedText => ({ en, ar });
export const money = (n: number): LocalizedText => ({ en: fmt.money(n, 'en'), ar: fmt.money(n, 'ar') });
export const pctT = (n: number): LocalizedText => ({ en: fmt.pct(n, 'en'), ar: fmt.pct(n, 'ar') });
export const numT = (n: number, d = 1): LocalizedText => ({ en: fmt.num(n, 'en', d), ar: fmt.num(n, 'ar', d) });
export const textT = (s: string): LocalizedText => ({ en: s, ar: s });

export interface Baseline {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  months: number;
  partial: boolean;
  hasData: boolean;
  cash: number;
  payroll: number;
}

/** خط الأساس: متوسط آخر 3 أشهر مكتملة (أو الشهر الحالي لو لسه مفيش) */
export function baseline(s: Snapshot): Baseline {
  const cur = s.today.slice(0, 7);
  const first = firstActivityMonth(s);
  const cash = cashBalanceAt(s, s.today);
  const payroll = round2(s.employees.filter((e) => !e.archived && e.employmentStatus !== 'terminated').reduce((a, e) => a + (e.monthlySalary || 0), 0));
  if (!first) return { monthlyRevenue: 0, monthlyExpenses: 0, monthlyProfit: 0, months: 0, partial: false, hasData: false, cash, payroll };
  const window = monthsList(addMonths(cur, -3), addMonths(cur, -1)).filter((m) => m >= first);
  const use = window.length ? window : [cur];
  const series = monthSeries(s, use);
  const rev = series.reduce((a, p) => a + p.revenue, 0) / use.length;
  const exp = series.reduce((a, p) => a + p.expenses, 0) / use.length;
  return { monthlyRevenue: round2(rev), monthlyExpenses: round2(exp), monthlyProfit: round2(rev - exp), months: use.length, partial: !window.length, hasData: true, cash, payroll };
}

const pctChange = (now: number, before: number): number => (before > 0 ? ((now - before) / before) * 100 : 0);

export function analyze(s: Snapshot, profitTarget = 0): Insight[] {
  const out: Insight[] = [];
  const cur = s.today.slice(0, 7);
  const prev = addMonths(cur, -1);
  const prev2 = addMonths(cur, -2);
  const [p2, p1, p0] = monthSeries(s, [prev2, prev, cur]);

  if (s.lines.length === 0) {
    out.push({
      id: 'no-data',
      severity: 'info',
      title: lt('Not enough financial data yet', 'لا توجد بيانات مالية كافية بعد'),
      message: lt(
        'No accounting records exist yet. Record invoices, payments or expenses and the analysis will appear here.',
        'لا توجد قيود محاسبية بعد. سجّل فواتير أو مدفوعات أو مصروفات وسيظهر التحليل هنا.',
      ),
      evidence: [],
    });
    return out;
  }

  // 1) الربح هذا الشهر
  if (p0.revenue > 0 || p0.expenses > 0) {
    const margin = p0.revenue > 0 ? (p0.profit / p0.revenue) * 100 : 0;
    if (p0.profit < 0) {
      out.push({
        id: 'loss-month',
        severity: 'high',
        title: lt('The company is running at a loss this month', 'الشركة تحقق خسارة هذا الشهر'),
        message: lt('Recognized expenses exceed recognized revenue this month (accrual basis).', 'المصروفات المعترف بها أعلى من الإيرادات المعترف بها هذا الشهر (أساس الاستحقاق).'),
        evidence: [
          { label: lt('Revenue (this month)', 'الإيراد (هذا الشهر)'), value: money(p0.revenue) },
          { label: lt('Expenses (this month)', 'المصروفات (هذا الشهر)'), value: money(p0.expenses) },
          { label: lt('Net = Revenue − Expenses', 'الصافي = الإيراد − المصروفات'), value: money(p0.profit) },
        ],
        link: '/accounting/reports',
      });
    } else if (p0.revenue > 0 && margin < 10) {
      out.push({
        id: 'low-margin',
        severity: 'medium',
        title: lt('Profit margin is low', 'هامش الربح منخفض'),
        message: lt('The net margin this month is below 10%, leaving little buffer for unexpected costs.', 'صافي هامش الربح هذا الشهر أقل من 10% مما يترك هامش أمان صغير.'),
        evidence: [
          { label: lt('Net profit', 'صافي الربح'), value: money(p0.profit) },
          { label: lt('Margin = Profit ÷ Revenue', 'الهامش = الربح ÷ الإيراد'), value: pctT(margin) },
        ],
      });
    } else if (p0.profit > 0) {
      out.push({
        id: 'profit-month',
        severity: 'good',
        title: lt('The company is profitable this month', 'الشركة رابحة هذا الشهر'),
        message: lt('Revenue exceeds expenses on the accrual basis. Remember profit is not the same as available cash.', 'الإيرادات أعلى من المصروفات (أساس الاستحقاق). تذكّر أن الربح ليس هو النقدية المتاحة.'),
        evidence: [
          { label: lt('Net profit', 'صافي الربح'), value: money(p0.profit) },
          { label: lt('Margin', 'الهامش'), value: pctT(margin) },
        ],
      });
    }
  }

  // 2) تغيّر المصروفات
  const prevHasData = (first: string | null) => !!first && first <= prev2;
  const first = firstActivityMonth(s);
  if (prevHasData(first) && p2.expenses > 0) {
    const ch = pctChange(p1.expenses, p2.expenses);
    if (ch > 20) {
      out.push({
        id: 'exp-up',
        severity: ch > 50 ? 'high' : 'medium',
        title: lt('Expenses increased compared with the previous month', 'المصروفات ارتفعت مقارنة بالشهر السابق'),
        message: lt('Last month’s expenses were noticeably higher than the month before. Review the categories below.', 'مصروفات الشهر الماضي أعلى بشكل ملحوظ من الشهر الذي قبله. راجع التصنيفات.'),
        evidence: [
          { label: lt('Two months ago', 'قبل شهرين'), value: money(p2.expenses) },
          { label: lt('Last month', 'الشهر الماضي'), value: money(p1.expenses) },
          { label: lt('Change', 'التغيّر'), value: pctT(ch) },
        ],
        link: '/accounting/transactions',
      });
    }
  }
  if (p1.expenses > 0 && p0.expenses > p1.expenses) {
    out.push({
      id: 'exp-mtd',
      severity: 'medium',
      title: lt('This month’s expenses already exceed last month’s total', 'مصروفات هذا الشهر تجاوزت إجمالي الشهر الماضي بالفعل'),
      message: lt('Month-to-date expenses are higher than the full previous month.', 'مصروفات الشهر حتى الآن أعلى من إجمالي الشهر السابق كاملًا.'),
      evidence: [
        { label: lt('Last month (full)', 'الشهر الماضي (كامل)'), value: money(p1.expenses) },
        { label: lt('This month (to date)', 'هذا الشهر (حتى اليوم)'), value: money(p0.expenses) },
      ],
    });
  }

  // 3) تراجع الإيراد
  if (prevHasData(first) && p2.revenue > 0) {
    const ch = pctChange(p1.revenue, p2.revenue);
    if (ch < -15) {
      out.push({
        id: 'rev-down',
        severity: ch < -35 ? 'high' : 'medium',
        title: lt('Revenue is declining', 'الإيرادات في تراجع'),
        message: lt('Revenue last month dropped compared with the month before.', 'إيراد الشهر الماضي انخفض مقارنة بالشهر الذي قبله.'),
        evidence: [
          { label: lt('Two months ago', 'قبل شهرين'), value: money(p2.revenue) },
          { label: lt('Last month', 'الشهر الماضي'), value: money(p1.revenue) },
          { label: lt('Change', 'التغيّر'), value: pctT(ch) },
        ],
      });
    }
  }

  // 4) المبالغ غير المحصلة
  const open = outstandingInvoices(s);
  const outstanding = fromCents(open.reduce((a, i) => a + toCents(remaining(i)), 0));
  const late = overdueInvoices(s);
  const lateAmount = fromCents(late.reduce((a, i) => a + toCents(remaining(i)), 0));
  if (late.length) {
    const clientName = (id: string) => s.clients.find((c) => c.id === id)?.name || '—';
    const top = [...late].sort((a, b) => remaining(b) - remaining(a)).slice(0, 3);
    out.push({
      id: 'overdue',
      severity: lateAmount > 0 && p1.revenue > 0 && lateAmount > p1.revenue * 0.5 ? 'high' : 'medium',
      title: lt('Overdue invoices need collection', 'فواتير متأخرة تحتاج تحصيل'),
      message: lt(`${late.length} invoice(s) are past their due date.`, `يوجد ${late.length} فاتورة تجاوزت تاريخ الاستحقاق.`),
      evidence: [
        { label: lt('Overdue amount', 'المبلغ المتأخر'), value: money(lateAmount) },
        ...top.map((i) => ({
          label: textT(i.number + ' · ' + clientName(i.clientId)),
          value: lt(fmt.money(remaining(i), 'en') + ` (${daysLate(i, s.today)} days late)`, fmt.money(remaining(i), 'ar') + ` (متأخرة ${daysLate(i, s.today)} يوم)`),
        })),
      ],
      link: '/accounting/invoices',
    });
  } else if (outstanding > 0) {
    const ref = Math.max(p1.revenue, p0.revenue);
    out.push({
      id: 'uncollected',
      severity: ref > 0 && outstanding > ref * 0.5 ? 'medium' : 'low',
      title: lt('Money remains uncollected from clients', 'مبالغ لم تُحصَّل بعد من العملاء'),
      message: lt('Open invoices are not yet overdue, but they are not cash yet.', 'الفواتير المفتوحة لم تتأخر بعد لكنها ليست نقدية بعد.'),
      evidence: [
        { label: lt('Open invoices', 'فواتير مفتوحة'), value: numT(open.length, 0) },
        { label: lt('Outstanding amount', 'المبلغ المستحق'), value: money(outstanding) },
      ],
      link: '/accounting/invoices',
    });
  }

  // 5) السيولة والاستمرارية
  const cash = cashBalanceAt(s, s.today);
  const burn = burnRate(s);
  const runway = runwayMonths(cash, burn);
  if (burn.hasData && runway !== null) {
    if (runway < 3) {
      out.push({
        id: 'runway',
        severity: runway < 1.5 ? 'high' : 'medium',
        title: lt('Cash runway is short', 'مدة كفاية السيولة قصيرة'),
        message: lt('At the current spending rate the cash balance may not cover the coming months.', 'بمعدل الصرف الحالي قد لا تكفي السيولة للأشهر القادمة.'),
        evidence: [
          { label: lt('Cash balance', 'رصيد النقدية'), value: money(cash) },
          { label: lt('Monthly burn (avg)', 'معدل الصرف الشهري (متوسط)'), value: money(burn.value) },
          { label: lt('Runway = Cash ÷ Burn (months)', 'المدة = النقدية ÷ الصرف (شهر)'), value: numT(runway) },
        ],
      });
    }
  }
  const ap = fromCents(unpaidExpenses(s).reduce((a, t) => a + toCents(t.amount), 0));
  const recurringNext = fromCents(s.recurring.filter((r) => r.active).reduce((a, r) => a + toCents(r.amount), 0));
  const upcoming = round2(ap + recurringNext);
  if (upcoming > 0 && cash < upcoming) {
    out.push({
      id: 'cash-obligations',
      severity: 'high',
      title: lt('Cash may be insufficient for upcoming obligations', 'قد لا تكفي السيولة للالتزامات القادمة'),
      message: lt('Unpaid bills plus monthly recurring expenses exceed the current cash balance.', 'الفواتير غير المسددة مع المصروفات الشهرية المتكررة أكبر من رصيد النقدية.'),
      evidence: [
        { label: lt('Cash balance', 'رصيد النقدية'), value: money(cash) },
        { label: lt('Unpaid payables', 'مستحقات غير مسددة'), value: money(ap) },
        { label: lt('Monthly recurring expenses', 'مصروفات شهرية متكررة'), value: money(recurringNext) },
      ],
    });
  }

  // 6) ميزانية المشروعات
  for (const p of s.projects) {
    if (p.archived || !(p.budget > 0) || p.status === 'cancelled') continue;
    const spent = fromCents(s.transactions.filter((t) => t.type === 'expense' && !t.voided && t.projectId === p.id).reduce((a, t) => a + toCents(t.amount), 0));
    const ratio = (spent / p.budget) * 100;
    if (ratio >= 80) {
      out.push({
        id: 'proj-budget-' + p.id,
        severity: ratio > 100 ? 'high' : 'medium',
        title: lt(ratio > 100 ? `Project exceeds its budget: ${p.name}` : `Project is near its budget limit: ${p.name}`, ratio > 100 ? `المشروع تجاوز ميزانيته: ${p.name}` : `المشروع قارب على حد الميزانية: ${p.name}`),
        message: lt('Recorded expenses linked to this project compared with its budget.', 'المصروفات المسجلة على هذا المشروع مقارنة بميزانيته.'),
        evidence: [
          { label: lt('Budget', 'الميزانية'), value: money(p.budget) },
          { label: lt('Spent', 'المصروف'), value: money(spent) },
          { label: lt('Used', 'المستخدم'), value: pctT(ratio) },
        ],
        link: '/projects/' + p.id,
      });
    }
  }

  // 7) خدمات هامشها منخفض (فقط لو في مصروفات موسومة)
  for (const r of serviceProfitability(s)) {
    if (r.extra && r.revenue > 0 && r.margin < 20) {
      const label = SERVICE_TYPES.find((x) => x.value === r.id)?.label || textT(r.id);
      out.push({
        id: 'svc-' + r.id,
        severity: 'medium',
        title: lt(`Low margin on service: ${label.en}`, `هامش ربح منخفض للخدمة: ${label.ar}`),
        message: lt('Direct costs tagged to this service take a large share of its revenue.', 'التكاليف المباشرة الموسومة على هذه الخدمة تستهلك نسبة كبيرة من إيرادها.'),
        evidence: [
          { label: lt('Revenue', 'الإيراد'), value: money(r.revenue) },
          { label: lt('Tagged costs', 'التكاليف الموسومة'), value: money(r.cost) },
          { label: lt('Margin', 'الهامش'), value: pctT(r.margin) },
        ],
      });
    }
  }

  // 8) عملاء متأخرون في السداد
  const lateByClient = new Map<string, number>();
  for (const inv of s.invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;
    const pays = s.payments.filter((p) => p.invoiceId === inv.id && !p.voided);
    const paidLate = inv.status === 'paid' && pays.length > 0 && pays.reduce((m, p) => (p.date > m ? p.date : m), '') > inv.dueDate;
    const overdueOpen = (inv.status === 'issued' || inv.status === 'partial') && inv.dueDate < s.today;
    if (paidLate || overdueOpen) lateByClient.set(inv.clientId, (lateByClient.get(inv.clientId) || 0) + 1);
  }
  lateByClient.forEach((n, clientId) => {
    if (n >= 2) {
      const c = s.clients.find((x) => x.id === clientId);
      out.push({
        id: 'late-client-' + clientId,
        severity: 'medium',
        title: lt(`Client consistently pays late: ${c?.name || '—'}`, `عميل متأخر باستمرار في السداد: ${c?.name || '—'}`),
        message: lt('This client has multiple invoices paid after (or still past) the due date.', 'لدى هذا العميل عدة فواتير سُدِّدت بعد الاستحقاق أو ما زالت متأخرة.'),
        evidence: [{ label: lt('Late invoices', 'فواتير متأخرة'), value: numT(n, 0) }],
        link: '/clients/' + clientId,
      });
    }
  });

  // 9) تركّز العملاء (آخر 90 يوم تقريبًا = 3 أشهر)
  const recentMonths = monthsList(addMonths(cur, -2), cur);
  const revByClient = new Map<string, number>();
  let revTotal = 0;
  for (const inv of s.invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue;
    if (!recentMonths.includes(inv.issueDate.slice(0, 7))) continue;
    revByClient.set(inv.clientId, (revByClient.get(inv.clientId) || 0) + toCents(inv.netAmount));
    revTotal += toCents(inv.netAmount);
  }
  if (revTotal > 0 && revByClient.size >= 2) {
    const [topId, topAmt] = Array.from(revByClient.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topAmt / revTotal > 0.5) {
      const c = s.clients.find((x) => x.id === topId);
      out.push({
        id: 'concentration',
        severity: 'medium',
        title: lt('Revenue depends heavily on one client', 'الإيراد يعتمد بشكل كبير على عميل واحد'),
        message: lt('One client represents more than half of invoiced revenue in the last 3 months.', 'عميل واحد يمثل أكثر من نصف الإيراد المفوتر خلال آخر 3 أشهر.'),
        evidence: [
          { label: textT(c?.name || '—'), value: money(fromCents(topAmt)) },
          { label: lt('Share', 'النسبة'), value: pctT((topAmt / revTotal) * 100) },
        ],
      });
    }
  }

  // 10) نقطة التعادل / الهدف
  const base = baseline(s);
  if (base.hasData && base.monthlyExpenses > 0) {
    const needed = base.monthlyExpenses + profitTarget;
    const activeClients = s.clients.filter((c) => c.status === 'active' && !c.archived).length;
    const avgPerClient = activeClients > 0 ? base.monthlyRevenue / activeClients : 0;
    const gap = needed - base.monthlyRevenue;
    if (gap > 0) {
      const ev: Insight['evidence'] = [
        { label: lt('Avg monthly expenses', 'متوسط المصروفات الشهرية'), value: money(base.monthlyExpenses) },
        { label: lt(profitTarget > 0 ? 'Revenue needed (expenses + target)' : 'Break-even revenue (= expenses)', profitTarget > 0 ? 'الإيراد المطلوب (مصروفات + هدف)' : 'إيراد التعادل (= المصروفات)'), value: money(needed) },
        { label: lt('Avg monthly revenue', 'متوسط الإيراد الشهري'), value: money(base.monthlyRevenue) },
        { label: lt('Gap', 'الفجوة'), value: money(gap) },
      ];
      if (avgPerClient > 0) ev.push({ label: lt('≈ extra clients needed (gap ÷ avg per client)', '≈ عملاء إضافيون مطلوبون (الفجوة ÷ متوسط العميل)'), value: numT(Math.ceil(gap / avgPerClient), 0) });
      out.push({
        id: 'breakeven',
        severity: 'medium',
        title: lt('More revenue is needed to reach break-even / target', 'مطلوب إيراد أكبر لتحقيق التعادل / الهدف'),
        message: lt('Average revenue is below the level needed to cover expenses and the profit target.', 'متوسط الإيراد أقل من المستوى المطلوب لتغطية المصروفات وهدف الربح.'),
        evidence: ev,
      });
    }
  }

  // أولويات العرض
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3, good: 4 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export { clientProfitability, projectProfitability, serviceProfitability };
