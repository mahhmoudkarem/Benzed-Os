import { BaseEntity } from './common';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account extends BaseEntity {
  code: string;
  nameEn: string;
  nameAr: string;
  type: AccountType;
  normal: 'debit' | 'credit';
  isCash: boolean;
  system: boolean;
  active: boolean;
}

export type JournalSource =
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'expense_payment'
  | 'income'
  | 'capital'
  | 'withdrawal'
  | 'asset'
  | 'depreciation'
  | 'manual';

export interface JournalEntry extends BaseEntity {
  number: string;
  date: string;
  memo: string;
  source: JournalSource;
  sourceId?: string;
  status: 'posted';
  reversalOf?: string;
  reversedBy?: string;
  reversalReason?: string;
}

export interface JournalLine {
  id: string;
  entryId: string;
  accountId: string;
  debit: number;
  credit: number;
  memo: string;
  /** منسوخة من القيد لتسريع الاستعلامات */
  date: string;
  source: JournalSource;
}

export interface FinancialPeriod extends BaseEntity {
  key: string; // YYYY-MM
  status: 'closed';
}

export interface InvoiceItem {
  description: string;
  service: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice extends BaseEntity {
  number: string;
  clientId: string;
  projectId?: string;
  items: InvoiceItem[];
  discount: number;
  taxRate: number;
  subtotal: number;
  netAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';
  issueDate: string;
  dueDate: string;
  notes: string;
  journalEntryId?: string;
  cancelEntryId?: string;
}

export interface Payment extends BaseEntity {
  number: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  notes: string;
  voided: boolean;
  journalEntryId?: string;
}

export interface FinTransaction extends BaseEntity {
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string;
  description: string;
  paymentMethod: string;
  clientId?: string;
  projectId?: string;
  employeeId?: string;
  supplier: string;
  service: string;
  notes: string;
  paid: boolean;
  paidDate?: string;
  voided: boolean;
  journalEntryId?: string;
  paymentEntryId?: string;
  recurringId?: string;
  salaryMonth?: string;
}

export interface RecurringExpense extends BaseEntity {
  name: string;
  amount: number;
  category: string;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  paymentMethod: string;
  autoPaid: boolean;
  active: boolean;
  lastGeneratedMonth?: string;
  supplier: string;
}

export interface Asset extends BaseEntity {
  name: string;
  purchaseDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: 'straight_line' | 'declining_balance';
  paymentMethod: string;
  status: 'active' | 'disposed';
  depreciatedThrough?: string; // YYYY-MM
  accumulated: number;
  journalEntryId?: string;
  notes: string;
}

export interface CapitalTx extends BaseEntity {
  type: 'initial' | 'additional' | 'withdrawal';
  amount: number;
  date: string;
  method: string;
  notes: string;
  voided: boolean;
  journalEntryId?: string;
}
