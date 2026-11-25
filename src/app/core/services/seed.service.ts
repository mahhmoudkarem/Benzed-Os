import { Injectable, inject } from '@angular/core';
import { DbService } from './db.service';
import { Account, AccountType } from '../models/accounting';
import { uid } from '../utils/id';
import { isoNow } from '../utils/date';

/** أكواد الحسابات النظامية المستخدمة في قواعد الترحيل */
export const ACC = {
  CASH: '1000',
  BANK: '1010',
  AR: '1100',
  EQUIPMENT: '1500',
  ACCUM_DEP: '1590',
  AP: '2000',
  TAX_PAYABLE: '2100',
  CAPITAL: '3000',
  WITHDRAWALS: '3100',
  RETAINED: '3200',
  REVENUE: '4000',
  OTHER_INCOME: '4900',
  EXP_DEPRECIATION: '5800',
} as const;

type Seed = [string, string, string, AccountType, boolean?];

const SEED: Seed[] = [
  ['1000', 'Cash on Hand', 'النقدية بالخزينة', 'asset', true],
  ['1010', 'Bank & Wallets', 'البنك والمحافظ', 'asset', true],
  ['1100', 'Accounts Receivable', 'العملاء (مدينون)', 'asset'],
  ['1500', 'Equipment', 'المعدات والأجهزة', 'asset'],
  ['1590', 'Accumulated Depreciation', 'مجمع الإهلاك', 'asset'],
  ['2000', 'Accounts Payable', 'الموردون (دائنون)', 'liability'],
  ['2100', 'Tax Payable', 'ضرائب مستحقة', 'liability'],
  ['3000', "Owner's Capital", 'رأس المال', 'equity'],
  ['3100', 'Owner Withdrawals', 'مسحوبات المالك', 'equity'],
  ['3200', 'Retained Earnings (manual adjustments)', 'أرباح محتجزة (تسويات يدوية)', 'equity'],
  ['4000', 'Service Revenue', 'إيرادات الخدمات', 'revenue'],
  ['4900', 'Other Income', 'إيرادات أخرى', 'revenue'],
  ['5100', 'Salaries', 'المرتبات', 'expense'],
  ['5200', 'Software Subscriptions', 'اشتراكات البرامج', 'expense'],
  ['5300', 'Marketing', 'التسويق', 'expense'],
  ['5400', 'Rent and Utilities', 'الإيجار والمرافق', 'expense'],
  ['5500', 'Freelancers', 'فريلانسرز', 'expense'],
  ['5600', 'Equipment (small items)', 'معدات (بنود صغيرة)', 'expense'],
  ['5700', 'Other Expenses', 'مصروفات أخرى', 'expense'],
  ['5800', 'Depreciation Expense', 'مصروف الإهلاك', 'expense'],
];

/** الحسابات اللي طبيعتها دائنة رغم إنها أصول (contra) أو مدينة رغم إنها حقوق ملكية */
const NORMAL_OVERRIDE: Record<string, 'debit' | 'credit'> = { '1590': 'credit', '3100': 'debit' };

@Injectable({ providedIn: 'root' })
export class SeedService {
  private readonly db = inject(DbService).db;

  async ensureAccounts(): Promise<void> {
    const count = await this.db.accounts.count();
    if (count > 0) return;
    const now = isoNow();
    const rows: Account[] = SEED.map(([code, nameEn, nameAr, type, isCash]) => ({
      id: uid(),
      code,
      nameEn,
      nameAr,
      type,
      normal:
        NORMAL_OVERRIDE[code] ??
        (type === 'asset' || type === 'expense' ? 'debit' : 'credit'),
      isCash: !!isCash,
      system: true,
      active: true,
      createdAt: now,
      updatedAt: now,
    }));
    await this.db.accounts.bulkAdd(rows);
  }
}
