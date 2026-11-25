import { LocalizedText } from '../models/common';
import { Snapshot } from '../accounting/snapshot';
import { baseline, lt, money, numT, pctT, textT } from './analyzer';
import {
  burnRate,
  cashBalanceAt,
  clientProfitability,
  monthSeries,
  outstandingInvoices,
  remaining,
  runwayMonths,
} from '../accounting/metrics';
import { profitAndLoss } from '../accounting/ledger';
import { endOfMonth, startOfMonth } from '../utils/date';
import { normalizeDigits } from '../utils/format';
import { EXPENSE_CATEGORIES } from '../constants/options';
import { fromCents, round2, toCents } from '../utils/money';
import { simulate } from './simulator';

export interface AssistantAnswer {
  text: LocalizedText;
  rows: { label: LocalizedText; value: LocalizedText }[];
  /** خطوات الحساب لشفافية الإجابة */
  calc: LocalizedText[];
}

export const SUGGESTED_QUESTIONS: LocalizedText[] = [
  lt('Is the company profitable?', 'هل الشركة تحقق ربحًا؟'),
  lt('How much did we earn this month?', 'كم كسبنا هذا الشهر؟'),
  lt('How much did we spend this month?', 'كم صرفنا هذا الشهر؟'),
  lt('What is our current net profit?', 'ما هو صافي الربح الحالي؟'),
  lt('How much money do clients owe us?', 'كم يدين لنا العملاء؟'),
  lt('What are our highest expenses?', 'ما هي أعلى مصروفاتنا؟'),
  lt('Can we afford to hire a new employee at 8000?', 'هل نستطيع توظيف موظف جديد براتب 8000؟'),
  lt('Can we afford to buy equipment for 30000?', 'هل نستطيع شراء معدات بـ 30000؟'),
  lt('What happens if salaries increase by 15%?', 'ماذا يحدث لو زادت المرتبات 15%؟'),
  lt('What happens if we lose a client?', 'ماذا يحدث لو خسرنا عميلًا؟'),
  lt('How much revenue do we need to reach 50000 profit?', 'كم إيراد نحتاج لنصل لربح 50000؟'),
];

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

function firstNumber(q: string): number | null {
  const m = normalizeDigits(q).replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** مساعد مالي محلي قائم على قواعد (ليس نموذج ذكاء اصطناعي). كل إجابة معها الأرقام وخطوات الحساب. */
export function answerQuestion(question: string, s: Snapshot, profitTarget = 0): AssistantAnswer {
  const q = normalizeDigits(question).toLowerCase().trim();
  const cur = s.today.slice(0, 7);
  const from = startOfMonth(s.today);
  const to = endOfMonth(s.today);
  const pl = profitAndLoss(s.accounts, s.lines, from, to);
  const allPl = profitAndLoss(s.accounts, s.lines, '0000-01-01', '9999-12-31');
  const base = baseline(s);
  const noData: AssistantAnswer = {
    text: lt('There is no recorded financial data yet, so I cannot answer reliably.', 'لا توجد بيانات مالية مسجلة بعد، لذلك لا أستطيع الإجابة بدقة.'),
    rows: [],
    calc: [],
  };
  const needsData = s.lines.length === 0;

  // --- ماذا يحدث لو زادت المرتبات
  if (has(q, ['salar', 'مرتب', 'مرتبات', 'رواتب']) && has(q, ['increase', 'raise', 'زاد', 'زيادة', 'ترفع', 'رفع', '%'])) {
    const pct = firstNumber(q) ?? 10;
    const r = simulate(base, { type: 'raise_salaries', amount: 0, percent: pct, horizon: 6 });
    return {
      text: lt(
        `A ${pct}% salary increase adds about ${r.monthlyExpenseDelta.toFixed(2)} EGP per month. Monthly profit would move from ${r.currentProfit.toFixed(2)} to ${r.projectedProfit.toFixed(2)} EGP.`,
        `زيادة المرتبات ${pct}% تضيف حوالي ${r.monthlyExpenseDelta.toFixed(2)} ج.م شهريًا. الربح الشهري سيتغير من ${r.currentProfit.toFixed(2)} إلى ${r.projectedProfit.toFixed(2)} ج.م.`,
      ),
      rows: [
        { label: lt('Monthly payroll (active employees)', 'المرتبات الشهرية (الموظفون النشطون)'), value: money(base.payroll) },
        { label: lt('Added cost per month', 'التكلفة الإضافية شهريًا'), value: money(r.monthlyExpenseDelta) },
        { label: lt('Current monthly profit (avg)', 'الربح الشهري الحالي (متوسط)'), value: money(r.currentProfit) },
        { label: lt('Projected monthly profit', 'الربح الشهري المتوقع'), value: money(r.projectedProfit) },
      ],
      calc: [lt(`Payroll × ${pct}% = ${r.monthlyExpenseDelta.toFixed(2)}`, `المرتبات × ${pct}% = ${r.monthlyExpenseDelta.toFixed(2)}`)],
    };
  }

  // --- هل نستطيع توظيف
  if (has(q, ['hire', 'employee', 'توظيف', 'نوظف', 'موظف جديد', 'تعيين'])) {
    const salaries = s.employees.filter((e) => !e.archived && e.monthlySalary > 0);
    const avg = salaries.length ? salaries.reduce((a, e) => a + e.monthlySalary, 0) / salaries.length : 0;
    const salary = firstNumber(q) ?? round2(avg);
    if (!salary) return { text: lt('Tell me the expected monthly salary, e.g. “Can we afford to hire at 8000?”', 'اذكر الراتب الشهري المتوقع، مثال: "هل نستطيع توظيف براتب 8000؟"'), rows: [], calc: [] };
    if (needsData) return noData;
    const r = simulate(base, { type: 'hire', amount: salary, percent: 0, horizon: 6 });
    const ok = r.projectedProfit >= 0 && r.projectedCash >= 0;
    return {
      text: lt(
        ok ? 'Yes, based on recent averages the company can absorb this hire, but monitor cash.' : 'Not comfortably. Based on recent averages this hire would push the result negative.',
        ok ? 'نعم، وفق المتوسطات الأخيرة تستطيع الشركة تحمل هذا التعيين، مع متابعة السيولة.' : 'ليس بسهولة. وفق المتوسطات الأخيرة هذا التعيين سيجعل النتيجة سالبة.',
      ),
      rows: [
        { label: lt('Monthly salary', 'الراتب الشهري'), value: money(salary) },
        { label: lt('Current monthly profit (avg)', 'الربح الشهري الحالي (متوسط)'), value: money(r.currentProfit) },
        { label: lt('Projected monthly profit', 'الربح الشهري المتوقع'), value: money(r.projectedProfit) },
        { label: lt('Projected cash after 6 months', 'النقدية المتوقعة بعد 6 أشهر'), value: money(r.projectedCash) },
      ],
      calc: [lt('Projected profit = current profit − new salary', 'الربح المتوقع = الربح الحالي − الراتب الجديد')],
    };
  }

  // --- هل نستطيع شراء معدات
  if (has(q, ['equipment', 'buy', 'purchase', 'معدات', 'شراء', 'نشتري', 'جهاز'])) {
    const amount = firstNumber(q);
    if (!amount) return { text: lt('Tell me the purchase amount, e.g. “Can we afford equipment for 30000?”', 'اذكر قيمة الشراء، مثال: "هل نستطيع شراء معدات بـ 30000؟"'), rows: [], calc: [] };
    if (needsData) return noData;
    const cash = cashBalanceAt(s, s.today);
    const burn = burnRate(s);
    const after = round2(cash - amount);
    const months = burn.value > 0 ? after / burn.value : null;
    const ok = after > 0 && (months === null || months >= 3);
    return {
      text: lt(
        ok ? 'Yes. The purchase is affordable and still leaves a reasonable cash buffer.' : after < 0 ? 'No. The purchase is larger than the available cash.' : 'Risky. It would leave less than 3 months of runway.',
        ok ? 'نعم. الشراء ممكن ويترك هامش سيولة معقول.' : after < 0 ? 'لا. قيمة الشراء أكبر من النقدية المتاحة.' : 'محفوف بالمخاطر. سيترك أقل من 3 أشهر من السيولة.',
      ),
      rows: [
        { label: lt('Cash now', 'النقدية الحالية'), value: money(cash) },
        { label: lt('Purchase', 'الشراء'), value: money(amount) },
        { label: lt('Cash after purchase', 'النقدية بعد الشراء'), value: money(after) },
        { label: lt('Monthly burn (avg)', 'معدل الصرف الشهري'), value: money(burn.value) },
        ...(months !== null ? [{ label: lt('Runway after purchase (months)', 'مدة كفاية السيولة بعد الشراء (شهر)'), value: numT(months) }] : []),
      ],
      calc: [lt('Cash after = cash − purchase; runway = cash after ÷ burn', 'النقدية بعد = النقدية − الشراء؛ المدة = النقدية بعد ÷ الصرف')],
    };
  }

  // --- ماذا لو خسرنا عميل
  if (has(q, ['lose a client', 'lose client', 'losing', 'خسرنا', 'نخسر', 'خسارة عميل', 'فقد عميل', 'خسر عميل'])) {
    if (needsData) return noData;
    const ranked = clientProfitability(s);
    const named = s.clients.find((c) => q.includes(c.name.toLowerCase()));
    const target = named ? ranked.find((r) => r.id === named.id) : ranked.sort((a, b) => b.revenue - a.revenue)[0];
    if (!target) return { text: lt('No client revenue is recorded yet.', 'لا توجد إيرادات عملاء مسجلة بعد.'), rows: [], calc: [] };
    const monthsActive = Math.max(1, base.months);
    const monthlyRev = round2(target.revenue / Math.max(1, monthsActive));
    const r = simulate(base, { type: 'lose_client', amount: monthlyRev, percent: 0, horizon: 6 });
    return {
      text: lt(
        `Losing ${target.name} would reduce monthly revenue by roughly ${monthlyRev.toFixed(2)} EGP.`,
        `خسارة ${target.name} ستخفض الإيراد الشهري بحوالي ${monthlyRev.toFixed(2)} ج.م.`,
      ),
      rows: [
        { label: lt('Client', 'العميل'), value: textT(target.name) },
        { label: lt('Total invoiced to this client', 'إجمالي المفوتر لهذا العميل'), value: money(target.revenue) },
        { label: lt('Estimated monthly revenue', 'الإيراد الشهري التقديري'), value: money(monthlyRev) },
        { label: lt('Monthly profit after loss', 'الربح الشهري بعد الخسارة'), value: money(r.projectedProfit) },
      ],
      calc: [lt(`Estimated monthly revenue = total invoiced ÷ ${monthsActive} month(s) of history`, `الإيراد الشهري التقديري = إجمالي المفوتر ÷ ${monthsActive} شهر من التاريخ`)],
    };
  }

  // --- كم إيراد نحتاج
  if (has(q, ['need', 'target', 'reach', 'نحتاج', 'هدف', 'لنصل', 'نصل']) && has(q, ['revenue', 'income', 'profit', 'إيراد', 'ربح', 'دخل'])) {
    if (needsData) return noData;
    const target = firstNumber(q) ?? profitTarget;
    const needed = round2(base.monthlyExpenses + target);
    return {
      text: lt(
        `To reach a monthly profit of ${target.toFixed(2)} EGP you need about ${needed.toFixed(2)} EGP in monthly revenue.`,
        `لتحقيق ربح شهري ${target.toFixed(2)} ج.م تحتاج إيرادًا شهريًا حوالي ${needed.toFixed(2)} ج.م.`,
      ),
      rows: [
        { label: lt('Avg monthly expenses', 'متوسط المصروفات الشهرية'), value: money(base.monthlyExpenses) },
        { label: lt('Profit target', 'هدف الربح'), value: money(target) },
        { label: lt('Revenue needed', 'الإيراد المطلوب'), value: money(needed) },
        { label: lt('Avg monthly revenue now', 'متوسط الإيراد الشهري الآن'), value: money(base.monthlyRevenue) },
        { label: lt('Gap', 'الفجوة'), value: money(Math.max(0, needed - base.monthlyRevenue)) },
      ],
      calc: [lt('Revenue needed = average monthly expenses + profit target', 'الإيراد المطلوب = متوسط المصروفات الشهرية + هدف الربح')],
    };
  }

  // --- العملاء مدينون
  if (has(q, ['owe', 'owed', 'receivable', 'يدين', 'مديونية', 'مستحق', 'يدينون', 'المتأخرات', 'نحصل'])) {
    const open = outstandingInvoices(s);
    const total = fromCents(open.reduce((a, i) => a + toCents(remaining(i)), 0));
    const byClient = new Map<string, number>();
    open.forEach((i) => byClient.set(i.clientId, (byClient.get(i.clientId) || 0) + toCents(remaining(i))));
    const rows = Array.from(byClient.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, c]) => ({ label: textT(s.clients.find((x) => x.id === id)?.name || '—'), value: money(fromCents(c)) }));
    return {
      text: lt(`Clients currently owe ${total.toFixed(2)} EGP across ${open.length} open invoice(s).`, `يدين العملاء حاليًا بمبلغ ${total.toFixed(2)} ج.م عبر ${open.length} فاتورة مفتوحة.`),
      rows,
      calc: [lt('Sum of (invoice total − amount paid) for issued/partial invoices', 'مجموع (إجمالي الفاتورة − المدفوع) للفواتير الصادرة/الجزئية')],
    };
  }

  // --- أعلى المصروفات
  if (has(q, ['highest expense', 'top expense', 'biggest', 'أعلى', 'اكبر', 'أكبر']) && has(q, ['expense', 'spend', 'مصروف', 'مصروفات', 'نصرف'])) {
    if (needsData) return noData;
    const cats = new Map<string, number>();
    s.transactions.filter((t) => t.type === 'expense' && !t.voided && t.date >= from && t.date <= to).forEach((t) => cats.set(t.category, (cats.get(t.category) || 0) + toCents(t.amount)));
    const rows = Array.from(cats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ label: EXPENSE_CATEGORIES.find((c) => c.value === k)?.label || textT(k), value: money(fromCents(v)) }));
    if (!rows.length) return { text: lt('No expenses were recorded this month.', 'لا توجد مصروفات مسجلة هذا الشهر.'), rows: [], calc: [] };
    return { text: lt('These are the highest expense categories this month.', 'هذه أعلى تصنيفات المصروفات هذا الشهر.'), rows, calc: [lt('Sum of recorded expenses by category for the current month', 'مجموع المصروفات المسجلة لكل تصنيف في الشهر الحالي')] };
  }

  // --- كم صرفنا
  if (has(q, ['spend', 'spent', 'expense', 'صرفنا', 'مصروف', 'مصروفات', 'ننفق', 'أنفقنا'])) {
    if (needsData) return noData;
    return {
      text: lt(`Expenses this month are ${pl.totalExpenses.toFixed(2)} EGP (accrual basis).`, `مصروفات هذا الشهر ${pl.totalExpenses.toFixed(2)} ج.م (أساس الاستحقاق).`),
      rows: pl.expenses.map((r) => ({ label: lt(r.account.nameEn, r.account.nameAr), value: money(r.amount) })),
      calc: [lt('Sum of expense accounts from the 1st of this month to today', 'مجموع حسابات المصروفات من أول الشهر حتى اليوم')],
    };
  }

  // --- كم كسبنا
  if (has(q, ['earn', 'revenue', 'income', 'كسبنا', 'إيراد', 'ايراد', 'دخل', 'ربحنا'])) {
    if (needsData) return noData;
    const cur2 = monthSeries(s, [cur])[0];
    return {
      text: lt(`Revenue this month is ${pl.totalRevenue.toFixed(2)} EGP (accrual); cash received is ${cur2.cashIn.toFixed(2)} EGP.`, `إيراد هذا الشهر ${pl.totalRevenue.toFixed(2)} ج.م (استحقاق)، والنقدية المستلمة ${cur2.cashIn.toFixed(2)} ج.م.`),
      rows: pl.revenue.map((r) => ({ label: lt(r.account.nameEn, r.account.nameAr), value: money(r.amount) })),
      calc: [lt('Accrual revenue counts invoices when issued; cash counts only money received', 'إيراد الاستحقاق يحتسب الفواتير عند الإصدار؛ والنقدي يحتسب المستلم فقط')],
    };
  }

  // --- صافي الربح
  if (has(q, ['net profit', 'صافي', 'الربح الحالي'])) {
    if (needsData) return noData;
    return {
      text: lt(`Net profit this month is ${pl.netIncome.toFixed(2)} EGP; all-time is ${allPl.netIncome.toFixed(2)} EGP.`, `صافي الربح هذا الشهر ${pl.netIncome.toFixed(2)} ج.م، وإجمالي الربح منذ البداية ${allPl.netIncome.toFixed(2)} ج.م.`),
      rows: [
        { label: lt('Revenue (month)', 'الإيراد (الشهر)'), value: money(pl.totalRevenue) },
        { label: lt('Expenses (month)', 'المصروفات (الشهر)'), value: money(pl.totalExpenses) },
        { label: lt('Net profit (month)', 'صافي الربح (الشهر)'), value: money(pl.netIncome) },
        { label: lt('Net profit (all time)', 'صافي الربح (منذ البداية)'), value: money(allPl.netIncome) },
      ],
      calc: [lt('Net profit = revenue − expenses', 'صافي الربح = الإيراد − المصروفات')],
    };
  }

  // --- هل الشركة رابحة
  if (has(q, ['profitable', 'profit', 'رابح', 'ربح', 'تحقق', 'خسارة'])) {
    if (needsData) return noData;
    const profitable = pl.netIncome > 0;
    const cash = cashBalanceAt(s, s.today);
    const burn = burnRate(s);
    const runway = runwayMonths(cash, burn);
    return {
      text: lt(
        profitable ? `Yes, this month shows a profit of ${pl.netIncome.toFixed(2)} EGP.` : pl.netIncome === 0 ? 'This month is exactly break-even.' : `No, this month shows a loss of ${Math.abs(pl.netIncome).toFixed(2)} EGP.`,
        profitable ? `نعم، هذا الشهر محقق ربحًا قدره ${pl.netIncome.toFixed(2)} ج.م.` : pl.netIncome === 0 ? 'هذا الشهر عند نقطة التعادل تمامًا.' : `لا، هذا الشهر محقق خسارة قدرها ${Math.abs(pl.netIncome).toFixed(2)} ج.م.`,
      ),
      rows: [
        { label: lt('Revenue', 'الإيراد'), value: money(pl.totalRevenue) },
        { label: lt('Expenses', 'المصروفات'), value: money(pl.totalExpenses) },
        { label: lt('Net profit', 'صافي الربح'), value: money(pl.netIncome) },
        { label: lt('Profit margin', 'هامش الربح'), value: pctT(pl.totalRevenue > 0 ? (pl.netIncome / pl.totalRevenue) * 100 : 0) },
        { label: lt('Cash balance (not the same as profit)', 'رصيد النقدية (ليس هو الربح)'), value: money(cash) },
        ...(runway !== null ? [{ label: lt('Runway (months)', 'مدة كفاية السيولة (شهر)'), value: numT(runway) }] : []),
      ],
      calc: [lt('Profit = recognised revenue − recognised expenses (accrual basis)', 'الربح = الإيراد المعترف به − المصروفات المعترف بها (أساس الاستحقاق)')],
    };
  }

  return {
    text: lt('I could not match that question. I am a local rule-based assistant, not a conversational AI. Try one of the suggested questions.', 'لم أتمكن من فهم هذا السؤال. أنا مساعد محلي قائم على قواعد وليس ذكاءً اصطناعيًا محادثيًا. جرّب أحد الأسئلة المقترحة.'),
    rows: [],
    calc: [],
  };
}
