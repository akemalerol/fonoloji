/**
 * KAP fon bildirimleri ingest — sadece KVH (kolektif yatırım kuruluşları).
 *
 * KAP'ta günde 100+ bildirim yayınlanıyor, büyük çoğunluğu BIST hisseleri için.
 * Biz sadece fonlarla ilgili olanları istiyoruz; bu yüzden `disclosure/funds/byCriteria`
 * endpoint'ini kullanıyoruz (member tip filtreli, fundCode direkt gelir).
 *
 * Çalışma penceresi: son 3 gün (idempotent — PK=disclosureIndex, INSERT OR IGNORE).
 *
 * Usage:
 *   npx tsx src/scripts/ingestKapDisclosures.ts [--days=3]
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb } from '../db/index.js';

const execFileAsync = promisify(execFile);

const KAP_API = 'https://www.kap.org.tr/tr/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface KapFundDisclosure {
  publishDate: string;      // "2026-04-17 15:42:11"
  fundCode: string;
  kapTitle: string;
  subject: string;
  summary?: string;
  disclosureIndex: number;
  attachmentCount: number;
  year: number;
  period: number;
  ruleType: string;
}

async function kapPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${KAP_API}/${path}`;
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sL',
      '--max-time',
      '30',
      '-A',
      UA,
      '-H',
      'Accept-Language: tr',
      '-H',
      'Content-Type: application/json',
      '-H',
      'Accept: application/json',
      '-X',
      'POST',
      '-d',
      JSON.stringify(body),
      url,
    ],
    { maxBuffer: 10_000_000 },
  );
  if (stdout.includes('engellenmistir') || stdout.includes('blocked')) {
    throw new Error('KAP rate limit — IP engellenmiş');
  }
  return JSON.parse(stdout) as T;
}

async function fetchWindow(fromDate: string, toDate: string): Promise<KapFundDisclosure[]> {
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

  // KAP tarafında birkaç disclosureClass var. '' = tüm bildirimler, 'FR' = finansal rapor.
  // İkisini ayrı ayrı çekip disclosureIndex ile dedupe ediyoruz.
  const [general, financial] = await Promise.all([
    kapPost<KapFundDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: '' }),
    kapPost<KapFundDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: 'FR' }),
  ]);

  const all = [...general, ...financial];
  const seen = new Set<number>();
  return all.filter((d) => {
    if (seen.has(d.disclosureIndex)) return false;
    seen.add(d.disclosureIndex);
    return true;
  });
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseKapDate(raw: string): number {
  // "2026-04-17 15:42:11" → unix ms
  const isoish = raw.replace(' ', 'T');
  const t = Date.parse(`${isoish}+03:00`); // TR saati
  return Number.isFinite(t) ? t : Date.now();
}

interface Options {
  days: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let days = 3;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--days=')) days = Number(a.slice(7));
    else if (a === '--days' && args[i + 1]) days = Number(args[++i]);
  }
  return { days };
}

export async function runKapDisclosuresIngest(overrides?: { days?: number }): Promise<{
  fetched: number;
  inserted: number;
  skipped: number;
}> {
  const days = overrides?.days ?? parseArgs().days;
  const db = getDb();

  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - Math.max(1, days));
  const fromDate = toYmd(from);
  const toDate = toYmd(today);

  console.log(`[kap-disclosures] Fetching ${fromDate} → ${toDate}`);

  const rows = await fetchWindow(fromDate, toDate);
  console.log(`[kap-disclosures] ${rows.length} fon bildirimi alındı`);

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO kap_disclosures
     (disclosure_index, fund_code, publish_date, subject, kap_title, rule_type, period, year, attachment_count, summary, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  const txn = db.transaction((records: KapFundDisclosure[]) => {
    for (const d of records) {
      const res = stmt.run(
        d.disclosureIndex,
        d.fundCode?.toUpperCase() ?? null,
        parseKapDate(d.publishDate),
        d.subject ?? null,
        d.kapTitle ?? null,
        d.ruleType ?? null,
        d.period ?? null,
        d.year ?? null,
        d.attachmentCount ?? 0,
        d.summary ?? null,
        now,
      );
      if (res.changes > 0) inserted++;
      else skipped++;
    }
  });
  txn(rows);

  console.log(`[kap-disclosures] +${inserted} yeni, ${skipped} zaten vardı`);
  return { fetched: rows.length, inserted, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runKapDisclosuresIngest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[kap-disclosures] hata:', err);
      process.exit(1);
    });
}
