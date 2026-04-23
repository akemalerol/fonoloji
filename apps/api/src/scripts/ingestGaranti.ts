/**
 * Garanti BBVA Yatırım Model Portföy PDF ingest'i.
 *
 * PDF URL pattern deterministik (tarih tabanlı):
 *   https://rapor.garantibbvayatirim.com.tr/arastirma/Portfoy_Performans_DD.MM.YYYY.pdf
 *
 * Cadence: haftalık (genelde Pazartesi çevresi) — yeni rapor yayınlanmadığı
 * günlerde 404 döner. Bu yüzden son N günü bugünden geriye doğru tarıyoruz,
 * ilk 200 dönen PDF'i alıyoruz (= en yeni).
 *
 * Tablo (İngilizce başlıklar, TR sayı formatı DEĞİL — nokta decimal):
 *   Stock | Included on | Weights | Share Price on Inclusion TL |
 *   Last Session Closing Price TL | Nominal return | Relative Perf. | 12-M Target Share Price
 *
 * PDF'de AL/TUT/SAT etiketi yok → model portföyde yer almak = AL sinyali.
 */

import {
  type BrokerRecommendation,
  startBrokerRun,
  upsertBrokerRecommendations,
} from './brokerIngestUtils.js';
import { downloadPdf, pdfToText, parseTurkishDate } from './pdfUtils.js';

export const GARANTI_BROKER_KEY = 'garantibbvayatirim';

const BASE_URL = 'https://rapor.garantibbvayatirim.com.tr/arastirma/';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

/** Bugünden geriye doğru en fazla N gün tarar; ilk 200 dönen PDF'in URL + tarihini döndürür. */
async function discoverLatestPdf(maxDaysBack = 21): Promise<{ url: string; date: string }> {
  const today = new Date();
  for (let i = 0; i <= maxDaysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const pretty = `${day}.${month}.${year}`;
    const url = `${BASE_URL}Portfoy_Performans_${pretty}.pdf`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const isoDate = `${year}-${month}-${day}`;
        console.log(`[garanti] Bulundu: ${pretty} (${i}gün önce)`);
        return { url, date: isoDate };
      }
    } catch {
      // network hatası, diğer tarihle devam et
    }
  }
  throw new Error(`Garanti: Son ${maxDaysBack} günde PDF bulunamadı`);
}

/** PDF text'inden hisse satırlarını regex ile çıkar. */
function parseRows(text: string): BrokerRecommendation[] {
  const rows: BrokerRecommendation[] = [];
  // "* TICKER  DD.MM.YYYY  W.W%  P.PP  P.PP  +N.N%  +N.N%  T.TT"
  // İlk kolonda bazı tickerlar * prefix taşıyor (BIST Participation Index üyesi) — atla.
  // Sayılar EN format (nokta decimal): `70.11`, `124.60`. Binlik yok (hep <1000 veya 3 haneli).
  const rowRe =
    /^\s*\*?\s*([A-Z]{3,6})\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null) {
    const [, ticker, inclDate, weight, , closePrice, , , target] = m;
    const closeNum = Number(closePrice);
    const targetNum = Number(target);
    const weightNum = Number(weight);
    if (!ticker || !Number.isFinite(closeNum) || !Number.isFinite(targetNum)) continue;
    const potentialPct = closeNum > 0 ? ((targetNum - closeNum) / closeNum) * 100 : null;
    rows.push({
      ticker,
      closePrice: closeNum,
      targetPrice: targetNum,
      potentialPct: potentialPct !== null ? Math.round(potentialPct * 100) / 100 : null,
      weightPct: Number.isFinite(weightNum) ? weightNum : null,
      recommendation: 'AL', // Model portföyde olmak = AL sinyali
      entryDate: parseTurkishDate(inclDate ?? ''),
    });
  }
  return rows;
}

export interface GarantiIngestResult {
  total: number;
  tagged: number;
  errors: number;
  asOfDate: string;
  pdfUrl: string;
  runId: number;
}

export async function runGarantiIngest(opts?: {
  trigger?: 'cron' | 'manual';
}): Promise<GarantiIngestResult> {
  const trigger = opts?.trigger ?? 'cron';
  const run = startBrokerRun(GARANTI_BROKER_KEY, trigger);

  let latest: { url: string; date: string };
  let rows: BrokerRecommendation[];
  try {
    console.log('[garanti] En yeni PDF aranıyor...');
    latest = await discoverLatestPdf();

    console.log(`[garanti] PDF indiriliyor: ${latest.url}`);
    const buf = await downloadPdf(latest.url);
    console.log(`[garanti] PDF boyutu: ${buf.length} bytes`);

    const text = await pdfToText(buf);
    rows = parseRows(text);
    console.log(`[garanti] Parse edilen hisse: ${rows.length}`);

    if (rows.length === 0) {
      throw new Error('PDF parse edilemedi — hisse satırı bulunamadı (format değişmiş olabilir)');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    run.finalize('error', 0, 0, msg, 1);
    throw err;
  }

  try {
    const written = upsertBrokerRecommendations(GARANTI_BROKER_KEY, latest.date, rows, {
      replaceAll: true,
    });
    run.finalize('ok', rows.length, written, null, 0);
    console.log(`[garanti] ${written} kayıt yazıldı (as_of=${latest.date})`);
    return {
      total: rows.length,
      tagged: written,
      errors: 0,
      asOfDate: latest.date,
      pdfUrl: latest.url,
      runId: run.runId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    run.finalize('error', rows.length, 0, msg, 1);
    throw err;
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runGarantiIngest()
    .then((r) => {
      console.log('[garanti] OK', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[garanti] HATA', err);
      process.exit(1);
    });
}
