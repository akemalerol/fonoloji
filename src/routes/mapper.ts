import type { FundPriceRecord } from '../types/fund.js';
import type { FundType } from '../types/input.js';
import type { FundPriceRow } from '../types/tefasResponse.js';

export interface MapOptions {
  fundType?: FundType;
  scrapedAt: string;
}

export function toFundPriceRecord(row: FundPriceRow, options: MapOptions): FundPriceRecord {
  return {
    fundCode: row.fundCode,
    fundName: row.fundName,
    ...(options.fundType && options.fundType !== 'ALL' ? { fundType: options.fundType } : {}),
    date: row.date,
    price: row.price,
    currency: 'TRY',
    totalValue: row.totalValue,
    sharesOutstanding: row.sharesOutstanding,
    investorCount: row.investorCount,
    metadata: {
      scrapedAt: options.scrapedAt,
      source: 'tefas.gov.tr',
    },
  };
}
