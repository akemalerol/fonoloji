/**
 * Ziraat Yatırım "Hisse Öneri Portföyü" PDF ingest'i.
 *
 * Cadence: aylık-iki aylık (yayına göre). Liste sayfasında genelde 2 PDF olur:
 *   güncel + bir önceki. Biz HER ZAMAN listedeki en yeni PDF'i seçip işliyoruz.
 *
 * 1. Liste sayfası HTML'i çek (ziraatyatirim.com.tr/tr/hisse-oneri-portfoyu)
 * 2. Sayfadaki her PDF linki için çevresindeki "DD.MM.YYYY Tarihli Raporumuz"
 *    ibaresini ara; en geç tarihli olanı seç.
 * 3. PDF'i indir → pdftotext -layout → tabloyu regex ile parse et.
 * 4. broker_recommendations'a upsert (replaceAll: true → eski hisseler temizlenir).
 *
 * Tablo yapısı (sayfa 2'de):
 *   Hisse Adı | Kod | Giriş Tarihi | Güncel Fiyat | Piyasa Değ. | Nominal | Görece | Hedef | Potansiyel | Ağırlık | Öneri
 */

import {
  type BrokerRecommendation,
  startBrokerRun,
  upsertBrokerRecommendations,
} from './brokerIngestUtils.js';
import { downloadPdf, pdfToText, parseTurkishNumber, parseTurkishDate } from './pdfUtils.js';

export const ZIRAAT_BROKER_KEY = 'ziraatyatirim';

const LIST_URL = 'https://www.ziraatyatirim.com.tr/tr/hisse-oneri-portfoyu';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

interface PdfCandidate {
  url: string;
  date: string | null; // YYYY-MM-DD — raporun yayın tarihi (context'ten)
}

/** Liste sayfasından tüm PDF candidate'larını + yayın tarihini çıkar. */
async function discoverLatestPdf(): Promise<PdfCandidate> {
  const res = await fetch(LIST_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`Ziraat liste sayfası HTTP ${res.status}`);
  const html = await res.text();

  const pdfRegex = /https:\/\/www\.ziraatyatirim\.com\.tr\/Documents\/editorfiles\/[a-f0-9-]+\.pdf/g;
  const candidates: PdfCandidate[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pdfRegex.exec(html)) !== null) {
    const url = m[0];
    if (seen.has(url)) continue;
    seen.add(url);
    // URL'nin ~500 karakter öncesi + 100 sonrası içinde tarih ara
    const contextStart = Math.max(0, m.index - 500);
    const contextEnd = Math.min(html.length, m.index + m[0].length + 100);
    // HTML entity'leri (&nbsp;) boşluğa çevir
    const ctx = html.slice(contextStart, contextEnd).replace(/&nbsp;|&#160;| /g, ' ');
    const dateMatch = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[Tt]arihli/.exec(ctx);
    const date = dateMatch
      ? `${dateMatch[3]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[1]).padStart(2, '0')}`
      : null;
    candidates.push({ url, date });
  }

  if (candidates.length === 0) throw new Error('Ziraat liste sayfasında PDF linki bulunamadı');

  // Tarih DESC sırala; tarihi olmayanlar sona
  candidates.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  console.log('[ziraat] PDF adayları:', candidates.map((c) => `${c.date ?? '?'} ${c.url.slice(-12)}`).join(', '));
  return candidates[0]!;
}

/** pdftotext çıktısından hisse satırlarını çıkar. */
function parseRows(text: string): BrokerRecommendation[] {
  const rows: BrokerRecommendation[] = [];

  // Ticker 3-6 büyük harf + DD.MM.YYYY anchor'ı ile satırları yakala.
  // Hisse adı asterisk olabilir (Koç Holding, Bim Mağazalar, Türk Hava Yolları)
  // Regex: (İsim) (KOD) (TARİH) (FİYAT TL) (PİYASA DEĞ) (NOMINAL%) (GÖRECE%) (HEDEF TL) (POTANSİYEL%) (AĞIRLIK%) (ÖNERİ)
  const rowRe =
    /^\s*([A-ZÇĞIİÖŞÜa-zçğıiöşü][A-ZÇĞIİÖŞÜa-zçğıiöşü. ]{2,40}?)\s+([A-Z]{3,6})\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+([\d.,]+)\s*TL\s+([\d.,]+)\s+(-?\d+(?:[.,]\d+)?)%\s+(-?\d+(?:[.,]\d+)?)%\s+([\d.,]+)\s*TL\s+(-?\d+(?:[.,]\d+)?)%\s+(\d+)%\s+(AL|TUT|SAT)\s*$/gm;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null) {
    const [, name, ticker, entryDateTr, closeStr, , , , targetStr, potentialStr, weightStr, rec] = m;
    const entryDate = parseTurkishDate(entryDateTr!);
    const closePrice = parseTurkishNumber(closeStr!);
    const targetPrice = parseTurkishNumber(targetStr!);
    const potentialPct = parseTurkishNumber(potentialStr!);
    const weightPct = parseTurkishNumber(weightStr!);
    if (!ticker || !closePrice || !targetPrice) continue;
    rows.push({
      ticker,
      name: name?.trim() ?? null,
      closePrice,
      targetPrice,
      potentialPct,
      weightPct,
      recommendation: rec as string,
      entryDate,
    });
  }

  return rows;
}

export interface ZiraatIngestResult {
  total: number;
  tagged: number;
  errors: number;
  asOfDate: string;
  pdfUrl: string;
  runId: number;
}

export async function runZiraatIngest(opts?: {
  trigger?: 'cron' | 'manual';
}): Promise<ZiraatIngestResult> {
  const trigger = opts?.trigger ?? 'cron';
  const run = startBrokerRun(ZIRAAT_BROKER_KEY, trigger);

  let latest: PdfCandidate;
  let rows: BrokerRecommendation[];
  let asOf: string;
  try {
    console.log('[ziraat] En yeni PDF aranıyor...');
    latest = await discoverLatestPdf();
    console.log(`[ziraat] Seçilen PDF: ${latest.url} (rapor tarihi: ${latest.date ?? 'bilinmiyor'})`);

    console.log('[ziraat] PDF indiriliyor...');
    const buf = await downloadPdf(latest.url);
    console.log(`[ziraat] PDF boyutu: ${buf.length} bytes`);

    // İlk 3 sayfa yeterli — tablo genelde sayfa 2'de
    const text = await pdfToText(buf, { firstPage: 1, lastPage: 3 });
    rows = parseRows(text);
    console.log(`[ziraat] Parse edilen hisse: ${rows.length}`);

    if (rows.length === 0) {
      throw new Error('PDF parse edilemedi — hisse satırı bulunamadı (format değişmiş olabilir)');
    }

    // as_of_date = raporun yayın tarihi, yoksa bugün
    asOf = latest.date ?? new Date().toISOString().slice(0, 10);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    run.finalize('error', 0, 0, msg, 1);
    throw err;
  }

  try {
    const written = upsertBrokerRecommendations(ZIRAAT_BROKER_KEY, asOf, rows, {
      replaceAll: true,
    });
    run.finalize('ok', rows.length, written, null, 0);
    console.log(`[ziraat] ${written} kayıt yazıldı (as_of=${asOf})`);
    return {
      total: rows.length,
      tagged: written,
      errors: 0,
      asOfDate: asOf,
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
  runZiraatIngest()
    .then((r) => {
      console.log('[ziraat] OK', r);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[ziraat] HATA', err);
      process.exit(1);
    });
}
