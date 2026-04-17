// @ts-nocheck
import { chromium } from 'playwright';
import { getDb } from '../db/index.js';
import { logIngest, upsertPrices } from '../db/repositories.js';
import {
  recomputeAllMetrics,
  recomputeCategoryStats,
  recomputeDailySummary,
} from '../analytics/recompute.js';
import { parseHistoryApiResponse } from '../../../../src/parsers/jsonParser.js';
function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function splitDateRange(start: string, end: string, maxDays = 90): Array<{ start: string; end: string }> {
  const startMs = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
  const endMs = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
  if (startMs > endMs) return [];
  const dayMs = 86_400_000;
  const out: Array<{ start: string; end: string }> = [];
  let cursor = startMs;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  while (cursor <= endMs) {
    const we = Math.min(cursor + (maxDays - 1) * dayMs, endMs);
    out.push({ start: iso(cursor), end: iso(we) });
    cursor = we + dayMs;
  }
  return out;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HISTORY_URL = 'https://www.tefas.gov.tr/TarihselVeriler.aspx';
const API_URL = 'https://www.tefas.gov.tr/api/DB/BindHistoryInfo';

interface Options {
  years: number;
  types: Array<'YAT' | 'EMK' | 'BYF'>;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let years = 2;
  let types: Options['types'] = ['YAT', 'EMK', 'BYF'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--years' && args[i + 1]) years = Number(args[++i]);
    else if (a === '--types' && args[i + 1]) types = args[++i].split(',');
  }
  return { years, types };
}

async function main() {
  const { years, types } = parseArgs();
  const db = getDb();

  const end = new Date();
  const start = new Date(end);
  start.setUTCFullYear(end.getUTCFullYear() - years);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);
  const windows = splitDateRange(startISO, endISO);

  console.log(`[playwright-backfill] ${startISO} → ${endISO} (${years} yıl) types=${types.join(',')} windows=${windows.length}`);
  const startedAt = Date.now();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 900 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const page = await context.newPage();
  console.log('[playwright-backfill] Visiting TEFAS to pass challenge…');
  await page.goto(HISTORY_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(3_000);
  await page.goto(HISTORY_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2_000);

  let totalInserted = 0;

  try {
    for (const fundType of types) {
      console.log(`\n[playwright-backfill] ${fundType} başlıyor…`);
      const typeStart = Date.now();
      let typeRows = 0;

      for (const w of windows) {
        const bastarih = toDdMmYyyy(w.start);
        const bittarih = toDdMmYyyy(w.end);
        const bodyStr = `fontip=${fundType}&sfontur=&fonkod=&fongrup=&bastarih=${encodeURIComponent(bastarih)}&bittarih=${encodeURIComponent(bittarih)}&fonturkod=&fonunvantip=`;

        // Use page.evaluate so fetch runs inside the page origin with full cookie access.
        const result: { status: number; body: string } = await page.evaluate(async (body) => {
          try {
            const res = await fetch('/api/DB/BindHistoryInfo', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body,
              credentials: 'include',
            });
            return { status: res.status, body: await res.text() };
          } catch (e) {
            return { status: 0, body: String(e) };
          }
        }, bodyStr);

        if (result.status !== 200 || result.body.includes('Request Rejected')) {
          console.warn(`  [${fundType}] window=${w.start}..${w.end} REJECTED (HTTP ${result.status})`);
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(3_000);
          continue;
        }
        const rows = parseHistoryApiResponse(result.body);
        const { prices } = upsertPrices(db, fundType, rows);
        typeRows += prices;
        totalInserted += prices;
        process.stdout.write(`  [${fundType}] ${w.start}..${w.end} → ${rows.length} rows\n`);
        await page.waitForTimeout(500);
      }

      console.log(
        `  ${fundType} toplam: ${typeRows} satır (${((Date.now() - typeStart) / 1000).toFixed(1)}s)`,
      );
    }

    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: `playwright-backfill-${years}y`,
      status: 'success',
      rowsInserted: totalInserted,
    });

    console.log(`\n[playwright-backfill] Toplam ${totalInserted} satır, ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    console.log('[playwright-backfill] Analytics yeniden hesaplanıyor…');
    recomputeAllMetrics(db);
    recomputeDailySummary(db);
    recomputeCategoryStats(db);
    console.log('[playwright-backfill] Tamamlandı.');
  } catch (err) {
    logIngest(db, {
      startedAt,
      finishedAt: Date.now(),
      kind: `playwright-backfill-${years}y`,
      status: 'error',
      rowsInserted: totalInserted,
      error: err.message,
    });
    console.error('[playwright-backfill] Hata:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
