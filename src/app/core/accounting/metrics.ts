import { Account, FinTransaction, Invoice } from '../models/accounting';
import { addMonths, cairoMonth, daysBetween, endOfMonth, monthsList } from '../utils/date';
import { fromCents, round2, safeDiv, toCents } from '../utils/money';
import { balanceSheet, cashBasisPL, cashFlowStatement, profitAndLoss, rawTotals } from './ledger';
import { Snapshot } from './snapshot';

export const accountByCode = (accounts: Account[], code: string): Account | undefined =>
  accounts.find((a) => a.code === code);

export const cashAccountIds = (accounts: Account[]): Set<string> =>
  new Set(accounts.filter((a) => a.isCash).map((a) => a.id));

export function cashBalanceAt(s: Snapshot, asOf: string): number {
  const ids = cashAccountIds(s.accounts);
  let c = 0;
  for (const l of s.lines) if (ids.has(l.accountId) && l.date <= asOf) c += toCents(l.debit) - toCents(l.credit);
  return fromCents(c);
}

export function remaining(inv: Invoice): number {
  return round2(inv.total - inv.amountPaid);
}

export const isOpenInvoice = (i: Invoice): boolean =>
  (i.status === 'issued' || i.status === 'partial') && remaining(i) > 0.004;

export function outstandingInvoices(s: Snapshot): Invoice[] {
  return s.invoices.filter(isOpenInvoice);
}

export function overdueInvoices(s: Snapshot): Invoice[] {
  return outstandingInvoices(s).filter((i) => i.dueDate < s.today);
}

export function unpaidExpenses(s: Snapshot): FinTransaction[] {
  return s.transactions.filter((t) => t.type === 'expense' && !t.voided && !t.paid);
}

// -------- Monthly series (accrual + cash)

export interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashIn: number;
  cashOut: number;
}

export function monthSeries(s: Snapshot, months: string[]): MonthPoint[] {
  const ids = cashAccountIds(s.accounts);
  return months.map((m) => {
    const from = m + '-01';
    const to = endOfMonth(from);
    const pl = profitAndLoss(s.accounts, s.lines, from, to);
    let ci = 0;
    let co = 0;
    for (const l of s.lines) {
      if (!ids.has(l.accountId) || l.date < from || l.date > to) continue;
      if (l.source === 'asset' || l.source === 'capital' || l.source === 'withdrawal') continue;
      ci += toCents(l.debit);
      co += toCents(l.credit);
    }
    return {
      month: m,
      revenue: pl.totalRevenue,
      expenses: pl.totalExpenses,
      profit: pl.netIncome,
      cashIn: fromCents(ci),
      cashOut: fromCents(co),
    };
  });
}

export function firstActivityMonth(s: Snapshot): string | null {
  let min: string | null = null;
  for (const l of s.lines) if (!min || l.date < min) min = l.date;
  return min ? min.slice(0, 7) : null;
}

// -------- Burn rate & runway

export interface Burn {
  value: number;
  months: number;
  partial: boolean;
  hasData: boolean;
}

/** معدل الصرف الشهري = متوسط المصروفات النقدية التشغيلية لآخر 3 أشهر مكتملة (أو الشهر الحالي لو مفيش) */
export function burnRate(s: Snapshot): Burn {
  const cur = cairoMonth(new Date(s.today + 'T12:00:00Z'));
  const first = firstActivityMonth(s);
  if (!first) return { value: 0, months: 0, partial: false, hasData: false };
  const ids = cashAccountIds(s.accounts);
  const outForMonth = (m: string): number => {
    const from = m + '-01';
    const to = endOfMonth(from);
    let o = 0;
    for (const l of s.lines) {
      if (!ids.has(l.accountId) || l.date < from || l.date > to) continue;
      if (l.source === 'expense' || l.source === 'expense_payment') o += toCents(l.credit) - toCents(l.debit);
    }
    return fromCents(o);
  };
  const window = monthsList(addMonths(cur, -3), addMonths(cur, -1)).filter((m) => m >= first);
  if (window.length) {
    const total = window.reduce((a, m) => a + outForMonth(m), 0);
    return { value: round2(total / window.length), months: window.length, partial: false, hasData: true };
  }
  return { value: round2(outForMonth(cur)), months: 1, partial: true, hasData: true };
}

export function runwayMonths(cash: number, burn: Burn): number | null {
  if (!burn.hasData || burn.value <= 0) return null;
  return round2(cash / burn.value);
}

// -------- Accounting summary

export interface AccountingSummary {
  initialCapital: number;
  additionalCapital: number;
  withdrawals: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  netLoss: number;
  net: number;
  margin: number;
  cashBalance: number;
  receivable: number;
  payable: number;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  balanced: boolean;
  burn: Burn;
  runway: number | null;
  cashBasis: { revenue: number; expenses: number; net: number };
  cashFlowNet: number;
}

export function summary(s: Snapshot, from: string, to: string): AccountingSummary {
  const pl = profitAndLoss(s.accounts, s.lines, from, to);
  const bs = balanceSheet(s.accounts, s.lines, to);
  const cash = cashBalanceAt(s, to);
  const t = rawTotals(s.lines, { to });
  const bal = (code: string, normal: 'debit' | 'credit'): number => {
    const a = accountByCode(s.accounts, code);
    const x = a ? t.get(a.id) : undefined;
    if (!x) return 0;
    return fromCents(normal === 'debit' ? x.d - x.c : x.c - x.d);
  };
  const cap = s.capital.filter((c) => !c.voided && c.date <= to);
  const sumType = (type: string) => fromCents(cap.filter((c) => c.type === type).reduce((a, c) => a + toCents(c.amount), 0));
  const burn = burnRate(s);
  const cb = cashBasisPL(s.invoices, s.payments, s.transactions, from, to);
  const cf = cashFlowStatement(cashAccountIds(s.accounts), s.lines, from, to);
  return {
    initialCapital: sumType('initial'),
    additionalCapital: sumType('additional'),
    withdrawals: sumType('withdrawal'),
    revenue: pl.totalRevenue,
    expenses: pl.totalExpenses,
    netProfit: Math.max(pl.netIncome, 0),
    netLoss: Math.max(-pl.netIncome, 0),
    net: pl.netIncome,
    margin: pl.totalRevenue > 0 ? (pl.netIncome / pl.totalRevenue) * 100 : 0,
    cashBalance: cash,
    receivable: bal('1100', 'debit'),
    payable: bal('2000', 'credit'),
    retainedEarnings: bs.retainedEarnings,
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    equity: bs.totalEquity,
    balanced: bs.balanced,
    burn,
    runway: runwayMonths(cash, burn),
    cashBasis: { revenue: cb.revenue, expenses: cb.expenses, net: cb.net },
    cashFlowNet: cf.netChange,
  };
}

// -------- Profitability

export interface ProfitRow {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  extra?: number;
}

const activeInvoices = (s: Snapshot): Invoice[] => s.invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');

export function clientProfitability(s: Snapshot): ProfitRow[] {
  const projClient = new Map(s.projects.map((p) => [p.id, p.clientId]));
  return s.clients
    .map((c) => {
      const rev = activeInvoices(s).filter((i) => i.clientId === c.id).reduce((a, i) => a + toCents(i.netAmount), 0);
      const cost = s.transactions
        .filter((t) => t.type === 'expense' && !t.voided && (t.clientId === c.id || (t.projectId && projClient.get(t.projectId) === c.id)))
        .reduce((a, t) => a + toCents(t.amount), 0);
      return { id: c.id, name: c.name, revenue: fromCents(rev), cost: fromCents(cost), profit: fromCents(rev - cost), margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0 };
    })
    .filter((r) => r.revenue > 0 || r.cost > 0)
    .sort((a, b) => b.profit - a.profit);
}

export function projectProfitability(s: Snapshot): ProfitRow[] {
  return s.projects
    .map((p) => {
      const rev = activeInvoices(s).filter((i) => i.projectId === p.id).reduce((a, i) => a + toCents(i.netAmount), 0);
      const cost = s.transactions.filter((t) => t.type === 'expense' && !t.voided && t.projectId === p.id).reduce((a, t) => a + toCents(t.amount), 0);
      return { id: p.id, name: p.name, revenue: fromCents(rev), cost: fromCents(cost), profit: fromCents(rev - cost), margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0, extra: p.budget };
    })
    .filter((r) => r.revenue > 0 || r.cost > 0 || (r.extra || 0) > 0)
    .sort((a, b) => b.profit - a.profit);
}

/** ربحية الخدمات: الإيراد من بنود الفواتير (بعد توزيع الخصم) مقابل المصروفات الموسومة بنفس الخدمة */
export function serviceProfitability(s: Snapshot): ProfitRow[] {
  const rev = new Map<string, number>();
  for (const inv of activeInvoices(s)) {
    const sub = inv.items.reduce((a, it) => a + toCents(it.unitPrice) * (Number(it.quantity) || 0), 0);
    for (const it of inv.items) {
      const line = toCents(it.unitPrice) * (Number(it.quantity) || 0);
      const net = sub > 0 ? (line * toCents(inv.netAmount)) / sub : 0;
      const key = it.service || 'other';
      rev.set(key, (rev.get(key) || 0) + net);
    }
  }
  const cost = new Map<string, number>();
  for (const t of s.transactions) {
    if (t.type !== 'expense' || t.voided || !t.service) continue;
    cost.set(t.service, (cost.get(t.service) || 0) + toCents(t.amount));
  }
  const keys = new Set<string>([...rev.keys(), ...cost.keys()]);
  return Array.from(keys).map((k) => {
    const r = Math.round(rev.get(k) || 0) / 100;
    const c = (cost.get(k) || 0) / 100;
    return { id: k, name: k, revenue: r, cost: c, profit: round2(r - c), margin: r > 0 ? ((r - c) / r) * 100 : 0, extra: cost.has(k) ? 1 : 0 };
  });
}

export function daysLate(inv: Invoice, today: string): number {
  return Math.max(0, daysBetween(inv.dueDate, today));
}

export { cashBasisPL, safeDiv };
