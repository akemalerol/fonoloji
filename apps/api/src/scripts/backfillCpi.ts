/**
 * 10-year Turkish CPI (TÜFE) backfill using TCMB EVDS API.
 *
 * EVDS API key is free — register at https://evds2.tcmb.gov.tr
 * Set env: EVDS_API_KEY=<your-key>
 *
 * Series codes:
 *   TP.FG.J0  → TÜFE yıllık değişim (YoY %)
 *   TP.FG.J1  → TÜFE aylık değişim (MoM %)
 *
 * Usage:
 *   EVDS_API_KEY=xxx npx tsx src/scripts/backfillCpi.ts
 */

import { getDb } from '../db/index.js';

const EVDS_KEY = process.env.EVDS_API_KEY ?? '';

interface EvdsItem {
  Tarih: string; // "DD-MM-YYYY"
  'TP_FG_J0'?: string;
  'TP_FG_J1'?: string;
  [key: string]: string | undefined;
}

async function fetchEvds(startDate: string, endDate: string): Promise<EvdsItem[]> {
  const url = new URL('https://evds2.tcmb.gov.tr/service/evds');
  url.searchParams.set('series', 'TP.FG.J0-TP.FG.J1');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('type', 'json');
  url.searchParams.set('key', EVDS_KEY);
  url.searchParams.set('frequency', '5'); // monthly

  console.log(`[cpi-backfill] EVDS'den çekiliyor: ${startDate} → ${endDate}`);
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`EVDS API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { items?: EvdsItem[] };
  return json.items ?? [];
}

function parseTarih(tarih: string): string {
  // "DD-MM-YYYY" → "YYYY-MM-01"
  const [d, m, y] = tarih.split('-');
  return `${y}-${m}-01`;
}

export async function runCpiBackfill(): Promise<number> {
  if (!EVDS_KEY) {
    console.error(
      '[cpi-backfill] EVDS_API_KEY env değişkeni gerekli.\n' +
        'Ücretsiz kayıt: https://evds2.tcmb.gov.tr → Üye Ol',
    );
    process.exit(1);
  }

  const db = getDb();

  const now = new Date();
  const endDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const startYear = now.getFullYear() - 10;
  const startDate = `01-01-${startYear}`;

  const items = await fetchEvds(startDate, endDate);
  if (items.length === 0) {
    console.warn('[cpi-backfill] EVDS boş döndü. API key doğru mu?');
    return 0;
  }

  const stmt = db.prepare(
    `INSERT INTO cpi_tr (date, yoy_change, mom_change, source, updated_at)
     VALUES (?, ?, ?, 'evds.tcmb.gov.tr', ?)
     ON CONFLICT(date) DO UPDATE SET
       yoy_change = COALESCE(excluded.yoy_change, yoy_change),
       mom_change = COALESCE(excluded.mom_change, mom_change),
       source = excluded.source,
       updated_at = excluded.updated_at`,
  );

  let count = 0;
  const txn = db.transaction(() => {
    for (const item of items) {
      const date = parseTarih(item.Tarih);
      const yoyRaw = item['TP_FG_J0'];
      const momRaw = item['TP_FG_J1'];
      const yoy = yoyRaw ? Number(yoyRaw) / 100 : null;
      const mom = momRaw ? Number(momRaw) / 100 : null;
      if (yoy === null && mom === null) continue;

      stmt.run(date, yoy, mom, Date.now());
      count++;
    }
  });
  txn();

  console.log(`[cpi-backfill] ${count} aylık TÜFE verisi yazıldı (${startYear}–${now.getFullYear()})`);

  // Verify
  const total = (db.prepare('SELECT COUNT(*) as c FROM cpi_tr').get() as { c: number }).c;
  console.log(`[cpi-backfill] Toplam cpi_tr kayıt: ${total}`);

  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCpiBackfill()
    .then((n) => {
      if (n === 0) process.exit(2);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cpi-backfill] hata:', err);
      process.exit(1);
    });
}
