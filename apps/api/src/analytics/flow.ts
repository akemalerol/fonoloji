import type { Database } from 'better-sqlite3';

export interface FlowMetrics {
  code: string;
  flow_1w: number | null;
  flow_1m: number | null;
  flow_3m: number | null;
  aum: number | null;
  investor_count: number | null;
}

export function computeFlow(db: Database, code: string): FlowMetrics {
  const rows = db
    .prepare(
      `SELECT date, total_value, shares_outstanding, price, investor_count
       FROM prices WHERE code = ? ORDER BY date DESC LIMIT 200`,
    )
    .all(code) as Array<{
    date: string;
    total_value: number | null;
    shares_outstanding: number | null;
    price: number | null;
    investor_count: number;
  }>;

  if (rows.length === 0) {
    return { code, flow_1w: null, flow_1m: null, flow_3m: null, aum: null, investor_count: null };
  }

  // Derive AUM: prefer PORTFOYBUYUKLUK; fall back to shares × price for older rows where field was missing.
  const aumOf = (r: { total_value: number | null; shares_outstanding: number | null; price: number | null }): number | null => {
    if (r.total_value && r.total_value > 0) return r.total_value;
    if (r.shares_outstanding && r.price && r.shares_outstanding > 0 && r.price > 0) {
      return r.shares_outstanding * r.price;
    }
    return null;
  };

  const latest = rows[0]!;
  const latestAum = aumOf(latest);
  const pickBackwards = (days: number) => rows.find((_r, idx) => idx >= days - 1) ?? null;

  const w1 = pickBackwards(7);
  const m1 = pickBackwards(30);
  const m3 = pickBackwards(90);

  const pct = (latest_v: number | null, baseline_v: number | null) =>
    latest_v && baseline_v && baseline_v > 0 ? (latest_v - baseline_v) / baseline_v : null;

  return {
    code,
    aum: latestAum,
    investor_count: latest.investor_count,
    flow_1w: pct(latestAum, w1 ? aumOf(w1) : null),
    flow_1m: pct(latestAum, m1 ? aumOf(m1) : null),
    flow_3m: pct(latestAum, m3 ? aumOf(m3) : null),
  };
}
