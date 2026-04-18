import type { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import { estimateFundNav } from '../services/liveEstimate.js';
import { backfillFundKapDisclosures } from '../scripts/ingestKapDisclosures.js';

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
      .all(...params, Number(limit));
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
};
