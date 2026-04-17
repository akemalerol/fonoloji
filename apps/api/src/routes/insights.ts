import type { FastifyPluginAsync } from 'fastify';
import {
  computeBenchAlpha,
  computeManagerScore,
  computeSeasonality,
  computeStressPeriods,
  detectLeakage,
} from '../analytics/advanced.js';
import { correlation } from '../analytics/correlation.js';
import type { PricePoint } from '../analytics/returns.js';
import { getDb } from '../db/index.js';
import { getMarketDigest, getOrGenerateAiSummary } from '../services/ai.js';

export const insightsRoute: FastifyPluginAsync = async (app) => {
  app.get('/summary/today', async () => {
    const db = getDb();
    const latest = db
      .prepare(`SELECT * FROM daily_summary ORDER BY date DESC LIMIT 1`)
      .get() as any;
    if (!latest) return { date: null };
    return {
      date: latest.date,
      topGainers: JSON.parse(latest.top_gainers ?? '[]'),
      topLosers: JSON.parse(latest.top_losers ?? '[]'),
      totalFunds: latest.total_funds,
      totalAum: latest.total_aum,
      totalInvestors: latest.total_investors,
    };
  });

  app.get('/categories', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT category, period, fund_count, total_aum, avg_return, median_return,
                top_fund_code, top_fund_return
         FROM category_stats WHERE period = '1y'
         ORDER BY avg_return DESC`,
      )
      .all();
    return { items: rows };
  });

  app.get('/categories/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const decoded = decodeURIComponent(name);
    const db = getDb();
    const stats = db
      .prepare(`SELECT * FROM category_stats WHERE category = ?`)
      .all(decoded);
    if (stats.length === 0) return reply.code(404).send({ error: 'Kategori bulunamadı' });

    const funds = db
      .prepare(
        `SELECT f.code, f.name, f.management_company,
                m.current_price, m.return_1m, m.return_3m, m.return_1y, m.return_ytd,
                m.aum, m.investor_count, m.volatility_90, m.sharpe_90
         FROM funds f JOIN metrics m ON m.code = f.code
         WHERE f.category = ?
         ORDER BY m.return_1y DESC NULLS LAST LIMIT 100`,
      )
      .all(decoded);
    return { category: decoded, stats, funds };
  });

  app.get('/insights/movers', async (req) => {
    const { period = '1d', limit = '20' } = req.query as Record<string, string>;
    const col = {
      '1d': 'return_1d',
      '1w': 'return_1w',
      '1m': 'return_1m',
      '3m': 'return_3m',
      '1y': 'return_1y',
      ytd: 'return_ytd',
    }[period] ?? 'return_1d';
    const db = getDb();
    // Filter out closed/delisted funds:
    // - prices collapsed to near-zero (artificial -100%)
    // - extreme returns (< -95% is almost certainly a closed fund artifact)
    // - AUM 0 and investor_count 0 (no active holdings)
    const SANITY_CLAUSE = `m.${col} IS NOT NULL
         AND m.current_price > 0.001
         AND m.${col} > -0.95
         AND m.${col} < 5.0
         AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
         AND f.trading_status LIKE '%TEFAS%işlem görüyor%'`;
    const gainers = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as change, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE ${SANITY_CLAUSE} ORDER BY m.${col} DESC LIMIT ?`,
      )
      .all(Number(limit));
    const losers = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as change, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE ${SANITY_CLAUSE} ORDER BY m.${col} ASC LIMIT ?`,
      )
      .all(Number(limit));
    return { period, gainers, losers };
  });

  app.get('/insights/flow', async (req) => {
    const { period = '1m', limit = '20' } = req.query as Record<string, string>;
    const col = { '1w': 'flow_1w', '1m': 'flow_1m', '3m': 'flow_3m' }[period] ?? 'flow_1m';
    const db = getDb();
    const inflow = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as flow, m.aum, m.investor_count
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.${col} IS NOT NULL ORDER BY m.${col} DESC LIMIT ?`,
      )
      .all(Number(limit));
    const outflow = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as flow, m.aum, m.investor_count
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.${col} IS NOT NULL ORDER BY m.${col} ASC LIMIT ?`,
      )
      .all(Number(limit));
    return { period, inflow, outflow };
  });

  app.get('/insights/risk-distribution', async () => {
    const db = getDb();
    const distribution = db
      .prepare(
        `SELECT f.risk_score as score, COUNT(*) as fund_count,
                AVG(m.return_1y) as avg_return_1y,
                AVG(m.volatility_90) as avg_volatility,
                SUM(m.aum) as total_aum
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.risk_score IS NOT NULL
         GROUP BY f.risk_score ORDER BY f.risk_score`,
      )
      .all();
    const all = db
      .prepare(
        `SELECT f.risk_score, f.code, f.name, f.category, m.return_1y, m.aum
         FROM funds f JOIN metrics m ON m.code = f.code
         WHERE f.risk_score IS NOT NULL AND m.return_1y IS NOT NULL
         ORDER BY f.risk_score, m.return_1y DESC`,
      )
      .all() as Array<{ risk_score: number; code: string; name: string; category: string; return_1y: number; aum: number }>;
    const topByScore: Record<number, typeof all> = {};
    for (const row of all) {
      if (!topByScore[row.risk_score]) topByScore[row.risk_score] = [];
      if (topByScore[row.risk_score]!.length < 5) topByScore[row.risk_score]!.push(row);
    }
    return { distribution, topByScore };
  });

  app.get('/insights/risk-return', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.return_1y, m.volatility_90, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.return_1y IS NOT NULL AND m.volatility_90 IS NOT NULL
           AND m.current_price > 0.001 AND m.return_1y > -0.95 AND m.return_1y < 5.0
           AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)`,
      )
      .all();
    return { items: rows };
  });

  app.get('/insights/heatmap/:code', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = db
      .prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`)
      .all(code) as Array<{ date: string; price: number }>;
    const returns: Array<{ date: string; return: number }> = [];
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.price;
      const curr = rows[i]!.price;
      if (prev > 0) returns.push({ date: rows[i]!.date, return: (curr - prev) / prev });
    }
    return { code, cells: returns };
  });

  app.get('/insights/correlation', async (req, reply) => {
    const { codes } = req.query as { codes?: string };
    if (!codes) return reply.code(400).send({ error: 'codes parametresi gerekli' });
    const list = codes.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (list.length < 2 || list.length > 20)
      return reply.code(400).send({ error: '2-20 fon kodu gerekli' });

    const db = getDb();
    const seriesMap = new Map<string, PricePoint[]>();
    for (const code of list) {
      const rows = db
        .prepare(
          `SELECT date, price FROM prices
           WHERE code = ? AND date >= date('now', '-365 day')
           ORDER BY date ASC`,
        )
        .all(code) as PricePoint[];
      seriesMap.set(code, rows);
    }

    const matrix: Array<{ a: string; b: string; r: number | null }> = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const r = i === j ? 1 : correlation(seriesMap.get(a) ?? [], seriesMap.get(b) ?? []);
        matrix.push({ a, b, r });
      }
    }
    return { codes: list, matrix };
  });

  app.get('/insights/trend', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.category,
                m.current_price, m.ma_30, m.ma_90, m.ma_200,
                m.return_1m, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.current_price IS NOT NULL AND m.ma_30 IS NOT NULL AND m.ma_200 IS NOT NULL`,
      )
      .all() as Array<{
        code: string;
        name: string;
        category: string;
        current_price: number;
        ma_30: number;
        ma_90: number;
        ma_200: number;
        return_1m: number | null;
        aum: number;
      }>;
    const rising = rows
      .filter((r) => r.current_price > r.ma_30 && r.ma_30 > r.ma_200)
      .sort((a, b) => (b.return_1m ?? 0) - (a.return_1m ?? 0))
      .slice(0, 20);
    const falling = rows
      .filter((r) => r.current_price < r.ma_30 && r.ma_30 < r.ma_200)
      .sort((a, b) => (a.return_1m ?? 0) - (b.return_1m ?? 0))
      .slice(0, 20);
    return { rising, falling };
  });

  app.get('/management-companies', async () => {
    const db = getDb();
    const items = db
      .prepare(
        `SELECT f.management_company as name, COUNT(*) as fund_count,
                SUM(m.aum) as total_aum,
                SUM(m.investor_count) as total_investors,
                AVG(m.return_1y) as avg_return_1y,
                AVG(m.sharpe_90) as avg_sharpe
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.management_company IS NOT NULL
         GROUP BY f.management_company
         HAVING fund_count >= 2
         ORDER BY total_aum DESC NULLS LAST`,
      )
      .all();
    return { items };
  });

  app.get('/management-companies/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const decoded = decodeURIComponent(name);
    const db = getDb();
    const stats = db
      .prepare(
        `SELECT f.management_company as name, COUNT(*) as fund_count,
                SUM(m.aum) as total_aum,
                SUM(m.investor_count) as total_investors,
                AVG(m.return_1y) as avg_return_1y,
                AVG(m.return_1m) as avg_return_1m,
                AVG(m.return_3m) as avg_return_3m,
                AVG(m.sharpe_90) as avg_sharpe,
                AVG(m.volatility_90) as avg_volatility
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.management_company = ?`,
      )
      .get(decoded);
    if (!stats || (stats as { fund_count: number }).fund_count === 0) {
      return reply.code(404).send({ error: 'Yönetim şirketi bulunamadı' });
    }

    const funds = db
      .prepare(
        `SELECT f.code, f.name, f.category, f.risk_score,
                m.current_price, m.return_1m, m.return_3m, m.return_1y, m.return_ytd,
                m.aum, m.investor_count, m.volatility_90, m.sharpe_90
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.management_company = ?
         ORDER BY m.aum DESC NULLS LAST LIMIT 200`,
      )
      .all(decoded);

    const categoryBreakdown = db
      .prepare(
        `SELECT f.category, COUNT(*) as count, SUM(m.aum) as aum
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.management_company = ? AND f.category IS NOT NULL
         GROUP BY f.category ORDER BY aum DESC`,
      )
      .all(decoded);

    return { name: decoded, stats, funds, categoryBreakdown };
  });

  // Portfolio recommender — pick 5 funds with low correlation + decent returns
  app.get('/insights/portfolio-recommendation', async (req) => {
    const { risk = 'balanced' } = req.query as { risk?: string };
    const db = getDb();

    // Risk profiles: which categories to favour
    const profile: Record<string, string[]> = {
      conservative: ['Para Piyasası Şemsiye Fonu', 'Borçlanma Araçları Şemsiye Fonu', 'Katılım Şemsiye Fonu'],
      balanced: ['Hisse Senedi Şemsiye Fonu', 'Borçlanma Araçları Şemsiye Fonu', 'Kıymetli Madenler Şemsiye Fonu', 'Eurobond', 'Para Piyasası Şemsiye Fonu'],
      aggressive: ['Hisse Senedi Şemsiye Fonu', 'Hisse Senedi Yoğun', 'Kıymetli Madenler Şemsiye Fonu', 'Değişken Şemsiye Fonu'],
    };
    const cats = profile[risk] ?? profile.balanced!;

    // Pick top 1 from each category by sharpe + aum
    const picks: Array<{ code: string; name: string; category: string; weight: number; sharpe: number; return_1y: number; aum: number }> = [];
    let totalWeight = 0;
    for (const cat of cats) {
      const top = db
        .prepare(
          `SELECT f.code, f.name, f.category, m.sharpe_90 as sharpe, m.return_1y, m.aum
           FROM funds f JOIN metrics m ON m.code = f.code
           WHERE f.category = ? AND m.sharpe_90 IS NOT NULL AND m.return_1y > 0 AND m.aum > 100000000
           ORDER BY m.sharpe_90 DESC LIMIT 1`,
        )
        .get(cat) as { code: string; name: string; category: string; sharpe: number; return_1y: number; aum: number } | undefined;
      if (top) {
        const weight = top.sharpe + 1; // weighting heuristic
        picks.push({ ...top, weight });
        totalWeight += weight;
      }
    }
    // Normalize weights to %
    const allocations = picks.map((p) => ({
      ...p,
      weight: Math.round((p.weight / totalWeight) * 100),
    }));
    const portfolioReturn1y = allocations.reduce((s, a) => s + (a.return_1y * a.weight) / 100, 0);

    return {
      risk,
      categories: cats,
      allocations,
      summary: {
        portfolioCount: allocations.length,
        weightedReturn1y: portfolioReturn1y,
        avgSharpe: allocations.reduce((s, a) => s + a.sharpe, 0) / Math.max(1, allocations.length),
      },
    };
  });

  // Fund detail advanced analytics
  app.get('/funds/:code/advanced', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const fund = db
      .prepare(`SELECT f.category FROM funds f WHERE f.code = ?`)
      .get(code) as { category: string | null } | undefined;
    if (!fund) return reply.code(404).send({ error: 'Fon bulunamadı' });

    const prices = db
      .prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`)
      .all(code) as Array<{ date: string; price: number }>;

    const portfolio = db
      .prepare(`SELECT * FROM portfolio_snapshots WHERE code = ? ORDER BY date DESC LIMIT 1`)
      .get(code) as Record<string, number> | undefined;

    const stressPeriods = computeStressPeriods(prices);
    const seasonality = computeSeasonality(prices);
    const leakage = fund.category ? detectLeakage(fund.category, portfolio ?? null) : null;
    const benchAlpha1y = fund.category ? computeBenchAlpha(db, code, fund.category, '1y') : null;
    const benchAlpha3m = fund.category ? computeBenchAlpha(db, code, fund.category, '3m') : null;

    return {
      code,
      stress_periods: stressPeriods,
      seasonality,
      leakage,
      bench_alpha: { '3m': benchAlpha3m, '1y': benchAlpha1y },
    };
  });

  // AI summary for a fund
  app.get('/funds/:code/ai-summary', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const snapshot = db
      .prepare(
        `SELECT f.code, f.name, f.category, f.management_company, f.risk_score,
                m.current_price, m.return_1m, m.return_1y, m.sharpe_90, m.volatility_90,
                m.real_return_1y, m.max_drawdown_1y, m.aum
         FROM funds f LEFT JOIN metrics m ON m.code = f.code WHERE f.code = ?`,
      )
      .get(code) as Record<string, unknown> | undefined;
    if (!snapshot) return reply.code(404).send({ error: 'Fon bulunamadı' });

    const portfolioRow = db
      .prepare(`SELECT * FROM portfolio_snapshots WHERE code = ? ORDER BY date DESC LIMIT 1`)
      .get(code) as Record<string, number> | undefined;

    const result = await getOrGenerateAiSummary(db, {
      code: String(snapshot.code),
      name: String(snapshot.name ?? ''),
      category: (snapshot.category as string) ?? null,
      management_company: (snapshot.management_company as string) ?? null,
      current_price: (snapshot.current_price as number) ?? null,
      return_1m: (snapshot.return_1m as number) ?? null,
      return_1y: (snapshot.return_1y as number) ?? null,
      sharpe_90: (snapshot.sharpe_90 as number) ?? null,
      volatility_90: (snapshot.volatility_90 as number) ?? null,
      real_return_1y: (snapshot.real_return_1y as number) ?? null,
      max_drawdown_1y: (snapshot.max_drawdown_1y as number) ?? null,
      aum: (snapshot.aum as number) ?? null,
      risk_score: (snapshot.risk_score as number) ?? null,
      portfolio: portfolioRow
        ? {
            stock: portfolioRow.stock ?? 0,
            government_bond: portfolioRow.government_bond ?? 0,
            treasury_bill: portfolioRow.treasury_bill ?? 0,
            corporate_bond: portfolioRow.corporate_bond ?? 0,
            eurobond: portfolioRow.eurobond ?? 0,
            gold: portfolioRow.gold ?? 0,
            cash: portfolioRow.cash ?? 0,
            other: portfolioRow.other ?? 0,
          }
        : null,
    });

    return {
      code,
      summary: result.summary,
      cached: result.cached,
      model: result.model,
    };
  });

  // Manager behavior score
  app.get('/management-companies/:name/score', async (req) => {
    const { name } = req.params as { name: string };
    const decoded = decodeURIComponent(name);
    const score = computeManagerScore(getDb(), decoded);
    return score ?? { score: null };
  });

  // Live market tickers (FX + gold + BIST)
  app.get('/market/live', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT symbol, name, value, change_pct, previous, source, fetched_at
         FROM live_market ORDER BY
           CASE symbol
             WHEN 'BIST100' THEN 1
             WHEN 'USDTRY' THEN 2
             WHEN 'EURTRY' THEN 3
             WHEN 'GBPTRY' THEN 4
             WHEN 'GOLDTRY_GR' THEN 5
             WHEN 'GOLDUSD_OZ' THEN 6
             WHEN 'SILVERTRY_GR' THEN 7
             WHEN 'SILVERUSD_OZ' THEN 8
             WHEN 'NDX' THEN 10
             WHEN 'SPX' THEN 11
             WHEN 'DJI' THEN 12
             WHEN 'FTSE' THEN 13
             WHEN 'DAX' THEN 14
             WHEN 'CAC' THEN 15
             WHEN 'N225' THEN 16
             WHEN 'HSI' THEN 17
             WHEN 'KOSPI' THEN 18
             WHEN 'NIFTY' THEN 19
             WHEN 'BTCUSD' THEN 30
             WHEN 'ETHUSD' THEN 31
             WHEN 'BNBUSD' THEN 32
             WHEN 'SOLUSD' THEN 33
             WHEN 'XRPUSD' THEN 34
             WHEN 'DOGEUSD' THEN 35
             WHEN 'ADAUSD' THEN 36
             WHEN 'TRXUSD' THEN 37
             WHEN 'AVAXUSD' THEN 38
             WHEN 'LINKUSD' THEN 39
             ELSE 99
           END`,
      )
      .all();
    return { items: rows, updated_at: rows.length > 0 ? (rows[0] as { fetched_at: number }).fetched_at : null };
  });

  // Market digest — AI commentary for day/week
  app.get('/market/digest', async (req) => {
    const { period = 'day' } = req.query as { period?: 'day' | 'week' };
    const db = getDb();
    const col = period === 'week' ? 'return_1w' : 'return_1d';
    const SANITY = `m.${col} IS NOT NULL
      AND m.current_price > 0.001 AND m.${col} > -0.95 AND m.${col} < 5.0
      AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
      AND f.trading_status LIKE '%TEFAS%işlem görüyor%'`;

    const gainers = db
      .prepare(
        `SELECT f.code, f.name, m.${col} as change FROM metrics m JOIN funds f ON f.code = m.code
         WHERE ${SANITY} ORDER BY m.${col} DESC LIMIT 10`,
      )
      .all() as Array<{ code: string; name: string; change: number }>;
    const losers = db
      .prepare(
        `SELECT f.code, f.name, m.${col} as change FROM metrics m JOIN funds f ON f.code = m.code
         WHERE ${SANITY} ORDER BY m.${col} ASC LIMIT 10`,
      )
      .all() as Array<{ code: string; name: string; change: number }>;

    const cats = db
      .prepare(`SELECT category, avg_return FROM category_stats WHERE period = '1w' ORDER BY avg_return DESC LIMIT 10`)
      .all() as Array<{ category: string; avg_return: number }>;

    const totals = db
      .prepare(`SELECT COUNT(*) as c, SUM(aum) as total_aum FROM metrics WHERE current_price > 0.001`)
      .get() as { c: number; total_aum: number | null };

    const cpi = db
      .prepare(`SELECT yoy_change FROM cpi_tr ORDER BY date DESC LIMIT 1`)
      .get() as { yoy_change: number } | undefined;

    const digest = await getMarketDigest(db, {
      period: period === 'week' ? 'week' : 'day',
      topGainers: gainers,
      topLosers: losers,
      categoryAvg: cats,
      totalFunds: totals.c,
      totalAum: totals.total_aum ?? 0,
      cpiYoy: cpi?.yoy_change ?? null,
    });

    return {
      period,
      summary: digest.summary,
      cached: digest.cached,
      topGainers: gainers.slice(0, 5),
      topLosers: losers.slice(0, 5),
    };
  });

  // TÜFE endpoint — last reading + next announcement
  app.get('/economy/cpi', async () => {
    const db = getDb();
    const latest = db
      .prepare(
        `SELECT date, yoy_change, mom_change, index_value, source
         FROM cpi_tr ORDER BY date DESC LIMIT 1`,
      )
      .get() as { date: string; yoy_change: number; mom_change: number | null; index_value: number | null; source: string } | undefined;

    const history = db
      .prepare(
        `SELECT date, yoy_change, mom_change FROM cpi_tr
         WHERE yoy_change IS NOT NULL
         ORDER BY date DESC LIMIT 120`,
      )
      .all() as Array<{ date: string; yoy_change: number; mom_change: number | null }>;

    const today = new Date().toISOString().slice(0, 10);
    const nextAnnounce = db
      .prepare(
        `SELECT period, scheduled_date, scheduled_time FROM cpi_announcements
         WHERE published = 0 AND scheduled_date >= ?
         ORDER BY scheduled_date ASC LIMIT 1`,
      )
      .get(today) as { period: string; scheduled_date: string; scheduled_time: string } | undefined;

    return {
      latest: latest ?? null,
      history: history.reverse(),
      next: nextAnnounce ?? null,
    };
  });
};
