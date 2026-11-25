import { APP_CONFIG } from '../config/app-config';

/** كل التواريخ في التطبيق نصوص بصيغة YYYY-MM-DD (تاريخ تقويمي بتوقيت القاهرة). */
export function cairoDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CONFIG.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function cairoMonth(d: Date = new Date()): string {
  return cairoDate(d).slice(0, 7);
}

export function isoNow(): string {
  return new Date().toISOString();
}

/** تاريخ اليوم (بتوقيت القاهرة) من timestamp ISO */
export function isoToCairoDate(iso: string): string {
  return iso ? cairoDate(new Date(iso)) : '';
}

function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

export function addDays(s: string, n: number): string {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 7);
}

export function startOfMonth(s: string): string {
  return s.slice(0, 7) + '-01';
}

export function endOfMonth(s: string): string {
  const [y, m] = parts(s);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** بداية الأسبوع = السبت (مناسب لمصر) */
export function startOfWeek(s: string): string {
  const [y, m, d] = parts(s);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun .. 6=Sat
  return addDays(s, -((dow + 1) % 7));
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function monthsList(fromMonth: string, toMonth: string): string[] {
  const out: string[] = [];
  let cur = fromMonth;
  let guard = 0;
  while (cur <= toMonth && guard++ < 600) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function datesList(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 800) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function inRange(date: string | undefined, from: string, to: string): boolean {
  return !!date && date >= from && date <= to;
}

export type RangePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  preset: RangePreset;
  from: string;
  to: string;
}

export function rangeFor(preset: RangePreset, today: string, custom?: { from: string; to: string }): DateRange {
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case 'week':
      return { preset, from: startOfWeek(today), to: addDays(startOfWeek(today), 6) };
    case 'year':
      return { preset, from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31' };
    case 'custom':
      return { preset, from: custom?.from || today, to: custom?.to || today };
    default:
      return { preset: 'month', from: startOfMonth(today), to: endOfMonth(today) };
  }
}
