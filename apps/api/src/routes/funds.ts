import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import { estimateFundNav } from '../services/liveEstimate.js';
import { backfillFundKapDisclosures } from '../scripts/ingestKapDisclosures.js';
import { runKapHoldingsIngest } from '../scripts/ingestKapHoldings.js';
import { analyzePortfolio, computeFundOverlap, type FundInput } from '../services/portfolioAnalysis.js';
import { getActiveAd, incrementImpression } from '../services/ads.js';

// Per-process throttle — fund başına en fazla ayda 1 holdings refresh denenir.
const holdingsBackfillTried = new Map<string, number>();
const HOLDINGS_BACKFILL_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function maybeTriggerHoldingsBackfill(db: ReturnType<typeof getDb>, code: string, log: { warn: (...args: unknown[]) => void }): void {
  const last = holdingsBackfillTried.get(code);
  if (last && Date.now() - last < HOLDINGS_BACKFILL_COOLDOWN_MS) return;

  // Sadece hisse ağırlıklı fonlar için — diğerleri için NAV tahmini anlamsız, PDF indirmeye değmez
  const alloc = db
    .prepare(`SELECT stock FROM portfolio_snapshots WHERE code = ? ORDER BY date DESC LIMIT 1`)
    .get(code) as { stock: number | null } | undefined;
  if (!alloc || (alloc.stock ?? 0) < 50) return;

  const latest = db
    .prepare(`SELECT MAX(report_date) as d FROM fund_holdings WHERE code = ?`)
    .get(code) as { d: string | null };
  const reportTime = latest.d ? Date.parse(latest.d + '-15') : NaN;
  const ageDays = Number.isFinite(reportTime) ? (Date.now() - reportTime) / 86_400_000 : Infinity;
  if (ageDays <= 60) return; // yeterince taze

  holdingsBackfillTried.set(code, Date.now());
  setImmediate(() => {
    runKapHoldingsIngest({ months: 3, fundCodes: [code] }).catch((err: Error) => {
      log.warn({ err: err.message, code }, 'holdings backfill hata');
    });
  });
}

export const fundsRoute: FastifyPluginAsync = async (app) => {
  app.get('/funds', async (req) => {
    const db = getDb();
    const { q, type, category, sort = 'aum', limit = '200' } =
      req.query as Record<string, string>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (q) {
      where.push(`(f.code LIKE ? OR f.name LIKE ?)`);
      params.push(`%${q.toUpperCase()}%`, `%${q}%`);
    }
    if (type) {
      where.push(`f.type = ?`);
      params.push(type);
    }
    if (category) {
      where.push(`f.category = ?`);
      params.push(category);
    }
    const { dir = 'desc' } = req.query as Record<string, string>;
    const sortCol: Record<string, string> = {
      aum: 'm.aum',
      return_1d: 'm.return_1d',
      return_1w: 'm.return_1w',
      return_1m: 'm.return_1m',
      return_3m: 'm.return_3m',
      return_1y: 'm.return_1y',
      return_ytd: 'm.return_ytd',
      volatility: 'm.volatility_90',
      sharpe: 'm.sharpe_90',
      risk: 'f.risk_score',
      investors: 'm.investor_count',
      name: 'f.name',
    };
    const col = sortCol[sort] ?? sortCol.aum!;
    const direction = dir === 'asc' ? 'ASC' : 'DESC';
    const orderBy = sort === 'name' ? `${col} ${direction}` : `${col} ${direction} NULLS LAST`;

    // When sorting ASC by a return column, exclude delisted/zero funds (−100% artifacts).
    if (dir === 'asc' && sort.startsWith('return_')) {
      where.push(
        `m.current_price > 0.001 AND ${col} > -0.95 AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)`,
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.type, f.category, f.management_company,
                f.isin, f.risk_score, f.kap_url, f.trading_status,
                m.current_price, m.current_date, m.return_1d, m.return_1w, m.return_1m,
                m.return_3m, m.return_6m, m.return_1y, m.return_ytd, m.volatility_90,
                m.sharpe_90, m.aum, m.investor_count,
                ps.stock, ps.government_bond, ps.treasury_bill, ps.corporate_bond,
                ps.eurobond, ps.gold, ps.cash, ps.other,
                ps.date as portfolio_date
         FROM funds f
         LEFT JOIN metrics m ON m.code = f.code
         LEFT JOIN (
           SELECT code, date, stock, government_bond, treasury_bill, corporate_bond,
                  eurobond, gold, cash, other,
                  ROW_NUMBER() OVER (PARTITION BY code ORDER BY date DESC) as rn
           FROM portfolio_snapshots
         ) ps ON ps.code = f.code AND ps.rn = 1
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ?`,
      )
      .all(...params, Math.min(Math.max(Number(limit) || 200, 1), 500));
    return { items: rows };
  });

  app.get('/funds/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const fund = db
      .prepare(
        `SELECT f.*, m.*
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE f.code = ?`,
      )
      .get(code);
    if (!fund) return reply.code(404).send({ error: 'Fon bulunamadı' });

    const portfolio = db
      .prepare(`SELECT * FROM portfolio_snapshots WHERE code = ? ORDER BY date DESC LIMIT 1`)
      .get(code);

    return { fund, portfolio };
  });

  // Portföy X-Ray — ad-hoc analiz, auth gerekmez. POST body: { funds: [{code, weight}] }
  app.post('/tools/portfolio-xray', async (req, reply) => {
    const body = req.body as { funds?: FundInput[] } | null;
    if (!body?.funds || !Array.isArray(body.funds) || body.funds.length === 0) {
      return reply.code(400).send({ error: 'funds[] gerekli' });
    }
    if (body.funds.length > 20) {
      return reply.code(400).send({ error: 'Max 20 fon' });
    }
    const db = getDb();
    const xray = analyzePortfolio(db, body.funds);
    return xray;
  });

  // Fon DNA / overlap — iki fonun holdings benzerliği
  app.get('/tools/fund-overlap', async (req, reply) => {
    const { a, b } = req.query as { a?: string; b?: string };
    if (!a || !b) return reply.code(400).send({ error: 'a ve b parametreleri gerekli' });
    const db = getDb();
    const overlap = computeFundOverlap(db, a.toUpperCase(), b.toUpperCase());
    if (!overlap) return reply.code(404).send({ error: 'En az bir fon için KAP portföy verisi yok' });
    return overlap;
  });

  // CSV export — fon listesi (fonlar sayfasıyla aynı filtreleri kabul eder)
  // Yeni listelenen fonlar — son 30 gün içinde ilk kez gözlenen (first_seen'e göre)
  app.get('/funds/new', async (req) => {
    const { days = '30', limit = '50' } = req.query as Record<string, string>;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.type, f.category, f.management_company, f.first_seen,
                m.current_price, m.return_1m, m.aum
         FROM funds f
         LEFT JOIN metrics m ON m.code = f.code
         WHERE f.first_seen IS NOT NULL
           AND julianday('now') - julianday(f.first_seen) <= ?
           AND (f.trading_status LIKE '%işlem görüyor%' OR f.trading_status IS NULL)
         ORDER BY f.first_seen DESC
         LIMIT ?`,
      )
      .all(Number(days) || 30, Math.min(Number(limit) || 50, 200));
    return { items: rows };
  });

  // Kapanmış fonlar mezarlığı — son 30+ gün TEFAS'ta güncellenmemiş fonlar
  app.get('/funds/archived', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.type, f.category, f.management_company, f.isin,
                f.trading_status, f.first_seen, f.last_seen, f.updated_at,
                m.current_price, m.aum, m.investor_count, m.return_1y, m.return_all
         FROM funds f
         LEFT JOIN metrics m ON m.code = f.code
         WHERE (
           f.trading_status IS NULL
           OR f.trading_status NOT LIKE '%işlem görüyor%'
           OR (f.last_seen IS NOT NULL AND julianday('now') - julianday(f.last_seen) > 30)
         )
         ORDER BY f.last_seen DESC NULLS LAST
         LIMIT 500`,
      )
      .all();
    return { items: rows };
  });

  app.get('/funds.csv', async (req, reply) => {
    const { q, type, category, sort = 'aum', dir = 'desc', limit = '500' } =
      req.query as Record<string, string>;
    const db = getDb();
    const where: string[] = [];
    const params: unknown[] = [];
    if (q) { where.push(`(f.code LIKE ? OR f.name LIKE ?)`); params.push(`%${q.toUpperCase()}%`, `%${q}%`); }
    if (type) { where.push(`f.type = ?`); params.push(type); }
    if (category) { where.push(`f.category = ?`); params.push(category); }

    const sortCol: Record<string, string> = {
      aum: 'm.aum', return_1d: 'm.return_1d', return_1w: 'm.return_1w',
      return_1m: 'm.return_1m', return_3m: 'm.return_3m', return_1y: 'm.return_1y',
      return_ytd: 'm.return_ytd', volatility: 'm.volatility_90', sharpe: 'm.sharpe_90',
      risk: 'f.risk_score', name: 'f.name',
    };
    const col = sortCol[sort] ?? 'm.aum';
    const direction = dir === 'asc' ? 'ASC' : 'DESC';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.type, f.category, f.management_company,
                f.isin, f.risk_score, f.trading_status,
                m.current_price, m.current_date, m.return_1d, m.return_1w, m.return_1m,
                m.return_3m, m.return_6m, m.return_1y, m.return_ytd, m.real_return_1y,
                m.volatility_90, m.sharpe_90, m.sortino_90, m.max_drawdown_1y,
                m.aum, m.investor_count, m.flow_1m
         FROM funds f
         LEFT JOIN metrics m ON m.code = f.code
         ${whereSql}
         ORDER BY ${col} ${direction} NULLS LAST
         LIMIT ?`,
      )
      .all(...params, Math.min(Math.max(Number(limit) || 500, 1), 500)) as Array<Record<string, unknown>>;

    const header = [
      'kod','ad','tip','kategori','yonetim_sirketi','isin','risk_skoru','durum',
      'fiyat','fiyat_tarihi','getiri_1g','getiri_1h','getiri_1a','getiri_3a','getiri_6a',
      'getiri_1y','getiri_ybi','reel_getiri_1y','volatilite_90','sharpe_90','sortino_90',
      'max_drawdown_1y','aum','yatirimci','akis_1a',
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [
      header.join(','),
      ...rows.map((r) => [
        r.code, r.name, r.type, r.category, r.management_company, r.isin, r.risk_score, r.trading_status,
        r.current_price, r.current_date, r.return_1d, r.return_1w, r.return_1m, r.return_3m, r.return_6m,
        r.return_1y, r.return_ytd, r.real_return_1y, r.volatility_90, r.sharpe_90, r.sortino_90,
        r.max_drawdown_1y, r.aum, r.investor_count, r.flow_1m,
      ].map(escape).join(',')),
    ].join('\n');

    const ts = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="fonoloji-fonlar-${ts}.csv"`);
    // BOM — Excel Türkçe karakter için
    return '\uFEFF' + csv;
  });

  app.get('/funds/:code/percentile', async (req, reply) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const upper = code.toUpperCase();
    const fund = db
      .prepare(`SELECT category FROM funds WHERE code = ?`)
      .get(upper) as { category: string | null } | undefined;
    if (!fund?.category) return reply.code(404).send({ error: 'Kategori yok' });

    // Kategori içi peerleri — sadece TEFAS-traded, sanity filter'lı
    const peers = db
      .prepare(
        `SELECT m.code, m.sharpe_90, m.return_1y, m.return_3m, m.real_return_1y,
                m.max_drawdown_1y, m.volatility_90, m.aum
         FROM funds f JOIN metrics m ON m.code = f.code
         WHERE f.category = ?
           AND m.current_price > 0.001
           AND (f.trading_status LIKE '%TEFAS%işlem görüyor%' OR f.trading_status LIKE '%BEFAS%işlem görüyor%')
           AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)`,
      )
      .all(fund.category) as Array<{
      code: string;
      sharpe_90: number | null;
      return_1y: number | null;
      return_3m: number | null;
      real_return_1y: number | null;
      max_drawdown_1y: number | null;
      volatility_90: number | null;
      aum: number | null;
    }>;

    // Her metrik için rank hesapla. null peer'lar yok sayılır.
    // Drawdown + volatility: daha düşük daha iyi → rank ters.
    type Metric = 'sharpe_90' | 'return_1y' | 'return_3m' | 'real_return_1y' | 'max_drawdown_1y' | 'volatility_90' | 'aum';
    const METRICS: Array<{ key: Metric; reverse: boolean }> = [
      { key: 'sharpe_90', reverse: false },
      { key: 'return_1y', reverse: false },
      { key: 'return_3m', reverse: false },
      { key: 'real_return_1y', reverse: false },
      { key: 'max_drawdown_1y', reverse: true },   // negatif değerler → en az negatif = iyi
      { key: 'volatility_90', reverse: true },      // düşük = iyi
      { key: 'aum', reverse: false },               // büyük = güven sinyali
    ];

    const result: Record<string, { rank: number; total: number; percentile: number; value: number | null } | null> = {};

    for (const { key, reverse } of METRICS) {
      const withValue = peers.filter((p) => p[key] !== null && Number.isFinite(p[key] as number));
      if (withValue.length < 3) {
        result[key] = null;
        continue;
      }
      const self = withValue.find((p) => p.code === upper);
      if (!self) { result[key] = null; continue; }
      const selfVal = self[key] as number;

      const sorted = withValue.slice().sort((a, b) => {
        const av = a[key] as number;
        const bv = b[key] as number;
        return reverse ? av - bv : bv - av; // default: desc (best first)
      });

      const rank = sorted.findIndex((p) => p.code === upper) + 1;
      const total = sorted.length;
      const percentile = Math.round((1 - (rank - 1) / total) * 100);

      result[key] = { rank, total, percentile, value: selfVal };
    }

    return { code: upper, category: fund.category, categorySize: peers.length, metrics: result };
  });

  app.get('/funds/:code/monthly-returns', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = db
      .prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`)
      .all(code) as Array<{ date: string; price: number }>;
    if (rows.length < 30) return { code, months: [] };

    // Group last price per (year-month)
    const monthlyLast = new Map<string, { date: string; price: number }>();
    for (const r of rows) {
      const ym = r.date.slice(0, 7);
      monthlyLast.set(ym, r);
    }
    const ordered = [...monthlyLast.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const months: Array<{ month: string; return: number }> = [];
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]![1];
      const curr = ordered[i]![1];
      if (prev.price > 0) {
        months.push({
          month: ordered[i]![0],
          return: Math.round(((curr.price - prev.price) / prev.price) * 1_000_000) / 1_000_000,
        });
      }
    }
    return { code, months };
  });

  app.get('/funds/:code/drawdown', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = db
      .prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`)
      .all(code) as Array<{ date: string; price: number }>;
    if (rows.length === 0) return { code, points: [] };

    let peak = rows[0]!.price;
    const points: Array<{ date: string; drawdown: number; peak: number }> = [];
    for (const r of rows) {
      if (r.price > peak) peak = r.price;
      const dd = peak > 0 ? (r.price - peak) / peak : 0;
      points.push({
        date: r.date,
        drawdown: Math.round(dd * 1_000_000) / 1_000_000,
        peak,
      });
    }
    return { code, points };
  });

  app.get('/funds/:code/portfolio-timeline', async (req) => {
    const { code } = req.params as { code: string };
    const { days = '180' } = req.query as Record<string, string>;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT date, stock, government_bond, treasury_bill, corporate_bond,
                eurobond, gold, cash, other
         FROM portfolio_snapshots
         WHERE code = ? AND date >= date('now', ? )
         ORDER BY date ASC`,
      )
      .all(code, `-${Number(days)} day`);
    return { code, points: rows };
  });

  // Fon + benchmark karşılaştırma serisi — normalize edilmiş getiri (başlangıç=100)
  // Benchmarks: BIST100 (live_market'ten), TÜFE (cpi_tr), USD/TRY (live_market)
  app.get('/funds/:code/vs-benchmark', async (req) => {
    const { code } = req.params as { code: string };
    const { period = '1y' } = req.query as Record<string, string>;
    const db = getDb();
    const days = { '1w': 7, '1m': 31, '3m': 93, '6m': 186, '1y': 365, '5y': 365 * 5, all: undefined }[period];
    const sql = days
      ? `SELECT date, price FROM prices WHERE code = ? AND date >= date('now', '-${days} day') ORDER BY date ASC`
      : `SELECT date, price FROM prices WHERE code = ? ORDER BY date ASC`;
    const fundRows = db.prepare(sql).all(code.toUpperCase()) as Array<{ date: string; price: number }>;
    if (fundRows.length < 2) return { code, period, points: [] };

    const firstDate = fundRows[0]!.date;
    const lastDate = fundRows[fundRows.length - 1]!.date;

    // Fund normalize
    const fundFirst = fundRows[0]!.price || 1;
    const fundSeries = fundRows.map((r) => ({ date: r.date, value: (r.price / fundFirst) * 100 }));

    // CPI (TÜFE) — aylık
    const cpiRows = db
      .prepare(
        `SELECT date, index_value FROM cpi_tr
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC`,
      )
      .all(firstDate, lastDate) as Array<{ date: string; index_value: number }>;
    const cpiFirst = cpiRows[0]?.index_value ?? 1;
    const cpiSeries = cpiRows.map((r) => ({ date: r.date, value: (r.index_value / cpiFirst) * 100 }));

    return {
      code,
      period,
      fund: fundSeries,
      cpi: cpiSeries,
    };
  });

  app.get('/funds/:code/history', async (req, reply) => {
    const { code } = req.params as { code: string };
    const { period = 'all', format } = req.query as Record<string, string>;
    const db = getDb();
    const days = {
      '1w': 7,
      '1m': 31,
      '3m': 93,
      '6m': 186,
      '1y': 365,
      '5y': 365 * 5,
      all: undefined,
    }[period];

    const sql = days
      ? `SELECT date, price, total_value, investor_count FROM prices WHERE code = ? AND date >= date('now', '-${days} day') ORDER BY date ASC`
      : `SELECT date, price, total_value, investor_count FROM prices WHERE code = ? ORDER BY date ASC`;
    const rows = db
      .prepare(sql)
      .all(code) as Array<{ date: string; price: number; total_value: number; investor_count: number }>;

    if (format === 'csv') {
      const header = 'date,price,aum,investor_count\n';
      const body = rows
        .map((r) => `${r.date},${r.price},${r.total_value ?? ''},${r.investor_count ?? ''}`)
        .join('\n');
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${code.toLowerCase()}-fiyat.csv"`);
      return header + body;
    }

    return { code, period, points: rows };
  });

  app.get('/funds/:code/holdings', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT asset_name, asset_code, asset_type, weight, market_value, report_date
         FROM fund_holdings WHERE code = ?
         ORDER BY report_date DESC, weight DESC`,
      )
      .all(code);
    return { code, holdings: rows };
  });

  app.get('/funds/:code/disclosures', async (req) => {
    const { code } = req.params as { code: string };
    const { limit = '20' } = req.query as Record<string, string>;
    const db = getDb();
    const upper = code.toUpperCase();

    // Fire-and-forget: hiç backfill edilmemiş fonlar için arka planda 180 günlük çekim.
    // İlk ziyarette response bekletmiyoruz, sonraki ziyarette veri gelmiş oluyor.
    const fund = db
      .prepare(`SELECT kap_backfilled_at FROM funds WHERE code = ?`)
      .get(upper) as { kap_backfilled_at: number | null } | undefined;
    if (fund && !fund.kap_backfilled_at) {
      setImmediate(() => {
        backfillFundKapDisclosures(upper).catch((err) => {
          req.log.warn({ err: err.message, code: upper }, 'kap backfill hata');
        });
      });
    }

    // Holdings backfill — hisse ağırlıklı fonun portföy raporu bayatsa arka planda tazele
    maybeTriggerHoldingsBackfill(db, upper, req.log);

    const rows = db
      .prepare(
        `SELECT disclosure_index, subject, kap_title, rule_type, period, year,
                publish_date, attachment_count, summary
         FROM kap_disclosures
         WHERE fund_code = ?
         ORDER BY publish_date DESC
         LIMIT ?`,
      )
      .all(upper, Math.min(Number(limit) || 20, 100));
    return { code: upper, items: rows, backfillTriggered: Boolean(fund && !fund.kap_backfilled_at) };
  });

  // Haftanın manşet fonları — son N günde en çok KAP bildirimi alan fonlar.
  // Genel "Aracı Kuruma Ödenen Komisyon" gibi rutin bildirimleri filtreler,
  // gerçekten ilginç olanları (Portföy, Özel Durum, Genel Açıklama) sayar.
  app.get('/kap/trending-funds', async (req) => {
    const { days = '7', limit = '20' } = req.query as Record<string, string>;
    const db = getDb();
    const windowMs = Math.min(Math.max(Number(days) || 7, 1), 90) * 86_400_000;
    const since = Date.now() - windowMs;
    const INTERESTING_SUBJECTS = [
      'Portföy Dağılım Raporu',
      'Genel Açıklama',
      'Özel Durum',
      'İzahname',
      'İzahname (Değişiklik) ',
      'Şemsiye Fon İç Tüzüğü (Değişiklik)',
      'Fon Sürekli Bilgilendirme Formu',
      'Yatırımcı Bilgi Formu',
      'İhraç Belgesi',
      'Sorumluluk Beyanı',
      'BYF, Fon Finansal Rapor',
    ];
    const placeholders = INTERESTING_SUBJECTS.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT d.fund_code, f.name, f.category, COUNT(*) as bildirim_sayisi,
                MAX(d.publish_date) as son_bildirim,
                GROUP_CONCAT(DISTINCT d.subject) as subjects
         FROM kap_disclosures d
         LEFT JOIN funds f ON f.code = d.fund_code
         WHERE d.publish_date >= ?
           AND d.fund_code IS NOT NULL
           AND d.subject IN (${placeholders})
         GROUP BY d.fund_code
         ORDER BY bildirim_sayisi DESC, son_bildirim DESC
         LIMIT ?`,
      )
      .all(since, ...INTERESTING_SUBJECTS, Math.min(Number(limit) || 20, 100));
    return { period_days: Number(days), items: rows };
  });

  app.get('/disclosures/recent', async (req) => {
    const { limit = '50' } = req.query as Record<string, string>;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT d.disclosure_index, d.fund_code, f.name as fund_name,
                d.subject, d.kap_title, d.publish_date, d.attachment_count
         FROM kap_disclosures d
         LEFT JOIN funds f ON f.code = d.fund_code
         WHERE d.fund_code IS NOT NULL
         ORDER BY d.publish_date DESC
         LIMIT ?`,
      )
      .all(Math.min(Number(limit) || 50, 200));
    return { items: rows };
  });

  app.get('/funds/:code/live-estimate', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const result = await estimateFundNav(db, code);
    if (!result) return { code, estimate: null, reason: 'Holdings verisi yok' };
    return { code, estimate: result };
  });

  app.get('/funds/:code/estimate-accuracy', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT estimate_date, estimated_change_pct, actual_change_pct, accuracy_error, confidence
         FROM nav_estimates
         WHERE code = ? AND actual_change_pct IS NOT NULL
         ORDER BY estimate_date DESC
         LIMIT 30`,
      )
      .all(code) as Array<{
      estimate_date: string;
      estimated_change_pct: number;
      actual_change_pct: number;
      accuracy_error: number;
      confidence: number;
    }>;
    const avgError = rows.length > 0
      ? rows.reduce((s, r) => s + r.accuracy_error, 0) / rows.length
      : null;
    return { code, history: rows, avgError, count: rows.length };
  });

  app.get('/estimate-leaderboard', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT code,
                COUNT(*) as days,
                AVG(accuracy_error) as avg_error,
                MIN(accuracy_error) as best,
                MAX(accuracy_error) as worst,
                AVG(confidence) as avg_confidence
         FROM nav_estimates
         WHERE actual_change_pct IS NOT NULL
         GROUP BY code
         HAVING days >= 3
         ORDER BY avg_error ASC
         LIMIT 50`,
      )
      .all();
    return { items: rows };
  });

  app.get('/search', async (req) => {
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) return { items: [] };
    const db = getDb();
    // Use ascii_fold() user-defined function — normalizes Turkish diacritics so
    // "is portfoy" matches "İŞ PORTFÖY", "oyak" matches "OYAK" etc.
    const folded = q
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
    const rows = db
      .prepare(
        `SELECT f.code, f.name, f.type, f.category, m.current_price, m.return_1d, m.aum
         FROM funds f LEFT JOIN metrics m ON m.code = f.code
         WHERE ascii_fold(f.code) LIKE ?
            OR ascii_fold(f.name) LIKE ?
            OR ascii_fold(f.management_company) LIKE ?
         ORDER BY
           CASE
             WHEN ascii_fold(f.code) = ? THEN 0
             WHEN ascii_fold(f.code) LIKE ? THEN 1
             WHEN ascii_fold(f.name) LIKE ? THEN 2
             ELSE 3
           END,
           m.aum DESC NULLS LAST
         LIMIT 25`,
      )
      .all(
        `%${folded}%`,      // code contains
        `%${folded}%`,      // name contains
        `%${folded}%`,      // management_company contains
        folded,              // exact code match → top
        `${folded}%`,        // code prefix → high priority
        `${folded}%`,        // name prefix → next
      );
    return { items: rows };
  });

  // Public: belirli bir yerleşim için aktif reklamı döndür (admin tarafından ayarlı ise).
  // Kapalıysa ya da slot_id boşsa null döner → site hiçbir şey render etmez.
  app.get('/ads/:placement', async (req) => {
    const { placement } = req.params as { placement: string };
    const db = getDb();
    const ad = getActiveAd(db, placement);
    if (!ad) return { ad: null };
    incrementImpression(db, placement);
    return { ad: { placement: ad.placement, slot_id: ad.slot_id, format: ad.format } };
  });
};
