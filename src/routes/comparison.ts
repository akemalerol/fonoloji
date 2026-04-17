import { Actor, log } from 'apify';
import { fetchComparison } from '../scrapers/comparisonScraper.js';
import type { TefasClient } from '../scrapers/tefasClient.js';
import type { Input } from '../types/input.js';

export async function scrapeComparison(client: TefasClient, input: Input): Promise<number> {
  const fundType = input.fundType ?? 'ALL';
  log.info('Fetching fund comparison', { fundType });

  const scrapedAt = new Date().toISOString();
  const records = await fetchComparison(client, { fundType, scrapedAt });

  const filtered = input.fundCodes && input.fundCodes.length > 0
    ? records.filter((r) => input.fundCodes!.includes(r.fundCode))
    : records;

  for (const record of filtered) {
    await Actor.pushData(record);
  }

  return filtered.length;
}
