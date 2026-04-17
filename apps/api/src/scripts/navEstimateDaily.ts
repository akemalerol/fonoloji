/**
 * Daily NAV estimate runner.
 *
 * 1. Find all equity-heavy funds (≥50% stock from TEFAS allocation)
 *    that have KAP holdings data
 * 2. For each: compute live estimate, save to nav_estimates
 * 3. Also verify yesterday's estimates against actual prices
 *
 * Usage:
 *   npx tsx src/scripts/navEstimateDaily.ts [--verify-only]
 *
 * Cron: run at 17:30 TR (near market close) to capture end-of-day estimates
 *       run at 09:00 TR next day to verify against actual TEFAS prices
 */

import { getDb } from '../db/index.js';
import { estimateFundNav } from '../services/liveEstimate.js';

interface EstimateCandidate {
  code: string;
  stock_pct: number;
}

function getEquityFunds(db: ReturnType<typeof getDb>): EstimateCandidate[] {
  return db
    .prepare(
      `SELECT ps.code, ps.stock as stock_pct
       FROM portfolio_snapshots ps
       JOIN (
         SELECT code, MAX(date) as latest FROM portfolio_snapshots GROUP BY code
       ) latest ON latest.code = ps.code AND latest.latest = ps.date
       WHERE ps.stock >= 50
         AND EXISTS (SELECT 1 FROM fund_holdings fh WHERE fh.code = ps.code AND fh.asset_type = 'stock')
       ORDER BY ps.stock DESC`,
    )
    .all() as EstimateCandidate[];
}

export async function runEstimates(): Promise<{ estimated: number; failed: number }> {
  const db = getDb();
  const candidates = getEquityFunds(db);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`[nav-estimate] ${candidates.length} hisse-ağırlıklı fon (holdings var)`);

  const insertStmt = db.prepare(
    `INSERT INTO nav_estimates (code, estimate_date, estimated_change_pct, confidence, stock_coverage_pct, holdings_date, estimated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code, estimate_date) DO UPDATE SET
       estimated_change_pct = excluded.estimated_change_pct,
       confidence = excluded.confidence,
       stock_coverage_pct = excluded.stock_coverage_pct,
       holdings_date = excluded.holdings_date,
       estimated_at = excluded.estimated_at`,
  );

  let estimated = 0;
  let failed = 0;

  for (const { code } of candidates) {
    try {
      const result = await estimateFundNav(db, code);
      if (!result || result.confidence < 0.3) {
        failed++;
        continue;
      }

      insertStmt.run(
        code,
        today,
        result.estimated_change_pct,
        result.confidence,
        result.stock_coverage_pct,
        result.holdings_date,
        Date.now(),
      );
      estimated++;

      if (estimated % 10 === 0) {
        console.log(`  ${estimated}/${candidates.length} tahmin kaydedildi`);
      }

      // Rate limit — Yahoo Finance
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`  ${code} hata: ${(err as Error).message?.slice(0, 80)}`);
      failed++;
    }
  }

  console.log(`[nav-estimate] ${estimated} tahmin kaydedildi, ${failed} başarısız`);
  return { estimated, failed };
}

export function verifyEstimates(): { verified: number; avgError: number } {
  const db = getDb();

  // Find unverified estimates where we now have actual prices
  const unverified = db
    .prepare(
      `SELECT ne.code, ne.estimate_date, ne.estimated_change_pct
       FROM nav_estimates ne
       WHERE ne.actual_change_pct IS NULL
         AND ne.estimate_date < date('now')
       ORDER BY ne.estimate_date DESC`,
    )
    .all() as Array<{ code: string; estimate_date: string; estimated_change_pct: number }>;

  if (unverified.length === 0) {
    console.log('[nav-verify] Doğrulanacak tahmin yok');
    return { verified: 0, avgError: 0 };
  }

  const updateStmt = db.prepare(
    `UPDATE nav_estimates SET actual_change_pct = ?, accuracy_error = ?, verified_at = ?
     WHERE code = ? AND estimate_date = ?`,
  );

  let verified = 0;
  let totalError = 0;

  for (const est of unverified) {
    // Get actual return for that date from metrics or prices
    const priceRow = db
      .prepare(
        `SELECT p1.price as price_on_date,
                (SELECT price FROM prices WHERE code = ? AND date < ? ORDER BY date DESC LIMIT 1) as prev_price
         FROM prices p1
         WHERE p1.code = ? AND p1.date = ?`,
      )
      .get(est.code, est.estimate_date, est.code, est.estimate_date) as {
      price_on_date: number;
      prev_price: number;
    } | undefined;

    if (!priceRow || !priceRow.prev_price || priceRow.prev_price <= 0) continue;

    const actualChange = ((priceRow.price_on_date - priceRow.prev_price) / priceRow.prev_price) * 100;
    const error = Math.abs(est.estimated_change_pct - actualChange);

    updateStmt.run(actualChange, error, Date.now(), est.code, est.estimate_date);
    verified++;
    totalError += error;
  }

  const avgError = verified > 0 ? totalError / verified : 0;
  console.log(
    `[nav-verify] ${verified} tahmin doğrulandı, ortalama hata: %${avgError.toFixed(3)}`,
  );
  return { verified, avgError };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verifyOnly = process.argv.includes('--verify-only');

  (async () => {
    if (!verifyOnly) {
      await runEstimates();
    }
    verifyEstimates();
    process.exit(0);
  })().catch((err) => {
    console.error('[nav-estimate] hata:', err);
    process.exit(1);
  });
}
