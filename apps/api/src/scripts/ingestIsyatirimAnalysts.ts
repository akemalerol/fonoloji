/**
 * İş Yatırım parametrik hisse tarayıcı ingest'i.
 *
 * Public endpoint — auth yok. Günlük çalışır; fon portföyündeki hisseler için
 * analist konsensüsünü (hedef fiyat, getiri potansiyeli, AL/SAT/TUT) besler.
 *
 * Strateji:
 *   1. Geniş criteria ile tüm hisseleri tek POST'ta çek (fiyat/hedef/potansiyel/F/K/piyasa değeri)
 *   2. AL/SAT/TUT/GÖZDEN GEÇİRİLİYOR filtreleriyle 4 ek POST — her hisseye öneri etiketi iliştir
 *   3. Upsert → isyatirim_stocks tablosu
 */

import { getDb } from '../db/index.js';

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
  const body = JSON.stringify({
    sektor: '',
    endeks: '',
    takip: '',
    oneri,
    // geniş aralık — tüm kapsamdaki hisseleri getirsin
    criterias: [[F_POTENTIAL, '-9999', '9999', 'False']],
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
  const s = String(v).trim();
  if (!s || s === '-' || s === 'n/a' || s === 'N/A') return null;
  // Türk formatı: "1.234,56" → 1234.56
  const normalized = s.replace(/\./g, '').replace(',', '.');
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
}

export async function runIsyatirimIngest(): Promise<IsyatirimIngestResult> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  let errors = 0;

  console.log('[isyatirim] Tüm hisseler çekiliyor...');
  const all = await fetchScreener('');
  console.log(`[isyatirim] ${all.length} hisse bulundu`);

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

  const tx = db.transaction((rows: RawStock[]) => {
    for (const r of rows) {
      const { ticker, name } = splitHisse(String(r.Hisse ?? ''));
      if (!ticker || ticker.length > 10) continue;
      upsert.run(
        ticker,
        name,
        parseNumber(r[F_CLOSE]),
        parseNumber(r[F_TARGET]),
        parseNumber(r[F_POTENTIAL]),
        parseNumber(r[F_PE]),
        parseNumber(r[F_MCAP]),
        recMap.get(ticker) ?? null,
        today,
        now,
      );
    }
  });
  tx(all);

  return {
    total: all.length,
    tagged: recMap.size,
    errors,
    asOfDate: today,
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
