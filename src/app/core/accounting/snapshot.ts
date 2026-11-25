import { Account, Asset, CapitalTx, FinTransaction, Invoice, JournalEntry, JournalLine, Payment, RecurringExpense } from '../models/accounting';
import { Campaign, Client, ContentItem, Employee, Project, Task } from '../models/business';

/** لقطة من كل البيانات اللازمة للحسابات والتحليل والتقارير */
export interface Snapshot {
  today: string;
  setupDate: string;
  accounts: Account[];
  lines: JournalLine[];
  entries: JournalEntry[];
  invoices: Invoice[];
  payments: Payment[];
  transactions: FinTransaction[];
  assets: Asset[];
  capital: CapitalTx[];
  recurring: RecurringExpense[];
  clients: Client[];
  employees: Employee[];
  projects: Project[];
  tasks: Task[];
  campaigns: Campaign[];
  content: ContentItem[];
}
