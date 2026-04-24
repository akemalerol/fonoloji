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

// TEFAS'ta işlem gören fon filtresi — tüm özet/ranking endpoint'lerinde kullanılır.
// İşlem görmeyen fonlar (kapalı/özel satış) para akışı/en iyi liste gibi genel
// özetlerde göstermek yanıltıcı.
const TEFAS_TRADED = `(f.trading_status LIKE '%TEFAS%işlem görüyor%' OR f.trading_status LIKE '%BEFAS%işlem görüyor%')`;

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
         WHERE f.category = ? AND ${TEFAS_TRADED}
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
      .all(Math.min(Math.max(Number(limit) || 20, 1), 100));
    const losers = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as change, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE ${SANITY_CLAUSE} ORDER BY m.${col} ASC LIMIT ?`,
      )
      .all(Math.min(Math.max(Number(limit) || 20, 1), 100));
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
         WHERE m.${col} IS NOT NULL AND ${TEFAS_TRADED}
         ORDER BY m.${col} DESC LIMIT ?`,
      )
      .all(Math.min(Math.max(Number(limit) || 20, 1), 100));
    const outflow = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.${col} as flow, m.aum, m.investor_count
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.${col} IS NOT NULL AND ${TEFAS_TRADED}
         ORDER BY m.${col} ASC LIMIT ?`,
      )
      .all(Math.min(Math.max(Number(limit) || 20, 1), 100));
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

  // Net exposure — kategori × varlık tipi ısı haritası
  // Her kategori için son portföy snapshot'ından ortalama asset breakdown
  app.get('/insights/exposure-heatmap', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `WITH latest AS (
           SELECT code, MAX(date) as d FROM portfolio_snapshots GROUP BY code
         ),
         ps_latest AS (
           SELECT ps.code, ps.stock, ps.government_bond, ps.treasury_bill,
                  ps.corporate_bond, ps.eurobond, ps.gold, ps.cash, ps.other
           FROM portfolio_snapshots ps
           JOIN latest l ON l.code = ps.code AND l.d = ps.date
         )
         SELECT f.category,
                COUNT(*) as fund_count,
                AVG(ps.stock) as stock,
                AVG(ps.government_bond + ps.treasury_bill) as govbond,
                AVG(ps.corporate_bond) as corpbond,
                AVG(ps.eurobond) as eurobond,
                AVG(ps.cash) as cash,
                AVG(ps.gold) as gold,
                AVG(ps.other) as other,
                SUM(m.aum) as total_aum
         FROM funds f
         JOIN ps_latest ps ON ps.code = f.code
         LEFT JOIN metrics m ON m.code = f.code
         WHERE f.category IS NOT NULL
           AND ${TEFAS_TRADED}
         GROUP BY f.category
         HAVING fund_count >= 3
         ORDER BY total_aum DESC NULLS LAST`,
      )
      .all();
    return { items: rows };
  });

  app.get('/insights/risk-return', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.category, m.return_1y, m.volatility_90, m.aum
         FROM metrics m JOIN funds f ON f.code = m.code
         WHERE m.return_1y IS NOT NULL AND m.volatility_90 IS NOT NULL
           AND m.current_price > 0.001 AND m.return_1y > -0.95 AND m.return_1y < 5.0
           AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
           AND ${TEFAS_TRADED}`,
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
         WHERE m.current_price IS NOT NULL AND m.ma_30 IS NOT NULL AND m.ma_200 IS NOT NULL
           AND ${TEFAS_TRADED}`,
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
         WHERE f.management_company IS NOT NULL AND ${TEFAS_TRADED}
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
         WHERE f.management_company = ? AND ${TEFAS_TRADED}`,
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
         WHERE f.management_company = ? AND ${TEFAS_TRADED}
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
             AND ${TEFAS_TRADED}
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

  // Analist konsensüsü — fon portföyündeki hisseler için birden fazla aracı kurumun
  // (İş Yatırım, Yapı Kredi Yatırım, ...) hedef fiyat + AL/TUT/SAT görüşünü birleştirir.
  // "Primary" broker olarak hedef fiyat yayınlayanlar arasında en yüksek piyasa değerli
  // (market cap) olan seçilir — o satırda tek hedef fiyat gösterilir; alternatifler
  // items[].brokers altında listelenir.
  //
  // Backward-compat: shape aynı kalıyor (ticker/targetPrice/potentialPct/recommendation),
  // ek olarak: brokers[] array, brokersCovering sayı, brokerSources meta.
  app.get('/funds/:code/analyst-consensus', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();

    const latest = db
      .prepare(
        `SELECT MAX(report_date) as d FROM fund_holdings
         WHERE code = ? AND asset_type = 'stock' AND asset_code IS NOT NULL`,
      )
      .get(code) as { d: string | null };
    if (!latest.d) {
      return { reportDate: null, coverage: 0, items: [], weightedPotential: null, brokers: [] };
    }

    // Portföydeki hisse + ağırlık
    const holdings = db
      .prepare(
        `SELECT asset_code as ticker, asset_name, weight
         FROM fund_holdings
         WHERE code = ? AND report_date = ?
           AND asset_type = 'stock' AND asset_code IS NOT NULL
         ORDER BY weight DESC`,
      )
      .all(code, latest.d) as Array<{ ticker: string; asset_name: string; weight: number }>;

    if (holdings.length === 0) {
      return { reportDate: latest.d, coverage: 0, items: [], weightedPotential: null, brokers: [] };
    }

    // Portföydeki ticker'lar için tüm broker tavsiyelerini tek sorguda al
    const tickers = holdings.map((h) => h.ticker);
    const placeholders = tickers.map(() => '?').join(',');
    const brokerRows = db
      .prepare(
        `SELECT broker, ticker, name, close_price, target_price, potential_pct,
                recommendation, pe_ratio, market_cap_mn_tl, entry_date,
                report_title, report_url, as_of_date
         FROM broker_recommendations
         WHERE ticker IN (${placeholders})`,
      )
      .all(...tickers) as Array<{
      broker: string;
      ticker: string;
      name: string | null;
      close_price: number | null;
      target_price: number | null;
      potential_pct: number | null;
      recommendation: string | null;
      pe_ratio: number | null;
      market_cap_mn_tl: number | null;
      entry_date: string | null;
      report_title: string | null;
      report_url: string | null;
      as_of_date: string;
    }>;

    // ticker -> broker adı -> satır
    const byTicker = new Map<string, typeof brokerRows>();
    for (const r of brokerRows) {
      const list = byTicker.get(r.ticker) ?? [];
      list.push(r);
      byTicker.set(r.ticker, list);
    }

    // Konsensüs metrikleri (primary görüşe göre)
    let totalWeight = 0;
    let coveredWeight = 0;
    let weightedSum = 0;
    const recCount: Record<string, number> = {
      AL: 0,
      TUT: 0,
      SAT: 0,
      'GÖZDEN GEÇİRİLİYOR': 0,
      unrated: 0,
    };
    let stocksAsOfDate: string | null = null;
    const brokerSources = new Set<string>();

    const items = holdings.map((h) => {
      totalWeight += h.weight;
      const brokerList = byTicker.get(h.ticker) ?? [];
      // Hedefi olan (> 0) görüşler
      const withTarget = brokerList.filter(
        (b) => b.target_price !== null && b.target_price > 0 && b.potential_pct !== null,
      );
      // Primary: hedef fiyat yayınlayanlar arasında market_cap en yüksek olan,
      // yoksa listedeki ilk hedef fiyat yayınlayan. Büyük kap = daha güvenilir proxy.
      const primary = withTarget.length > 0
        ? withTarget.reduce((best, cur) => {
            const bm = best.market_cap_mn_tl ?? -Infinity;
            const cm = cur.market_cap_mn_tl ?? -Infinity;
            return cm > bm ? cur : best;
          })
        : (brokerList[0] ?? null);

      if (primary && primary.target_price !== null && primary.target_price > 0) {
        coveredWeight += h.weight;
        weightedSum += h.weight * (primary.potential_pct as number);
      }
      const rec = primary?.recommendation ?? null;
      if (rec && rec in recCount) recCount[rec]!++;
      else if (primary?.close_price !== null && primary?.close_price !== undefined) recCount.unrated!++;

      for (const b of brokerList) {
        brokerSources.add(b.broker);
        if (b.as_of_date && (!stocksAsOfDate || b.as_of_date > stocksAsOfDate)) {
          stocksAsOfDate = b.as_of_date;
        }
      }

      // Hedef fiyatların min/max/avg
      const targets = withTarget.map((b) => b.target_price as number);
      const targetMin = targets.length > 0 ? Math.min(...targets) : null;
      const targetMax = targets.length > 0 ? Math.max(...targets) : null;
      const targetAvg =
        targets.length > 0 ? targets.reduce((a, c) => a + c, 0) / targets.length : null;

      const validPrimary = primary && primary.target_price !== null && primary.target_price > 0;
      return {
        ticker: h.ticker,
        name: primary?.name ?? h.asset_name,
        weight: h.weight,
        closePrice: primary?.close_price ?? null,
        // Primary broker view (geri uyumluluk için tekil alanlar)
        targetPrice: validPrimary ? primary!.target_price : null,
        potentialPct: validPrimary ? primary!.potential_pct : null,
        peRatio: primary?.pe_ratio ?? null,
        recommendation: rec,
        primaryBroker: primary?.broker ?? null,
        // Tüm broker görüşleri
        brokers: brokerList.map((b) => ({
          broker: b.broker,
          targetPrice: b.target_price !== null && b.target_price > 0 ? b.target_price : null,
          potentialPct: b.target_price !== null && b.target_price > 0 ? b.potential_pct : null,
          recommendation: b.recommendation,
          entryDate: b.entry_date,
          reportTitle: b.report_title,
          reportUrl: b.report_url,
          asOfDate: b.as_of_date,
        })),
        brokerCount: brokerList.length,
        targetRange: targets.length > 0 ? { min: targetMin, max: targetMax, avg: targetAvg } : null,
      };
    });

    const coverage = totalWeight > 0 ? coveredWeight / totalWeight : 0;
    const weightedPotential = coveredWeight > 0 ? weightedSum / coveredWeight : null;

    return {
      reportDate: latest.d,
      stocksAsOfDate,
      brokers: Array.from(brokerSources).sort(),
      totalWeight: Math.round(totalWeight * 100) / 100,
      coveredWeight: Math.round(coveredWeight * 100) / 100,
      coverage: Math.round(coverage * 10000) / 10000,
      weightedPotential:
        weightedPotential !== null ? Math.round(weightedPotential * 100) / 100 : null,
      recCount,
      items,
    };
  });

  // Hisse detay — fund_holdings'te geçen bir ticker için tüm fonlar,
  // analist konsensüsü, zaman içinde ağırlık trendi, top holder fonlar.
  // /hisse/[ticker] sayfasını besler.
  app.get('/stocks/:ticker', async (req, reply) => {
    const { ticker } = req.params as { ticker: string };
    const t = ticker.trim().toUpperCase();
    const db = getDb();

    // Son rapor tarihindeki holdings
    const latestReport = db
      .prepare(`SELECT MAX(report_date) AS d FROM fund_holdings WHERE asset_code = ?`)
      .get(t) as { d: string | null };
    if (!latestReport.d) return reply.code(404).send({ error: 'Hisse bulunamadı' });

    // Bu hisseyi tutan fonlar — son raporda
    const holders = db
      .prepare(
        `SELECT h.code, h.weight, h.market_value, h.asset_name,
                f.name AS fund_name, f.category, f.management_company,
                m.current_price, m.return_1m, m.return_1y, m.volatility_90
         FROM fund_holdings h
         JOIN funds f ON f.code = h.code
         LEFT JOIN metrics m ON m.code = h.code
         WHERE h.asset_code = ? AND h.report_date = ?
         ORDER BY h.weight DESC`,
      )
      .all(t, latestReport.d) as Array<{
      code: string;
      weight: number;
      market_value: number | null;
      asset_name: string;
      fund_name: string;
      category: string | null;
      management_company: string | null;
      current_price: number | null;
      return_1m: number | null;
      return_1y: number | null;
      volatility_90: number | null;
    }>;

    if (holders.length === 0) return reply.code(404).send({ error: 'Hisse bulunamadı' });

    // Analist konsensüsü — broker_recommendations
    const brokers = db
      .prepare(
        `SELECT broker, name, close_price, target_price, potential_pct, recommendation,
                pe_ratio, market_cap_mn_tl, entry_date, report_title, report_url, as_of_date
         FROM broker_recommendations
         WHERE ticker = ?
         ORDER BY broker`,
      )
      .all(t) as Array<{
      broker: string;
      name: string | null;
      close_price: number | null;
      target_price: number | null;
      potential_pct: number | null;
      recommendation: string | null;
      pe_ratio: number | null;
      market_cap_mn_tl: number | null;
      entry_date: string | null;
      report_title: string | null;
      report_url: string | null;
      as_of_date: string;
    }>;

    // Zaman içinde fon sahipliği sayısı (aylık)
    const ownershipTrend = db
      .prepare(
        `SELECT report_date, COUNT(DISTINCT code) AS fund_count,
                ROUND(AVG(weight), 2) AS avg_weight,
                ROUND(SUM(market_value) / 1000000, 2) AS total_mv_mn
         FROM fund_holdings
         WHERE asset_code = ?
         GROUP BY report_date
         ORDER BY report_date`,
      )
      .all(t) as Array<{
      report_date: string;
      fund_count: number;
      avg_weight: number;
      total_mv_mn: number | null;
    }>;

    // Özet
    const totalMv = holders.reduce((a, h) => a + (h.market_value ?? 0), 0);
    const avgWeight = holders.reduce((a, h) => a + h.weight, 0) / holders.length;
    const maxWeight = Math.max(...holders.map((h) => h.weight));
    const name = holders[0]!.asset_name;

    // Primary broker (hedef fiyat yayınlayanlar arasında market cap en büyüğü)
    const withTarget = brokers.filter((b) => b.target_price !== null && b.target_price > 0);
    const primary =
      withTarget.length > 0
        ? withTarget.reduce((best, cur) => {
            const bm = best.market_cap_mn_tl ?? -Infinity;
            const cm = cur.market_cap_mn_tl ?? -Infinity;
            return cm > bm ? cur : best;
          })
        : null;
    const targets = withTarget.map((b) => b.target_price as number);
    const targetRange =
      targets.length > 0
        ? {
            min: Math.min(...targets),
            max: Math.max(...targets),
            avg: targets.reduce((a, c) => a + c, 0) / targets.length,
          }
        : null;

    return {
      ticker: t,
      name,
      reportDate: latestReport.d,
      summary: {
        fundCount: holders.length,
        totalMarketValueTl: totalMv,
        avgWeightInFunds: Math.round(avgWeight * 100) / 100,
        maxWeightInFunds: Math.round(maxWeight * 100) / 100,
      },
      primaryBroker: primary?.broker ?? null,
      consensus: {
        brokerCount: brokers.length,
        targetRange,
        recommendation: primary?.recommendation ?? null,
        closePrice: primary?.close_price ?? null,
        peRatio: primary?.pe_ratio ?? null,
        marketCapMnTl: primary?.market_cap_mn_tl ?? null,
      },
      brokers,
      holders,
      ownershipTrend,
    };
  });

  // Stock logo manifest — tüm ticker'lar için logo URL'i / fallback durumu.
  // UI compact logo resolver'ı için tek request'te çözmek amacıyla toplu döner.
  // Frontend bunu cache'ler, her ticker için ayrı HEAD çağrısı yapmaz.
  app.get('/stock-logos', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT ticker, status, file_size FROM stock_logos WHERE status = 'ok'`,
      )
      .all() as Array<{ ticker: string; status: string; file_size: number }>;
    const items: Record<string, string> = {};
    for (const r of rows) {
      items[r.ticker] = `/stock-logos/${r.ticker}.svg`;
    }
    return { items, total: rows.length };
  });

  // Tek hisse için tüm aracı kurumların görüşü — stock detay sayfası için.
  app.get('/stocks/:ticker/recommendations', async (req) => {
    const { ticker } = req.params as { ticker: string };
    const db = getDb();
    const t = ticker.trim().toUpperCase();
    const rows = db
      .prepare(
        `SELECT broker, ticker, name, close_price, target_price, potential_pct,
                recommendation, pe_ratio, market_cap_mn_tl, weight_pct, entry_date,
                report_title, report_url, as_of_date, updated_at
         FROM broker_recommendations
         WHERE ticker = ?
         ORDER BY broker ASC`,
      )
      .all(t) as Array<Record<string, unknown>>;
    return { ticker: t, items: rows };
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

  // Altınkaynak altın piyasası — fiziki ürün (çeyrek/yarım/tam/cumhuriyet/
  // 22-18-14 ayar/bilezik) + gram altın + ons + gümüş, buy/sell spread'li.
  // data_group: 2=Perakende, 7=Gümüş, 8=Cumhuriyet ailesi, 9=Ons/IAB, 11=Toptan
  app.get('/gold/live', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT code, name, description, buy, sell, value, change_pct, is_bulk,
                data_group, source_time, fetched_at
         FROM gold_prices
         ORDER BY data_group, code`,
      )
      .all() as Array<{
      code: string;
      name: string | null;
      description: string | null;
      buy: number | null;
      sell: number | null;
      value: number | null;
      change_pct: number | null;
      is_bulk: number;
      data_group: number | null;
      source_time: string | null;
      fetched_at: number;
    }>;
    const fetchedAt = rows[0]?.fetched_at ?? null;
    return { items: rows, fetchedAt };
  });

  // Altın karşılaştırma — verilen TL tutarın bugün hangi fiziki altın ürünü
  // veya altın fonundan kaç adet/gram alacağını hesaplar + son 30 günlük
  // gram altın vs altın fonu performansını kıyaslar.
  app.get('/gold/compare', async (req) => {
    const { amount = '10000', fundCode } = req.query as { amount?: string; fundCode?: string };
    const tl = Math.max(0, Number(amount) || 0);
    const db = getDb();

    // Fiziki ürünler — "ne kadar alırsın" hesabı için satış fiyatı kullanılır
    const physical = db
      .prepare(
        `SELECT code, name, description, sell, buy, change_pct
         FROM gold_prices
         WHERE code IN ('GA','C','Y','T','A','B','18','14','HH_T','CH_T','GAT','XAUUSD')
         ORDER BY CASE code
           WHEN 'GA' THEN 1
           WHEN 'C' THEN 2
           WHEN 'Y' THEN 3
           WHEN 'T' THEN 4
           WHEN 'A' THEN 5
           WHEN 'B' THEN 6
           WHEN '18' THEN 7
           WHEN '14' THEN 8
           WHEN 'HH_T' THEN 20
           WHEN 'CH_T' THEN 21
           WHEN 'GAT' THEN 22
           WHEN 'XAUUSD' THEN 30
           ELSE 99 END`,
      )
      .all() as Array<{
      code: string;
      name: string | null;
      description: string | null;
      sell: number | null;
      buy: number | null;
      change_pct: number | null;
    }>;

    const items = physical.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      buy: p.buy,
      sell: p.sell,
      changePct: p.change_pct,
      unitsForAmount: p.sell && p.sell > 0 ? tl / p.sell : null,
      // Sell - Buy = bozdurma sırasında kaybedilen spread (%)
      spreadPct: p.sell && p.buy && p.sell > 0 ? ((p.sell - p.buy) / p.sell) * 100 : null,
    }));

    // Opsiyonel: fon karşılaştırması
    let fund: {
      code: string;
      name: string;
      currentPrice: number | null;
      unitsForAmount: number | null;
      return30d: number | null;
      gramGold30dReturn: number | null;
      realGoldReturn: number | null;
    } | null = null;

    if (fundCode) {
      const code = fundCode.toUpperCase();
      const f = db
        .prepare(
          `SELECT f.code, f.name, m.current_price, m.return_1m
           FROM funds f LEFT JOIN metrics m ON m.code = f.code
           WHERE f.code = ?`,
        )
        .get(code) as { code: string; name: string; current_price: number | null; return_1m: number | null } | undefined;

      if (f) {
        // Gram altının 30 gün getirisi — gold_daily'den hesapla, yoksa null
        const gold30d = db
          .prepare(
            `WITH recent AS (
               SELECT mid FROM gold_daily WHERE code='GA' ORDER BY date DESC LIMIT 1
             ), old AS (
               SELECT mid FROM gold_daily WHERE code='GA' AND date <= date('now','-30 days')
               ORDER BY date DESC LIMIT 1
             )
             SELECT (SELECT mid FROM recent) AS now_price, (SELECT mid FROM old) AS old_price`,
          )
          .get() as { now_price: number | null; old_price: number | null };
        const gold30dReturn =
          gold30d.now_price && gold30d.old_price && gold30d.old_price > 0
            ? ((gold30d.now_price - gold30d.old_price) / gold30d.old_price) * 100
            : null;

        const fundRet = f.return_1m !== null ? f.return_1m * 100 : null;
        const realGoldReturn =
          fundRet !== null && gold30dReturn !== null ? fundRet - gold30dReturn : null;

        fund = {
          code: f.code,
          name: f.name,
          currentPrice: f.current_price,
          unitsForAmount: f.current_price && f.current_price > 0 ? tl / f.current_price : null,
          return30d: fundRet,
          gramGold30dReturn: gold30dReturn,
          realGoldReturn,
        };
      }
    }

    return { amountTl: tl, physical: items, fund };
  });

  // Fon detayında "bu paran kaç gram altın eder" badge'i için hızlı endpoint.
  // GA (gram altın) sell fiyatını + fonun son fiyatını döndürür.
  app.get('/funds/:code/gold-parity', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const fund = db
      .prepare(
        `SELECT f.code, f.name, m.current_price, m.current_date
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.code = ?`,
      )
      .get(code) as { code: string; name: string; current_price: number | null; current_date: string | null } | undefined;
    if (!fund || fund.current_price === null) return reply.code(404).send({ error: 'Fon bulunamadı' });

    const gold = db
      .prepare(
        `SELECT sell, buy, change_pct, fetched_at
         FROM gold_prices WHERE code = 'GA'`,
      )
      .get() as { sell: number | null; buy: number | null; change_pct: number | null; fetched_at: number } | undefined;
    if (!gold?.sell) return reply.code(503).send({ error: 'Altın fiyatı henüz yok' });

    // 1 fon payı = kaç gram altın?
    const gramsPerUnit = fund.current_price / gold.sell;

    return {
      fund: { code: fund.code, name: fund.name, price: fund.current_price, priceDate: fund.current_date },
      gold: { gramSellPrice: gold.sell, gramBuyPrice: gold.buy, changePct: gold.change_pct, fetchedAt: gold.fetched_at },
      gramsPerUnit,
    };
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
