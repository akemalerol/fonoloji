import type { Database } from 'better-sqlite3';
import type { FundPriceRow } from '../../../../src/types/tefasResponse.js';

export interface PriceRow {
  code: string;
  date: string;
  price: number;
  shares_outstanding: number | null;
  investor_count: number | null;
  total_value: number | null;
}

export interface FundRow {
  code: string;
  name: string;
  type: string | null;
  category: string | null;
  management_company: string | null;
  first_seen: string | null;
  last_seen: string | null;
  updated_at: number | null;
}

export interface MetricsRow {
  code: string;
  updated_at: number;
  current_price: number | null;
  current_date: string | null;
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  return_ytd: number | null;
  return_all: number | null;
  volatility_30: number | null;
  volatility_90: number | null;
  sharpe_90: number | null;
  max_drawdown_1y: number | null;
  ma_30: number | null;
  ma_90: number | null;
  ma_200: number | null;
  aum: number | null;
  investor_count: number | null;
  flow_1w: number | null;
  flow_1m: number | null;
  flow_3m: number | null;
}

export function upsertPrices(
  db: Database,
  fundType: string,
  rows: FundPriceRow[],
): { funds: number; prices: number } {
  if (rows.length === 0) return { funds: 0, prices: 0 };

  const now = Date.now();

  const insertFund = db.prepare(`
    INSERT INTO funds (code, name, type, first_seen, last_seen, updated_at)
    VALUES (@code, @name, @type, @date, @date, @now)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      type = COALESCE(excluded.type, funds.type),
      first_seen = MIN(funds.first_seen, excluded.first_seen),
      last_seen = MAX(funds.last_seen, excluded.last_seen),
      updated_at = @now
  `);

  const insertPrice = db.prepare(`
    INSERT INTO prices (code, date, price, shares_outstanding, investor_count, total_value)
    VALUES (@code, @date, @price, @shares_outstanding, @investor_count, @total_value)
    ON CONFLICT(code, date) DO UPDATE SET
      price = excluded.price,
      shares_outstanding = excluded.shares_outstanding,
      investor_count = excluded.investor_count,
      total_value = excluded.total_value
  `);

  const uniqueFunds = new Map<string, { code: string; name: string }>();
  for (const r of rows) uniqueFunds.set(r.fundCode, { code: r.fundCode, name: r.fundName });

  const txn = db.transaction(() => {
    for (const f of uniqueFunds.values()) {
      insertFund.run({
        code: f.code,
        name: f.name,
        type: fundType,
        date: rows.find((r) => r.fundCode === f.code)?.date,
        now,
      });
    }
    for (const r of rows) {
      insertPrice.run({
        code: r.fundCode,
        date: r.date,
        price: r.price,
        shares_outstanding: r.sharesOutstanding,
        investor_count: r.investorCount,
        total_value: r.totalValue,
      });
    }
  });
  txn();

  return { funds: uniqueFunds.size, prices: rows.length };
}

export function logIngest(
  db: Database,
  entry: {
    startedAt: number;
    finishedAt: number;
    kind: string;
    status: 'success' | 'error';
    rowsInserted: number;
    error?: string;
  },
): void {
  db.prepare(
    `INSERT INTO ingest_log (started_at, finished_at, kind, status, rows_inserted, error)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.startedAt,
    entry.finishedAt,
    entry.kind,
    entry.status,
    entry.rowsInserted,
    entry.error ?? null,
  );
}

export function allFundCodes(db: Database): string[] {
  const rows = db.prepare(`SELECT code FROM funds ORDER BY code`).all() as { code: string }[];
  return rows.map((r) => r.code);
}

export function getPricesForFund(
  db: Database,
  code: string,
  limit?: number,
): Array<{ date: string; price: number }> {
  const stmt = limit
    ? db.prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date DESC LIMIT ?`)
    : db.prepare(`SELECT date, price FROM prices WHERE code = ? ORDER BY date DESC`);
  const rows = limit ? stmt.all(code, limit) : stmt.all(code);
  return (rows as Array<{ date: string; price: number }>).reverse();
}

export function getLatestPrices(
  db: Database,
  codes?: string[],
): Array<{ code: string; date: string; price: number; total_value: number; investor_count: number }> {
  const filter = codes && codes.length > 0
    ? `WHERE code IN (${codes.map(() => '?').join(',')})`
    : '';
  const stmt = db.prepare(`
    SELECT p.code, p.date, p.price, p.total_value, p.investor_count
    FROM prices p
    INNER JOIN (
      SELECT code, MAX(date) AS max_date FROM prices ${filter} GROUP BY code
    ) latest ON latest.code = p.code AND latest.max_date = p.date
    ORDER BY p.code
  `);
  const params = codes && codes.length > 0 ? codes : [];
  return stmt.all(...params) as Array<{
    code: string;
    date: string;
    price: number;
    total_value: number;
    investor_count: number;
  }>;
}
