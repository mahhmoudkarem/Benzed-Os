import { Injectable, inject } from '@angular/core';
import { DbService } from '../services/db.service';
import { SettingsService } from '../services/settings.service';
import { ActivityService } from '../services/activity.service';
import { ACC } from '../services/seed.service';
import { Account, Asset, CapitalTx, FinTransaction, Invoice, InvoiceItem, JournalEntry, JournalLine, JournalSource, Payment } from '../models/accounting';
import { CATEGORY_ACCOUNT } from '../constants/options';
import { addMonths, cairoDate, endOfMonth, isoNow, monthsList } from '../utils/date';
import { fmt } from '../utils/format';
import { toCents, fromCents, round2 } from '../utils/money';
import { uid } from '../utils/id';
import { invoiceTotals } from './ledger';
import { depreciationSchedule } from './depreciation';

export interface PostLineInput {
  code?: string;
  accountId?: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface PostInput {
  date: string;
  memo: string;
  source: JournalSource;
  sourceId?: string;
  lines: PostLineInput[];
  reversalOf?: string;
  reversalReason?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number, w: number) => String(n).padStart(w, '0');

export interface InvoiceInput {
  id?: string;
  clientId: string;
  projectId?: string;
  items: InvoiceItem[];
  discount: number;
  taxRate: number;
  issueDate: string;
  dueDate: string;
  notes: string;
}

/**
 * محرك القيد المزدوج + قواعد الترحيل لكل العمليات المالية.
 * كل عملية مركّبة بتتم داخل transaction واحدة (كلها تنجح أو كلها تفشل).
 */
@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly db = inject(DbService).db;
  private readonly settings = inject(SettingsService);
  private readonly activity = inject(ActivityService);

  private tx<T>(fn: () => Promise<T>): Promise<T> {
    return this.db.transaction('rw', this.db.tables, fn) as Promise<T>;
  }

  async accountByCode(code: string): Promise<Account> {
    const a = await this.db.accounts.where('code').equals(code).first();
    if (!a) throw new Error('Account not found: ' + code);
    return a;
  }

  private cashCode(method: string): string {
    return method === 'cash' ? ACC.CASH : ACC.BANK;
  }

  // ------------------------------------------------------------------ core posting

  postEntry(input: PostInput): Promise<JournalEntry> {
    return this.tx(() => this.postInner(input));
  }

  private async postInner(input: PostInput): Promise<JournalEntry> {
    if (!DATE_RE.test(input.date || '')) throw new Error('Invalid entry date.');
    const period = await this.db.periods.where('key').equals(input.date.slice(0, 7)).first();
    if (period) throw new Error('The financial period ' + input.date.slice(0, 7) + ' is closed.');
    if (!input.lines || input.lines.length < 2) throw new Error('A journal entry needs at least two lines.');

    const entryId = uid();
    const now = isoNow();
    let totalD = 0;
    let totalC = 0;
    const lines: JournalLine[] = [];
    for (const l of input.lines) {
      const acct = l.accountId ? await this.db.accounts.get(l.accountId) : await this.accountByCode(l.code || '');
      if (!acct) throw new Error('Account not found for a journal line.');
      if (!acct.active && !input.reversalOf) throw new Error('Account ' + acct.code + ' is inactive.');
      const d = toCents(l.debit || 0);
      const c = toCents(l.credit || 0);
      if (d < 0 || c < 0) throw new Error('Negative amounts are not allowed.');
      if (d > 0 && c > 0) throw new Error('A line cannot have both debit and credit.');
      if (d === 0 && c === 0) throw new Error('Every line needs a debit or a credit amount.');
      totalD += d;
      totalC += c;
      lines.push({
        id: uid(),
        entryId,
        accountId: acct.id,
        debit: fromCents(d),
        credit: fromCents(c),
        memo: l.memo || '',
        date: input.date,
        source: input.source,
      });
    }
    if (totalD !== totalC) throw new Error('Total debits must equal total credits.');
    if (totalD <= 0) throw new Error('Entry total must be greater than zero.');

    const n = await this.settings.nextCounter('journal');
    const entry: JournalEntry = {
      id: entryId,
      number: 'JE-' + pad(n, 6),
      date: input.date,
      memo: input.memo,
      source: input.source,
      sourceId: input.sourceId,
      status: 'posted',
      reversalOf: input.reversalOf,
      reversalReason: input.reversalReason,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.journalEntries.add(entry);
    await this.db.journalLines.bulkAdd(lines);
    return entry;
  }

  /** قيد عكسي موثّق. sameDate=true بيحط القيد العكسي بنفس تاريخ الأصل (لو الفترة مفتوحة). */
  reverseEntry(entryId: string, reason: string, date?: string, sameDate = false): Promise<JournalEntry> {
    return this.tx(() => this.reverseInner(entryId, reason, date, sameDate));
  }

  private async reverseInner(entryId: string, reason: string, date?: string, sameDate = false): Promise<JournalEntry> {
    const e = await this.db.journalEntries.get(entryId);
    if (!e) throw new Error('Journal entry not found.');
    if (e.reversedBy) throw new Error('This entry has already been reversed.');
    if (e.reversalOf) throw new Error('A reversal entry cannot be reversed again.');
    if (!reason || !reason.trim()) throw new Error('A reason is required for a reversal.');
    const lines = await this.db.journalLines.where('entryId').equals(entryId).toArray();
    let useDate = date || cairoDate();
    if (sameDate) {
      const closed = await this.db.periods.where('key').equals(e.date.slice(0, 7)).first();
      useDate = closed ? cairoDate() : e.date;
    }
    const rev = await this.postInner({
      date: useDate,
      memo: 'Reversal of ' + e.number + ': ' + reason.trim(),
      source: e.source,
      sourceId: e.sourceId,
      reversalOf: e.id,
      reversalReason: reason.trim(),
      lines: lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, memo: l.memo })),
    });
    await this.db.journalEntries.update(e.id, { reversedBy: rev.id } as any);
    await this.activity.log('journal_reversed', 'journal', e.id, 'Journal entry ' + e.number + ' reversed: ' + reason, 'تم عكس القيد ' + e.number + ': ' + reason);
    return rev;
  }

  async postManual(date: string, memo: string, lines: PostLineInput[]): Promise<JournalEntry> {
    if (!memo.trim()) throw new Error('A description is required.');
    const e = await this.postEntry({ date, memo: memo.trim(), source: 'manual', lines });
    await this.activity.log('entry_posted', 'journal', e.id, 'Manual journal entry posted: ' + e.number, 'تم ترحيل قيد يدوي: ' + e.number);
    return e;
  }

  // ------------------------------------------------------------------ periods

  async closePeriod(month: string): Promise<void> {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid period.');
    const exists = await this.db.periods.where('key').equals(month).first();
    if (exists) return;
    const now = isoNow();
    await this.db.periods.add({ id: uid(), key: month, status: 'closed', createdAt: now, updatedAt: now });
    await this.activity.log('period_closed', 'period', month, 'Period closed: ' + month, 'تم إغلاق الفترة: ' + month);
  }

  async reopenPeriod(month: string): Promise<void> {
    await this.db.periods.where('key').equals(month).delete();
    await this.activity.log('period_reopened', 'period', month, 'Period reopened: ' + month, 'تم إعادة فتح الفترة: ' + month);
  }

  // ------------------------------------------------------------------ invoices

  saveInvoice(input: InvoiceInput, issue: boolean): Promise<Invoice> {
    return this.tx(async () => {
      if (!input.clientId) throw new Error('Select a client.');
      const items = (input.items || []).filter((i) => (i.description || '').trim() || i.unitPrice);
      if (!items.length) throw new Error('Add at least one invoice item.');
      for (const it of items) {
        if (!(Number(it.quantity) > 0)) throw new Error('Item quantity must be greater than zero.');
        if (!(Number(it.unitPrice) >= 0)) throw new Error('Unit price cannot be negative.');
      }
      if (input.dueDate < input.issueDate) throw new Error('Due date cannot be before the issue date.');
      const t = invoiceTotals(items, input.discount, input.taxRate);
      if (t.total <= 0) throw new Error('Invoice total must be greater than zero.');
      const now = isoNow();
      let inv: Invoice;
      if (input.id) {
        const existing = await this.db.invoices.get(input.id);
        if (!existing) throw new Error('Invoice not found.');
        if (existing.status !== 'draft') throw new Error('Only draft invoices can be edited. Cancel and re-issue instead.');
        inv = { ...existing, ...this.invFields(input, items, t), updatedAt: now };
        await this.db.invoices.put(inv);
      } else {
        const n = await this.settings.nextCounter('invoice');
        inv = {
          id: uid(),
          number: 'INV-' + input.issueDate.slice(0, 4) + '-' + pad(n, 4),
          ...this.invFields(input, items, t),
          amountPaid: 0,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        } as Invoice;
        await this.db.invoices.add(inv);
      }
      if (issue) inv = await this.issueInner(inv.id);
      else await this.activity.log('invoice_created', 'invoice', inv.id, 'Invoice draft saved: ' + inv.number, 'تم حفظ مسودة فاتورة: ' + inv.number);
      return inv;
    });
  }

  private invFields(input: InvoiceInput, items: InvoiceItem[], t: ReturnType<typeof invoiceTotals>) {
    return {
      clientId: input.clientId,
      projectId: input.projectId || undefined,
      items: items.map((i) => ({ description: i.description, service: i.service || 'other', quantity: Number(i.quantity), unitPrice: round2(i.unitPrice) })),
      discount: t.discount,
      taxRate: Number(input.taxRate) || 0,
      subtotal: t.subtotal,
      netAmount: t.netAmount,
      taxAmount: t.taxAmount,
      total: t.total,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      notes: input.notes || '',
    };
  }

  issueInvoice(id: string): Promise<Invoice> {
    return this.tx(() => this.issueInner(id));
  }

  private async issueInner(id: string): Promise<Invoice> {
    const inv = await this.db.invoices.get(id);
    if (!inv) throw new Error('Invoice not found.');
    if (inv.status !== 'draft') throw new Error('Invoice is already issued.');
    const lines: PostLineInput[] = [
      { code: ACC.AR, debit: inv.total, memo: inv.number },
      { code: ACC.REVENUE, credit: inv.netAmount, memo: inv.number },
    ];
    if (inv.taxAmount > 0) lines.push({ code: ACC.TAX_PAYABLE, credit: inv.taxAmount, memo: inv.number });
    const e = await this.postInner({ date: inv.issueDate, memo: 'Invoice ' + inv.number, source: 'invoice', sourceId: inv.id, lines });
    await this.db.invoices.update(id, { status: 'issued', journalEntryId: e.id, updatedAt: isoNow() } as any);
    await this.activity.log(
      'invoice_created',
      'invoice',
      id,
      'Invoice issued: ' + inv.number + ' (' + fmt.money(inv.total, 'en') + ')',
      'تم إصدار الفاتورة: ' + inv.number + ' (' + fmt.money(inv.total, 'ar') + ')',
    );
    return (await this.db.invoices.get(id)) as Invoice;
  }

  cancelInvoice(id: string, reason: string): Promise<void> {
    return this.tx(async () => {
      const inv = await this.db.invoices.get(id);
      if (!inv) throw new Error('Invoice not found.');
      if (inv.status === 'draft') {
        await this.db.invoices.update(id, { status: 'cancelled', updatedAt: isoNow() } as any);
        return;
      }
      if (inv.status !== 'issued') throw new Error('Only issued invoices with no active payments can be cancelled. Void the payments first.');
      if (!inv.journalEntryId) throw new Error('Invoice has no journal entry.');
      const rev = await this.reverseInner(inv.journalEntryId, reason, undefined, true);
      await this.db.invoices.update(id, { status: 'cancelled', cancelEntryId: rev.id, updatedAt: isoNow() } as any);
      await this.activity.log('invoice_cancelled', 'invoice', id, 'Invoice cancelled: ' + inv.number, 'تم إلغاء الفاتورة: ' + inv.number);
    });
  }

  deleteDraftInvoice(id: string): Promise<void> {
    return this.tx(async () => {
      const inv = await this.db.invoices.get(id);
      if (!inv) return;
      if (inv.status !== 'draft') throw new Error('Only draft invoices can be deleted.');
      await this.db.invoices.delete(id);
    });
  }

  // ------------------------------------------------------------------ payments

  recordPayment(input: { invoiceId: string; amount: number; date: string; method: string; reference: string; notes: string }): Promise<Payment> {
    return this.tx(async () => {
      const inv = await this.db.invoices.get(input.invoiceId);
      if (!inv) throw new Error('Invoice not found.');
      if (inv.status !== 'issued' && inv.status !== 'partial') throw new Error('Payments can only be recorded on open issued invoices.');
      const amount = round2(input.amount);
      if (!(amount > 0)) throw new Error('Payment amount must be greater than zero.');
      const remaining = round2(inv.total - inv.amountPaid);
      if (toCents(amount) > toCents(remaining)) throw new Error('Payment exceeds the remaining balance (' + fmt.money(remaining, 'en') + ').');
      if (!DATE_RE.test(input.date)) throw new Error('Invalid payment date.');
      const n = await this.settings.nextCounter('payment');
      const id = uid();
      const e = await this.postInner({
        date: input.date,
        memo: 'Payment for ' + inv.number,
        source: 'payment',
        sourceId: id,
        lines: [
          { code: this.cashCode(input.method), debit: amount, memo: inv.number },
          { code: ACC.AR, credit: amount, memo: inv.number },
        ],
      });
      const now = isoNow();
      const pay: Payment = {
        id,
        number: 'PAY-' + pad(n, 5),
        invoiceId: inv.id,
        clientId: inv.clientId,
        amount,
        date: input.date,
        method: input.method,
        reference: input.reference || '',
        notes: input.notes || '',
        voided: false,
        journalEntryId: e.id,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.payments.add(pay);
      await this.recomputeInvoice(inv.id);
      await this.activity.log(
        'payment_recorded',
        'payment',
        id,
        'Payment recorded: ' + fmt.money(amount, 'en') + ' for ' + inv.number,
        'تم تسجيل دفعة: ' + fmt.money(amount, 'ar') + ' للفاتورة ' + inv.number,
      );
      return pay;
    });
  }

  voidPayment(id: string, reason: string): Promise<void> {
    return this.tx(async () => {
      const p = await this.db.payments.get(id);
      if (!p) throw new Error('Payment not found.');
      if (p.voided) throw new Error('Payment is already voided.');
      if (p.journalEntryId) await this.reverseInner(p.journalEntryId, reason, undefined, true);
      await this.db.payments.update(id, { voided: true, updatedAt: isoNow() } as any);
      await this.recomputeInvoice(p.invoiceId);
      await this.activity.log('payment_voided', 'payment', id, 'Payment voided: ' + p.number, 'تم إلغاء الدفعة: ' + p.number);
    });
  }

  private async recomputeInvoice(invoiceId: string): Promise<void> {
    const inv = await this.db.invoices.get(invoiceId);
    if (!inv) return;
    const pays = await this.db.payments.where('invoiceId').equals(invoiceId).toArray();
    const paid = fromCents(pays.filter((p) => !p.voided).reduce((a, p) => a + toCents(p.amount), 0));
    const status = toCents(paid) >= toCents(inv.total) ? 'paid' : paid > 0 ? 'partial' : 'issued';
    await this.db.invoices.update(invoiceId, { amountPaid: paid, status, updatedAt: isoNow() } as any);
  }

  // ------------------------------------------------------------------ income & expenses

  recordTransaction(input: Partial<FinTransaction> & { type: 'income' | 'expense'; amount: number; category: string; date: string }): Promise<FinTransaction> {
    return this.tx(async () => {
      const amount = round2(input.amount);
      if (!(amount > 0)) throw new Error('Amount must be greater than zero.');
      if (!DATE_RE.test(input.date)) throw new Error('Invalid date.');
      const acctCode = CATEGORY_ACCOUNT[input.category];
      if (!acctCode) throw new Error('Unknown category.');
      const id = uid();
      const method = input.paymentMethod || 'cash';
      const isExpense = input.type === 'expense';
      const paid = isExpense ? !!input.paid : true;
      const lines: PostLineInput[] = isExpense
        ? [
            { code: acctCode, debit: amount, memo: input.description },
            { code: paid ? this.cashCode(method) : ACC.AP, credit: amount, memo: input.description },
          ]
        : [
            { code: this.cashCode(method), debit: amount, memo: input.description },
            { code: acctCode, credit: amount, memo: input.description },
          ];
      const e = await this.postInner({
        date: input.date,
        memo: (isExpense ? 'Expense: ' : 'Income: ') + (input.description || input.category),
        source: isExpense ? 'expense' : 'income',
        sourceId: id,
        lines,
      });
      const now = isoNow();
      const rec: FinTransaction = {
        id,
        type: input.type,
        amount,
        category: input.category,
        date: input.date,
        description: input.description || '',
        paymentMethod: method,
        clientId: input.clientId || undefined,
        projectId: input.projectId || undefined,
        employeeId: input.employeeId || undefined,
        supplier: input.supplier || '',
        service: input.service || '',
        notes: input.notes || '',
        paid,
        paidDate: paid ? input.date : undefined,
        voided: false,
        journalEntryId: e.id,
        recurringId: input.recurringId,
        salaryMonth: input.salaryMonth,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.transactions.add(rec);
      await this.activity.log(
        isExpense ? 'expense_recorded' : 'income_recorded',
        'transaction',
        id,
        (isExpense ? 'Expense recorded: ' : 'Income recorded: ') + fmt.money(amount, 'en') + (input.description ? ' — ' + input.description : ''),
        (isExpense ? 'تم تسجيل مصروف: ' : 'تم تسجيل إيراد: ') + fmt.money(amount, 'ar') + (input.description ? ' — ' + input.description : ''),
      );
      return rec;
    });
  }

  /** سداد مصروف مستحق (دائن) */
  payTransaction(id: string, date: string, method: string): Promise<void> {
    return this.tx(async () => {
      const t = await this.db.transactions.get(id);
      if (!t || t.type !== 'expense') throw new Error('Expense not found.');
      if (t.voided) throw new Error('This expense is voided.');
      if (t.paid) throw new Error('This expense is already paid.');
      if (date < t.date) throw new Error('Payment date cannot be before the expense date.');
      const e = await this.postInner({
        date,
        memo: 'Payment of payable: ' + (t.description || t.category),
        source: 'expense_payment',
        sourceId: t.id,
        lines: [
          { code: ACC.AP, debit: t.amount },
          { code: this.cashCode(method), credit: t.amount },
        ],
      });
      await this.db.transactions.update(id, { paid: true, paidDate: date, paymentMethod: method, paymentEntryId: e.id, updatedAt: isoNow() } as any);
      await this.activity.log('expense_paid', 'transaction', id, 'Payable settled: ' + fmt.money(t.amount, 'en'), 'تم سداد مستحق: ' + fmt.money(t.amount, 'ar'));
    });
  }

  voidTransaction(id: string, reason: string): Promise<void> {
    return this.tx(async () => {
      const t = await this.db.transactions.get(id);
      if (!t) throw new Error('Transaction not found.');
      if (t.voided) throw new Error('Already voided.');
      if (t.paymentEntryId) await this.reverseInner(t.paymentEntryId, reason, undefined, true);
      if (t.journalEntryId) await this.reverseInner(t.journalEntryId, reason, undefined, true);
      await this.db.transactions.update(id, { voided: true, updatedAt: isoNow() } as any);
      await this.activity.log('transaction_voided', 'transaction', id, 'Transaction voided: ' + (t.description || t.category), 'تم إلغاء معاملة: ' + (t.description || t.category));
    });
  }

  /** إنشاء مرتبات الشهر لكل الموظفين النشطين (مرة واحدة لكل موظف/شهر) */
  generateSalaries(month: string, method: string): Promise<number> {
    return this.tx(async () => {
      const emps = (await this.db.employees.toArray()).filter((e) => !e.archived && e.employmentStatus !== 'terminated' && e.monthlySalary > 0);
      const existing = await this.db.transactions.toArray();
      const today = cairoDate();
      const date = endOfMonth(month + '-01') > today ? today : endOfMonth(month + '-01');
      let n = 0;
      for (const e of emps) {
        if (existing.some((t) => !t.voided && t.employeeId === e.id && t.salaryMonth === month)) continue;
        if (e.joiningDate && e.joiningDate.slice(0, 7) > month) continue;
        await this.recordTransaction({
          type: 'expense',
          amount: e.monthlySalary,
          category: 'salaries',
          date,
          description: 'Salary ' + month + ' — ' + e.fullName,
          paymentMethod: method,
          employeeId: e.id,
          paid: true,
          salaryMonth: month,
        });
        n++;
      }
      return n;
    });
  }

  /** توليد المصروفات المتكررة المستحقة حتى اليوم */
  generateRecurring(today: string): Promise<number> {
    return this.tx(async () => {
      const list = (await this.db.recurringExpenses.toArray()).filter((r) => r.active);
      let created = 0;
      for (const r of list) {
        const startMonth = r.startDate.slice(0, 7);
        const from = r.lastGeneratedMonth ? addMonths(r.lastGeneratedMonth, 1) : startMonth;
        const to = today.slice(0, 7);
        if (from > to) continue;
        const months = monthsList(from, to).slice(0, 36);
        let last = r.lastGeneratedMonth;
        for (const m of months) {
          const maxDay = Number(endOfMonth(m + '-01').slice(8, 10));
          const day = Math.min(Math.max(1, r.dayOfMonth), maxDay);
          const date = m + '-' + pad(day, 2);
          if (date > today) break;
          if (date < r.startDate) {
            last = m;
            continue;
          }
          if (r.endDate && date > r.endDate) break;
          await this.recordTransaction({
            type: 'expense',
            amount: r.amount,
            category: r.category,
            date,
            description: r.name,
            paymentMethod: r.paymentMethod,
            supplier: r.supplier,
            paid: r.autoPaid,
            recurringId: r.id,
          });
          created++;
          last = m;
        }
        if (last && last !== r.lastGeneratedMonth) await this.db.recurringExpenses.update(r.id, { lastGeneratedMonth: last, updatedAt: isoNow() } as any);
      }
      return created;
    });
  }

  // ------------------------------------------------------------------ capital

  recordCapital(input: { type: 'initial' | 'additional' | 'withdrawal'; amount: number; date: string; method: string; notes: string }): Promise<CapitalTx> {
    return this.tx(async () => {
      const amount = round2(input.amount);
      if (!(amount > 0)) throw new Error('Amount must be greater than zero.');
      if (!DATE_RE.test(input.date)) throw new Error('Invalid date.');
      if (input.type === 'initial') {
        const ex = (await this.db.capitalTx.where('type').equals('initial').toArray()).find((c) => !c.voided);
        if (ex) throw new Error('Initial capital already exists. Record additional capital instead, or void the initial entry first.');
      }
      if (input.type === 'withdrawal') {
        const cashIds = (await this.db.accounts.toArray()).filter((a) => a.isCash).map((a) => a.id);
        const lines = await this.db.journalLines.toArray();
        let cash = 0;
        for (const l of lines) if (cashIds.includes(l.accountId)) cash += toCents(l.debit) - toCents(l.credit);
        if (toCents(amount) > cash) throw new Error('Withdrawal exceeds the available cash balance (' + fmt.money(fromCents(cash), 'en') + ').');
      }
      const id = uid();
      const cash = this.cashCode(input.method);
      const lines: PostLineInput[] =
        input.type === 'withdrawal'
          ? [
              { code: ACC.WITHDRAWALS, debit: amount },
              { code: cash, credit: amount },
            ]
          : [
              { code: cash, debit: amount },
              { code: ACC.CAPITAL, credit: amount },
            ];
      const e = await this.postInner({
        date: input.date,
        memo: input.type === 'initial' ? 'Initial capital' : input.type === 'additional' ? 'Additional capital contribution' : 'Owner withdrawal',
        source: input.type === 'withdrawal' ? 'withdrawal' : 'capital',
        sourceId: id,
        lines,
      });
      const now = isoNow();
      const rec: CapitalTx = { id, type: input.type, amount, date: input.date, method: input.method, notes: input.notes || '', voided: false, journalEntryId: e.id, createdAt: now, updatedAt: now };
      await this.db.capitalTx.add(rec);
      await this.activity.log('capital_recorded', 'capital', id, 'Capital entry posted: ' + input.type + ' ' + fmt.money(amount, 'en'), 'تم ترحيل حركة رأس مال: ' + fmt.money(amount, 'ar'));
      return rec;
    });
  }

  voidCapital(id: string, reason: string): Promise<void> {
    return this.tx(async () => {
      const c = await this.db.capitalTx.get(id);
      if (!c) throw new Error('Capital entry not found.');
      if (c.voided) throw new Error('Already voided.');
      if (c.journalEntryId) await this.reverseInner(c.journalEntryId, reason, undefined, true);
      await this.db.capitalTx.update(id, { voided: true, updatedAt: isoNow() } as any);
      await this.activity.log('capital_voided', 'capital', id, 'Capital entry voided', 'تم إلغاء حركة رأس مال');
    });
  }

  // ------------------------------------------------------------------ assets

  createAsset(input: { name: string; purchaseDate: string; cost: number; salvageValue: number; usefulLifeMonths: number; method: 'straight_line' | 'declining_balance'; paymentMethod: string; notes: string }): Promise<Asset> {
    return this.tx(async () => {
      if (!input.name.trim()) throw new Error('Asset name is required.');
      const cost = round2(input.cost);
      const salvage = round2(input.salvageValue || 0);
      if (!(cost > 0)) throw new Error('Cost must be greater than zero.');
      if (salvage < 0 || salvage >= cost) throw new Error('Salvage value must be less than the cost.');
      if (!(input.usefulLifeMonths >= 1)) throw new Error('Useful life must be at least 1 month.');
      const id = uid();
      const e = await this.postInner({
        date: input.purchaseDate,
        memo: 'Asset purchase: ' + input.name,
        source: 'asset',
        sourceId: id,
        lines: [
          { code: ACC.EQUIPMENT, debit: cost, memo: input.name },
          { code: this.cashCode(input.paymentMethod), credit: cost, memo: input.name },
        ],
      });
      const now = isoNow();
      const rec: Asset = {
        id,
        name: input.name.trim(),
        purchaseDate: input.purchaseDate,
        cost,
        salvageValue: salvage,
        usefulLifeMonths: Math.floor(input.usefulLifeMonths),
        method: input.method,
        paymentMethod: input.paymentMethod,
        status: 'active',
        accumulated: 0,
        journalEntryId: e.id,
        notes: input.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      await this.db.assets.add(rec);
      await this.activity.log('asset_created', 'asset', id, 'Asset purchased: ' + rec.name + ' (' + fmt.money(cost, 'en') + ')', 'تم شراء أصل: ' + rec.name + ' (' + fmt.money(cost, 'ar') + ')');
      return rec;
    });
  }

  /** ترحيل الإهلاك المستحق حتى شهر معيّن. بيرجع عدد القيود. */
  runDepreciation(throughMonth: string): Promise<number> {
    return this.tx(async () => {
      const today = cairoDate();
      const assets = (await this.db.assets.toArray()).filter((a) => a.status === 'active');
      const byMonth = new Map<string, { total: number; items: { id: string; amount: number }[] }>();
      for (const a of assets) {
        for (const r of depreciationSchedule(a)) {
          if (r.month > throughMonth || r.amount <= 0) continue;
          if (a.depreciatedThrough && r.month <= a.depreciatedThrough) continue;
          const cur = byMonth.get(r.month) || { total: 0, items: [] };
          cur.total += toCents(r.amount);
          cur.items.push({ id: a.id, amount: r.amount });
          byMonth.set(r.month, cur);
        }
      }
      const months = Array.from(byMonth.keys()).sort();
      let count = 0;
      for (const m of months) {
        const b = byMonth.get(m)!;
        const end = endOfMonth(m + '-01');
        const date = end > today ? today : end;
        await this.postInner({
          date,
          memo: 'Depreciation ' + m,
          source: 'depreciation',
          sourceId: m,
          lines: [
            { code: ACC.EXP_DEPRECIATION, debit: fromCents(b.total) },
            { code: ACC.ACCUM_DEP, credit: fromCents(b.total) },
          ],
        });
        for (const it of b.items) {
          const a = await this.db.assets.get(it.id);
          if (!a) continue;
          await this.db.assets.update(a.id, { depreciatedThrough: m, accumulated: round2(a.accumulated + it.amount), updatedAt: isoNow() } as any);
        }
        count++;
      }
      if (count) await this.activity.log('depreciation_posted', 'asset', undefined, 'Depreciation posted for ' + count + ' month(s)', 'تم ترحيل الإهلاك لعدد ' + count + ' شهر');
      return count;
    });
  }
}
