import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractHiddenField,
  normalizeDate,
  parseHistoricalTable,
  parseTurkishNumber,
} from '../src/parsers/htmlParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

describe('extractHiddenField', () => {
  it('reads VIEWSTATE by id', () => {
    const html = fixture('sampleInitial.html');
    expect(extractHiddenField(html, '__VIEWSTATE')).toBe(
      '/wEPDwUKLTYxNDk2Njg3NWRkINITIAL_VS_TOKEN==',
    );
    expect(extractHiddenField(html, '__VIEWSTATEGENERATOR')).toBe('CA0B0334');
    expect(extractHiddenField(html, '__EVENTVALIDATION')).toBe('/wEdAAjINITIAL_EV_TOKEN');
  });

  it('falls back to name attribute when id is absent', () => {
    const html = '<input type="hidden" name="__VIEWSTATE" value="abc123" />';
    expect(extractHiddenField(html, '__VIEWSTATE')).toBe('abc123');
  });

  it('handles values with special characters', () => {
    const html = `<input id="__VIEWSTATE" value="a+b/c=d e &amp; f" />`;
    expect(extractHiddenField(html, '__VIEWSTATE')).toBe('a+b/c=d e & f');
  });

  it('returns empty string when field missing', () => {
    expect(extractHiddenField('<html></html>', '__VIEWSTATE')).toBe('');
    expect(extractHiddenField('', '__VIEWSTATE')).toBe('');
  });
});

describe('parseTurkishNumber', () => {
  it('parses Turkish-formatted decimals', () => {
    expect(parseTurkishNumber('1.234,56')).toBe(1234.56);
    expect(parseTurkishNumber('1.234.567,89')).toBe(1234567.89);
    expect(parseTurkishNumber('0,00')).toBe(0);
    expect(parseTurkishNumber('3,456789')).toBeCloseTo(3.456789, 6);
  });

  it('handles integers without decimals', () => {
    expect(parseTurkishNumber('12.450')).toBe(12450);
    expect(parseTurkishNumber('357.246.813')).toBe(357246813);
  });

  it('returns 0 for empty/invalid input', () => {
    expect(parseTurkishNumber('')).toBe(0);
    expect(parseTurkishNumber('   ')).toBe(0);
    expect(parseTurkishNumber('n/a')).toBe(0);
  });
});

describe('normalizeDate', () => {
  it('converts DD.MM.YYYY to ISO', () => {
    expect(normalizeDate('15.06.2024')).toBe('2024-06-15');
  });

  it('pads single-digit day and month', () => {
    expect(normalizeDate('5.1.2024')).toBe('2024-01-05');
  });

  it('trims whitespace', () => {
    expect(normalizeDate('  15.06.2024  ')).toBe('2024-06-15');
  });

  it('returns input unchanged for malformed values', () => {
    expect(normalizeDate('2024-06-15')).toBe('2024-06-15');
    expect(normalizeDate('garbage')).toBe('garbage');
  });
});

describe('parseHistoricalTable', () => {
  it('parses all rows from sample fixture', () => {
    const rows = parseHistoricalTable(fixture('sampleHistoricalTable.html'));
    expect(rows).toHaveLength(3);

    expect(rows[0]).toEqual({
      date: '2024-06-15',
      fundCode: 'TTE',
      fundName: 'TEB PORTFÖY HİSSE SENEDİ FONU',
      price: 3.456789,
      sharesOutstanding: 357246813,
      investorCount: 12450,
      totalValue: 1234567890.5,
    });

    expect(rows[2]!.date).toBe('2024-01-05');
    expect(rows[2]!.fundCode).toBe('AFT');
    expect(rows[2]!.price).toBeCloseTo(0.123456, 6);
  });

  it('returns empty array for empty input', () => {
    expect(parseHistoricalTable('')).toEqual([]);
    expect(parseHistoricalTable('<html></html>')).toEqual([]);
  });

  it('returns empty array when grid has only header', () => {
    const html = `
      <table id="MainContent_GridViewFonlar">
        <tr><th>TARİH</th><th>FON KODU</th></tr>
      </table>`;
    expect(parseHistoricalTable(html)).toEqual([]);
  });

  it('skips malformed rows with too few cells', () => {
    const html = `
      <table id="MainContent_GridViewFonlar">
        <tr><th>TARİH</th></tr>
        <tr><td>15.06.2024</td><td>TTE</td></tr>
        <tr>
          <td>14.06.2024</td><td>TTE</td><td>TEB</td>
          <td>3,45</td><td>100</td><td>50</td><td>500,00</td>
        </tr>
      </table>`;
    const rows = parseHistoricalTable(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.fundCode).toBe('TTE');
  });

  it('truncates investor count to integer', () => {
    const rows = parseHistoricalTable(fixture('sampleHistoricalTable.html'));
    for (const row of rows) {
      expect(Number.isInteger(row.investorCount)).toBe(true);
    }
  });
});
