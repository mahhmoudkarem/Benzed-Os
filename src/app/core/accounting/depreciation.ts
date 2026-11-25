import { Asset } from '../models/accounting';
import { addMonths } from '../utils/date';
import { round2 } from '../utils/money';

type DepInput = Pick<Asset, 'cost' | 'salvageValue' | 'usefulLifeMonths' | 'method'>;

/** إهلاك الشهر رقم k (يبدأ من 0 = شهر الشراء) بعد إهلاك متراكم سابق */
export function monthlyDepreciation(a: DepInput, k: number, accumulatedBefore: number): number {
  const life = Math.max(1, Math.floor(a.usefulLifeMonths));
  const depreciable = Math.max(0, a.cost - a.salvageValue);
  const remaining = round2(depreciable - accumulatedBefore);
  if (k < 0 || k >= life || remaining <= 0) return 0;
  if (k === life - 1) return remaining; // آخر شهر: نكمّل الباقي بالضبط
  let amt: number;
  if (a.method === 'declining_balance') {
    const book = a.cost - accumulatedBefore;
    const annualRate = 2 / (life / 12); // الرصيد المتناقص المزدوج
    amt = (book * annualRate) / 12;
  } else {
    amt = depreciable / life;
  }
  return round2(Math.min(amt, remaining));
}

export interface DepRow {
  month: string;
  amount: number;
  accumulated: number;
  bookValue: number;
}

export function depreciationSchedule(a: Pick<Asset, 'cost' | 'salvageValue' | 'usefulLifeMonths' | 'method' | 'purchaseDate'>): DepRow[] {
  const rows: DepRow[] = [];
  let acc = 0;
  const start = a.purchaseDate.slice(0, 7);
  const life = Math.max(1, Math.floor(a.usefulLifeMonths));
  for (let k = 0; k < life; k++) {
    const amt = monthlyDepreciation(a, k, acc);
    acc = round2(acc + amt);
    rows.push({ month: addMonths(start, k), amount: amt, accumulated: acc, bookValue: round2(a.cost - acc) });
  }
  return rows;
}

/** الإهلاك المتراكم النظري حتى شهر معيّن */
export function accumulatedThrough(a: Parameters<typeof depreciationSchedule>[0], throughMonth: string): number {
  let acc = 0;
  for (const r of depreciationSchedule(a)) {
    if (r.month <= throughMonth) acc = r.accumulated;
  }
  return acc;
}
