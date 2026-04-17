import { fetchHistoricalPrices } from '../../../../src/scrapers/pricesScraper.js';
import type { FundType } from '../../../../src/types/input.js';
import { getDb } from '../db/index.js';
import { logIngest, upsertPrices } from '../db/repositories.js';
import { getTefasClient } from '../lib/tefas.js';

function today(): string {
  const d = new Date();
  const tz = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  return tz.toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function runDailyIngest(args?: { start?: string; end?: string }): Promise<{
  funds: number;
  prices: number;
}> {
  const db = getDb();
  const client = getTefasClient();

  const start = args?.start ?? yesterday();
  const end = args?.end ?? today();

  const startedAt = Date.now();
  const aggregated = { funds: 0, prices: 0 };

  console.log(`[ingest] Fetching ${start} .. ${end}`);
  try {
    for (const fundType of ['YAT', 'EMK', 'BYF'] as FundType[]) {
      const rows = await fetchHistoricalPrices(client, {
        fundCodes: [],
        fundType,
        start,
        end,
      });
      const result = upsertPrices(db, fundType, rows);
      aggregated.funds += result.funds;
      aggregated.prices += result.prices;
      console.log(`  ${fundType}: ${rows.length} rows`);
    }

    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: 'daily',
      status: 'success',
      rowsInserted: aggregated.prices,
    });

    console.log(
      `[ingest] Done. ${aggregated.funds} funds, ${aggregated.prices} price rows (${(
        (Date.now() - startedAt) /
        1000
      ).toFixed(1)}s)`,
    );
    return aggregated;
  } catch (err) {
    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: 'daily',
      status: 'error',
      rowsInserted: aggregated.prices,
      error: (err as Error).message,
    });
    throw err;
  }
}

// Direct CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyIngest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ingest] Failed:', err);
      process.exit(1);
    });
}
