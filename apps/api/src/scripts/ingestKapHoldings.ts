/**
 * KAP Portföy Dağılım Raporu scraper.
 *
 * Flow:
 * 1. KAP bildirim API → "Portföy Dağılım Raporu" konulu bildirimleri bul
 * 2. Attachment PDF'lerini indir
 * 3. pdf-parse ile metin çıkar
 * 4. Heuristic parser ile holdings çıkar (hisse adı, oran, değer)
 * 5. fund_holdings tablosuna yaz
 *
 * Usage:
 *   npx tsx src/scripts/ingestKapHoldings.ts [--months=2] [--codes=TTE,AAV]
 */

import { execFile, execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { promisify } from 'node:util';
import { getDb } from '../db/index.js';

const execFileAsync = promisify(execFile);

const KAP_API = 'https://www.kap.org.tr/tr/api';

function getEquityFundCodes(db: ReturnType<typeof getDb>): string[] {
  const rows = db
    .prepare(
      `SELECT ps.code
       FROM portfolio_snapshots ps
       JOIN funds f ON f.code = ps.code
       JOIN (SELECT code, MAX(date) as d FROM portfolio_snapshots GROUP BY code) latest
         ON latest.code = ps.code AND latest.d = ps.date
       WHERE ps.stock >= 50
         AND f.type IS NOT NULL
         AND (f.trading_status LIKE '%TEFAS%işlem görüyor%' OR f.trading_status LIKE '%BEFAS%işlem görüyor%')
       ORDER BY ps.stock DESC`,
    )
    .all() as Array<{ code: string }>;
  return rows.map(r => r.code);
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface KapDisclosure {
  publishDate: string;
  fundCode: string;
  kapTitle: string;
  subject: string;
  disclosureIndex: number;
  attachmentCount: number;
  year: number;
  period: number;
  ruleType: string;
}

interface KapAttachment {
  objId: string;
  fileName: string;
  fileExtension: string;
}

interface ParsedHolding {
  asset_name: string;
  asset_code: string | null;
  asset_type: string;
  weight: number;
  market_value: number | null;
}

async function kapFetch<T>(path: string, body?: unknown): Promise<T> {
  const url = `${KAP_API}/${path}`;
  const args = ['-sL', '-w', '\n__HTTP__:%{http_code}', '--max-time', '30', '-A', UA,
    '-H', 'Accept-Language: tr',
    '-H', 'Content-Type: application/json',
    '-H', 'Accept: application/json',
  ];
  if (body) {
    args.push('-X', 'POST', '-d', JSON.stringify(body));
  }
  args.push(url);
  let stdout: string;
  try {
    const res = await execFileAsync('curl', args, { maxBuffer: 10_000_000 });
    stdout = res.stdout;
  } catch (err) {
    // curl exit kodu != 0 — timeout, DNS, network. Uzun "Command failed: curl ..."
    // dump'ı log'u kirletir; kısa ve anlamlı bir hata fırlat.
    const e = err as { code?: number; signal?: string; stderr?: string };
    const code = e.code ?? 'err';
    const hint =
      code === 28 ? 'timeout'
      : code === 6 ? 'dns fail'
      : code === 7 ? 'connection refused'
      : code === 35 ? 'tls handshake'
      : e.signal ? `signal ${e.signal}`
      : `exit ${code}`;
    throw new Error(`KAP ağ hatası (${hint})`);
  }

  // HTTP kodunu ayrıştır
  const httpMatch = stdout.match(/\n__HTTP__:(\d+)$/);
  const httpCode = httpMatch ? Number(httpMatch[1]) : 0;
  const body_ = httpMatch ? stdout.slice(0, httpMatch.index) : stdout;

  if (httpCode === 403 || httpCode === 429) {
    throw new Error(`KAP erişim engeli (HTTP ${httpCode})`);
  }
  if (httpCode >= 500) {
    throw new Error(`KAP sunucu hatası (HTTP ${httpCode})`);
  }
  if (httpCode !== 200) {
    throw new Error(`KAP beklenmedik HTTP ${httpCode}`);
  }

  try {
    return JSON.parse(body_) as T;
  } catch {
    if (body_.includes('IP adresiniz') || body_.includes('Access Denied') || body_.startsWith('<')) {
      throw new Error('KAP erişim engeli (IP bloğu)');
    }
    throw new Error(`KAP yanıtı parse edilemedi`);
  }
}

async function findPortfolioDisclosures(fromDate: string, toDate: string, fundCodes?: string[]): Promise<KapDisclosure[]> {
  // ÖNCELİK: bizim kap_disclosures tablomuz — 14k bildirim zaten var, KAP'ın
  // 2000-kayıtlık pagination capini aşıyor. Sadece "Portföy Dağılım Raporu"
  // subject'i al (BYF, Fon Finansal Rapor UFRS formatı, parser uyumsuz).
  const db = getDb();
  const localRows = db
    .prepare(
      `SELECT disclosure_index, fund_code, subject, kap_title, rule_type, period, year, attachment_count, publish_date
       FROM kap_disclosures
       WHERE subject = 'Portföy Dağılım Raporu'
         AND publish_date >= (strftime('%s', ?) * 1000)
         AND publish_date <= (strftime('%s', ?) * 1000) + 86400000
         AND fund_code IS NOT NULL
       ORDER BY publish_date DESC`,
    )
    .all(fromDate, toDate) as Array<{
    disclosure_index: number; fund_code: string; subject: string; kap_title: string | null;
    rule_type: string | null; period: number | null; year: number | null; attachment_count: number; publish_date: number;
  }>;

  let records: KapDisclosure[] = localRows.map((r) => ({
    publishDate: new Date(r.publish_date).toISOString(),
    fundCode: r.fund_code,
    kapTitle: r.kap_title ?? '',
    subject: r.subject,
    disclosureIndex: r.disclosure_index,
    attachmentCount: r.attachment_count,
    year: r.year ?? new Date(r.publish_date).getFullYear(),
    period: r.period ?? 0,
    ruleType: r.rule_type ?? '',
  }));

  if (fundCodes && fundCodes.length > 0) {
    const set = new Set(fundCodes.map(c => c.toUpperCase()));
    records = records.filter(d => set.has(d.fundCode));
  }

  console.log(`[kap-holdings] Lokal DB'den ${records.length} Portföy Dağılım Raporu bulundu`);
  return records;
}

async function getAttachments(disclosureIndex: number): Promise<KapAttachment[]> {
  const detail = await kapFetch<Array<{ attachments?: KapAttachment[] }>>(
    `notification/attachment-detail/${disclosureIndex}`,
  );
  const atts: KapAttachment[] = [];
  for (const item of detail) {
    if (item.attachments) atts.push(...item.attachments);
  }
  return atts;
}

async function downloadPdf(objId: string): Promise<Buffer> {
  const url = `${KAP_API}/file/download/${objId}`;
  const tmpPath = `/tmp/kap_dl_${Date.now()}.bin`;
  try {
    await execFileAsync('curl', ['-sL', '--max-time', '30', '-A', UA, '-o', tmpPath, url], { maxBuffer: 1_000_000 });
    const fs = await import('node:fs');
    let buf = fs.readFileSync(tmpPath);
    // KAP wraps PDFs in Java serialization — extract the raw PDF
    const pdfStart = buf.indexOf('%PDF');
    if (pdfStart > 0) {
      buf = buf.subarray(pdfStart);
    }
    return buf;
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}

function extractTextFromPdf(pdfBuffer: Buffer): string {
  const tmpPath = `/tmp/kap_pdf_${Date.now()}.pdf`;
  try {
    writeFileSync(tmpPath, pdfBuffer);
    const text = execFileSync('pdftotext', ['-layout', tmpPath, '-'], {
      timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
    }).toString('utf-8');
    return text;
  } catch (err) {
    console.warn(`    pdftotext hata: ${(err as Error).message?.slice(0, 100)}`);
    return '';
  } finally {
    try { unlinkSync(tmpPath); } catch {}
  }
}

function parseHoldings(text: string, fundCode: string): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  const lines = text.split('\n');

  // Detect section headers to know current asset type
  let currentSection = '';
  const sectionMap: Record<string, string> = {
    'HİSSE': 'stock',
    'HISSE': 'stock',
    'T.REPO': 'repo',
    'REPO': 'repo',
    'MEVDUAT': 'cash',
    'TPP': 'cash',
    'TAHVİL': 'government_bond',
    'BONO': 'treasury_bill',
    'DEVLET TAHVİL': 'government_bond',
    'ÖZEL SEKTÖR': 'corporate_bond',
    'EUROBOND': 'eurobond',
    'ALTIN': 'gold',
    'KIYMETLİ MADEN': 'gold',
    'VIOP': 'derivative',
    'KİRA SERTİFİKA': 'corporate_bond',
    'BORSA YATIRIM': 'fund',
    'BORÇLANMA SENET': 'corporate_bond',
    'YABANCI BORÇLANMA': 'eurobond',
    'Eurobond': 'eurobond',
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section headers
    for (const [key, type] of Object.entries(sectionMap)) {
      if (line.toUpperCase().startsWith(key) && line.length < 60) {
        currentSection = type;
        break;
      }
    }

    // Skip header/summary lines
    if (/TOPLAM|GRUP TOPLAM|MENKUL KIYMET|DÖVİZ|CİNSİ|FON PORTFÖY DEĞ|VADEYE/i.test(line)) continue;
    if (/^(I{1,3}-|A-|B-|C-|D-|E-|F-|G-|V-|VI-)/i.test(line)) continue;

    // Main pattern: line starts with ticker/ISIN + currency (TL, USD, EUR, GBP)
    const tickerMatch = line.match(/^([A-ZÇĞİÖŞÜ0-9]{2,20}(?:\s+[A-Z]{2})?)\s+(TL|USD|EUR|GBP)\s+/);
    if (tickerMatch) {
      const ticker = tickerMatch[1]!.trim();
      // Extract ISIN (TR/US/XS/etc pattern)
      const isinMatch = line.match(/([A-Z]{2}[A-Z0-9]{9,11})/);
      // Extract numbers — last 3 numbers are typically: GRUP%, FPD%, FTD%
      const allNumbers = [...line.matchAll(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,6})?)/g)].map(m => {
        return parseFloat(m[1]!.replace(/\./g, '').replace(',', '.'));
      }).filter(n => Number.isFinite(n));

      if (allNumbers.length < 3) continue;

      // FTD% is the last number — this is weight relative to total fund value
      const ftdPct = allNumbers[allNumbers.length - 1]!;
      // FPD% is second to last
      const fpdPct = allNumbers[allNumbers.length - 2]!;
      // Total value is typically 3rd from last (a large number)
      const totalValue = allNumbers.length >= 4 ? allNumbers[allNumbers.length - 4] : null;

      // Skip negative entries (short positions already netted)
      if (ftdPct <= 0) continue;
      // Skip very small positions
      if (ftdPct < 0.01) continue;

      const assetType = currentSection || 'stock';

      holdings.push({
        asset_name: ticker,
        asset_code: ticker,
        asset_type: assetType,
        weight: Math.round(ftdPct * 100) / 100,
        market_value: totalValue && totalValue > 1000 ? totalValue : null,
      });
      continue;
    }

    // Secondary pattern: line starts with asset name (for non-equity like deposits)
    // e.g. "DENİZBANK A.Ş.  TL  02/04/25  ...  2.261.300,52  100,00  0,12  0,06"
    if (currentSection) {
      const bankMatch = line.match(/^([A-ZÇĞİÖŞÜa-zçğıöşü\s.]{5,50})\s+(TL|USD|EUR)\s+/);
      if (bankMatch) {
        const allNumbers = [...line.matchAll(/(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,6})?)/g)].map(m => {
          return parseFloat(m[1]!.replace(/\./g, '').replace(',', '.'));
        }).filter(n => Number.isFinite(n));

        if (allNumbers.length >= 3) {
          const ftdPct = allNumbers[allNumbers.length - 1]!;
          if (ftdPct > 0 && ftdPct < 100) {
            holdings.push({
              asset_name: bankMatch[1]!.trim(),
              asset_code: null,
              asset_type: currentSection,
              weight: Math.round(ftdPct * 100) / 100,
              market_value: null,
            });
          }
        }
      }
    }
  }

  // Deduplicate: same ticker might appear multiple times (different lots), sum weights
  const merged = new Map<string, ParsedHolding>();
  for (const h of holdings) {
    const key = `${h.asset_code || h.asset_name}|${h.asset_type}`;
    const existing = merged.get(key);
    if (existing) {
      existing.weight += h.weight;
      if (h.market_value && existing.market_value) existing.market_value += h.market_value;
    } else {
      merged.set(key, { ...h });
    }
  }

  return [...merged.values()].map(h => ({
    ...h,
    weight: Math.round(h.weight * 100) / 100,
  }));
}

function reportDateFromDisclosure(d: KapDisclosure): string {
  // ruleType: "3. Ay" + period: 3 + year: 2025 → "2025-03"
  const month = d.period;
  return `${d.year}-${String(month).padStart(2, '0')}`;
}

interface Options {
  months: number;
  fundCodes: string[] | null;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let months = 2;
  let fundCodes: string[] | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--months=')) months = Number(a.slice(9));
    else if (a === '--months' && args[i + 1]) months = Number(args[++i]);
    else if (a.startsWith('--codes=')) fundCodes = a.slice(8).split(',');
    else if (a === '--codes' && args[i + 1]) fundCodes = args[++i]!.split(',');
  }
  return { months, fundCodes };
}

export async function runKapHoldingsIngest(overrides?: { months?: number; fundCodes?: string[] | null }): Promise<{ disclosures: number; holdings: number; failed: number }> {
  const opts = overrides ?? parseArgs();
  const months = opts.months ?? 2;
  const fundCodes = opts.fundCodes ?? null;
  const db = getDb();

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - months);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Only target TEFAS-listed equity-heavy funds (≥50% stock)
  const targetCodes = fundCodes ?? getEquityFundCodes(db);
  console.log(`[kap-holdings] Hedef: ${targetCodes.length} fon (TEFAS hisse ≥%50)`);
  console.log(`[kap-holdings] Bildirim aranıyor: ${from} → ${to}`);

  const disclosures = await findPortfolioDisclosures(from, to, targetCodes);
  console.log(`[kap-holdings] ${disclosures.length} Portföy Dağılım Raporu bulundu`);

  const insertStmt = db.prepare(
    `INSERT INTO fund_holdings (code, report_date, asset_name, asset_code, asset_type, weight, market_value, kap_disclosure_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code, report_date, asset_name) DO UPDATE SET
       asset_code = excluded.asset_code,
       asset_type = excluded.asset_type,
       weight = excluded.weight,
       market_value = excluded.market_value,
       kap_disclosure_id = excluded.kap_disclosure_id,
       updated_at = excluded.updated_at`,
  );

  let totalHoldings = 0;
  let failed = 0;
  let consecutiveKapErrors = 0;

  for (const disc of disclosures) {
    // KAP art arda engel/ağ hatası veriyorsa bu çalıştırmayı bırak — bir sonraki
    // cron döngüsünde tekrar dener. Aksi hâlde log'u spam'ler.
    if (consecutiveKapErrors >= 5) {
      console.warn(`[kap-holdings] Ardışık 5 KAP hatası — çalıştırma bırakılıyor, sonraki döngüde tekrar denenecek`);
      break;
    }

    const reportDate = reportDateFromDisclosure(disc);

    // Skip if already ingested
    const existing = db
      .prepare('SELECT COUNT(*) as c FROM fund_holdings WHERE code = ? AND report_date = ?')
      .get(disc.fundCode, reportDate) as { c: number };
    if (existing.c > 0) {
      console.log(`  ${disc.fundCode} ${reportDate} — zaten var (${existing.c} holding), atlıyorum`);
      continue;
    }

    try {
      const attachments = await getAttachments(disc.disclosureIndex);
      const pdfs = attachments.filter(a => a.fileExtension === 'pdf');

      if (pdfs.length === 0) {
        console.log(`  ${disc.fundCode} ${reportDate} — PDF ek yok, atlıyorum`);
        failed++;
        continue;
      }

      // Prioritize: BDR (bağımsız denetçi raporu) > main report > first PDF
      const mainPdf = pdfs.find(p => p.fileName.toLowerCase().includes('bdr'))
        ?? pdfs.find(p => !p.fileName.toLowerCase().includes('risk') && !p.fileName.toLowerCase().includes('ftd') && !p.fileName.toLowerCase().includes('beyan'))
        ?? pdfs[0]!;

      console.log(`  ${disc.fundCode} ${reportDate} — PDF indiriliyor: ${mainPdf.fileName}`);
      const pdfBuffer = await downloadPdf(mainPdf.objId);

      const text = extractTextFromPdf(pdfBuffer);
      if (!text || text.length < 50) {
        console.log(`    ⚠ PDF metin çıkarılamadı (${text.length} char)`);
        failed++;
        continue;
      }

      const holdings = parseHoldings(text, disc.fundCode);
      if (holdings.length === 0) {
        console.log(`    ⚠ Holdings parse edilemedi (text ${text.length} char)`);
        failed++;
        continue;
      }

      // SANITY CHECK — fon ağırlıklarının toplamı %80-120 aralığında olmalı.
      // Parser yanlış sütunu okuduğunda (endeks ağırlığı vs FTD%) toplam 1000+
      // çıkabiliyor; o zaman holdings bozuk, INSERT yapmayalım.
      const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
      if (totalWeight < 80 || totalWeight > 120) {
        console.log(`    ⚠ Parser sanity fail — toplam ağırlık %${totalWeight.toFixed(1)} (80-120 arası bekleniyor), reddedildi`);
        failed++;
        continue;
      }
      const maxSingleWeight = Math.max(...holdings.map(h => h.weight));
      if (maxSingleWeight > 50) {
        console.log(`    ⚠ Parser sanity fail — tek hisse %${maxSingleWeight.toFixed(1)} (>50), reddedildi`);
        failed++;
        continue;
      }

      const txn = db.transaction(() => {
        for (const h of holdings) {
          insertStmt.run(
            disc.fundCode,
            reportDate,
            h.asset_name,
            h.asset_code,
            h.asset_type,
            h.weight,
            h.market_value,
            disc.disclosureIndex,
            Date.now(),
          );
        }
      });
      txn();

      totalHoldings += holdings.length;
      consecutiveKapErrors = 0;
      console.log(`    ✓ ${holdings.length} holding kaydedildi`);

      // Rate limit — KAP blocks aggressive scraping
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown';
      const isKap = msg.startsWith('KAP ');
      console.warn(`  ${disc.fundCode} ${reportDate} — hata: ${msg}`);
      failed++;
      if (isKap) consecutiveKapErrors++; else consecutiveKapErrors = 0;
    }

    // Her başarılı işlemde consecutive sayacı sıfırlanır (başarılı yol zaten
    // yukarıda totalHoldings artırıyor, buraya try-blok dışında düşmezsek reset
    // gerekmez — success path try içinde tamamlanınca bir sonraki iterasyona geçer)
  }

  console.log(`\n[kap-holdings] Tamamlandı: ${disclosures.length} bildirim, ${totalHoldings} holding, ${failed} başarısız`);
  return { disclosures: disclosures.length, holdings: totalHoldings, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runKapHoldingsIngest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[kap-holdings] hata:', err);
      process.exit(1);
    });
}
