import { describe, expect, it } from 'vitest';
import { Account, FinTransaction, Invoice, JournalLine, Payment } from '../models/accounting';
import { balanceSheet, cashBasisPL, cashFlowStatement, invoiceTotals, profitAndLoss, trialBalance } from './ledger';
import { cashAccountIds } from './metrics';
import { depreciationSchedule } from './depreciation';

const acc = (id: string, code: string, type: Account['type'], normal: Account['normal'], isCash = false): Account =>
  ({ id, code, nameEn: code, nameAr: code, type, normal, isCash, system: true, active: true, createdAt: '', updatedAt: '' });

const accounts: Account[] = [
  acc('cash', '1000', 'asset', 'debit', true), acc('bank', '1010', 'asset', 'debit', true), acc('ar', '1100', 'asset', 'debit'),
  acc('eq', '1500', 'asset', 'debit'), acc('ad', '1590', 'asset', 'credit'), acc('ap', '2000', 'liability', 'credit'),
  acc('tax', '2100', 'liability', 'credit'), acc('cap', '3000', 'equity', 'credit'), acc('rev', '4000', 'revenue', 'credit'),
  acc('sal', '5100', 'expense', 'debit'), acc('rent', '5400', 'expense', 'debit'), acc('dep', '5800', 'expense', 'debit'),
];

const lines: JournalLine[] = [];
function post(date: string, source: JournalLine['source'], ls: [string, number, number][]): void {
  const entryId = 'e' + lines.length;
  for (const [accountId, debit, credit] of ls) lines.push({ id: 'l' + lines.length, entryId, accountId, debit, credit, memo: '', date, source });
}
post('2026-01-01', 'capital', [['bank', 100000, 0], ['cap', 0, 100000]]);
post('2026-01-10', 'invoice', [['ar', 11400, 0], ['rev', 0, 10000], ['tax', 0, 1400]]);
post('2026-01-20', 'payment', [['cash', 5700, 0], ['ar', 0, 5700]]);
post('2026-01-31', 'expense', [['sal', 3000, 0], ['bank', 0, 3000]]);
post('2026-01-31', 'expense', [['rent', 2000, 0], ['ap', 0, 2000]]);
post('2026-01-05', 'asset', [['eq', 12000, 0], ['bank', 0, 12000]]);
post('2026-01-31', 'depreciation', [['dep', 1000, 0], ['ad', 0, 1000]]);

const invoice = { id: 'i1', total: 11400, netAmount: 10000 } as Invoice;
const payment = { id: 'p1', invoiceId: 'i1', amount: 5700, date: '2026-01-20', voided: false } as Payment;
const txs = [
  { id: 't1', type: 'expense', amount: 3000, category: 'salaries', date: '2026-01-31', paid: true, paidDate: '2026-01-31', voided: false },
  { id: 't2', type: 'expense', amount: 2000, category: 'rent_utilities', date: '2026-01-31', paid: false, voided: false },
] as FinTransaction[];

describe('ledger engine', () => {
  it('profit & loss (accrual) excludes tax and includes depreciation', () => {
    const pl = profitAndLoss(accounts, lines, '2026-01-01', '2026-01-31');
    expect(pl.totalRevenue).toBe(10000);
    expect(pl.totalExpenses).toBe(6000);
    expect(pl.netIncome).toBe(4000);
  });

  it('balance sheet balances: assets = liabilities + equity', () => {
    const bs = balanceSheet(accounts, lines, '2026-01-31');
    expect(bs.balanced).toBe(true);
    expect(bs.totalAssets).toBe(107400);
    expect(bs.totalLiabilities).toBe(3400);
    expect(bs.totalEquity).toBe(104000);
  });

  it('trial balance debits equal credits', () => {
    const tb = trialBalance(accounts, lines, '2026-01-31');
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });

  it('cash flow reconciles and separates activities', () => {
    const cf = cashFlowStatement(cashAccountIds(accounts), lines, '2026-01-01', '2026-01-31');
    expect(cf.reconciled).toBe(true);
    expect(cf.closing).toBe(90700);
    expect(cf.operating).toBe(2700);
    expect(cf.investing).toBe(-12000);
    expect(cf.financing).toBe(100000);
  });

  it('cash basis counts only received/paid money (no double counting)', () => {
    const cb = cashBasisPL([invoice], [payment], txs, '2026-01-01', '2026-01-31');
    expect(cb.revenue).toBe(5000);
    expect(cb.expenses).toBe(3000);
    expect(cb.net).toBe(2000);
  });

  it('invoice totals apply discount before tax', () => {
    const t = invoiceTotals([{ description: 'a', service: 'design', quantity: 2, unitPrice: 500 }], 100, 14);
    expect(t.subtotal).toBe(1000);
    expect(t.netAmount).toBe(900);
    expect(t.taxAmount).toBe(126);
    expect(t.total).toBe(1026);
  });

  it('straight-line depreciation reaches salvage value exactly', () => {
    const s = depreciationSchedule({ cost: 12000, salvageValue: 0, usefulLifeMonths: 12, method: 'straight_line', purchaseDate: '2026-01-05' });
    expect(s[0].amount).toBe(1000);
    expect(s[11].bookValue).toBe(0);
  });
});
