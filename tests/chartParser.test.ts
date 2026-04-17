import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseChartData } from '../src/parsers/chartParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

describe('parseChartData', () => {
  it('parses [timestamp, price] tuple format (Highcharts)', () => {
    const points = parseChartData(fixture('sampleChart.html'));
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ date: '2024-01-01', price: 3.1234 });
    expect(points[3]).toEqual({ date: '2024-01-04', price: 3.189 });
  });

  it('parses parallel categories + data arrays', () => {
    const points = parseChartData(fixture('sampleChartParallel.html'));
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ date: '2024-06-01', price: 3.1 });
    expect(points[2]).toEqual({ date: '2024-06-03', price: 3.25 });
  });

  it('returns empty array when no chart script present', () => {
    expect(parseChartData('<html></html>')).toEqual([]);
    expect(parseChartData('')).toEqual([]);
  });

  it('returns empty array when script lacks recognizable data', () => {
    const html = `<html><script>var foo = 1;</script></html>`;
    expect(parseChartData(html)).toEqual([]);
  });

  it('dedupes duplicate dates keeping latest', () => {
    const html = `
      <html><script>
        chartMainContent_FonFiyatGrafik = Highcharts.chart({
          series: [{ data: [
            [1704067200000, 3.0],
            [1704067200000, 3.5],
            [1704153600000, 3.2]
          ]}]
        });
      </script></html>`;
    const points = parseChartData(html);
    expect(points).toHaveLength(2);
    expect(points[0]!.price).toBe(3.5);
  });
});
