/**
 * BIST hisse logoları — TradingView symbol-search API'sinden çekilip
 * /opt/fonoloji/apps/web/public/stock-logos/{TICKER}.svg olarak host edilir.
 *
 * Pipeline:
 *   1. fund_holdings'ten unique ticker listesi al
 *   2. Her ticker için TV search → logoid
 *   3. s3-symbol-logo.tradingview.com/{logoid}--big.svg → SVG indir
 *   4. SVG'yi web/public/stock-logos/ dizinine yaz
 *   5. stock_logos tablosuna durum yaz (ok / not_found / failed)
 *
 * Rate limit: 5 concurrent, ticker başına ~300ms gecikme. ~1200 ticker için
 * total ~2-3 dakika.
 *
 * Refresh stratejisi:
 *   - Cron haftada 1 (Pazar 05:00) sadece eksikleri ve `not_found`'ları tekrar dener
 *   - Manuel full refresh için --all flag
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// /opt/fonoloji/apps/api/dist/apps/api/src/scripts → /opt/fonoloji/apps/web/public
// Prod path: ../../../../../../web/public/stock-logos (compiled'dan 6 seviye yukarı)
// Dev path: ../../../../web/public/stock-logos (src'den 4 seviye yukarı)
function resolveLogoDir(): string {
  const candidates = [
    join(__dirname, '../../../../../../web/public/stock-logos'), // prod compiled
    join(__dirname, '../../../../web/public/stock-logos'),       // dev src
    join(process.cwd(), 'apps/web/public/stock-logos'),          // monorepo root cwd
  ];
  for (const c of candidates) {
    const parent = dirname(c);
    if (existsSync(parent)) return c;
  }
  throw new Error(`Logo dizini bulunamadı: ${candidates.join(', ')}`);
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

interface TvSearchItem {
  symbol: string;
  description?: string;
  type?: string;
  exchange?: string;
  logoid?: string;
  logo?: { logoid?: string };
}

/** TV'den ticker için logoid bul. null = TV kapsamında yok. */
async function lookupLogoid(ticker: string): Promise<string | null> {
  const url =
    `https://symbol-search.tradingview.com/symbol_search/?text=${encodeURIComponent(ticker)}&type=stock&exchange=BIST`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Origin: 'https://www.tradingview.com',
      Referer: 'https://www.tradingview.com/',
      Accept: 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TV search HTTP ${res.status}`);
  const text = await res.text();
  // TV sometimes wraps in {"symbols":[...]} sometimes returns array directly
  let items: TvSearchItem[];
  try {
    const parsed = JSON.parse(text) as TvSearchItem[] | { symbols: TvSearchItem[] };
    items = Array.isArray(parsed) ? parsed : (parsed.symbols ?? []);
  } catch {
    return null;
  }
  // İlk stock tipi + BIST exchange + aynı ticker match
  const cleanTicker = ticker.toUpperCase();
  const match = items.find((i) => {
    const sym = (i.symbol ?? '').replace(/<[^>]+>/g, '').toUpperCase();
    return sym === cleanTicker && (i.exchange === 'BIST' || !i.exchange);
  }) ?? items[0];
  const logoid = match?.logoid ?? match?.logo?.logoid ?? null;
  return logoid && typeof logoid === 'string' ? logoid : null;
}

/** TV CDN'inden SVG indir. */
async function downloadLogo(logoid: string): Promise<Buffer> {
  const url = `https://s3-symbol-logo.tradingview.com/${encodeURIComponent(logoid)}--big.svg`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/svg+xml,image/*,*/*' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Logo indirme HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Minimum validation — SVG içerik kontrolü
  const head = buf.subarray(0, 100).toString();
  if (!head.includes('<svg') && !head.includes('<?xml')) {
    throw new Error('İndirilen içerik SVG değil');
  }
  return buf;
}

interface TickerRow {
  ticker: string;
  existing: 'ok' | 'not_found' | 'failed' | null;
}

/** fund_holdings + broker_recommendations'ten tüm unique ticker'ları al,
 *  stock_logos mevcut durumlarıyla birleştir. */
function listTickersToProcess(all: boolean): TickerRow[] {
  const db = getDb();
  // BIST ticker formatı: 3-6 büyük harf/rakam, boşluk/özel karakter yok.
  // Yabancı hisse (AAPL, ABBV, AAL LN) filtre dışı — TV'ye gereksiz sorgu atmamak için.
  const rows = db
    .prepare(
      `WITH source_tickers AS (
         SELECT DISTINCT asset_code AS t FROM fund_holdings
         WHERE asset_type = 'stock'
           AND asset_code IS NOT NULL
           AND length(asset_code) BETWEEN 3 AND 6
           AND asset_code NOT LIKE '% %'
           AND asset_code GLOB '[A-Z0-9]*'
           AND NOT asset_code GLOB '*[^A-Z0-9]*'
         UNION
         SELECT DISTINCT ticker AS t FROM broker_recommendations
       )
       SELECT st.t AS ticker, sl.status AS existing
       FROM source_tickers st
       LEFT JOIN stock_logos sl ON sl.ticker = st.t
       ORDER BY st.t`,
    )
    .all() as TickerRow[];

  if (all) return rows;
  // Incremental: sadece henüz denenmemiş veya failed olanları. not_found 30+ gün
  // önce denendiyse tekrar dene (TV yeni ekleme olabilir).
  return rows.filter((r) => {
    if (r.existing === null) return true;
    if (r.existing === 'failed') return true;
    return false;
  });
}

interface IngestStats {
  processed: number;
  ok: number;
  notFound: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

/** Paralel worker havuzu — N concurrent job. */
async function parallelMap<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const i = nextIdx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runStockLogosIngest(opts?: { all?: boolean }): Promise<IngestStats> {
  const t0 = Date.now();
  const logoDir = resolveLogoDir();
  if (!existsSync(logoDir)) mkdirSync(logoDir, { recursive: true });
  console.log(`[stock-logos] Target dir: ${logoDir}`);

  const db = getDb();
  const tickers = listTickersToProcess(opts?.all ?? false);
  console.log(`[stock-logos] ${tickers.length} ticker işlenecek (${opts?.all ? 'FULL' : 'INCREMENTAL'})`);

  const upsert = db.prepare(
    `INSERT INTO stock_logos (ticker, logoid, file_size, status, last_error, found_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       logoid = excluded.logoid,
       file_size = excluded.file_size,
       status = excluded.status,
       last_error = excluded.last_error,
       found_at = COALESCE(stock_logos.found_at, excluded.found_at),
       updated_at = excluded.updated_at`,
  );

  let ok = 0;
  let notFound = 0;
  let failed = 0;

  await parallelMap(tickers, 5, async (row) => {
    const ticker = row.ticker;
    try {
      // Rate limit — burst'ü engellemek için 100-300ms jitter
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

      const logoid = await lookupLogoid(ticker);
      if (!logoid) {
        upsert.run(ticker, null, null, 'not_found', null, null, Date.now());
        notFound++;
        return;
      }

      const buf = await downloadLogo(logoid);
      const filePath = join(logoDir, `${ticker}.svg`);
      writeFileSync(filePath, buf);
      upsert.run(ticker, logoid, buf.length, 'ok', null, Date.now(), Date.now());
      ok++;
      if (ok % 50 === 0) console.log(`[stock-logos] ${ok} indirildi...`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      upsert.run(ticker, null, null, 'failed', msg.slice(0, 200), null, Date.now());
      failed++;
      if (failed <= 5) console.warn(`[stock-logos] ${ticker}: ${msg}`);
    }
  });

  const durationMs = Date.now() - t0;
  const stats: IngestStats = {
    processed: tickers.length,
    ok,
    notFound,
    failed,
    skipped: 0,
    durationMs,
  };
  console.log(`[stock-logos] OK ${ok} · 404 ${notFound} · FAIL ${failed} · ${Math.round(durationMs / 1000)}s`);
  return stats;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const all = process.argv.includes('--all');
  runStockLogosIngest({ all })
    .then((s) => {
      console.log('[stock-logos] Done', s);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[stock-logos] HATA', err);
      process.exit(1);
    });
}
