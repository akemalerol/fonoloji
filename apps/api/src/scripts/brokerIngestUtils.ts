/**
 * Aracı kurum (broker) analist ingest'lerinin ortak yardımcıları.
 *
 * Her broker (isyatirim, ykyatirim, ...) için run log'u + toplu upsert sunar.
 * broker_recommendations + broker_runs tablolarına yazar.
 */

import type { Database } from 'better-sqlite3';
import { getDb } from '../db/index.js';

export interface BrokerRecommendation {
  ticker: string;
  name?: string | null;
  closePrice?: number | null;
  targetPrice?: number | null;
  potentialPct?: number | null;
  recommendation?: string | null;
  peRatio?: number | null;
  marketCapMnTl?: number | null;
  weightPct?: number | null;
  entryDate?: string | null;
  reportTitle?: string | null;
  reportUrl?: string | null;
}

export interface BrokerRunHandle {
  runId: number;
  startedAt: number;
  finalize: (status: 'ok' | 'error', total: number, tagged: number, errorMessage: string | null, errors?: number) => void;
}

/**
 * broker_runs'a "running" status ile yeni satır açar. finalize() ile kapatılır.
 */
export function startBrokerRun(broker: string, trigger: 'cron' | 'manual'): BrokerRunHandle {
  const db = getDb();
  const startedAt = Date.now();
  const runId = Number(
    db
      .prepare(
        `INSERT INTO broker_runs (broker, started_at, trigger, status) VALUES (?, ?, ?, 'running')`,
      )
      .run(broker, startedAt, trigger).lastInsertRowid,
  );

  const finalize = (
    status: 'ok' | 'error',
    total: number,
    tagged: number,
    errorMessage: string | null,
    errors = 0,
  ) => {
    const fin = Date.now();
    db.prepare(
      `UPDATE broker_runs
         SET finished_at = ?, duration_ms = ?, total = ?, tagged = ?, errors = ?,
             error_message = ?, status = ?
         WHERE id = ?`,
    ).run(fin, fin - startedAt, total, tagged, errors, errorMessage, status, runId);
  };

  return { runId, startedAt, finalize };
}

/**
 * Belirli bir broker için tüm hisse tavsiyelerini transactional upsert eder.
 * Çağrıdan önce broker için eski kayıtları silmez — "silinmiş" (artık önerilmeyen)
 * hisselerin kalıntılarını bırakır. Bu yüzden caller her run'da "bu broker için
 * kapsamdaki ticker seti"ni de verip fark silebilir (snapshot modeli).
 *
 * @param broker — tablo key'i ('isyatirim', 'ykyatirim'...)
 * @param asOfDate — YYYY-MM-DD snapshot tarihi
 * @param rows — tavsiye kayıtları
 * @param opts.replaceAll — true ise upsert öncesi broker'ın tüm kayıtları silinir
 *                         (snapshot replace). False/undefined → merge upsert.
 */
export function upsertBrokerRecommendations(
  broker: string,
  asOfDate: string,
  rows: BrokerRecommendation[],
  opts?: { replaceAll?: boolean },
): number {
  const db = getDb();
  const now = Date.now();

  const upsert = db.prepare(
    `INSERT INTO broker_recommendations
       (broker, ticker, name, close_price, target_price, potential_pct,
        recommendation, pe_ratio, market_cap_mn_tl, weight_pct,
        entry_date, report_title, report_url, as_of_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(broker, ticker) DO UPDATE SET
       name = excluded.name,
       close_price = excluded.close_price,
       target_price = excluded.target_price,
       potential_pct = excluded.potential_pct,
       recommendation = excluded.recommendation,
       pe_ratio = excluded.pe_ratio,
       market_cap_mn_tl = excluded.market_cap_mn_tl,
       weight_pct = excluded.weight_pct,
       entry_date = excluded.entry_date,
       report_title = excluded.report_title,
       report_url = excluded.report_url,
       as_of_date = excluded.as_of_date,
       updated_at = excluded.updated_at`,
  );

  const tx = db.transaction((items: BrokerRecommendation[]) => {
    if (opts?.replaceAll) {
      db.prepare(`DELETE FROM broker_recommendations WHERE broker = ?`).run(broker);
    }
    let count = 0;
    for (const r of items) {
      const t = r.ticker?.trim().toUpperCase();
      if (!t || t.length > 10) continue;
      upsert.run(
        broker,
        t,
        r.name ?? null,
        r.closePrice ?? null,
        r.targetPrice ?? null,
        r.potentialPct ?? null,
        r.recommendation ?? null,
        r.peRatio ?? null,
        r.marketCapMnTl ?? null,
        r.weightPct ?? null,
        r.entryDate ?? null,
        r.reportTitle ?? null,
        r.reportUrl ?? null,
        asOfDate,
        now,
      );
      count++;
    }
    return count;
  });

  return tx(rows);
}

/**
 * Başka bir db instance (test) almak isteyenler için.
 */
export function getBrokerDb(): Database {
  return getDb();
}
