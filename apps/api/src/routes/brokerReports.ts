/**
 * Broker raporları — PDF viewer için inline endpoint.
 *
 * Stratejisi:
 *   - Native PDF'ler (Ziraat, Garanti): kaynaktan download edip inline pipe et.
 *     URL discovery broker_runs/broker_recommendations'tan değil, her seferinde
 *     canlı listing sayfasından (en güncel rapor mantığı).
 *   - API-based (İş Yatırım, YKY): DB'den oku, pdfkit ile tablo PDF'i üret.
 *
 * Tüm PDF'ler `Content-Disposition: inline`, `Cache-Control: private, max-age=900`.
 * iframe'de `#toolbar=0&navpanes=0` ile indirme butonu gizlenir (Chrome/Edge).
 */

import type { FastifyPluginAsync } from 'fastify';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { getDb } from '../db/index.js';
import { downloadPdf } from '../scripts/pdfUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Font dosyaları: derlemede dist/apps/api/src/routes/ altına düştüğü için
// ../../../assets hesapla. Prod'da /usr/share/fonts fallback da var.
const FONT_CANDIDATES = [
  join(__dirname, '../../../assets/DejaVuSans.ttf'),
  join(__dirname, '../../assets/DejaVuSans.ttf'),
  join(__dirname, '../assets/DejaVuSans.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];
const FONT_BOLD_CANDIDATES = [
  join(__dirname, '../../../assets/DejaVuSans-Bold.ttf'),
  join(__dirname, '../../assets/DejaVuSans-Bold.ttf'),
  join(__dirname, '../assets/DejaVuSans-Bold.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];

function findFont(candidates: string[]): string {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Font bulunamadı: ${candidates.join(', ')}`);
}

const FONT_PATH = findFont(FONT_CANDIDATES);
const FONT_BOLD_PATH = findFont(FONT_BOLD_CANDIDATES);

interface BrokerMeta {
  label: string;
  subtitle: string;
  disclaimer: string;
}
const BROKER_META: Record<string, BrokerMeta> = {
  isyatirim: {
    label: 'İş Yatırım',
    subtitle: 'Analist Hedef Fiyat ve Öneri Listesi',
    disclaimer:
      'Bilgi amaçlıdır; yatırım tavsiyesi değildir. Kaynak: İş Yatırım Menkul Değerler A.Ş. parametrik hisse tarayıcısı.',
  },
  ykyatirim: {
    label: 'Yapı Kredi Yatırım',
    subtitle: 'Model Portföy',
    disclaimer:
      'Bilgi amaçlıdır; yatırım tavsiyesi değildir. Kaynak: Yapı Kredi Yatırım Menkul Değerler A.Ş. araştırma bölümü.',
  },
};

/** DB'den broker verilerini çekerek tablo PDF'i üret. Stream yerine Buffer. */
async function generateDbPdf(broker: string): Promise<Buffer> {
  const meta = BROKER_META[broker];
  if (!meta) throw new Error(`Bilinmeyen broker: ${broker}`);

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ticker, name, close_price, target_price, potential_pct,
              recommendation, market_cap_mn_tl, entry_date, as_of_date
       FROM broker_recommendations
       WHERE broker = ?
       ORDER BY COALESCE(market_cap_mn_tl, 0) DESC, ticker ASC`,
    )
    .all(broker) as Array<{
    ticker: string;
    name: string | null;
    close_price: number | null;
    target_price: number | null;
    potential_pct: number | null;
    recommendation: string | null;
    market_cap_mn_tl: number | null;
    entry_date: string | null;
    as_of_date: string;
  }>;

  const asOf = rows[0]?.as_of_date ?? new Date().toISOString().slice(0, 10);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Sans', FONT_PATH);
    doc.registerFont('SansBold', FONT_BOLD_PATH);

    // Header
    doc.font('SansBold').fontSize(22).fillColor('#0f172a').text(meta.label, { align: 'center' });
    doc.font('Sans').fontSize(12).fillColor('#475569').text(meta.subtitle, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#94a3b8').text(`Güncellenme: ${asOf}`, { align: 'center' });
    doc.fontSize(9).text(`Toplam ${rows.length} hisse`, { align: 'center' });
    doc.moveDown(1);

    // Table
    // Kolonlar: Hisse (60) | Ad (130) | Kapanış (60) | Hedef (60) | Pot.% (55) | Tavsiye (60) | P.Değ (70)
    const startX = 40;
    const colW = [55, 150, 58, 58, 55, 60, 0]; // son kolon genişliği hesaplanacak
    const tableWidth = 595 - 80; // A4 width - 2*margin
    colW[6] = tableWidth - colW.slice(0, 6).reduce((a, b) => a + b, 0);

    let y = doc.y;
    const headers = ['Hisse', 'Ad', 'Kapanış', 'Hedef', 'Pot.%', 'Tavsiye', 'Piyasa Değ. (mn TL)'];

    function drawRow(cells: string[], isHeader: boolean, bgColor?: string) {
      const rowH = 18;
      if (bgColor) {
        doc.save().fillColor(bgColor).rect(startX, y, tableWidth, rowH).fill().restore();
      }
      doc.font(isHeader ? 'SansBold' : 'Sans')
        .fontSize(isHeader ? 9 : 8.5)
        .fillColor(isHeader ? '#0f172a' : '#1e293b');
      let x = startX;
      for (let i = 0; i < cells.length; i++) {
        const align = i === 0 || i === 1 ? 'left' : 'right';
        const pad = 4;
        doc.text(cells[i] ?? '', x + pad, y + 5, {
          width: colW[i]! - pad * 2,
          align,
          ellipsis: true,
          lineBreak: false,
        });
        x += colW[i]!;
      }
      y += rowH;
      // Alt çizgi
      doc.save()
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .moveTo(startX, y)
        .lineTo(startX + tableWidth, y)
        .stroke()
        .restore();
    }

    drawRow(headers, true, '#f1f5f9');

    const fmt = (v: number | null, decimals = 2) =>
      v === null || !Number.isFinite(v)
        ? '—'
        : v.toLocaleString('tr-TR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
    const fmtPct = (v: number | null) => {
      if (v === null || !Number.isFinite(v)) return '—';
      const s = v.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return `${v >= 0 ? '+' : ''}${s}%`;
    };
    const fmtMcap = (v: number | null) => {
      if (v === null || !Number.isFinite(v)) return '—';
      return v.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    };

    for (const r of rows) {
      if (y > 780) {
        doc.addPage();
        y = 40;
        drawRow(headers, true, '#f1f5f9');
      }
      const validTarget = r.target_price !== null && r.target_price > 0;
      drawRow(
        [
          r.ticker,
          r.name ?? '',
          fmt(r.close_price),
          validTarget ? fmt(r.target_price) : '—',
          validTarget ? fmtPct(r.potential_pct) : '—',
          r.recommendation ?? '—',
          fmtMcap(r.market_cap_mn_tl),
        ],
        false,
      );
    }

    doc.moveDown(2);
    doc.font('Sans').fontSize(7.5).fillColor('#94a3b8');
    doc.text(meta.disclaimer, startX, doc.y, { width: tableWidth, align: 'left' });
    doc.text(
      `Bu rapor Fonoloji tarafından derlenmiştir — veri kaynaklarının güncel analiz ve yorumları için resmi kurum yayınlarına başvurulmalıdır.`,
      startX,
      doc.y + 8,
      { width: tableWidth, align: 'left' },
    );

    doc.end();
  });
}

// --- Native PDF fetchers (her çağrıda en güncel PDF'i bulur, proxy ile döndürür) ---

async function fetchZiraatPdf(): Promise<Buffer> {
  const listUrl = 'https://www.ziraatyatirim.com.tr/tr/hisse-oneri-portfoyu';
  const res = await fetch(listUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Ziraat liste ${res.status}`);
  const html = await res.text();
  const pdfRe =
    /https:\/\/www\.ziraatyatirim\.com\.tr\/Documents\/editorfiles\/[a-f0-9-]+\.pdf/g;
  const candidates: Array<{ url: string; date: string | null }> = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pdfRe.exec(html)) !== null) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    const start = Math.max(0, m.index - 500);
    const ctx = html.slice(start, m.index + m[0].length + 100).replace(/&nbsp;|&#160;/g, ' ');
    const dm = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[Tt]arihli/.exec(ctx);
    candidates.push({
      url: m[0],
      date: dm ? `${dm[3]}-${String(dm[2]).padStart(2, '0')}-${String(dm[1]).padStart(2, '0')}` : null,
    });
  }
  if (!candidates.length) throw new Error('Ziraat PDF bulunamadı');
  candidates.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return downloadPdf(candidates[0]!.url);
}

async function fetchGarantiPdf(): Promise<Buffer> {
  const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
  const today = new Date();
  for (let i = 0; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const pretty = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const url = `https://rapor.garantibbvayatirim.com.tr/arastirma/Portfoy_Performans_${pretty}.pdf`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(6_000),
      });
      if (res.ok) return downloadPdf(url);
    } catch {
      /* continue */
    }
  }
  throw new Error('Garanti PDF bulunamadı (son 21 gün)');
}

// In-memory cache — dakikada bir tetikleme yerine 30dk serve.
interface CacheEntry {
  data: Buffer;
  fetchedAt: number;
  contentType: string;
}
const PDF_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

export const brokerReportsRoute: FastifyPluginAsync = async (app) => {
  app.get('/broker-reports/:broker', async (req, reply) => {
    const { broker } = req.params as { broker: string };

    // Cache hit?
    const cached = PDF_CACHE.get(broker);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return reply
        .type(cached.contentType)
        .header('Cache-Control', 'private, max-age=900')
        .header('Content-Disposition', `inline; filename="fonoloji-${broker}.pdf"`)
        .header('X-Frame-Options', 'SAMEORIGIN')
        .send(cached.data);
    }

    let buf: Buffer;
    try {
      if (broker === 'ziraatyatirim') {
        buf = await fetchZiraatPdf();
      } else if (broker === 'garantibbvayatirim') {
        buf = await fetchGarantiPdf();
      } else if (broker === 'isyatirim' || broker === 'ykyatirim') {
        buf = await generateDbPdf(broker);
      } else {
        return reply.code(404).send({ error: 'Bilinmeyen broker' });
      }
    } catch (err) {
      req.log.error({ err, broker }, 'broker PDF hatası');
      return reply.code(502).send({
        error: 'Rapor şu an getirilemedi',
        message: err instanceof Error ? err.message : 'Unknown',
      });
    }

    PDF_CACHE.set(broker, {
      data: buf,
      fetchedAt: Date.now(),
      contentType: 'application/pdf',
    });

    return reply
      .type('application/pdf')
      .header('Cache-Control', 'private, max-age=900')
      .header('Content-Disposition', `inline; filename="fonoloji-${broker}.pdf"`)
      .header('X-Frame-Options', 'SAMEORIGIN')
      .send(buf);
  });

  // Broker meta listesi (keşif sayfası için)
  app.get('/broker-reports', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT broker, COUNT(*) as stock_count, MAX(as_of_date) as as_of_date
         FROM broker_recommendations
         GROUP BY broker`,
      )
      .all() as Array<{ broker: string; stock_count: number; as_of_date: string | null }>;

    const labels: Record<string, { label: string; kind: 'native' | 'generated'; cadence: string }> = {
      isyatirim: { label: 'İş Yatırım', kind: 'generated', cadence: 'Her iş günü (kapanış sonrası)' },
      ykyatirim: { label: 'Yapı Kredi Yatırım', kind: 'generated', cadence: 'Pzt/Çar/Cum' },
      ziraatyatirim: { label: 'Ziraat Yatırım', kind: 'native', cadence: 'Aylık (model portföy)' },
      garantibbvayatirim: {
        label: 'Garanti BBVA Yatırım',
        kind: 'native',
        cadence: 'Haftalık (Pzt/Çar)',
      },
    };

    return {
      items: Object.keys(labels).map((b) => {
        const row = rows.find((r) => r.broker === b);
        return {
          broker: b,
          label: labels[b]!.label,
          kind: labels[b]!.kind,
          cadence: labels[b]!.cadence,
          stockCount: row?.stock_count ?? 0,
          asOfDate: row?.as_of_date ?? null,
        };
      }),
    };
  });
};
