import { Actor, log } from 'apify';
import { fetchFundDetail } from '../scrapers/fundDetailScraper.js';
import type { TefasClient } from '../scrapers/tefasClient.js';
import type { Input } from '../types/input.js';

export async function scrapeFundDetail(client: TefasClient, input: Input): Promise<number> {
  const codes = input.fundCodes ?? [];
  if (codes.length === 0) {
    throw new Error('fundCodes is required in fund_detail mode');
  }

  const scrapedAt = new Date().toISOString();
  let count = 0;

  for (const code of codes) {
    log.info(`Fetching fund detail for ${code}`);
    try {
      const record = await fetchFundDetail(client, { fundCode: code, scrapedAt });
      if (record) {
        await Actor.pushData(record);
        count++;
      } else {
        log.warning(`No chart data found for fund ${code}`);
      }
    } catch (err) {
      log.error(`Failed to fetch detail for ${code}`, { error: (err as Error).message });
    }
  }

  return count;
}
