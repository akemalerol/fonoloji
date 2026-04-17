import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb } from '../db/index.js';

const execFileAsync = promisify(execFile);

/**
 * Near-real-time market headline tickers.
 * - Yahoo Finance v8 chart API for everything (BIST100, FX, gold) — live intraday
 *   with proper `chartPreviousClose` so daily % is accurate all session long.
 * - TCMB today.xml as fallback only (once-daily government rates).
 */

// Yahoo rate-limits aggressive UAs — keep headers minimal.
const UA_YAHOO = 'Mozilla/5.0';
const UA_TCMB =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchText(url: string, ua: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-sL', '--max-time', '15', '-A', ua, url],
      { maxBuffer: 20_000_000 },
    );
    if (!stdout || stdout.startsWith('Too Many Requests')) return null;
    return stdout;
  } catch {
    return null;
  }
}

interface YahooMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
}

async function fetchYahooQuote(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  const json = await fetchText(url, UA_YAHOO);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { chart?: { result?: Array<{ meta?: YahooMeta }> } };
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    if (!price || !prev) return null;
    return { price, prevClose: prev };
  } catch {
    return null;
  }
}

function parseTcmbXml(xml: string): Record<string, { name: string; buying: number; selling: number }> {
  const out: Record<string, { name: string; buying: number; selling: number }> = {};
  const currencyRe = /<Currency[^>]*CurrencyCode="([A-Z]+)"[^>]*>([\s\S]*?)<\/Currency>/g;
  let m: RegExpExecArray | null;
  while ((m = currencyRe.exec(xml)) !== null) {
    const code = m[1]!;
    const body = m[2]!;
    const name = /<CurrencyName>([^<]+)<\/CurrencyName>/.exec(body)?.[1]?.trim() ?? code;
    const buying = Number(/<ForexBuying>([0-9.]+)<\/ForexBuying>/.exec(body)?.[1] ?? 'NaN');
    const selling = Number(/<ForexSelling>([0-9.]+)<\/ForexSelling>/.exec(body)?.[1] ?? 'NaN');
    if (Number.isFinite(selling) && Number.isFinite(buying)) {
      out[code] = { name, buying, selling };
    }
  }
  return out;
}

let tcmbCache: { rates: Record<string, { name: string; buying: number; selling: number }>; fetchedAt: number } | null = null;
const TCMB_TTL_MS = 6 * 3600_000;

async function getTcmbRates(): Promise<Record<string, { name: string; buying: number; selling: number }>> {
  const now = Date.now();
  if (tcmbCache && now - tcmbCache.fetchedAt < TCMB_TTL_MS) return tcmbCache.rates;
  const xml = await fetchText('https://www.tcmb.gov.tr/kurlar/today.xml', UA_TCMB);
  if (!xml) return tcmbCache?.rates ?? {};
  const rates = parseTcmbXml(xml);
  tcmbCache = { rates, fetchedAt: now };
  return rates;
}

interface Ticker {
  symbol: string;
  name: string;
  value: number;
  previous: number;
  source: string;
}

/**
 * Check whether "now" falls inside a stock exchange session, with a few
 * minutes of lead/lag so delayed feeds still update right at the edges.
 * DST-safe (uses Intl with the exchange's local TZ).
 */
function isMarketOpen(
  tz: string,
  openH: number,
  openM: number,
  closeH: number,
  closeM: number,
  openLeadMin = 5,
  closeLagMin = 20,
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[wd] ?? 1;
  if (day === 0 || day === 6) return false; // weekend closed
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = hour * 60 + minute;
  const openMin = openH * 60 + openM - openLeadMin;
  const closeMin = closeH * 60 + closeM + closeLagMin;
  return nowMin >= openMin && nowMin <= closeMin;
}

export async function runLiveMarketIngest(): Promise<{ updated: number }> {
  const db = getDb();
  const tickers: Ticker[] = [];

  // Per-asset market windows. Skipping a fetch just means DB keeps last known
  // value — Yahoo free tier is delayed ~15min anyway, +20min lag captures the
  // final tick after close.
  const wantBist = isMarketOpen('Europe/Istanbul', 9, 55, 18, 10);
  const wantNdx = isMarketOpen('America/New_York', 9, 30, 16, 0); // NASDAQ + NYSE share hours
  const wantFtse = isMarketOpen('Europe/London', 8, 0, 16, 30);
  const wantDax = isMarketOpen('Europe/Berlin', 9, 0, 17, 30);
  // FX + metals: essentially 24h Mon-Fri, skip true weekend only.
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date());
  const isFxWeekend = wd === 'Sat' || wd === 'Sun';
  const wantFx = !isFxWeekend;
  // Crypto trades 24/7 — always fetch.
  const wantCrypto = true;

  const maybe = <T,>(cond: boolean, fn: () => Promise<T | null>): Promise<T | null> =>
    cond ? fn() : Promise.resolve(null);

  const [bist, usd, eur, gbp, gold, silver, btc, eth, ndx, spx, ftse, dax] = await Promise.all([
    maybe(wantBist, () => fetchYahooQuote('XU100.IS')),
    maybe(wantFx, () => fetchYahooQuote('USDTRY=X')),
    maybe(wantFx, () => fetchYahooQuote('EURTRY=X')),
    maybe(wantFx, () => fetchYahooQuote('GBPTRY=X')),
    maybe(wantFx, () => fetchYahooQuote('GC=F')),
    maybe(wantFx, () => fetchYahooQuote('SI=F')),
    maybe(wantCrypto, () => fetchYahooQuote('BTC-USD')),
    maybe(wantCrypto, () => fetchYahooQuote('ETH-USD')),
    maybe(wantNdx, () => fetchYahooQuote('^NDX')),
    maybe(wantNdx, () => fetchYahooQuote('^GSPC')),
    maybe(wantFtse, () => fetchYahooQuote('^FTSE')),
    maybe(wantDax, () => fetchYahooQuote('^GDAXI')),
  ]);

  if (bist) tickers.push({ symbol: 'BIST100', name: 'BIST 100', value: bist.price, previous: bist.prevClose, source: 'yahoo' });
  if (usd) tickers.push({ symbol: 'USDTRY', name: 'Dolar / TL', value: usd.price, previous: usd.prevClose, source: 'yahoo' });
  if (eur) tickers.push({ symbol: 'EURTRY', name: 'Euro / TL', value: eur.price, previous: eur.prevClose, source: 'yahoo' });
  if (gbp) tickers.push({ symbol: 'GBPTRY', name: 'Sterlin / TL', value: gbp.price, previous: gbp.prevClose, source: 'yahoo' });

  const OZ_PER_GRAM = 31.1034768;

  // Gold: ons ($) + gram (TL)
  if (gold) {
    tickers.push({ symbol: 'GOLDUSD_OZ', name: 'Ons Altın', value: gold.price, previous: gold.prevClose, source: 'yahoo' });
  }
  if (gold && usd) {
    tickers.push({
      symbol: 'GOLDTRY_GR',
      name: 'Gram Altın',
      value: (gold.price / OZ_PER_GRAM) * usd.price,
      previous: (gold.prevClose / OZ_PER_GRAM) * usd.prevClose,
      source: 'yahoo',
    });
  }

  // Silver: ons ($) + gram (TL)
  if (silver) {
    tickers.push({ symbol: 'SILVERUSD_OZ', name: 'Ons Gümüş', value: silver.price, previous: silver.prevClose, source: 'yahoo' });
  }
  if (silver && usd) {
    tickers.push({
      symbol: 'SILVERTRY_GR',
      name: 'Gram Gümüş',
      value: (silver.price / OZ_PER_GRAM) * usd.price,
      previous: (silver.prevClose / OZ_PER_GRAM) * usd.prevClose,
      source: 'yahoo',
    });
  }

  // Global stock indices
  if (ndx) tickers.push({ symbol: 'NDX', name: 'Nasdaq 100', value: ndx.price, previous: ndx.prevClose, source: 'yahoo' });
  if (spx) tickers.push({ symbol: 'SPX', name: 'S&P 500', value: spx.price, previous: spx.prevClose, source: 'yahoo' });
  if (ftse) tickers.push({ symbol: 'FTSE', name: 'FTSE 100', value: ftse.price, previous: ftse.prevClose, source: 'yahoo' });
  if (dax) tickers.push({ symbol: 'DAX', name: 'DAX', value: dax.price, previous: dax.prevClose, source: 'yahoo' });

  // Crypto — 24/7
  if (btc) tickers.push({ symbol: 'BTCUSD', name: 'Bitcoin', value: btc.price, previous: btc.prevClose, source: 'yahoo' });
  if (eth) tickers.push({ symbol: 'ETHUSD', name: 'Ethereum', value: eth.price, previous: eth.prevClose, source: 'yahoo' });

  // TCMB fallback only for FX pairs Yahoo missed (rare)
  const needsFallback = ['USDTRY', 'EURTRY', 'GBPTRY'].filter((s) => !tickers.find((t) => t.symbol === s));
  if (needsFallback.length > 0) {
    const rates = await getTcmbRates();
    const map: Record<string, [string, string]> = {
      USDTRY: ['USD', 'Dolar / TL'],
      EURTRY: ['EUR', 'Euro / TL'],
      GBPTRY: ['GBP', 'Sterlin / TL'],
    };
    for (const sym of needsFallback) {
      const [code, label] = map[sym]!;
      const r = rates[code];
      if (r) tickers.push({ symbol: sym, name: label, value: r.selling, previous: r.selling, source: 'tcmb' });
    }
  }

  if (tickers.length === 0) return { updated: 0 };

  const now = Date.now();
  // Store previous = daily previous close (stable through the session).
  // change_pct computed from it — stays correct as price ticks.
  const stmt = db.prepare(
    `INSERT INTO live_market (symbol, name, value, change_pct, previous, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET
       name = excluded.name,
       value = excluded.value,
       previous = excluded.previous,
       change_pct = CASE
         WHEN excluded.previous > 0
         THEN (excluded.value - excluded.previous) / excluded.previous
         ELSE NULL
       END,
       source = excluded.source,
       fetched_at = excluded.fetched_at`,
  );

  const txn = db.transaction(() => {
    for (const t of tickers) {
      const change = t.previous > 0 ? (t.value - t.previous) / t.previous : null;
      stmt.run(t.symbol, t.name, t.value, change, t.previous, t.source, now);
    }
  });
  txn();

  return { updated: tickers.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveMarketIngest()
    .then((r) => {
      console.log(`[live-market] ${r.updated} ticker güncellendi`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[live-market] hata:', err);
      process.exit(1);
    });
}
