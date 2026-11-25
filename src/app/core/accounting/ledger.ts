import { Account, FinTransaction, Invoice, InvoiceItem, JournalLine, Payment } from '../models/accounting';
import { fromCents, toCents } from '../utils/money';

/**
 * محرك دفتر الأستاذ (دوال نقية بدون اعتماد على قاعدة البيانات عشان تتختبر بسهولة).
 * كل الحسابات بتتم بالقروش (أعداد صحيحة) لتجنب أخطاء الكسور.
 */
export interface Range {
  from?: string;
  to?: string;
}

const within = (date: string, r: Range): boolean =>
  (!r.from || date >= r.from) && (!r.to || date <= r.to);

/** إجمالي المدين/الدائن (بالقروش) لكل حساب داخل نطاق تاريخ */
export function rawTotals(lines: JournalLine[], range: Range = {}): Map<string, { d: number; c: number }> {
  const map = new Map<string, { d: number; c: number }>();
  for (const l of lines) {
    if (!within(l.date, range)) continue;
    const cur = map.get(l.accountId) || { d: 0, c: 0 };
    cur.d += toCents(l.debit);
    cur.c += toCents(l.credit);
    map.set(l.accountId, cur);
  }
  return map;
}

export interface StatementRow {
  account: Account;
  amount: number;
}

export interface ProfitAndLoss {
  revenue: StatementRow[];
  expenses: StatementRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export function profitAndLoss(accounts: Account[], lines: JournalLine[], from: string, to: string): ProfitAndLoss {
  const t = rawTotals(lines, { from, to });
  const revenue: StatementRow[] = [];
  const expenses: StatementRow[] = [];
  let rev = 0;
  let exp = 0;
  for (const a of accounts) {
    const x = t.get(a.id);
    if (!x) continue;
    if (a.type === 'revenue') {
      const amt = x.c - x.d;
      if (amt !== 0) revenue.push({ account: a, amount: fromCents(amt) });
      rev += amt;
    } else if (a.type === 'expense') {
      const amt = x.d - x.c;
      if (amt !== 0) expenses.push({ account: a, amount: fromCents(amt) });
      exp += amt;
    }
  }
  const byCode = (p: StatementRow, q: StatementRow) => p.account.code.localeCompare(q.account.code);
  return {
    revenue: revenue.sort(byCode),
    expenses: expenses.sort(byCode),
    totalRevenue: fromCents(rev),
    totalExpenses: fromCents(exp),
    netIncome: fromCents(rev - exp),
  };
}

export interface BalanceSheet {
  assets: StatementRow[];
  liabilities: StatementRow[];
  equity: StatementRow[];
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export function balanceSheet(accounts: Account[], lines: JournalLine[], asOf: string): BalanceSheet {
  const t = rawTotals(lines, { to: asOf });
  const assets: StatementRow[] = [];
  const liabilities: StatementRow[] = [];
  const equity: StatementRow[] = [];
  let ta = 0;
  let tl = 0;
  let te = 0;
  let netIncome = 0;
  for (const a of accounts) {
    const x = t.get(a.id) || { d: 0, c: 0 };
    if (a.type === 'asset') {
      const amt = x.d - x.c;
      if (amt !== 0 || a.system) assets.push({ account: a, amount: fromCents(amt) });
      ta += amt;
    } else if (a.type === 'liability') {
      const amt = x.c - x.d;
      if (amt !== 0 || a.system) liabilities.push({ account: a, amount: fromCents(amt) });
      tl += amt;
    } else if (a.type === 'equity') {
      const amt = x.c - x.d;
      if (amt !== 0 || a.system) equity.push({ account: a, amount: fromCents(amt) });
      te += amt;
    } else if (a.type === 'revenue') {
      netIncome += x.c - x.d;
    } else if (a.type === 'expense') {
      netIncome -= x.d - x.c;
    }
  }
  const totalEquity = te + netIncome;
  const byCode = (p: StatementRow, q: StatementRow) => p.account.code.localeCompare(q.account.code);
  return {
    assets: assets.sort(byCode),
    liabilities: liabilities.sort(byCode),
    equity: equity.sort(byCode),
    retainedEarnings: fromCents(netIncome),
    totalAssets: fromCents(ta),
    totalLiabilities: fromCents(tl),
    totalEquity: fromCents(totalEquity),
    balanced: ta === tl + totalEquity,
  };
}

export interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export function trialBalance(accounts: Account[], lines: JournalLine[], asOf: string): TrialBalance {
  const t = rawTotals(lines, { to: asOf });
  const rows: TrialBalanceRow[] = [];
  let td = 0;
  let tc = 0;
  for (const a of [...accounts].sort((p, q) => p.code.localeCompare(q.code))) {
    const x = t.get(a.id);
    if (!x) continue;
    const net = x.d - x.c;
    if (net === 0) continue;
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    td += debit;
    tc += credit;
    rows.push({ account: a, debit: fromCents(debit), credit: fromCents(credit) });
  }
  return { rows, totalDebit: fromCents(td), totalCredit: fromCents(tc), balanced: td === tc };
}

/** الرصيد الطبيعي لحساب واحد حتى تاريخ معيّن */
export function accountBalance(account: Account, lines: JournalLine[], asOf?: string): number {
  let d = 0;
  let c = 0;
  for (const l of lines) {
    if (l.accountId !== account.id) continue;
    if (asOf && l.date > asOf) continue;
    d += toCents(l.debit);
    c += toCents(l.credit);
  }
  return fromCents(account.normal === 'debit' ? d - c : c - d);
}

// ---------------------------------------------------------------- Cash flow

export type CashSection = 'operating' | 'investing' | 'financing';

export const CASH_SECTION: Record<string, CashSection> = {
  payment: 'operating',
  income: 'operating',
  expense: 'operating',
  expense_payment: 'operating',
  manual: 'operating',
  invoice: 'operating',
  depreciation: 'operating',
  asset: 'investing',
  capital: 'financing',
  withdrawal: 'financing',
};

export interface CashFlowRow {
  source: string;
  section: CashSection;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CashFlowStatement {
  opening: number;
  closing: number;
  rows: CashFlowRow[];
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  reconciled: boolean;
}

/** قائمة التدفقات النقدية (الطريقة المباشرة) من حركة حسابات النقدية والبنك */
export function cashFlowStatement(cashAccountIds: Set<string>, lines: JournalLine[], from: string, to: string): CashFlowStatement {
  let opening = 0;
  let closing = 0;
  const bySource = new Map<string, { i: number; o: number }>();
  for (const l of lines) {
    if (!cashAccountIds.has(l.accountId)) continue;
    const net = toCents(l.debit) - toCents(l.credit);
    if (l.date < from) opening += net;
    if (l.date <= to) closing += net;
    if (l.date >= from && l.date <= to) {
      const cur = bySource.get(l.source) || { i: 0, o: 0 };
      cur.i += toCents(l.debit);
      cur.o += toCents(l.credit);
      bySource.set(l.source, cur);
    }
  }
  const rows: CashFlowRow[] = [];
  let op = 0;
  let inv = 0;
  let fin = 0;
  bySource.forEach((v, source) => {
    const section = CASH_SECTION[source] || 'operating';
    const net = v.i - v.o;
    if (v.i === 0 && v.o === 0) return;
    rows.push({ source, section, inflow: fromCents(v.i), outflow: fromCents(v.o), net: fromCents(net) });
    if (section === 'operating') op += net;
    else if (section === 'investing') inv += net;
    else fin += net;
  });
  const netChange = op + inv + fin;
  return {
    opening: fromCents(opening),
    closing: fromCents(closing),
    rows,
    operating: fromCents(op),
    investing: fromCents(inv),
    financing: fromCents(fin),
    netChange: fromCents(netChange),
    reconciled: opening + netChange === closing,
  };
}

// ---------------------------------------------------------------- Invoice math

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  netAmount: number;
  taxAmount: number;
  total: number;
}

export function invoiceTotals(items: InvoiceItem[], discount: number, taxRate: number): InvoiceTotals {
  let sub = 0;
  for (const it of items) sub += Math.round(toCents(it.unitPrice) * (Number(it.quantity) || 0));
  const disc = Math.min(Math.max(toCents(discount), 0), sub);
  const net = sub - disc;
  const tax = Math.round((net * (Number(taxRate) || 0)) / 100);
  return {
    subtotal: fromCents(sub),
    discount: fromCents(disc),
    netAmount: fromCents(net),
    taxAmount: fromCents(tax),
    total: fromCents(net + tax),
  };
}

// ---------------------------------------------------------------- Cash basis

export interface CashBasisResult {
  revenue: number;
  expenses: number;
  net: number;
  expensesByCategory: { category: string; amount: number }[];
}

/**
 * الأساس النقدي: الإيراد عند استلام النقدية (بدون ضريبة)، والمصروف عند الدفع.
 * مشتريات الأصول لا تدخل هنا (تظهر في الأنشطة الاستثمارية بقائمة التدفقات).
 * الفاتورة والدفعة لا تُحسب مرتين لأن الأساس النقدي يقرأ الدفعات فقط.
 */
export function cashBasisPL(
  invoices: Invoice[],
  payments: Payment[],
  transactions: FinTransaction[],
  from: string,
  to: string,
): CashBasisResult {
  const invMap = new Map(invoices.map((i) => [i.id, i]));
  let rev = 0;
  for (const p of payments) {
    if (p.voided || p.date < from || p.date > to) continue;
    const inv = invMap.get(p.invoiceId);
    const ratio = inv && inv.total > 0 ? inv.netAmount / inv.total : 1;
    rev += Math.round(toCents(p.amount) * ratio);
  }
  const cat = new Map<string, number>();
  let exp = 0;
  for (const t of transactions) {
    if (t.voided) continue;
    if (t.type === 'income') {
      if (t.date >= from && t.date <= to) rev += toCents(t.amount);
    } else if (t.paid) {
      const paidOn = t.paidDate || t.date;
      if (paidOn >= from && paidOn <= to) {
        exp += toCents(t.amount);
        cat.set(t.category, (cat.get(t.category) || 0) + toCents(t.amount));
      }
    }
  }
  return {
    revenue: fromCents(rev),
    expenses: fromCents(exp),
    net: fromCents(rev - exp),
    expensesByCategory: Array.from(cat.entries()).map(([category, amount]) => ({ category, amount: fromCents(amount) })),
  };
}
