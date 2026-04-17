import type { Database } from 'better-sqlite3';
import { computeFlow } from './flow.js';
import {
  dailyReturns,
  ensureSorted,
  returnAll,
  returnOverDays,
  returnYtd,
  type PricePoint,
} from './returns.js';
import {
  annualizedVolatility,
  beta,
  calmar,
  maxDrawdown,
  movingAverage,
  sharpe,
  sortino,
} from './risk.js';

// Default benchmark — IPB (İş Portföy BIST 30 Endeks Fonu) tracks BIST 30 closely.
// Override via env in production (FONOLOJI_BENCHMARK_CODE).
const BENCHMARK_CODE = process.env.FONOLOJI_BENCHMARK_CODE ?? 'IPB';

let benchmarkCache: PricePoint[] | null = null;
let benchmarkCacheKey = '';

function loadBenchmark(db: Database): PricePoint[] {
  const today = new Date().toISOString().slice(0, 10);
  if (benchmarkCache && benchmarkCacheKey === today) return benchmarkCache;
  const rows = db
    .prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`)
    .all(BENCHMARK_CODE) as PricePoint[];
  benchmarkCache = rows;
  benchmarkCacheKey = today;
  return rows;
}

// TÜFE latest yoy_change from cpi_tr table; falls back to env var if DB empty.
let cpiCache: { value: number; day: string } | null = null;

function latestCpiYoy(db: Database): number {
  const today = new Date().toISOString().slice(0, 10);
  if (cpiCache && cpiCache.day === today) return cpiCache.value;
  const row = db
    .prepare(`SELECT yoy_change FROM cpi_tr WHERE yoy_change IS NOT NULL ORDER BY date DESC LIMIT 1`)
    .get() as { yoy_change: number | null } | undefined;
  const fallback = Number(process.env.FONOLOJI_CPI_YOY ?? '0.38');
  const value = row?.yoy_change ?? fallback;
  cpiCache = { value, day: today };
  return value;
}

export function invalidateCpiCache(): void {
  cpiCache = null;
}

export function recomputeMetricsForFund(db: Database, code: string): boolean {
  const rows = db
    .prepare(`SELECT date, price, total_value, investor_count FROM prices WHERE code = ? ORDER BY date ASC`)
    .all(code) as Array<{ date: string; price: number; total_value: number; investor_count: number }>;

  if (rows.length === 0) return false;

  const points: PricePoint[] = rows.map((r) => ({ date: r.date, price: r.price }));
  const sorted = ensureSorted(points);
  const latest = sorted[sorted.length - 1]!;

  const flow = computeFlow(db, code);
  const last1y = sorted.slice(-365);

  const benchmark = code === BENCHMARK_CODE ? null : loadBenchmark(db);
  const betaValue = benchmark && benchmark.length > 30 ? beta(sorted, benchmark, 365) : null;

  // Real return = nominal/CPI - 1 — uses live TÜFE from cpi_tr table
  const nominalReturn1y = returnOverDays(sorted, 365);
  const cpiYoy = latestCpiYoy(db);
  const realReturn1y =
    nominalReturn1y !== null
      ? Math.round(((1 + nominalReturn1y) / (1 + cpiYoy) - 1) * 1_000_000) / 1_000_000
      : null;

  const metrics = {
    code,
    updated_at: Date.now(),
    current_price: latest.price,
    current_date: latest.date,
    return_1d: returnOverDays(sorted, 1),
    return_1w: returnOverDays(sorted, 7),
    return_1m: returnOverDays(sorted, 30),
    return_3m: returnOverDays(sorted, 90),
    return_6m: returnOverDays(sorted, 180),
    return_1y: nominalReturn1y,
    return_ytd: returnYtd(sorted),
    return_all: returnAll(sorted),
    volatility_30: annualizedVolatility(sorted, 30),
    volatility_90: annualizedVolatility(sorted, 90),
    sharpe_90: sharpe(sorted, 90),
    sortino_90: sortino(sorted, 90),
    calmar_1y: calmar(sorted, 365),
    beta_1y: betaValue,
    real_return_1y: realReturn1y,
    max_drawdown_1y: maxDrawdown(last1y),
    ma_30: movingAverage(sorted, 30),
    ma_90: movingAverage(sorted, 90),
    ma_200: movingAverage(sorted, 200),
    aum: flow.aum,
    investor_count: flow.investor_count,
    flow_1w: flow.flow_1w,
    flow_1m: flow.flow_1m,
    flow_3m: flow.flow_3m,
  };

  db.prepare(
    `INSERT INTO metrics (
      code, updated_at, current_price, current_date,
      return_1d, return_1w, return_1m, return_3m, return_6m, return_1y, return_ytd, return_all,
      volatility_30, volatility_90, sharpe_90, sortino_90, calmar_1y, beta_1y, real_return_1y,
      max_drawdown_1y, ma_30, ma_90, ma_200,
      aum, investor_count, flow_1w, flow_1m, flow_3m
    ) VALUES (
      @code, @updated_at, @current_price, @current_date,
      @return_1d, @return_1w, @return_1m, @return_3m, @return_6m, @return_1y, @return_ytd, @return_all,
      @volatility_30, @volatility_90, @sharpe_90, @sortino_90, @calmar_1y, @beta_1y, @real_return_1y,
      @max_drawdown_1y, @ma_30, @ma_90, @ma_200,
      @aum, @investor_count, @flow_1w, @flow_1m, @flow_3m
    )
    ON CONFLICT(code) DO UPDATE SET
      updated_at = excluded.updated_at,
      current_price = excluded.current_price,
      current_date = excluded.current_date,
      return_1d = excluded.return_1d,
      return_1w = excluded.return_1w,
      return_1m = excluded.return_1m,
      return_3m = excluded.return_3m,
      return_6m = excluded.return_6m,
      return_1y = excluded.return_1y,
      return_ytd = excluded.return_ytd,
      return_all = excluded.return_all,
      volatility_30 = excluded.volatility_30,
      volatility_90 = excluded.volatility_90,
      sharpe_90 = excluded.sharpe_90,
      sortino_90 = excluded.sortino_90,
      calmar_1y = excluded.calmar_1y,
      beta_1y = excluded.beta_1y,
      real_return_1y = excluded.real_return_1y,
      max_drawdown_1y = excluded.max_drawdown_1y,
      ma_30 = excluded.ma_30,
      ma_90 = excluded.ma_90,
      ma_200 = excluded.ma_200,
      aum = excluded.aum,
      investor_count = excluded.investor_count,
      flow_1w = excluded.flow_1w,
      flow_1m = excluded.flow_1m,
      flow_3m = excluded.flow_3m`,
  ).run(metrics);

  return true;
}

export function recomputeAllMetrics(db: Database): { updated: number } {
  invalidateCpiCache();
  const codes = db.prepare(`SELECT code FROM funds ORDER BY code`).all() as { code: string }[];
  let updated = 0;
  const txn = db.transaction(() => {
    for (const { code } of codes) {
      if (recomputeMetricsForFund(db, code)) updated++;
    }
  });
  txn();
  return { updated };
}

export function recomputeDailySummary(db: Database): void {
  const latestDateRow = db
    .prepare(`SELECT MAX(date) as d FROM prices`)
    .get() as { d: string | null };
  if (!latestDateRow.d) return;

  const date = latestDateRow.d;

  // Sanity: exclude closed/delisted funds + only TEFAS-tradable
  const SANITY = `m.return_1d IS NOT NULL
       AND m.current_price > 0.001
       AND m.return_1d > -0.95 AND m.return_1d < 5.0
       AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
       AND f.trading_status LIKE '%TEFAS%işlem görüyor%'`;

  const topGainers = db
    .prepare(
      `SELECT m.code, f.name, m.return_1d
       FROM metrics m JOIN funds f ON f.code = m.code
       WHERE ${SANITY}
       ORDER BY m.return_1d DESC LIMIT 10`,
    )
    .all();

  const topLosers = db
    .prepare(
      `SELECT m.code, f.name, m.return_1d
       FROM metrics m JOIN funds f ON f.code = m.code
       WHERE ${SANITY}
       ORDER BY m.return_1d ASC LIMIT 10`,
    )
    .all();

  const aggregates = db
    .prepare(
      `SELECT COUNT(*) as total_funds,
              SUM(aum) as total_aum,
              SUM(investor_count) as total_investors
       FROM metrics WHERE current_date = ?`,
    )
    .get(date) as { total_funds: number; total_aum: number; total_investors: number };

  db.prepare(
    `INSERT INTO daily_summary (
      date, top_gainers, top_losers, category_stats,
      total_funds, total_aum, total_investors, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      top_gainers = excluded.top_gainers,
      top_losers = excluded.top_losers,
      category_stats = excluded.category_stats,
      total_funds = excluded.total_funds,
      total_aum = excluded.total_aum,
      total_investors = excluded.total_investors,
      updated_at = excluded.updated_at`,
  ).run(
    date,
    JSON.stringify(topGainers),
    JSON.stringify(topLosers),
    JSON.stringify([]),
    aggregates.total_funds,
    aggregates.total_aum,
    aggregates.total_investors,
    Date.now(),
  );
}

export function recomputeCategoryStats(db: Database): void {
  const periods = [
    { name: '1d', col: 'return_1d' },
    { name: '1w', col: 'return_1w' },
    { name: '1m', col: 'return_1m' },
    { name: '3m', col: 'return_3m' },
    { name: '1y', col: 'return_1y' },
    { name: 'ytd', col: 'return_ytd' },
  ];
  const categories = db
    .prepare(`SELECT DISTINCT category FROM funds WHERE category IS NOT NULL AND category != ''`)
    .all() as { category: string }[];

  const insert = db.prepare(
    `INSERT INTO category_stats (category, period, fund_count, total_aum, avg_return, median_return, top_fund_code, top_fund_return, updated_at)
     VALUES (@category, @period, @fund_count, @total_aum, @avg_return, @median_return, @top_fund_code, @top_fund_return, @updated_at)
     ON CONFLICT(category, period) DO UPDATE SET
       fund_count = excluded.fund_count,
       total_aum = excluded.total_aum,
       avg_return = excluded.avg_return,
       median_return = excluded.median_return,
       top_fund_code = excluded.top_fund_code,
       top_fund_return = excluded.top_fund_return,
       updated_at = excluded.updated_at`,
  );

  const now = Date.now();
  const txn = db.transaction(() => {
    for (const { category } of categories) {
      for (const period of periods) {
        const rows = db
          .prepare(
            `SELECT m.code, m.${period.col} as r, m.aum FROM metrics m
             JOIN funds f ON f.code = m.code
             WHERE f.category = ? AND m.${period.col} IS NOT NULL`,
          )
          .all(category) as Array<{ code: string; r: number; aum: number }>;
        if (rows.length === 0) continue;
        const sorted = rows.slice().sort((a, b) => a.r - b.r);
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1]!.r + sorted[sorted.length / 2]!.r) / 2
            : sorted[Math.floor(sorted.length / 2)]!.r;
        const avg = rows.reduce((a, b) => a + b.r, 0) / rows.length;
        const top = rows.reduce((best, cur) => (cur.r > best.r ? cur : best), rows[0]!);
        const aum = rows.reduce((a, b) => a + (b.aum ?? 0), 0);

        insert.run({
          category,
          period: period.name,
          fund_count: rows.length,
          total_aum: aum,
          avg_return: avg,
          median_return: median,
          top_fund_code: top.code,
          top_fund_return: top.r,
          updated_at: now,
        });
      }
    }
  });
  txn();
}
