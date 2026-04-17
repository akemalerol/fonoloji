import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseComparisonTable } from '../src/parsers/comparisonParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

const SCRAPED = '2024-06-15T18:30:00.000Z';

describe('parseComparisonTable', () => {
  it('parses sample comparison table', () => {
    const rows = parseComparisonTable(fixture('sampleComparison.html'), SCRAPED);
    expect(rows).toHaveLength(2);

    const tte = rows[0]!;
    expect(tte.fundCode).toBe('TTE');
    expect(tte.fundCategory).toBe('Hisse Senedi Fonu');
    expect(tte.returnOneMonth).toBeCloseTo(0.1234, 4);
    expect(tte.returnOneYear).toBeCloseTo(0.5678, 4);
    expect(tte.returnYTD).toBeCloseTo(0.4567, 4);
    expect(tte.totalValue).toBe(1234567890.5);
    expect(tte.investorCount).toBe(12450);
    expect(tte.metadata.scrapedAt).toBe(SCRAPED);
    expect(tte.metadata.source).toBe('tefas.gov.tr');
  });

  it('returns empty array for empty or malformed html', () => {
    expect(parseComparisonTable('', SCRAPED)).toEqual([]);
    expect(parseComparisonTable('<html></html>', SCRAPED)).toEqual([]);
  });

  it('skips rows missing fund code', () => {
    const html = `
      <table>
        <tr><th>Fon Kodu</th><th>Fon Adı</th></tr>
        <tr><td></td><td>Empty</td></tr>
        <tr><td>TTE</td><td>TEB</td></tr>
      </table>`;
    const rows = parseComparisonTable(html, SCRAPED);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fundCode).toBe('TTE');
  });

  it('investor count is always an integer', () => {
    const rows = parseComparisonTable(fixture('sampleComparison.html'), SCRAPED);
    for (const r of rows) {
      if (r.investorCount !== undefined) {
        expect(Number.isInteger(r.investorCount)).toBe(true);
      }
    }
  });
});
