/**
 * İş Yatırım parametrik hisse tarayıcı ingest'i.
 *
 * Public endpoint — auth yok. Günlük çalışır; fon portföyündeki hisseler için
 * analist konsensüsünü (hedef fiyat, getiri potansiyeli, AL/SAT/TUT) besler.
 *
 * Strateji:
 *   1. Geniş criteria ile tüm hisseleri tek POST'ta çek (fiyat/hedef/potansiyel/F/K/piyasa değeri)
 *   2. AL/SAT/TUT/GÖZDEN GEÇİRİLİYOR filtreleriyle 4 ek POST — her hisseye öneri etiketi iliştir
 *   3. Upsert → isyatirim_stocks (legacy) + broker_recommendations (broker='isyatirim')
 *
 * Dual-write: eski `isyatirim_stocks` tablosu admin paneli için tutuluyor; yeni
 * `broker_recommendations` tablosu multi-broker konsensüs için besleniyor.
 */

import { getDb } from '../db/index.js';
import {
  type BrokerRecommendation,
  startBrokerRun,
  upsertBrokerRecommendations,
} from './brokerIngestUtils.js';

export const ISYATIRIM_BROKER_KEY = 'isyatirim';

const ENDPOINT =
  'https://www.isyatirim.com.tr/tr-tr/analiz/_Layouts/15/IsYatirim.Website/StockInfo/CompanyInfoAjax.aspx/getScreenerDataNEW';
const REFERER =
  'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/gelismis-hisse-arama.aspx';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Field kodları (görselden): 7=kapanış, 51=hedef, 61=potansiyel%, 28=F/K, 8=piyasa değeri
const F_CLOSE = '7';
const F_TARGET = '51';
const F_POTENTIAL = '61';
const F_PE = '28';
const F_MCAP = '8';

type OneriFilter = '' | 'AL' | 'SAT' | 'TUT' | 'GÖZDEN GEÇİRİLİYOR';

interface RawStock {
  Hisse?: string;
  [k: string]: unknown;
}

async function fetchScreener(oneri: OneriFilter): Promise<RawStock[]> {
  // criterias dizisi aynı zamanda dönen alanları da belirler. Kapsam dışı kalmasın
  // diye her alan için çok geniş bir aralık koyuyoruz — potansiyel için daraltma
  // da yok; tüm İş Yatırım kapsamını çekiyoruz.
  const body = JSON.stringify({
    sektor: '',
    endeks: '',
    takip: '',
    oneri,
    criterias: [
      [F_POTENTIAL, '-9999', '9999', 'False'],
      [F_CLOSE, '-999999', '999999', 'False'],
      [F_TARGET, '-999999', '999999', 'False'],
      [F_PE, '-999999', '999999', 'False'],
      [F_MCAP, '-999999999', '999999999', 'False'],
    ],
    lang: '1055',
  });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: REFERER,
      'User-Agent': UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
    body,
  });

  if (!res.ok) throw new Error(`İş Yatırım API HTTP ${res.status}`);
  const wrapper = (await res.json()) as { d?: string };
  if (!wrapper?.d) throw new Error('İş Yatırım yanıtı boş (d alanı yok)');
  const arr = JSON.parse(wrapper.d);
  if (!Array.isArray(arr)) throw new Error('İş Yatırım yanıtı array değil');
  return arr as RawStock[];
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === '-' || s === 'n/a' || s === 'N/A') return null;
  // İş Yatırım hem "64.49" hem "1.234,56" döndürebiliyor — formatı ayırt et:
  //   "1.234,56" (TR) → "." binlik, "," ondalık
  //   "64.49"   (EN) → "." ondalık
  //   "4,16"    (TR) → "," ondalık
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  let normalized: string;
  if (hasComma && hasDot) normalized = s.replace(/\./g, '').replace(',', '.');
  else if (hasComma) normalized = s.replace(',', '.');
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function splitHisse(h: string): { ticker: string; name: string | null } {
  // "THYAO - Türk Hava Yolları" veya "THYAO" tek başına
  const parts = h.split(/\s*-\s*/);
  const ticker = (parts[0] ?? '').trim().toUpperCase();
  const name = parts.slice(1).join(' - ').trim() || null;
  return { ticker, name };
}

export interface IsyatirimIngestResult {
  total: number;
  tagged: number;
  errors: number;
  asOfDate: string;
  runId: number;
}

export async function runIsyatirimIngest(opts?: { trigger?: 'cron' | 'manual' }): Promise<IsyatirimIngestResult> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const trigger = opts?.trigger ?? 'cron';
  let errors = 0;

  // Log satırını önce "running" olarak aç; hata olsa bile finished_at + status yazacağız.
  // Dual-write: eski isyatirim_runs (admin uyumluluk) + yeni broker_runs (multi-broker)
  const runId = Number(
    db
      .prepare(
        `INSERT INTO isyatirim_runs (started_at, trigger, status) VALUES (?, ?, 'running')`,
      )
      .run(now, trigger).lastInsertRowid,
  );
  const brokerRun = startBrokerRun(ISYATIRIM_BROKER_KEY, trigger);

  const finalize = (status: 'ok' | 'error', totalCount: number, taggedCount: number, errMsg: string | null) => {
    const fin = Date.now();
    db.prepare(
      `UPDATE isyatirim_runs SET finished_at = ?, duration_ms = ?, total = ?, tagged = ?, errors = ?, error_message = ?, status = ? WHERE id = ?`,
    ).run(fin, fin - now, totalCount, taggedCount, errors, errMsg, status, runId);
    brokerRun.finalize(status, totalCount, taggedCount, errMsg, errors);
  };

  let all: RawStock[];
  try {
    console.log('[isyatirim] Tüm hisseler çekiliyor...');
    all = await fetchScreener('');
    console.log(`[isyatirim] ${all.length} hisse bulundu`);
  } catch (err) {
    finalize('error', 0, 0, String(err instanceof Error ? err.message : err));
    throw err;
  }

  // Öneri etiketi için 4 ek çağrı — her filtreden dönen hisseye etiket koy
  const recMap = new Map<string, string>();
  const recFilters: OneriFilter[] = ['AL', 'SAT', 'TUT', 'GÖZDEN GEÇİRİLİYOR'];
  for (const rec of recFilters) {
    try {
      await new Promise((r) => setTimeout(r, 400)); // nazik bekleme
      const rows = await fetchScreener(rec);
      for (const row of rows) {
        const { ticker } = splitHisse(String(row.Hisse ?? ''));
        if (ticker) recMap.set(ticker, rec);
      }
      console.log(`[isyatirim] ${rec}: ${rows.length} hisse`);
    } catch (err) {
      errors++;
      console.error(`[isyatirim] ${rec} filtresi hatası:`, err);
    }
  }

  const upsert = db.prepare(
    `INSERT INTO isyatirim_stocks
       (ticker, name, close_price, target_price, potential_pct, pe_ratio, market_cap_mn_tl, recommendation, as_of_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       name = excluded.name,
       close_price = excluded.close_price,
       target_price = excluded.target_price,
       potential_pct = excluded.potential_pct,
       pe_ratio = excluded.pe_ratio,
       market_cap_mn_tl = excluded.market_cap_mn_tl,
       recommendation = excluded.recommendation,
       as_of_date = excluded.as_of_date,
       updated_at = excluded.updated_at`,
  );

  const brokerRows: BrokerRecommendation[] = [];

  const tx = db.transaction((rows: RawStock[]) => {
    for (const r of rows) {
      const { ticker, name } = splitHisse(String(r.Hisse ?? ''));
      if (!ticker || ticker.length > 10) continue;
      const closePrice = parseNumber(r[F_CLOSE]);
      const targetPrice = parseNumber(r[F_TARGET]);
      const potentialPct = parseNumber(r[F_POTENTIAL]);
      const peRatio = parseNumber(r[F_PE]);
      const marketCap = parseNumber(r[F_MCAP]);
      const recommendation = recMap.get(ticker) ?? null;
      upsert.run(
        ticker,
        name,
        closePrice,
        targetPrice,
        potentialPct,
        peRatio,
        marketCap,
        recommendation,
        today,
        now,
      );
      brokerRows.push({
        ticker,
        name,
        closePrice,
        targetPrice,
        potentialPct,
        peRatio,
        marketCapMnTl: marketCap,
        recommendation,
      });
    }
  });
  tx(all);

  // Yeni generic tabloya da yaz (multi-broker konsensüs için)
  upsertBrokerRecommendations(ISYATIRIM_BROKER_KEY, today, brokerRows, { replaceAll: true });

  finalize(errors === 0 ? 'ok' : 'error', all.length, recMap.size, null);

  return {
    total: all.length,
    tagged: recMap.size,
    errors,
    asOfDate: today,
    runId,
  };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runIsyatirimIngest()
    .then((r) => {
      console.log('[isyatirim] OK', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[isyatirim] HATA', err);
      process.exit(1);
    });
}
