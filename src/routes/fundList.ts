import { Actor, log } from 'apify';
import { fetchHistoricalPrices } from '../scrapers/pricesScraper.js';
import type { TefasClient } from '../scrapers/tefasClient.js';
import type { FundListRecord } from '../types/fund.js';
import type { Input } from '../types/input.js';
import { today } from '../utils/dateWindows.js';

export async function scrapeFundList(client: TefasClient, input: Input): Promise<number> {
  const date = input.endDate && input.endDate.length > 0 ? input.endDate : today();

  log.info('Fetching fund list snapshot', {
    date,
    fundType: input.fundType ?? 'ALL',
  });

  const rows = await fetchHistoricalPrices(client, {
    fundCodes: [],
    fundType: input.fundType ?? 'ALL',
    start: date,
    end: date,
  });

  const fundType = input.fundType && input.fundType !== 'ALL' ? input.fundType : undefined;
  const records: FundListRecord[] = rows.map((row) => ({
    fundCode: row.fundCode,
    fundName: row.fundName,
    ...(fundType ? { fundType } : {}),
    isActive: row.price > 0 && row.totalValue > 0,
    latestPrice: row.price,
    latestDate: row.date,
    totalValue: row.totalValue,
    investorCount: row.investorCount,
  }));

  for (const record of records) {
    await Actor.pushData(record);
  }

  return records.length;
}
