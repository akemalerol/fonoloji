/**
 * Hisse fiyatı on-demand ingest — Yahoo Finance v8 chart endpoint.
 *
 * Eski v7 /finance/quote crumb+cookie auth gerektirmeye başladı (429 dönüyor).
 * Bunun yerine v8 /finance/chart per-symbol (crumb'sız, public). Batch yok ama
 * sadece görüntülenen ticker'a fetch atıyoruz → scale problem yok.
 *
 * Strateji:
 *   - `getStockPrice(ticker)` — in-memory cache 30sn TTL
 *   - Cache miss → Yahoo v8 chart → parse meta → DB'ye yaz → cache
 *   - UI'nin /api/stocks/:ticker/price çağrısı bunu çağırır
 *   - Cron/interval YOK — pasif ticker'lara fetch atmıyoruz
 *   - Piyasa kapalıysa: son fetched_at DB'den serve, yine cache'e koy
 *
 * yahoo_symbol map:
 *   BIST         ASELS     → ASELS.IS
 *   US plain     AAPL      → AAPL
 *   Bloomberg    AMZN US   → AMZN
 *                AAL LN    → IAG.L (… hmm ticker mismatch)
 *                ABI BB    → ABI.BR
 *                NESN SW   → NESN.SW
 */

import YahooFinance from 'yahoo-finance2';
import { getDb } from '../db/index.js';

// yahoo-finance2 v3+ constructor pattern (eski default export deprecated)
const yahooFinance = new YahooFinance();
(yahooFinance as unknown as { suppressNotices?: (notices: string[]) => void }).suppressNotices?.([
  'yahooSurvey',
]);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const YAHOO_SUFFIX: Record<string, string> = {
  US: '',
  LN: '.L',
  BB: '.BR',
  FP: '.PA',
  NA: '.AS',
  GY: '.DE',
  GR: '.DE',
  SW: '.SW',
  SM: '.MC',
  IM: '.MI',
  JP: '.T',
  HK: '.HK',
  KS: '.KS',
  AU: '.AX',
  CN: '.TO',
  SP: '.SS',
};

export function toYahooSymbol(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  const bloomberg = /^(\S+)\s+([A-Z]{2})$/.exec(t);
  if (bloomberg) {
    const base = bloomberg[1]!;
    const suffix = bloomberg[2]!;
    const yh = YAHOO_SUFFIX[suffix];
    if (yh === undefined) return null;
    return base + yh;
  }
  if (/^[A-Z][A-Z0-9]{2,5}$/.test(t)) return `${t}.IS`; // BIST varsayımı
  return null;
}

// v8 chart response shape
interface ChartMeta {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  instrumentType?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;           // unix seconds — son price zaman damgası
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketState?: string;
  exchangeTimezoneName?: string;
  gmtoffset?: number;
  currentTradingPeriod?: {
    pre?: { start: number; end: number; timezone?: string; gmtoffset?: number };
    regular?: { start: number; end: number; timezone?: string; gmtoffset?: number };
    post?: { start: number; end: number; timezone?: string; gmtoffset?: number };
  };
}

/** v8 chart'ta `marketState` alanı yok. currentTradingPeriod ile infer et. */
function inferMarketState(meta: ChartMeta): string {
  const now = Math.floor(Date.now() / 1000);
  const tp = meta.currentTradingPeriod;
  if (tp?.regular && now >= tp.regular.start && now <= tp.regular.end) return 'REGULAR';
  if (tp?.pre && now >= tp.pre.start && now <= tp.pre.end) return 'PRE';
  if (tp?.post && now >= tp.post.start && now <= tp.post.end) return 'POST';
  return 'CLOSED';
}

interface ChartResponse {
  chart?: {
    result?: Array<{ meta: ChartMeta }> | null;
    error?: { code?: string; description?: string } | null;
  };
}

export interface StockPrice {
  ticker: string;
  yahooSymbol: string;
  price: number | null;
  previous: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string | null;
  marketState: string | null;
  isDelayed: boolean;
  delayMinutes: number;
  fetchedAt: number;
}

/** yahoo-finance2 v3+ chart API. period1/period2 Date objeleri zorunlu.
 *  Meta'da regularMarketTime + currentTradingPeriod Date objesi olarak gelir,
 *  bizim ChartMeta tipi unix-seconds tutuyor — convertMeta ile dönüştür. */
interface YfChartMeta {
  currency?: string;
  symbol?: string;
  exchangeName?: string;
  instrumentType?: string;
  regularMarketPrice?: number;
  regularMarketTime?: Date | number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  currentTradingPeriod?: {
    pre?: { start?: Date | number; end?: Date | number };
    regular?: { start?: Date | number; end?: Date | number };
    post?: { start?: Date | number; end?: Date | number };
  };
}

function toUnixSeconds(v: Date | number | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  return Math.floor(v.getTime() / 1000);
}

function convertMeta(yf: YfChartMeta): ChartMeta {
  return {
    currency: yf.currency,
    symbol: yf.symbol,
    exchangeName: yf.exchangeName,
    instrumentType: yf.instrumentType,
    regularMarketPrice: yf.regularMarketPrice,
    regularMarketTime: toUnixSeconds(yf.regularMarketTime),
    chartPreviousClose: yf.chartPreviousClose,
    previousClose: yf.previousClose,
    regularMarketDayHigh: yf.regularMarketDayHigh,
    regularMarketDayLow: yf.regularMarketDayLow,
    regularMarketVolume: yf.regularMarketVolume,
    currentTradingPeriod: yf.currentTradingPeriod
      ? {
          pre: yf.currentTradingPeriod.pre
            ? {
                start: toUnixSeconds(yf.currentTradingPeriod.pre.start) ?? 0,
                end: toUnixSeconds(yf.currentTradingPeriod.pre.end) ?? 0,
              }
            : undefined,
          regular: yf.currentTradingPeriod.regular
            ? {
                start: toUnixSeconds(yf.currentTradingPeriod.regular.start) ?? 0,
                end: toUnixSeconds(yf.currentTradingPeriod.regular.end) ?? 0,
              }
            : undefined,
          post: yf.currentTradingPeriod.post
            ? {
                start: toUnixSeconds(yf.currentTradingPeriod.post.start) ?? 0,
                end: toUnixSeconds(yf.currentTradingPeriod.post.end) ?? 0,
              }
            : undefined,
        }
      : undefined,
  };
}

async function fetchFromYahoo(yahooSymbol: string): Promise<ChartMeta | null> {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 2 * 86_400_000); // 2 gün geriye — hafta sonu edge case
    const res = await yahooFinance.chart(yahooSymbol, {
      period1: yesterday,
      period2: now,
      interval: '1d',
    });
    const yfMeta = (res as unknown as { meta?: YfChartMeta }).meta;
    return yfMeta ? convertMeta(yfMeta) : null;
  } catch {
    return null;
  }
}

/** Ticker Bloomberg format mı? (boşluk içeriyor → gecikme BIST dışı olasılığı) */
function detectDelay(ticker: string): { isDelayed: boolean; delayMinutes: number } {
  const hasSpace = ticker.includes(' ');
  // Boşluksuz = BIST varsayımı → 15dk gecikmeli
  if (!hasSpace) return { isDelayed: true, delayMinutes: 15 };
  // Bloomberg: US regular realtime, diğerleri genelde near-realtime
  return { isDelayed: false, delayMinutes: 0 };
}

function upsertPrice(
  ticker: string,
  yahoo: string,
  meta: ChartMeta | null,
  errorMsg: string | null,
): void {
  const db = getDb();
  const now = Date.now();
  const price = meta?.regularMarketPrice ?? null;
  const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
  const changePct = price !== null && prev !== null && prev > 0
    ? ((price - prev) / prev) * 100
    : null;
  db.prepare(
    `INSERT INTO stock_prices
       (ticker, yahoo_symbol, price, previous, change_pct, day_high, day_low,
        volume, currency, market_state, last_error, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       yahoo_symbol = excluded.yahoo_symbol,
       price = excluded.price,
       previous = excluded.previous,
       change_pct = excluded.change_pct,
       day_high = excluded.day_high,
       day_low = excluded.day_low,
       volume = excluded.volume,
       currency = excluded.currency,
       market_state = excluded.market_state,
       last_error = excluded.last_error,
       fetched_at = excluded.fetched_at`,
  ).run(
    ticker,
    yahoo,
    price,
    prev,
    changePct,
    meta?.regularMarketDayHigh ?? null,
    meta?.regularMarketDayLow ?? null,
    meta?.regularMarketVolume ?? null,
    meta?.currency ?? null,
    meta ? inferMarketState(meta) : null,
    errorMsg,
    now,
  );
}

// In-memory cache: ticker → { fetchedAt, data }
interface CacheEntry {
  fetchedAt: number;
  data: StockPrice | null;
}
const priceCache = new Map<string, CacheEntry>();
const LIVE_TTL_MS = 30_000;
const CLOSED_TTL_MS = 5 * 60_000;

/** Ticker için fiyat — cache varsa o, yoksa Yahoo'dan çek + DB'ye yaz + cache. */
export async function getStockPrice(ticker: string): Promise<StockPrice | null> {
  const t = ticker.trim().toUpperCase();
  const yahoo = toYahooSymbol(t);
  if (!yahoo) return null;

  const cached = priceCache.get(t);
  if (cached) {
    const age = Date.now() - cached.fetchedAt;
    const ttl = cached.data?.marketState === 'REGULAR' || cached.data?.marketState === 'PRE' || cached.data?.marketState === 'POST'
      ? LIVE_TTL_MS
      : CLOSED_TTL_MS;
    if (age < ttl) return cached.data;
  }

  const meta = await fetchFromYahoo(yahoo);
  upsertPrice(t, yahoo, meta, meta ? null : 'fetch_failed');

  const delay = detectDelay(t);
  const price = meta?.regularMarketPrice ?? null;
  const prev = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
  const changePct = price !== null && prev !== null && prev > 0
    ? ((price - prev) / prev) * 100
    : null;

  const result: StockPrice | null = meta
    ? {
        ticker: t,
        yahooSymbol: yahoo,
        price,
        previous: prev,
        changePct,
        dayHigh: meta.regularMarketDayHigh ?? null,
        dayLow: meta.regularMarketDayLow ?? null,
        volume: meta.regularMarketVolume ?? null,
        currency: meta.currency ?? null,
        marketState: inferMarketState(meta),
        isDelayed: delay.isDelayed,
        delayMinutes: delay.delayMinutes,
        fetchedAt: Date.now(),
      }
    : null;

  priceCache.set(t, { fetchedAt: Date.now(), data: result });
  return result;
}

/** DB'den son bilinen fiyatı getir (fetch yapmadan, yalnız read). */
export function getCachedStockPrice(ticker: string): StockPrice | null {
  const t = ticker.trim().toUpperCase();
  const cached = priceCache.get(t);
  if (cached?.data) return cached.data;
  const row = getDb()
    .prepare(
      `SELECT yahoo_symbol, price, previous, change_pct, day_high, day_low,
              volume, currency, market_state, fetched_at
       FROM stock_prices WHERE ticker = ?`,
    )
    .get(t) as
    | {
        yahoo_symbol: string;
        price: number | null;
        previous: number | null;
        change_pct: number | null;
        day_high: number | null;
        day_low: number | null;
        volume: number | null;
        currency: string | null;
        market_state: string | null;
        fetched_at: number;
      }
    | undefined;
  if (!row || row.price === null) return null;
  const delay = detectDelay(t);
  return {
    ticker: t,
    yahooSymbol: row.yahoo_symbol,
    price: row.price,
    previous: row.previous,
    changePct: row.change_pct,
    dayHigh: row.day_high,
    dayLow: row.day_low,
    volume: row.volume,
    currency: row.currency,
    marketState: row.market_state,
    isDelayed: delay.isDelayed,
    delayMinutes: delay.delayMinutes,
    fetchedAt: row.fetched_at,
  };
}

// Ana ticker ingest fonksiyonu (backward compat; eski cron için no-op).
export async function runStockPricesIngest(): Promise<{ total: number; ok: number; noQuote: number; durationMs: number }> {
  // On-demand mimari — bulk fetch yok. Return boş.
  return { total: 0, ok: 0, noQuote: 0, durationMs: 0 };
}

export function schedulePriceTicker(_log: { info: (m: string) => void; error: (...a: unknown[]) => void }): void {
  // On-demand cache yeterli — interval fetch yok.
  // İleride "popular tickers warm-up" eklenebilir.
}

// CLI — tek symbol test
if (import.meta.url === `file://${process.argv[1]}`) {
  const ticker = process.argv[2];
  if (!ticker) {
    console.error('Usage: node ingestStockPrices.js <TICKER>');
    process.exit(1);
  }
  getStockPrice(ticker)
    .then((p) => {
      console.log(JSON.stringify(p, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('HATA', err);
      process.exit(1);
    });
}
