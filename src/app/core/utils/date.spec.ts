import { describe, expect, it } from 'vitest';
import { addDays, addMonths, endOfMonth, startOfWeek, daysBetween } from './date';

describe('date utils (calendar strings)', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('adds months', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });
  it('computes month end and week start (Saturday)', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(startOfWeek('2026-11-25')).toBe('2026-11-21'); // Wednesday -> previous Saturday
  });
  it('counts days between dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
  });
});
