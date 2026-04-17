import { describe, expect, it } from 'vitest';
import { splitDateRange, toDdMmYyyy } from '../src/utils/dateWindows.js';

describe('splitDateRange', () => {
  it('returns single window for same-day range', () => {
    const windows = splitDateRange('2024-06-15', '2024-06-15');
    expect(windows).toEqual([{ start: '2024-06-15', end: '2024-06-15' }]);
  });

  it('returns single window for exactly maxDays range', () => {
    const windows = splitDateRange('2024-01-01', '2024-03-30', 90);
    expect(windows).toEqual([{ start: '2024-01-01', end: '2024-03-30' }]);
  });

  it('splits 91-day range into two windows', () => {
    const windows = splitDateRange('2024-01-01', '2024-03-31', 90);
    expect(windows).toEqual([
      { start: '2024-01-01', end: '2024-03-30' },
      { start: '2024-03-31', end: '2024-03-31' },
    ]);
  });

  it('covers a 2-year range with contiguous windows', () => {
    const windows = splitDateRange('2023-01-01', '2024-12-31', 90);
    expect(windows.length).toBeGreaterThanOrEqual(8);
    expect(windows[0]).toEqual({ start: '2023-01-01', end: '2023-03-31' });
    expect(windows.at(-1)!.end).toBe('2024-12-31');

    // Contiguous: each window.start is prev.end + 1 day.
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = new Date(`${windows[i - 1]!.end}T00:00:00Z`).getTime();
      const thisStart = new Date(`${windows[i]!.start}T00:00:00Z`).getTime();
      expect(thisStart - prevEnd).toBe(86_400_000);
    }
  });

  it('handles leap year boundary correctly', () => {
    const windows = splitDateRange('2024-02-28', '2024-03-02', 90);
    expect(windows).toEqual([{ start: '2024-02-28', end: '2024-03-02' }]);
  });

  it('returns empty array when start > end', () => {
    expect(splitDateRange('2024-06-15', '2024-01-01')).toEqual([]);
  });

  it('accepts custom window size', () => {
    const windows = splitDateRange('2024-01-01', '2024-01-10', 3);
    expect(windows).toEqual([
      { start: '2024-01-01', end: '2024-01-03' },
      { start: '2024-01-04', end: '2024-01-06' },
      { start: '2024-01-07', end: '2024-01-09' },
      { start: '2024-01-10', end: '2024-01-10' },
    ]);
  });

  it('throws on invalid date format', () => {
    expect(() => splitDateRange('2024/01/01', '2024-12-31')).toThrow(/Invalid date format/);
    expect(() => splitDateRange('not-a-date', '2024-12-31')).toThrow(/Invalid date format/);
  });

  it('throws on non-positive maxDays', () => {
    expect(() => splitDateRange('2024-01-01', '2024-12-31', 0)).toThrow(/maxDays must be positive/);
  });
});

describe('toDdMmYyyy', () => {
  it('converts ISO date to TEFAS format', () => {
    expect(toDdMmYyyy('2024-06-15')).toBe('15.06.2024');
    expect(toDdMmYyyy('2024-01-01')).toBe('01.01.2024');
  });
});
