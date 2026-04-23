/**
 * Yapı Kredi Yatırım Model Portföy ingest'i.
 *
 * Public JSON endpoint (auth yok):
 *   GET https://www.ykyatirim.com.tr/DetailPage/GetModelPortfolio
 *
 * İş Yatırım'dan farkı: tüm BIST'i tarama DEĞİL; YKY Araştırma'nın kendi seçtiği
 * ~10-15 hisselik **model portföy** listesi. Her satırda:
 *   - instrument (ticker)
 *   - price (öneri tarihindeki giriş fiyatı)
 *   - targetPrice (hedef fiyat)
 *   - profitRate (teorik potansiyel — giriş fiyatına göre)
 *   - closePrice (son güncel fiyat)
 *   - realProfitRate (güncel fiyata göre kalan potansiyel)
 *   - proposeDate (model portföye giriş tarihi)
 *   - reportFilePath (ilgili araştırma raporu tokenı)
 *   - reportTitle (rapor başlığı)
 *
 * YKY "AL/SAT/TUT" etiketi döndürmüyor — model portföyde listelenen her hisse
 * fiilen "AL" demek (giriş sinyali). Bu yüzden recommendation = 'AL'.
 * Model portföyden çıkarılan hisse listede görünmez → broker_recommendations'tan
 * da snapshot replace ile silinir.
 *
 * Güncelleme cadence: closePrice günlük kapanış sonrası değişir ama proposeDate
 * / targetPrice sadece yeni rapor yayınlanınca değişir (haftalar mertebesinde).
 * Cron: haftada 3x (Pzt/Çar/Cum 18:20) — hem fiyat güncel hem rapor kaçmaz.
 */

import {
  type BrokerRecommendation,
  startBrokerRun,
  upsertBrokerRecommendations,
} from './brokerIngestUtils.js';

export const YKYATIRIM_BROKER_KEY = 'ykyatirim';

const ENDPOINT = 'https://www.ykyatirim.com.tr/DetailPage/GetModelPortfolio';
const REFERER = 'https://www.ykyatirim.com.tr/model-portfoy';
const REPORT_BASE = 'https://www.ykyatirim.com.tr/DetailPage/GetFilePath?url=';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

interface YkyRawItem {
  instrument: string;
  instrumentDesc: string | null;
  price: number;
  targetPrice: number;
  profitRate: number;
  proposeDate: string; // ISO "2025-10-16T00:00:00+03:00"
  status: number;
  closePrice: number;
  stockPriceUpdateDate: string; // "22.04.2026 18:19:01"
  realProfitRate: number;
  offer: unknown;
  value: string;
  label: string;
  reportFilePath: string | null;
  reportTitle: string | null;
}

async function fetchModelPortfolio(): Promise<YkyRawItem[]> {
  const res = await fetch(ENDPOINT, {
    method: 'GET',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      Referer: REFERER,
    },
  });
  if (!res.ok) throw new Error(`YKY API HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('YKY yanıtı array değil');
  return data as YkyRawItem[];
}

function isoToDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // "2025-10-16T00:00:00+03:00" → "2025-10-16"
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1]! : null;
}

export interface YkyatirimIngestResult {
  total: number;
  tagged: number;
  errors: number;
  asOfDate: string;
  runId: number;
}

export async function runYkyatirimIngest(opts?: {
  trigger?: 'cron' | 'manual';
}): Promise<YkyatirimIngestResult> {
  const today = new Date().toISOString().slice(0, 10);
  const trigger = opts?.trigger ?? 'cron';
  const run = startBrokerRun(YKYATIRIM_BROKER_KEY, trigger);

  let items: YkyRawItem[];
  try {
    console.log('[ykyatirim] Model portföy çekiliyor...');
    items = await fetchModelPortfolio();
    console.log(`[ykyatirim] ${items.length} hisse döndü`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    run.finalize('error', 0, 0, msg, 1);
    throw err;
  }

  const rows: BrokerRecommendation[] = [];
  for (const it of items) {
    const ticker = (it.instrument ?? '').trim().toUpperCase();
    if (!ticker) continue;
    const reportUrl =
      it.reportFilePath && it.reportFilePath.trim()
        ? REPORT_BASE + encodeURIComponent(it.reportFilePath)
        : null;
    rows.push({
      ticker,
      name: it.instrumentDesc ?? null,
      closePrice: Number.isFinite(it.closePrice) ? it.closePrice : null,
      // price (giriş fiyatı) değil, realProfitRate güncel potansiyel olduğu için
      // potentialPct olarak onu kullanmak fon kartındaki "ne kadar yükselir" için doğru.
      targetPrice: Number.isFinite(it.targetPrice) ? it.targetPrice : null,
      potentialPct: Number.isFinite(it.realProfitRate)
        ? Math.round(it.realProfitRate * 100) / 100
        : null,
      // Model portföyde listelenen hisse = AL sinyali
      recommendation: 'AL',
      entryDate: isoToDate(it.proposeDate),
      reportTitle: it.reportTitle ?? null,
      reportUrl,
    });
  }

  try {
    // replaceAll: çıkarılan hisseleri temizle (snapshot davranışı)
    const written = upsertBrokerRecommendations(YKYATIRIM_BROKER_KEY, today, rows, {
      replaceAll: true,
    });
    run.finalize('ok', items.length, written, null, 0);
    console.log(`[ykyatirim] ${written} kayıt yazıldı`);
    return {
      total: items.length,
      tagged: written,
      errors: 0,
      asOfDate: today,
      runId: run.runId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    run.finalize('error', items.length, 0, msg, 1);
    throw err;
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runYkyatirimIngest()
    .then((r) => {
      console.log('[ykyatirim] OK', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ykyatirim] HATA', err);
      process.exit(1);
    });
}
