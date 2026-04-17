import { describe, expect, it } from 'vitest';
import { computeReturns } from '../src/scrapers/fundDetailScraper.js';

describe('computeReturns', () => {
  it('returns empty for empty history', () => {
    expect(computeReturns([])).toEqual({});
  });

  it('computes daily return from consecutive points', () => {
    const returns = computeReturns([
      { date: '2024-06-14', price: 10 },
      { date: '2024-06-15', price: 11 },
    ]);
    expect(returns.daily).toBeCloseTo(0.1, 4);
  });

  it('computes monthly and yearly returns from long history', () => {
    const history = [];
    const start = Date.UTC(2023, 0, 1);
    for (let i = 0; i < 400; i++) {
      const d = new Date(start + i * 86_400_000);
      history.push({
        date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
        price: 100 + i,
      });
    }
    const returns = computeReturns(history);
    expect(returns.daily).toBeDefined();
    expect(returns.weekly).toBeDefined();
    expect(returns.monthly).toBeDefined();
    expect(returns.threeMonth).toBeDefined();
    expect(returns.sixMonth).toBeDefined();
    expect(returns.oneYear).toBeDefined();
    expect(returns.ytd).toBeDefined();
    expect(returns.oneYear!).toBeGreaterThan(0);
  });

  it('skips returns when no baseline available', () => {
    const returns = computeReturns([{ date: '2024-06-15', price: 10 }]);
    expect(returns.oneYear).toBeUndefined();
    expect(returns.monthly).toBeUndefined();
  });
});
