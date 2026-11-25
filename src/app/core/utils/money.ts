/** كل المبالغ بالجنيه بعد تقريب لقرشين. المقارنات بتتم بالقروش (أعداد صحيحة). */
export const toCents = (n: number): number => Math.round((Number(n) || 0) * 100);
export const fromCents = (c: number): number => c / 100;
export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (arr: number[]): number => fromCents(arr.reduce((a, b) => a + toCents(b), 0));
export const safeDiv = (a: number, b: number): number => (b ? a / b : 0);
