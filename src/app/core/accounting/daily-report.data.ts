import { Snapshot } from './snapshot';
import { accountBalance, cashBasisPL, cashFlowStatement, profitAndLoss } from './ledger';
import { accountByCode, cashAccountIds, cashBalanceAt, remaining } from './metrics';
import { addDays, isoToCairoDate, startOfMonth } from '../utils/date';
import { fromCents, round2, toCents } from '../utils/money';
import { projectProgress } from '../utils/progress';

export interface DailyData {
  date: string;
  partial: boolean;
  fin: {
    dayRevenue: number; mtdRevenue: number;
    dayExpenses: number; mtdExpenses: number;
    dayNet: number; mtdNet: number;
    dayCashIn: number; mtdCashIn: number;
    dayCashOut: number; mtdCashOut: number;
    dayCashNet: number; mtdCashNet: number;
    dayLedgerCashChange: number;
    cashBalance: number;
    outstanding: number;
    prevDayRevenue: number;
    prevDayExpenses: number;
  };
  newPayments: { number: string; client: string; invoice: string; amount: number; method: string }[];
  newExpenses: { description: string; category: string; amount: number; paid: boolean }[];
  clients: {
    newClients: number;
    activeClients: number;
    rows: { name: string; invoiced: number; paid: number; outstanding: number }[];
  };
  tasks: {
    newTasks: number;
    completed: number;
    pending: number;
    overdue: number;
    employees: { name: string; open: number; completedToday: number; overdue: number }[];
  };
  projects: {
    active: number;
    completed: number;
    rows: { name: string; client: string; progress: number; deadline: string }[];
    campaigns: { name: string; client: string; platform: string; budget: number; spend: number }[];
    campaignSpendTotal: number;
    published: { title: string; client: string; platform: string }[];
  };
}

export function computeDaily(s: Snapshot, date: string): DailyData {
  const ms = startOfMonth(date);
  const dayPL = profitAndLoss(s.accounts, s.lines, date, date);
  const mtdPL = profitAndLoss(s.accounts, s.lines, ms, date);
  const prevPL = profitAndLoss(s.accounts, s.lines, addDays(date, -1), addDays(date, -1));
  const dayCB = cashBasisPL(s.invoices, s.payments, s.transactions, date, date);
  const mtdCB = cashBasisPL(s.invoices, s.payments, s.transactions, ms, date);
  const ids = cashAccountIds(s.accounts);
  const dayCF = cashFlowStatement(ids, s.lines, date, date);
  const ar = accountByCode(s.accounts, '1100');
  const clientName = (id?: string) => s.clients.find((c) => c.id === id)?.name || '—';
  const invNo = (id: string) => s.invoices.find((i) => i.id === id)?.number || '—';

  const clientRows = s.clients
    .map((c) => {
      const invs = s.invoices.filter((i) => i.clientId === c.id && i.status !== 'draft' && i.status !== 'cancelled' && i.issueDate <= date);
      const invoicedDay = invs.filter((i) => i.issueDate === date).reduce((a, i) => a + toCents(i.total), 0);
      const pays = s.payments.filter((p) => p.clientId === c.id && !p.voided && p.date <= date);
      const paidDay = pays.filter((p) => p.date === date).reduce((a, p) => a + toCents(p.amount), 0);
      const outstanding = invs.reduce((a, i) => a + toCents(i.total), 0) - pays.reduce((a, p) => a + toCents(p.amount), 0);
      return { name: c.name, invoiced: fromCents(invoicedDay), paid: fromCents(paidDay), outstanding: fromCents(outstanding) };
    })
    .filter((r) => r.invoiced || r.paid || r.outstanding > 0.004);

  const active = s.tasks.filter((t) => t.status !== 'completed');
  const empRows = s.employees
    .filter((e) => !e.archived)
    .map((e) => {
      const mine = s.tasks.filter((t) => t.assigneeId === e.id);
      return {
        name: e.fullName,
        open: mine.filter((t) => t.status !== 'completed').length,
        completedToday: mine.filter((t) => t.completedAt && isoToCairoDate(t.completedAt) === date).length,
        overdue: mine.filter((t) => t.status !== 'completed' && t.dueDate && t.dueDate < date).length,
      };
    });

  const camps = s.campaigns.filter((c) => c.status === 'active' || (c.startDate <= date && (!c.endDate || c.endDate >= date) && c.status !== 'cancelled' && c.status !== 'draft'));

  return {
    date,
    partial: date >= s.today,
    fin: {
      dayRevenue: dayPL.totalRevenue, mtdRevenue: mtdPL.totalRevenue,
      dayExpenses: dayPL.totalExpenses, mtdExpenses: mtdPL.totalExpenses,
      dayNet: dayPL.netIncome, mtdNet: mtdPL.netIncome,
      dayCashIn: dayCB.revenue, mtdCashIn: mtdCB.revenue,
      dayCashOut: dayCB.expenses, mtdCashOut: mtdCB.expenses,
      dayCashNet: dayCB.net, mtdCashNet: mtdCB.net,
      dayLedgerCashChange: dayCF.netChange,
      cashBalance: cashBalanceAt(s, date),
      outstanding: ar ? accountBalance(ar, s.lines, date) : 0,
      prevDayRevenue: prevPL.totalRevenue,
      prevDayExpenses: prevPL.totalExpenses,
    },
    newPayments: s.payments
      .filter((p) => !p.voided && p.date === date)
      .map((p) => ({ number: p.number, client: clientName(p.clientId), invoice: invNo(p.invoiceId), amount: p.amount, method: p.method })),
    newExpenses: s.transactions
      .filter((t) => t.type === 'expense' && !t.voided && t.date === date)
      .map((t) => ({ description: t.description, category: t.category, amount: t.amount, paid: t.paid })),
    clients: {
      newClients: s.clients.filter((c) => isoToCairoDate(c.createdAt) === date).length,
      activeClients: s.clients.filter((c) => c.status === 'active' && !c.archived).length,
      rows: clientRows,
    },
    tasks: {
      newTasks: s.tasks.filter((t) => t.createdDate === date).length,
      completed: s.tasks.filter((t) => t.completedAt && isoToCairoDate(t.completedAt) === date).length,
      pending: active.length,
      overdue: active.filter((t) => t.dueDate && t.dueDate < date).length,
      employees: empRows,
    },
    projects: {
      active: s.projects.filter((p) => p.status === 'active' && !p.archived).length,
      completed: s.projects.filter((p) => p.completedDate === date).length,
      rows: s.projects
        .filter((p) => p.status === 'active' && !p.archived)
        .map((p) => ({ name: p.name, client: clientName(p.clientId), progress: projectProgress(p, s.tasks), deadline: p.deadline })),
      campaigns: camps.map((c) => ({ name: c.name, client: clientName(c.clientId), platform: c.platform, budget: c.budget, spend: c.actualSpend })),
      campaignSpendTotal: round2(fromCents(camps.reduce((a, c) => a + toCents(c.actualSpend), 0))),
      published: s.content.filter((c) => c.status === 'published' && c.publishDate === date).map((c) => ({ title: c.title, client: clientName(c.clientId), platform: c.platform })),
    },
  };
}

export { remaining };
