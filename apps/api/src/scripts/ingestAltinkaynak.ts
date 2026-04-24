/**
 * Altınkaynak anlık altın/döviz piyasası ingest'i.
 *
 * Kaynak: https://static.altinkaynak.com/Store_Main  (özet, 7 kayıt)
 *         https://static.altinkaynak.com/Store_Gold  (detay, 24 kayıt)
 *
 * Public CDN, auth yok, ~60 sn cache. Bizim cron: 5 dk → snapshot + history
 * + günün kapanış tablosu (idempotent günlük upsert).
 *
 * Neden yahoo'ya ek?
 *   - Yahoo sadece ons/gram altın spot; bizde çeyrek/yarım/tam/cumhuriyet/
 *     22-18-14 ayar/bilezik fiziki ürün fiyatları yok.
 *   - Yahoo single value; Altınkaynak alış/satış spread'li (TR döviz bürosu).
 *
 * Not: Altınkaynak saati UTC offset yazmıyor ama "24.04.2026 16:06:41"
 * formatında TR (+03) ile gönderiyor. JS Date parse'e bırakmayıp
 * fetched_at = Date.now() kullanıyoruz (sunucu TR timezone'da).
 */

import { getDb } from '../db/index.js';

const STORE_MAIN = 'https://static.altinkaynak.com/Store_Main';
const STORE_GOLD = 'https://static.altinkaynak.com/Store_Gold';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

interface MainItem {
  code: string;
  value: string;
  buy: string | null;
  sell: string | null;
  time: string;
  IsBulk: boolean | null;
  change: number | null;
}
interface GoldItem {
  Id: number;
  Alis: string;
  Satis: string;
  Kod: string;
  Aciklama: string;
  MobilAciklama: string | null;
  GuncellenmeZamani: string;
  Main: boolean;
  DataGroup: number;
  WebGroup: number | null;
  WidgetAciklama: string | null;
  IsBulk: boolean;
  Change: number | null;
}

/** "6.770,22" → 6770.22, "45,012" → 45.012, "6.737,92" → 6737.92 */
function parseNumber(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!t || t === '-') return null;
  const cleaned = t.replace(/[^\d.,+\-]/g, '');
  if (!cleaned) return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let norm: string;
  if (hasComma && hasDot) {
    // "6.770,22" — TR format: . = binlik, , = ondalık
    norm = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // "45,012" — virgül = ondalık
    norm = cleaned.replace(',', '.');
  } else {
    norm = cleaned;
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Altınkaynak ${url} HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Altınkaynak tarih string'i: "24.04.2026 16:06:41" (TR local).
 * Server TR timezone'da → basit parse yeterli.
 */
function parseTrDatetime(s: string): string {
  const m = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}+03:00`;
}

export interface AltinkaynakIngestResult {
  mainCount: number;
  goldCount: number;
  historyRows: number;
  dailyRows: number;
}

export async function runAltinkaynakIngest(): Promise<AltinkaynakIngestResult> {
  const [main, gold] = await Promise.all([
    fetchJson<{ generatedAt: string; items: MainItem[] }>(STORE_MAIN),
    fetchJson<GoldItem[]>(STORE_GOLD),
  ]);

  const db = getDb();
  const now = Date.now();
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

  // Tüm kayıtları birleştirilmiş bir listede topla (code deduplication — gold
  // listesi daha zengin, onunla başlayıp main'i overlay et).
  type Row = {
    code: string;
    name: string | null;
    description: string | null;
    buy: number | null;
    sell: number | null;
    value: number | null;
    change_pct: number | null;
    is_bulk: 0 | 1;
    data_group: number | null;
    source_time: string | null;
  };
  const byCode = new Map<string, Row>();

  for (const g of gold) {
    if (!g.Kod) continue;
    byCode.set(g.Kod, {
      code: g.Kod,
      name: g.MobilAciklama ?? g.WidgetAciklama ?? null,
      description: g.Aciklama ?? null,
      buy: parseNumber(g.Alis),
      sell: parseNumber(g.Satis),
      value: parseNumber(g.Satis),
      change_pct: typeof g.Change === 'number' ? g.Change : null,
      is_bulk: g.IsBulk ? 1 : 0,
      data_group: typeof g.DataGroup === 'number' ? g.DataGroup : null,
      source_time: parseTrDatetime(g.GuncellenmeZamani ?? ''),
    });
  }

  // Store_Main özet kayıtlarında "name" alanı yok — varsayılan isimler
  const MAIN_NAMES: Record<string, string> = {
    USD: 'ABD Doları',
    EUR: 'Euro',
    GBP: 'İngiliz Sterlini',
  };

  for (const m of main.items ?? []) {
    if (!m.code) continue;
    const existing = byCode.get(m.code);
    const row: Row = existing ?? {
      code: m.code,
      name: MAIN_NAMES[m.code] ?? m.code,
      description: null,
      buy: null,
      sell: null,
      value: null,
      change_pct: null,
      is_bulk: 0,
      data_group: null,
      source_time: null,
    };
    // Main'dan gelenler daha güncel tarih taşıyabilir; değer eksikse main'dan doldur
    row.buy = row.buy ?? parseNumber(m.buy);
    row.sell = row.sell ?? parseNumber(m.sell);
    row.value = row.value ?? parseNumber(m.value);
    if (row.change_pct === null && typeof m.change === 'number') row.change_pct = m.change;
    if (row.is_bulk === 0 && m.IsBulk) row.is_bulk = 1;
    if (!row.source_time && m.time) row.source_time = m.time; // Main zaten ISO
    byCode.set(m.code, row);
  }

  const upsertSnap = db.prepare(
    `INSERT INTO gold_prices
       (code, name, description, buy, sell, value, change_pct, is_bulk, data_group, source_time, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       name = COALESCE(excluded.name, name),
       description = COALESCE(excluded.description, description),
       buy = excluded.buy,
       sell = excluded.sell,
       value = excluded.value,
       change_pct = excluded.change_pct,
       is_bulk = excluded.is_bulk,
       data_group = COALESCE(excluded.data_group, data_group),
       source_time = excluded.source_time,
       fetched_at = excluded.fetched_at`,
  );

  const insertHistory = db.prepare(
    `INSERT OR IGNORE INTO gold_prices_history (code, fetched_at, buy, sell, change_pct)
     VALUES (?, ?, ?, ?, ?)`,
  );

  const upsertDaily = db.prepare(
    `INSERT INTO gold_daily (date, code, buy, sell, mid)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, code) DO UPDATE SET
       buy = excluded.buy,
       sell = excluded.sell,
       mid = excluded.mid`,
  );

  const purgeOldHistory = db.prepare(
    `DELETE FROM gold_prices_history WHERE fetched_at < ?`,
  );

  let historyRows = 0;
  let dailyRows = 0;
  const tx = db.transaction(() => {
    for (const r of byCode.values()) {
      upsertSnap.run(
        r.code,
        r.name,
        r.description,
        r.buy,
        r.sell,
        r.value,
        r.change_pct,
        r.is_bulk,
        r.data_group,
        r.source_time,
        now,
      );
      insertHistory.run(r.code, now, r.buy, r.sell, r.change_pct);
      historyRows++;
      const mid = r.buy !== null && r.sell !== null ? (r.buy + r.sell) / 2 : (r.sell ?? r.buy);
      upsertDaily.run(today, r.code, r.buy, r.sell, mid);
      dailyRows++;
    }
    // 180 günlük tarihçe tut; daha eskisini sil
    const cutoff = now - 180 * 86_400_000;
    purgeOldHistory.run(cutoff);
  });
  tx();

  return {
    mainCount: main.items?.length ?? 0,
    goldCount: gold.length,
    historyRows,
    dailyRows,
  };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runAltinkaynakIngest()
    .then((r) => {
      console.log('[altinkaynak] OK', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[altinkaynak] HATA', err);
      process.exit(1);
    });
}
