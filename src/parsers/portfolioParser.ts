import * as cheerio from 'cheerio';
import type { PortfolioAllocation } from '../types/fund.js';
import { parseTurkishNumber } from './htmlParser.js';

const CATEGORY_MAP: Array<{ keywords: string[]; key: keyof PortfolioAllocation }> = [
  { keywords: ['hisse senedi'], key: 'stock' },
  { keywords: ['devlet tahvili', 'dev. tah.'], key: 'governmentBond' },
  { keywords: ['hazine bonosu'], key: 'treasuryBill' },
  { keywords: ['özel sektör tahvili', 'borçlanma araçları', 'borçlanma arac'], key: 'corporateBond' },
  { keywords: ['eurobond', 'dış borçlanma'], key: 'eurobond' },
  { keywords: ['altın', 'kıymetli maden'], key: 'gold' },
  { keywords: ['nakit', 'vadeli mevduat', 'ters repo', 'para piyasası', 'tpp', 'katılım hesabı'], key: 'cash' },
];

export function parsePortfolioAllocation(html: string): PortfolioAllocation {
  if (!html) return {};
  const $ = cheerio.load(html);

  const aggregate: Record<keyof PortfolioAllocation, number> = {
    stock: 0,
    governmentBond: 0,
    treasuryBill: 0,
    corporateBond: 0,
    eurobond: 0,
    gold: 0,
    cash: 0,
    other: 0,
  };
  let matchedAny = false;

  $('table tr').each((_i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const label = $(cells[0]).text().trim().toLowerCase();
    const valueText = $(cells[cells.length - 1]).text().replace('%', '').trim();
    if (!label || !valueText) return;
    const value = parseTurkishNumber(valueText);
    if (value === 0 && !/^0+[,\.]?0*$/.test(valueText)) return;

    const matched = classify(label);
    if (matched) {
      aggregate[matched] += value;
      matchedAny = true;
    } else if (/(diğer|other)/.test(label)) {
      aggregate.other += value;
      matchedAny = true;
    }
  });

  if (!matchedAny) return {};

  const result: PortfolioAllocation = {};
  for (const [k, v] of Object.entries(aggregate) as Array<[keyof PortfolioAllocation, number]>) {
    if (v > 0) result[k] = roundTo(v, 4);
  }
  return result;
}

function classify(label: string): keyof PortfolioAllocation | null {
  for (const { keywords, key } of CATEGORY_MAP) {
    if (keywords.some((kw) => label.includes(kw))) return key;
  }
  return null;
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
