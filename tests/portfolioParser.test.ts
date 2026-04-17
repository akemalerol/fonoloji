import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePortfolioAllocation } from '../src/parsers/portfolioParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

describe('parsePortfolioAllocation', () => {
  it('maps Turkish asset classes to normalized keys', () => {
    const alloc = parsePortfolioAllocation(fixture('samplePortfolio.html'));
    expect(alloc.stock).toBe(85.23);
    expect(alloc.governmentBond).toBe(5.12);
    expect(alloc.treasuryBill).toBe(3.45);
    expect(alloc.corporateBond).toBe(2.1);
    expect(alloc.cash).toBeCloseTo(4.1, 2); // 2.10 (vadeli) + 2.00 (repo)
    expect(alloc.eurobond).toBeUndefined();
    expect(alloc.gold).toBeUndefined();
    expect(alloc.other).toBeUndefined();
  });

  it('returns empty object for empty html', () => {
    expect(parsePortfolioAllocation('')).toEqual({});
    expect(parsePortfolioAllocation('<html></html>')).toEqual({});
  });

  it('sums multiple rows mapping to same key', () => {
    const html = `
      <table>
        <tr><td>Vadeli Mevduat</td><td>%10,00</td></tr>
        <tr><td>Ters Repo</td><td>%5,00</td></tr>
        <tr><td>Para Piyasası Fonu</td><td>%3,00</td></tr>
      </table>`;
    const alloc = parsePortfolioAllocation(html);
    expect(alloc.cash).toBeCloseTo(18.0, 2);
  });

  it('ignores unknown categories and rows with 0', () => {
    const html = `
      <table>
        <tr><td>Hisse Senedi</td><td>%50,00</td></tr>
        <tr><td>Uzay Araçları</td><td>%50,00</td></tr>
      </table>`;
    const alloc = parsePortfolioAllocation(html);
    expect(alloc.stock).toBe(50);
    expect(Object.keys(alloc)).toHaveLength(1);
  });
});
