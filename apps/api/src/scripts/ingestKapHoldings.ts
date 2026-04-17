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
  const args = ['-sL', '--max-time', '30', '-A', UA,
    '-H', 'Accept-Language: tr',
    '-H', 'Content-Type: application/json',
    '-H', 'Accept: application/json',
  ];
  if (body) {
    args.push('-X', 'POST', '-d', JSON.stringify(body));
  }
  args.push(url);
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10_000_000 });
  if (stdout.includes('engellenmistir') || stdout.includes('blocked')) {
    throw new Error('KAP rate limit — IP engellenmiş, bekleniyor');
  }
  return JSON.parse(stdout) as T;
}

async function findPortfolioDisclosures(fromDate: string, toDate: string, fundCodes?: string[]): Promise<KapDisclosure[]> {
  const baseBody = {
    fromDate,
    toDate,
    fundTypeList: [],
    mkkMemberOidList: [],
    fundOidList: [],
    passiveFundOidList: [],
    isLate: '',
    subjectList: [],
    discIndex: [],
    fromSrc: false,
    srcCategory: '',
  };

  // Search both DG (general disclosures) and FR (financial reports)
  const [dgResults, frResults] = await Promise.all([
    kapFetch<KapDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: '' }),
    kapFetch<KapDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: 'FR' }),
  ]);

  const PORTFOLIO_SUBJECTS = [
    'Portföy Dağılım Raporu',
    'BYF, Fon Finansal Rapor',
  ];

  const all = [...dgResults, ...frResults];
  // Deduplicate by disclosureIndex
  const seen = new Set<number>();
  const unique = all.filter(d => {
    if (seen.has(d.disclosureIndex)) return false;
    seen.add(d.disclosureIndex);
    return true;
  });

  let filtered = unique.filter(d => PORTFOLIO_SUBJECTS.includes(d.subject));
  if (fundCodes && fundCodes.length > 0) {
    const set = new Set(fundCodes.map(c => c.toUpperCase()));
    filtered = filtered.filter(d => set.has(d.fundCode));
  }
  return filtered;
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

  for (const disc of disclosures) {
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
      console.log(`    ✓ ${holdings.length} holding kaydedildi`);

      // Rate limit — KAP blocks aggressive scraping
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.warn(`  ${disc.fundCode} ${reportDate} — hata: ${(err as Error).message}`);
      failed++;
    }
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
