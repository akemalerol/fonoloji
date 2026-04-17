import { describe, expect, it } from 'vitest';
import { validateInput } from '../src/utils/validators.js';
import type { Input } from '../src/types/input.js';

const base: Input = { mode: 'daily' };

describe('validateInput', () => {
  it('accepts valid daily input', () => {
    const result = validateInput(base);
    expect(result.warnings).toEqual([]);
  });

  it('accepts historical with startDate', () => {
    const result = validateInput({
      mode: 'historical',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    });
    expect(result.warnings).toEqual([]);
  });

  it('rejects missing mode', () => {
    expect(() => validateInput({ ...base, mode: undefined as unknown as Input['mode'] }))
      .toThrow(/mode is required/);
  });

  it('rejects unknown mode', () => {
    expect(() => validateInput({ ...base, mode: 'wat' as Input['mode'] })).toThrow(/mode must be/);
  });

  it('rejects historical without startDate', () => {
    expect(() => validateInput({ mode: 'historical' })).toThrow(/startDate is required/);
  });

  it('rejects fund_detail without fundCodes', () => {
    expect(() => validateInput({ mode: 'fund_detail' })).toThrow(/fundCodes must contain/);
    expect(() => validateInput({ mode: 'fund_detail', fundCodes: [] })).toThrow(/fundCodes must contain/);
  });

  it('rejects malformed dates', () => {
    expect(() => validateInput({ mode: 'daily', startDate: '2024/01/01' })).toThrow(/startDate must be YYYY-MM-DD/);
    expect(() => validateInput({ mode: 'daily', endDate: 'yesterday' })).toThrow(/endDate must be YYYY-MM-DD/);
  });

  it('rejects start > end', () => {
    expect(() => validateInput({ mode: 'historical', startDate: '2024-06-01', endDate: '2024-01-01' }))
      .toThrow(/must be <=/);
  });

  it('rejects invalid fund codes', () => {
    expect(() => validateInput({ mode: 'daily', fundCodes: ['tte'] })).toThrow(/invalid code/);
    expect(() => validateInput({ mode: 'daily', fundCodes: ['A'] })).toThrow(/invalid code/);
    expect(() => validateInput({ mode: 'daily', fundCodes: ['TOOLONG'] })).toThrow(/invalid code/);
  });

  it('rejects non-positive rate limit', () => {
    expect(() => validateInput({ mode: 'daily', maxRequestsPerMinute: 0 })).toThrow(/positive/);
    expect(() => validateInput({ mode: 'daily', maxRequestsPerMinute: -5 })).toThrow(/positive/);
  });

  it('warns on currency other than TRY', () => {
    const result = validateInput({ mode: 'daily', outputCurrency: 'USD' });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.field).toBe('outputCurrency');
  });

  it('warns on rate limit above 60', () => {
    const result = validateInput({ mode: 'daily', maxRequestsPerMinute: 120 });
    expect(result.warnings.some((w) => w.field === 'maxRequestsPerMinute')).toBe(true);
  });

  it('rejects invalid fundType', () => {
    expect(() => validateInput({ mode: 'daily', fundType: 'XYZ' as Input['fundType'] }))
      .toThrow(/fundType must be/);
  });
});
