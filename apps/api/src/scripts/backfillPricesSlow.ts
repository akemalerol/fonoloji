/**
 * TEFAS fiyat geçmişi güvenli backfill — ban riski olmadan geriye git.
 *
 * Yaklaşım:
 *   - 30 günlük pencerelere böl
 *   - Window başına delay (default 3 sn)
 *   - Her window sonrası DB'ye direkt yaz, belleği boşalt
 *   - Progressive logging (ne kadar gittik, kaç row, tahmini kalan süre)
 *   - 3 ardışık boş window → "data başlangıcı" kabul, dur
 *   - Resume: `--since` ile belirli tarihten başla; default mevcut min(price.date)
 *
 * Kullanım:
 *   node backfillPricesSlow.js                   # min date'ten 2010-01-01'e git
 *   node backfillPricesSlow.js --to 2015-01-01   # sadece 2015'e kadar git
 *   node backfillPricesSlow.js --delay 5         # 5 sn delay
 *   node backfillPricesSlow.js --window 14       # 14 günlük pencereler
 *
 * VPN önkoşul: TEFAS yabancı IP'leri WAF ile bloklar; bu script TR IP
 * (Keenetic tunnel 172.20.8.2) üzerinden çağrı atar (vpn-split-tefas cron).
 */

import { fetchHistoricalPrices } from '../../../../src/scrapers/pricesScraper.js';
import type { FundType } from '../../../../src/types/input.js';
import { getDb } from '../db/index.js';
import { logIngest, upsertPrices } from '../db/repositories.js';
import { getTefasClient } from '../lib/tefas.js';

interface Options {
  /** Başlangıç — bu tarihten GERİYE gideceğiz (default: DB'deki MIN(date)) */
  from: string | null;
  /** Hedef — bu tarihe kadar git (default: 2010-01-01) */
  to: string;
  /** Fon tipleri */
  types: FundType[];
  /** Window boyutu (gün) — TEFAS API'sinin tek call'da kabul ettiği max */
  windowDays: number;
  /** Delay (ms) — her window arası */
  delayMs: number;
  /** Kaç ardışık boş window sonrası durmalı */
  maxEmptyStreak: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const opts: Options = {
    from: null,
    to: '2010-01-01',
    types: ['YAT', 'EMK', 'BYF'],
    windowDays: 30,
    delayMs: 3000,
    maxEmptyStreak: 3,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--from' && args[i + 1]) opts.from = args[++i]!;
    else if (a === '--to' && args[i + 1]) opts.to = args[++i]!;
    else if (a === '--window' && args[i + 1]) opts.windowDays = Number(args[++i]);
    else if (a === '--delay' && args[i + 1]) opts.delayMs = Number(args[++i]) * 1000;
    else if (a === '--types' && args[i + 1]) opts.types = args[++i]!.split(',') as FundType[];
    else if (a === '--streak' && args[i + 1]) opts.maxEmptyStreak = Number(args[++i]);
  }
  return opts;
}

function parseIsoDate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const db = getDb();
  const client = getTefasClient();

  // Başlangıç tarihi — default: DB'deki mevcut min date'in bir gün öncesi
  let fromIso: string;
  if (opts.from) {
    fromIso = opts.from;
  } else {
    const row = db.prepare(`SELECT MIN(date) as d FROM prices`).get() as { d: string | null };
    const minDate = row.d ?? new Date().toISOString().slice(0, 10);
    fromIso = isoDate(addDays(parseIsoDate(minDate), -1));
  }

  const fromDate = parseIsoDate(fromIso);
  const toDate = parseIsoDate(opts.to);

  if (toDate >= fromDate) {
    console.log(`[backfill] Hedef ${opts.to} zaten başlangıç ${fromIso}'dan sonra → iş yok`);
    process.exit(0);
  }

  console.log(`[backfill] ${isoDate(fromDate)} ← ${opts.to} geriye backfill`);
  console.log(`  types=${opts.types.join(',')} window=${opts.windowDays}gün delay=${opts.delayMs}ms`);
  console.log(`  toplam ~${Math.ceil((fromDate.getTime() - toDate.getTime()) / (opts.windowDays * 86_400_000))} pencere × ${opts.types.length} tip`);

  const startedAt = Date.now();
  let totalPrices = 0;
  let totalFunds = 0;
  const emptyStreakPerType = new Map<FundType, number>();

  // Geriye doğru: cursor = fromDate, her tur windowDays gün geri git
  let cursor = fromDate;

  while (cursor > toDate) {
    const windowEnd = cursor;
    const windowStart = new Date(Math.max(addDays(cursor, -opts.windowDays + 1).getTime(), toDate.getTime()));

    const startISO = isoDate(windowStart);
    const endISO = isoDate(windowEnd);

    for (const fundType of opts.types) {
      // Bu type için ardışık boş streak durumunu kontrol et
      const streak = emptyStreakPerType.get(fundType) ?? 0;
      if (streak >= opts.maxEmptyStreak) continue; // bu tipte data bitti

      try {
        const rows = await fetchHistoricalPrices(client, {
          fundCodes: [],
          fundType,
          start: startISO,
          end: endISO,
        });

        if (rows.length === 0) {
          emptyStreakPerType.set(fundType, streak + 1);
          console.log(`  [${fundType}] ${startISO}..${endISO}: BOŞ (streak=${streak + 1})`);
        } else {
          emptyStreakPerType.set(fundType, 0);
          const { funds, prices } = upsertPrices(db, fundType, rows);
          totalPrices += prices;
          totalFunds += funds;
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
          console.log(
            `  [${fundType}] ${startISO}..${endISO}: +${prices} fiyat / +${funds} fon  (total=${totalPrices}, ${elapsed}s)`,
          );
        }
      } catch (err) {
        console.warn(`  [${fundType}] ${startISO}..${endISO}: HATA ${err instanceof Error ? err.message : err}`);
        emptyStreakPerType.set(fundType, streak + 1);
      }

      // Her call sonrası delay (ban koruma)
      await sleep(opts.delayMs);
    }

    // Tüm tipler için streak dolu mu? Bitir.
    const allDone = opts.types.every((t) => (emptyStreakPerType.get(t) ?? 0) >= opts.maxEmptyStreak);
    if (allDone) {
      console.log(`[backfill] Tüm tipler için ardışık ${opts.maxEmptyStreak} boş → data başlangıcına ulaşıldı, dur`);
      break;
    }

    cursor = addDays(windowStart, -1);
  }

  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(0);
  logIngest(db, {
    startedAt,
    finishedAt: Date.now(),
    kind: `backfill-slow`,
    status: 'success',
    rowsInserted: totalPrices,
  });

  console.log(`\n[backfill] BİTTİ — +${totalPrices} fiyat, +${totalFunds} fon referansı, ${durationSec}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] ÖLÜMCÜL HATA:', err);
  process.exit(1);
});
