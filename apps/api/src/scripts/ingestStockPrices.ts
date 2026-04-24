/**
 * Hisse fiyatı canlı ingest — Yahoo Finance quote API.
 *
 * Kapsam: fund_holdings + broker_recommendations'ten tüm unique ticker'lar.
 *   - BIST: "ASELS" → Yahoo "ASELS.IS"
 *   - US plain: "AAPL" → Yahoo "AAPL" (zaten)
 *   - Bloomberg: "AAL LN" → Yahoo "IAG.L" (exchange suffix map ile)
 *
 * Yahoo quote endpoint: up to ~100 symbols per request.
 *   https://query1.finance.yahoo.com/v7/finance/quote?symbols=X,Y,Z
 * Yanıt alanları: regularMarketPrice, regularMarketPreviousClose,
 * regularMarketChangePercent, regularMarketDayHigh/Low, regularMarketVolume,
 * marketState, currency, exchangeDataDelayedBy, exchange.
 *
 * Piyasa kapalıysa "regularMarketPrice" SON KAPANIŞ fiyatıdır — ayrıca
 * bir şey yapmaya gerek yok. marketState field'ı 'REGULAR' (açık),
 * 'CLOSED' (kapalı), 'PRE'/'POST' (pre/post-market) dönüyor.
 *
 * exchangeDataDelayedBy: saniye cinsinden gecikme. BIST ~15dk (900s),
 * US genelde 0 veya 15dk. UI'da bu değer > 0 ise "gecikmeli" ibaresi.
 */

import { getDb } from '../db/index.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Bloomberg suffix → Yahoo exchange suffix. '' = no suffix needed (US).
const YAHOO_SUFFIX: Record<string, string> = {
  US: '',
  LN: '.L',     // London
  BB: '.BR',    // Brussels
  FP: '.PA',    // Paris
  NA: '.AS',    // Amsterdam
  GY: '.DE',    // Germany XETRA
  GR: '.DE',
  SW: '.SW',    // Swiss SIX
  SM: '.MC',    // Madrid
  IM: '.MI',    // Milan
  JP: '.T',     // Tokyo
  HK: '.HK',    // Hong Kong
  KS: '.KS',    // Korea
  AU: '.AX',    // Australia
  CN: '.TO',    // Canada Toronto
  SP: '.SS',    // Shanghai
};

/** Ticker'ı Yahoo Finance symbol'üne çevir. */
function toYahoo(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  // Bloomberg format: "AMZN US", "AAL LN", "005930 KS"
  const bloomberg = /^(\S+)\s+([A-Z]{2})$/.exec(t);
  if (bloomberg) {
    const base = bloomberg[1]!;
    const suffix = bloomberg[2]!;
    const yh = YAHOO_SUFFIX[suffix];
    if (yh === undefined) return null;
    return base + yh;
  }

  // Boşluksuz: BIST muhtemelen — 3-6 harf
  if (/^[A-Z][A-Z0-9]{2,5}$/.test(t)) {
    // Bir US ticker'ı olabilir (AAPL, MSFT). Ama bizim DB'de genelde "AAPL US" formatında.
    // Düz format → BIST varsayalım (.IS suffix). AAPL gibi plain-US tickers zaten
    // Bloomberg format ile giriyorsa ikinci defa işlenmez.
    return `${t}.IS`;
  }

  return null;
}

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  currency?: string;
  marketState?: 'REGULAR' | 'CLOSED' | 'PRE' | 'POST' | 'PREPRE' | 'POSTPOST';
  exchange?: string;
  exchangeDataDelayedBy?: number;
}

interface YahooResponse {
  quoteResponse?: {
    result: YahooQuote[];
    error: unknown;
  };
}

/** 100'lük gruplar halinde Yahoo quote çek. */
async function fetchQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const result = new Map<string, YahooQuote>();
  const batchSize = 100;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const chunk = symbols.slice(i, i + batchSize);
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(','))}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        console.warn(`[stock-prices] Yahoo batch ${i}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as YahooResponse;
      const quotes = json.quoteResponse?.result ?? [];
      for (const q of quotes) {
        if (q.symbol) result.set(q.symbol, q);
      }
    } catch (err) {
      console.warn(`[stock-prices] batch ${i} hata:`, err instanceof Error ? err.message : err);
    }
    // Rate limit — jitter
    if (i + batchSize < symbols.length) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
    }
  }
  return result;
}

export interface PriceIngestStats {
  total: number;
  ok: number;
  noQuote: number;
  durationMs: number;
}

export async function runStockPricesIngest(): Promise<PriceIngestStats> {
  const t0 = Date.now();
  const db = getDb();

  // fund_holdings + broker_recommendations'ten unique ticker'lar
  const tickers = db
    .prepare(
      `WITH t AS (
         SELECT DISTINCT asset_code AS ticker FROM fund_holdings
         WHERE asset_type='stock' AND asset_code IS NOT NULL
           AND length(asset_code) BETWEEN 3 AND 12
           AND asset_code GLOB '[A-Z0-9]*'
           AND NOT asset_code GLOB '*[^A-Z0-9 ]*'
         UNION
         SELECT DISTINCT ticker FROM broker_recommendations
       )
       SELECT ticker FROM t ORDER BY ticker`,
    )
    .all() as Array<{ ticker: string }>;

  // Ticker → Yahoo symbol map
  const yahooMap = new Map<string, string>(); // ticker → yahoo_symbol
  for (const { ticker } of tickers) {
    const yh = toYahoo(ticker);
    if (yh) yahooMap.set(ticker, yh);
  }

  const symbols = Array.from(new Set(yahooMap.values()));
  console.log(`[stock-prices] ${tickers.length} ticker, ${symbols.length} unique Yahoo sembolü`);

  const quotes = await fetchQuotes(symbols);
  console.log(`[stock-prices] ${quotes.size} quote geldi`);

  const upsert = db.prepare(
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
  );

  let ok = 0;
  let noQuote = 0;
  const now = Date.now();

  const tx = db.transaction(() => {
    for (const { ticker } of tickers) {
      const yh = yahooMap.get(ticker);
      if (!yh) continue;
      const q = quotes.get(yh);
      if (!q || q.regularMarketPrice === undefined) {
        upsert.run(ticker, yh, null, null, null, null, null, null, null, null, 'no_quote', now);
        noQuote++;
        continue;
      }
      upsert.run(
        ticker,
        yh,
        q.regularMarketPrice,
        q.regularMarketPreviousClose ?? null,
        q.regularMarketChangePercent ?? null,
        q.regularMarketDayHigh ?? null,
        q.regularMarketDayLow ?? null,
        q.regularMarketVolume ?? null,
        q.currency ?? null,
        q.marketState ?? null,
        null,
        now,
      );
      ok++;
    }
  });
  tx();

  const durationMs = Date.now() - t0;
  console.log(`[stock-prices] ok=${ok} nq=${noQuote} ${Math.round(durationMs / 1000)}s`);
  return { total: tickers.length, ok, noQuote, durationMs };
}

// --- Market hours logic & scheduler ---

interface MarketWindow {
  /** Exchange kodu (Bloomberg suffix veya 'BIST') */
  exchange: string;
  /** TR saati — hafta içi açılış saati (0-23) + dakika */
  openHourTr: number;
  openMinTr: number;
  /** TR saati — hafta içi kapanış (exchangeDataDelayedBy dahil "finalize" ekstra ekle) */
  closeHourTr: number;
  closeMinTr: number;
}

// Ana piyasaların TR saatine göre açılış-kapanış penceresi.
// Kapanıştan sonra gelecek 30 dk (exchange delay + mum tamamlaması) içinde
// fetch'e devam ediyoruz — finalize son değer düzgün yazılsın.
const MARKETS: MarketWindow[] = [
  { exchange: 'BIST', openHourTr: 10, openMinTr: 0, closeHourTr: 19, closeMinTr: 0 },    // BIST 10:00-18:00 + 60dk cushion
  { exchange: 'US',   openHourTr: 16, openMinTr: 30, closeHourTr: 23, closeMinTr: 30 },  // NYSE 16:30-23:00 TR + cushion
  { exchange: 'LN',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },   // LSE 10:00-18:30 TR (winter)
  { exchange: 'BB',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'FP',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'NA',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'GY',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'GR',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'SW',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'SM',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'IM',   openHourTr: 10, openMinTr: 0, closeHourTr: 18, closeMinTr: 30 },
  { exchange: 'JP',   openHourTr: 3,  openMinTr: 0, closeHourTr: 9,  closeMinTr: 0 },
  { exchange: 'HK',   openHourTr: 4,  openMinTr: 30, closeHourTr: 11, closeMinTr: 0 },
  { exchange: 'KS',   openHourTr: 3,  openMinTr: 0, closeHourTr: 9,  closeMinTr: 30 },
  { exchange: 'AU',   openHourTr: 1,  openMinTr: 0, closeHourTr: 7,  closeMinTr: 0 },
  { exchange: 'CN',   openHourTr: 16, openMinTr: 30, closeHourTr: 23, closeMinTr: 30 },
];

function getTrParts(now: Date): { weekday: number; hour: number; minute: number } {
  // TR saati = UTC+3 (DST yok)
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  const trTotal = (utc + 3 * 60) % (24 * 60);
  const trHour = Math.floor(trTotal / 60);
  const trMinute = trTotal % 60;
  // Weekday hesaplaması (TR'ye göre kaydırıldı)
  const utcDay = now.getUTCDay();
  const dayAdj = utc + 3 * 60 >= 24 * 60 ? 1 : 0;
  const weekday = (utcDay + dayAdj) % 7;
  return { weekday, hour: trHour, minute: trMinute };
}

function isAnyMarketOpen(now: Date): boolean {
  const { weekday, hour, minute } = getTrParts(now);
  // 0 = Pazar, 6 = Cumartesi — hafta sonu tüm borsalar kapalı
  if (weekday === 0 || weekday === 6) return false;
  const nowMin = hour * 60 + minute;
  return MARKETS.some((m) => {
    const open = m.openHourTr * 60 + m.openMinTr;
    const close = m.closeHourTr * 60 + m.closeMinTr;
    return nowMin >= open && nowMin <= close;
  });
}

let tickerRunning = false;
let lastSuccessAt = 0;

/**
 * Her 30 sn bir tick. Piyasa kapalıysa skip. Overlap protection.
 * Next.js SSR / client polling buradan beslenecek.
 */
export function schedulePriceTicker(log: { info: (m: string) => void; error: (...a: unknown[]) => void }): void {
  const tick = async () => {
    if (tickerRunning) return;
    if (!isAnyMarketOpen(new Date())) return;
    tickerRunning = true;
    try {
      const r = await runStockPricesIngest();
      lastSuccessAt = Date.now();
      if (r.ok > 0 && Date.now() - (lastSuccessAt - r.durationMs) > 60_000) {
        log.info(`[stock-prices] ok=${r.ok} nq=${r.noQuote} ${Math.round(r.durationMs / 1000)}s`);
      }
    } catch (err) {
      log.error('[stock-prices] tick hata:', err);
    } finally {
      tickerRunning = false;
    }
  };

  // İlk tick boot'tan 5 sn sonra; sonra her 30 sn.
  setTimeout(tick, 5_000);
  setInterval(tick, 30_000);
  log.info('[stock-prices] ticker 30sn interval ile başladı (market hours aware)');
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runStockPricesIngest()
    .then((s) => {
      console.log('[stock-prices] OK', s);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[stock-prices] HATA', err);
      process.exit(1);
    });
}
