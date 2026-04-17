import { Actor, log } from 'apify';
import { fetchHistoricalPrices } from '../scrapers/pricesScraper.js';
import type { TefasClient } from '../scrapers/tefasClient.js';
import type { FundPriceRecord } from '../types/fund.js';
import type { Input } from '../types/input.js';
import { today } from '../utils/dateWindows.js';
import { toFundPriceRecord } from './mapper.js';

export async function scrapeHistoricalData(client: TefasClient, input: Input): Promise<number> {
  if (!input.startDate) {
    throw new Error('startDate is required in historical mode');
  }
  const end = input.endDate && input.endDate.length > 0 ? input.endDate : today();

  log.info('Fetching historical TEFAS data', {
    start: input.startDate,
    end,
    fundCodes: input.fundCodes ?? [],
    fundType: input.fundType ?? 'ALL',
  });

  const rows = await fetchHistoricalPrices(client, {
    fundCodes: input.fundCodes ?? [],
    fundType: input.fundType ?? 'ALL',
    start: input.startDate,
    end,
  });

  const scrapedAt = new Date().toISOString();
  const records: FundPriceRecord[] = rows.map((row) =>
    toFundPriceRecord(row, { fundType: input.fundType, scrapedAt }),
  );

  for (const record of records) {
    await Actor.pushData(record);
  }

  return records.length;
}
