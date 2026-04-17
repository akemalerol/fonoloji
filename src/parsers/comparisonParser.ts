import * as cheerio from 'cheerio';
import type { FundComparisonRecord } from '../types/fund.js';
import { parseTurkishNumber } from './htmlParser.js';

type ColumnKey =
  | 'fundCode'
  | 'fundName'
  | 'fundCategory'
  | 'returnOneMonth'
  | 'returnThreeMonth'
  | 'returnSixMonth'
  | 'returnOneYear'
  | 'returnYTD'
  | 'totalValue'
  | 'investorCount';

const HEADER_PATTERNS: Array<[RegExp, ColumnKey]> = [
  [/fon\s*kodu/, 'fundCode'],
  [/fon\s*ad/, 'fundName'],
  [/kategor/, 'fundCategory'],
  [/1\s*ay|son\s*1\s*ay/, 'returnOneMonth'],
  [/3\s*ay|son\s*3\s*ay/, 'returnThreeMonth'],
  [/6\s*ay|son\s*6\s*ay/, 'returnSixMonth'],
  [/1\s*y[ıi]l|son\s*1\s*y[ıi]l/, 'returnOneYear'],
  [/ytd|y[ıi]lba[şs][ıi]ndan/, 'returnYTD'],
  [/toplam\s*de[ğg]er|fon\s*toplam/, 'totalValue'],
  [/ki[şs]i\s*say[ıi]|yat[ıi]r[ıi]mc[ıi]/, 'investorCount'],
];

const PERCENT_KEYS: ReadonlySet<ColumnKey> = new Set([
  'returnOneMonth',
  'returnThreeMonth',
  'returnSixMonth',
  'returnOneYear',
  'returnYTD',
]);

export function parseComparisonTable(html: string, scrapedAt: string): FundComparisonRecord[] {
  if (!html) return [];
  const $ = cheerio.load(html);

  const table = $('#MainContent_GridViewFonlar, table.table, table').first();
  if (table.length === 0) return [];

  const headerCells = table.find('tr').first().find('th, td');
  if (headerCells.length === 0) return [];

  const columnMap = new Map<number, ColumnKey>();
  headerCells.each((i, cell) => {
    const text = $(cell).text().trim().toLowerCase();
    for (const [re, key] of HEADER_PATTERNS) {
      if (re.test(text)) {
        columnMap.set(i, key);
        break;
      }
    }
  });
  if (!columnMap.size || ![...columnMap.values()].includes('fundCode')) return [];

  const rows: FundComparisonRecord[] = [];
  table.find('tr').slice(1).each((_i, tr) => {
    const cells = $(tr).find('td');
    if (cells.length === 0) return;

    const rec: Partial<FundComparisonRecord> = {};
    columnMap.forEach((key, idx) => {
      const raw = $(cells[idx]).text().trim();
      if (!raw) return;
      if (key === 'fundCode' || key === 'fundName' || key === 'fundCategory') {
        rec[key] = raw;
      } else if (PERCENT_KEYS.has(key)) {
        const n = parseTurkishNumber(raw.replace('%', ''));
        rec[key] = roundTo(n / 100, 6);
      } else {
        rec[key] = parseTurkishNumber(raw);
      }
    });

    if (!rec.fundCode) return;
    rows.push({
      fundCode: rec.fundCode,
      fundName: rec.fundName ?? '',
      ...(rec.fundCategory ? { fundCategory: rec.fundCategory } : {}),
      ...(rec.returnOneMonth !== undefined ? { returnOneMonth: rec.returnOneMonth } : {}),
      ...(rec.returnThreeMonth !== undefined ? { returnThreeMonth: rec.returnThreeMonth } : {}),
      ...(rec.returnSixMonth !== undefined ? { returnSixMonth: rec.returnSixMonth } : {}),
      ...(rec.returnOneYear !== undefined ? { returnOneYear: rec.returnOneYear } : {}),
      ...(rec.returnYTD !== undefined ? { returnYTD: rec.returnYTD } : {}),
      ...(rec.totalValue !== undefined ? { totalValue: rec.totalValue } : {}),
      ...(rec.investorCount !== undefined ? { investorCount: Math.trunc(rec.investorCount) } : {}),
      metadata: {
        scrapedAt,
        source: 'tefas.gov.tr',
      },
    });
  });

  return rows;
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
