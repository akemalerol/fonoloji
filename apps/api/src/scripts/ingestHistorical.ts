import { fetchHistoricalPrices } from '../../../../src/scrapers/pricesScraper.js';
import type { FundType } from '../../../../src/types/input.js';
import { getDb } from '../db/index.js';
import { logIngest, upsertPrices } from '../db/repositories.js';
import { getTefasClient } from '../lib/tefas.js';

interface Options {
  years: number;
  types: FundType[];
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let years = 2;
  let types: FundType[] = ['YAT', 'EMK', 'BYF'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--years' && args[i + 1]) {
      years = Number(args[++i]);
    } else if (a === '--types' && args[i + 1]) {
      types = args[++i]!.split(',') as FundType[];
    }
  }
  return { years, types };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { years, types } = parseArgs();
  const db = getDb();
  const client = getTefasClient();

  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(end.getUTCFullYear() - years);

  const startISO = isoDate(start);
  const endISO = isoDate(end);

  console.log(`[backfill] ${startISO} → ${endISO} (${years} yıl) types=${types.join(',')}`);
  const startedAt = Date.now();
  let total = 0;

  try {
    for (const fundType of types) {
      console.log(`\n[backfill] ${fundType} başlıyor…`);
      const typeStart = Date.now();
      const rows = await fetchHistoricalPrices(client, {
        fundCodes: [],
        fundType,
        start: startISO,
        end: endISO,
      });
      const { funds, prices } = upsertPrices(db, fundType, rows);
      total += prices;
      console.log(
        `  ${fundType}: ${prices} fiyat / ${funds} fon (${((Date.now() - typeStart) / 1000).toFixed(1)}s)`,
      );
    }

    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: `backfill-${years}y`,
      status: 'success',
      rowsInserted: total,
    });
    console.log(
      `\n[backfill] Toplam ${total} satır, ${((Date.now() - startedAt) / 1000).toFixed(1)} sn.`,
    );
    process.exit(0);
  } catch (err) {
    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: `backfill-${years}y`,
      status: 'error',
      rowsInserted: total,
      error: (err as Error).message,
    });
    console.error('[backfill] Hata:', err);
    process.exit(1);
  }
}

main();
