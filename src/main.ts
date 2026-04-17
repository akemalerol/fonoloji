import { Actor, log } from 'apify';
import { scrapeComparison } from './routes/comparison.js';
import { scrapeDailyData } from './routes/daily.js';
import { scrapeFundDetail } from './routes/fundDetail.js';
import { scrapeFundList } from './routes/fundList.js';
import { scrapeHistoricalData } from './routes/historical.js';
import { TefasClient } from './scrapers/tefasClient.js';
import type { Input } from './types/input.js';
import { validateInput } from './utils/validators.js';

await Actor.init();

try {
  const input = await Actor.getInput<Input>();
  if (!input) throw new Error('Input is required');

  const { warnings } = validateInput(input);
  for (const w of warnings) {
    log.warning(`[${w.field}] ${w.message}`);
  }

  const proxyConfiguration = input.proxy
    ? await Actor.createProxyConfiguration(input.proxy)
    : undefined;
  const proxyUrl = proxyConfiguration ? await proxyConfiguration.newUrl() : undefined;

  const client = new TefasClient({
    maxRequestsPerMinute: input.maxRequestsPerMinute ?? 30,
    proxyUrl,
  });

  await chargeSafe('scrape-started');

  let resultCount = 0;
  switch (input.mode) {
    case 'daily':
      resultCount = await scrapeDailyData(client, input);
      break;
    case 'historical':
      resultCount = await scrapeHistoricalData(client, input);
      break;
    case 'fund_list':
      resultCount = await scrapeFundList(client, input);
      break;
    case 'fund_detail':
      resultCount = await scrapeFundDetail(client, input);
      break;
    case 'comparison':
      resultCount = await scrapeComparison(client, input);
      break;
    default: {
      const exhaustive: never = input.mode;
      throw new Error(`Unknown mode: ${exhaustive as string}`);
    }
  }

  await chargeForResults(input.mode, resultCount);

  log.info(`Scraping complete. ${resultCount} result(s) collected.`);
} catch (error) {
  log.error('Scraping failed', { error: (error as Error).message });
  throw error;
} finally {
  await Actor.exit();
}

async function chargeSafe(eventName: string, count = 1): Promise<void> {
  try {
    await Actor.charge({ eventName, count });
  } catch (err) {
    log.debug(`Charge event "${eventName}" skipped: ${(err as Error).message}`);
  }
}

async function chargeForResults(mode: Input['mode'], resultCount: number): Promise<void> {
  if (resultCount <= 0) return;
  switch (mode) {
    case 'daily':
    case 'historical':
    case 'fund_list': {
      const units = Math.ceil(resultCount / 100);
      for (let i = 0; i < units; i++) await chargeSafe('data-points-100');
      break;
    }
    case 'fund_detail':
      for (let i = 0; i < resultCount; i++) await chargeSafe('fund-detail-report');
      break;
    case 'comparison':
      await chargeSafe('comparison-report');
      break;
  }
}
