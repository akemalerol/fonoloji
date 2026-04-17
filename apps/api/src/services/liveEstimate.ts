/**
 * Live fund NAV estimator.
 *
 * Uses fund_holdings (KAP data) + live BIST stock prices (Yahoo Finance)
 * to estimate intraday fund price change.
 *
 * Accuracy: ~80-95% for equity-heavy funds. Less accurate for:
 * - Funds with large cash/bond positions (bond prices not tracked intraday)
 * - Funds whose holdings are stale (>45 days old)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Database } from 'better-sqlite3';

const execFileAsync = promisify(execFile);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

interface Holding {
  asset_name: string;
  asset_code: string | null;
  asset_type: string;
  weight: number;
}

interface StockQuote {
  symbol: string;
  price: number;
  change_pct: number;
  prev_close: number;
}

interface EstimateResult {
  code: string;
  estimated_change_pct: number;
  confidence: number;
  holdings_date: string;
  stock_coverage_pct: number;
  components: Array<{
    ticker: string;
    weight: number;
    change_pct: number | null;
    contribution: number;
  }>;
  non_stock_pct: number;
  updated_at: number;
}

// In-memory cache — stock quotes valid for 5 minutes
const quoteCache = new Map<string, { quote: StockQuote; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchStockQuotes(tickers: string[]): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  const toFetch: string[] = [];

  for (const t of tickers) {
    const cached = quoteCache.get(t);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      result.set(t, cached.quote);
    } else {
      toFetch.push(t);
    }
  }

  if (toFetch.length === 0) return result;

  // Yahoo Finance v8 — batch up to 20 tickers
  const symbols = toFetch.map(t => `${t}.IS`).join(',');
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbols}?interval=1d&range=2d`;

  // Single ticker — use direct endpoint for each
  for (const ticker of toFetch) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.IS?interval=1d&range=2d`;
      const { stdout } = await execFileAsync(
        'curl', ['-sL', '--max-time', '10', '-A', UA, yahooUrl],
        { maxBuffer: 1_000_000 },
      );
      const data = JSON.parse(stdout) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
          }>;
        };
      };
      const meta = data.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice && meta?.chartPreviousClose) {
        const quote: StockQuote = {
          symbol: ticker,
          price: meta.regularMarketPrice,
          prev_close: meta.chartPreviousClose,
          change_pct: (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose,
        };
        result.set(ticker, quote);
        quoteCache.set(ticker, { quote, ts: Date.now() });
      }
    } catch {
      // Skip failed tickers
    }
  }

  return result;
}

export async function estimateFundNav(
  db: Database,
  fundCode: string,
): Promise<EstimateResult | null> {
  // Try detailed holdings first (KAP data)
  const holdings = db
    .prepare(
      `SELECT asset_name, asset_code, asset_type, weight, report_date
       FROM fund_holdings
       WHERE code = ?
       ORDER BY report_date DESC`,
    )
    .all(fundCode) as Array<Holding & { report_date: string }>;

  if (holdings.length > 0) {
    return estimateFromHoldings(db, fundCode, holdings);
  }

  // No KAP holdings — no estimate (BIST100 proxy is too inaccurate)
  return null;
}

async function estimateFromHoldings(
  db: Database,
  fundCode: string,
  holdings: Array<Holding & { report_date: string }>,
): Promise<EstimateResult> {
  const reportDate = holdings[0]!.report_date;
  const latest = holdings.filter(h => h.report_date === reportDate);

  const stockHoldings = latest.filter(h => h.asset_type === 'stock' && h.asset_code);
  const nonStockWeight = latest
    .filter(h => h.asset_type !== 'stock')
    .reduce((sum, h) => sum + h.weight, 0);

  const stockTickers = [...new Set(stockHoldings.map(h => h.asset_code!))];
  const quotes = await fetchStockQuotes(stockTickers);

  let totalWeightedChange = 0;
  let coveredWeight = 0;
  const components: EstimateResult['components'] = [];

  for (const h of stockHoldings) {
    const quote = quotes.get(h.asset_code!);
    const changePct = quote?.change_pct ?? null;
    const contribution = changePct !== null ? (h.weight / 100) * changePct : 0;

    if (changePct !== null) {
      totalWeightedChange += contribution;
      coveredWeight += h.weight;
    }

    const existing = components.find(c => c.ticker === h.asset_code);
    if (existing) {
      existing.weight += h.weight;
      existing.contribution += contribution;
    } else {
      components.push({
        ticker: h.asset_code!,
        weight: h.weight,
        change_pct: changePct !== null ? Math.round(changePct * 10000) / 100 : null,
        contribution,
      });
    }
  }

  addGoldContribution(db, latest, (c) => { totalWeightedChange += c; });

  // Fund holdings — try BYF (ETF) live price via Yahoo first, fallback to TEFAS metrics
  const fundHoldings = latest.filter(h => h.asset_type === 'fund' && h.asset_code);
  const fundTickers = [...new Set(fundHoldings.map(h => h.asset_code!))];
  const fundQuotes = await fetchStockQuotes(fundTickers);

  for (const h of fundHoldings) {
    const fundCode = h.asset_code!;
    let changePct: number | null = null;

    // 1. Try Yahoo (for BYF/ETFs like TPKGY, GLDTR, GMSTR, ZPX30)
    const yahooQuote = fundQuotes.get(fundCode);
    if (yahooQuote?.change_pct !== undefined && yahooQuote.change_pct !== null) {
      changePct = yahooQuote.change_pct;
    } else {
      // 2. Fallback: TEFAS metrics (for mutual funds like HMV, PRY, PNU, PHE)
      const metric = db
        .prepare('SELECT return_1d FROM metrics WHERE code = ?')
        .get(fundCode) as { return_1d: number | null } | undefined;
      if (metric?.return_1d !== null && metric?.return_1d !== undefined) {
        changePct = metric.return_1d;
      }
    }

    if (changePct !== null) {
      const contribution = (h.weight / 100) * changePct;
      totalWeightedChange += contribution;
      coveredWeight += h.weight;
      components.push({
        ticker: fundCode,
        weight: h.weight,
        change_pct: Math.round(changePct * 10000) / 100,
        contribution,
      });
    }
  }

  // Repo / T.Repo — assume daily yield ~0.15% (approximate TCMB rate / 365)
  const repoHoldings = latest.filter(h => h.asset_type === 'repo');
  const repoWeight = repoHoldings.reduce((s, h) => s + h.weight, 0);
  if (repoWeight > 0) {
    const dailyRepoYield = 0.0015; // ~%0.15/gün
    const contribution = (repoWeight / 100) * dailyRepoYield;
    totalWeightedChange += contribution;
    coveredWeight += repoWeight;
    components.push({
      ticker: 'REPO',
      weight: repoWeight,
      change_pct: 0.15,
      contribution,
    });
  }

  // Vadeli mevduat / cash — also earns daily interest (~0.12%)
  const cashHoldings = latest.filter(h => h.asset_type === 'cash');
  const cashWeight = cashHoldings.reduce((s, h) => s + h.weight, 0);
  if (cashWeight > 0) {
    const dailyCashYield = 0.0012;
    const contribution = (cashWeight / 100) * dailyCashYield;
    totalWeightedChange += contribution;
    coveredWeight += cashWeight;
    components.push({
      ticker: 'MEVDUAT',
      weight: cashWeight,
      change_pct: 0.12,
      contribution,
    });
  }

  // Corporate bonds — small daily accrual (~0.12%)
  const bondHoldings = latest.filter(h => h.asset_type === 'corporate_bond');
  const bondWeight = bondHoldings.reduce((s, h) => s + h.weight, 0);
  if (bondWeight > 0) {
    const dailyBondYield = 0.0012;
    const contribution = (bondWeight / 100) * dailyBondYield;
    totalWeightedChange += contribution;
    coveredWeight += bondWeight;
    components.push({
      ticker: 'TAHVİL',
      weight: bondWeight,
      change_pct: 0.12,
      contribution,
    });
  }

  const totalStockWeight = stockHoldings.reduce((s, h) => s + h.weight, 0);
  const totalCoverableWeight = totalStockWeight + fundHoldings.reduce((s, h) => s + h.weight, 0) + repoWeight + cashWeight + bondWeight;
  const confidence = totalCoverableWeight > 0
    ? Math.min(1, coveredWeight / totalCoverableWeight) * Math.min(1, totalCoverableWeight / 100)
    : 0;

  components.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    code: fundCode,
    estimated_change_pct: Math.round(totalWeightedChange * 10000) / 100,
    confidence: Math.round(confidence * 100) / 100,
    holdings_date: reportDate,
    stock_coverage_pct: Math.round(coveredWeight * 100) / 100,
    components: components.slice(0, 15),
    non_stock_pct: Math.round(nonStockWeight * 100) / 100,
    updated_at: Date.now(),
  };
}

async function estimateFromAllocation(
  db: Database,
  fundCode: string,
): Promise<EstimateResult | null> {
  const alloc = db
    .prepare(
      `SELECT date, stock, government_bond, treasury_bill, corporate_bond, eurobond, gold, cash, other
       FROM portfolio_snapshots WHERE code = ?
       ORDER BY date DESC LIMIT 1`,
    )
    .get(fundCode) as {
    date: string;
    stock: number;
    gold: number;
    eurobond: number;
    [key: string]: number | string;
  } | undefined;

  if (!alloc || (alloc.stock ?? 0) < 50) return null;

  const stockPct = alloc.stock ?? 0;
  const goldPct = alloc.gold ?? 0;
  const eurobondPct = alloc.eurobond ?? 0;

  // Use BIST100 as proxy for stock component
  const bist = db
    .prepare("SELECT value, change_pct FROM live_market WHERE symbol = 'BIST100' LIMIT 1")
    .get() as { value: number; change_pct: number | null } | undefined;

  // Use USDTRY for eurobond proxy
  const usd = db
    .prepare("SELECT value, change_pct FROM live_market WHERE symbol = 'USDTRY' LIMIT 1")
    .get() as { value: number; change_pct: number | null } | undefined;

  let totalChange = 0;
  const components: EstimateResult['components'] = [];

  if (bist?.change_pct !== null && bist?.change_pct !== undefined) {
    const bistChange = bist.change_pct; // already a fraction in DB (e.g. -0.0036 = -0.36%)
    const contribution = (stockPct / 100) * bistChange;
    totalChange += contribution;
    components.push({
      ticker: 'BIST100',
      weight: Math.round(stockPct * 100) / 100,
      change_pct: Math.round(bist.change_pct * 10000) / 100,
      contribution,
    });
  }

  if (goldPct > 0) {
    addGoldContribution(db, [{ asset_type: 'gold', weight: goldPct, asset_name: 'gold', asset_code: null }], (c) => {
      totalChange += c;
      components.push({ ticker: 'ALTIN', weight: goldPct, change_pct: null, contribution: c });
    });
  }

  if (eurobondPct > 0 && usd?.change_pct !== null && usd?.change_pct !== undefined) {
    const usdChange = usd.change_pct;
    const contribution = (eurobondPct / 100) * usdChange;
    totalChange += contribution;
    components.push({
      ticker: 'USDTRY',
      weight: Math.round(eurobondPct * 100) / 100,
      change_pct: Math.round(usd.change_pct * 10000) / 100,
      contribution,
    });
  }

  // Lower confidence for index-proxy estimates
  const confidence = Math.min(0.6, stockPct / 200);

  return {
    code: fundCode,
    estimated_change_pct: Math.round(totalChange * 10000) / 100,
    confidence: Math.round(confidence * 100) / 100,
    holdings_date: alloc.date,
    stock_coverage_pct: Math.round(stockPct * 100) / 100,
    components,
    non_stock_pct: Math.round((100 - stockPct) * 100) / 100,
    updated_at: Date.now(),
  };
}

function addGoldContribution(
  db: Database,
  holdings: Holding[],
  cb: (contribution: number) => void,
): void {
  const goldHoldings = holdings.filter(h => h.asset_type === 'gold');
  if (goldHoldings.length === 0) return;
  const goldRow = db
    .prepare("SELECT change_pct FROM live_market WHERE symbol = 'XAUTRY' OR symbol = 'GOLD' LIMIT 1")
    .get() as { change_pct: number | null } | undefined;
  if (goldRow?.change_pct) {
    const goldWeight = goldHoldings.reduce((s, h) => s + h.weight, 0);
    cb((goldWeight / 100) * (goldRow.change_pct / 100));
  }
}
