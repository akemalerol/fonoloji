import { getDb } from '../db/index.js';
import { getTefasClient } from '../lib/tefas.js';
import type { FundType } from '../../../../src/types/input.js';

const COMPARISON_API_URL = 'https://www.tefas.gov.tr/api/DB/BindComparisonFundReturns';
const REFERER = 'https://www.tefas.gov.tr/FonKarsilastirma.aspx';

interface ComparisonRow {
  FONKODU?: string;
  FONUNVAN?: string;
  FONTURACIKLAMA?: string;
  FONTURKOD?: string;
  KURUCUKODU?: string;
  KURUCUUNVAN?: string;
}

function ddmmyyyy(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

async function fetchType(client: ReturnType<typeof getTefasClient>, fundType: FundType): Promise<ComparisonRow[]> {
  // Use last 7 days as range — Comparison endpoint requires it but only metadata matters
  const today = new Date();
  const week = new Date(today);
  week.setUTCDate(week.getUTCDate() - 7);

  const formData: Record<string, string> = {
    calismatipi: '1',
    fontip: fundType,
    sfontur: '',
    kurucukod: '',
    fongrup: '',
    bastarih: ddmmyyyy(week),
    bittarih: ddmmyyyy(today),
    fonturkod: '',
    fonunvantip: '',
    strperiod: '1,1,1,1,1,1,1',
  };

  const body = await client.postDirect(COMPARISON_API_URL, formData, {
    referer: REFERER,
    acceptJson: true,
  });
  try {
    const data = JSON.parse(body) as { data?: ComparisonRow[] };
    return data.data ?? [];
  } catch {
    console.warn(`[meta] ${fundType} parse hata, body=${body.slice(0, 200)}`);
    return [];
  }
}

async function main(): Promise<void> {
  const db = getDb();
  const client = getTefasClient();

  const updateStmt = db.prepare(
    `UPDATE funds SET category = ?, management_company = ?, updated_at = ? WHERE code = ?`,
  );
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO funds (code, name, type, category, management_company, first_seen, last_seen, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let updated = 0;
  let unmatched = 0;

  for (const fundType of ['YAT', 'EMK', 'BYF'] as FundType[]) {
    console.log(`[meta] ${fundType} çekiliyor…`);
    const rows = await fetchType(client, fundType);
    console.log(`  ${rows.length} fon meta verisi geldi`);
    const now = Date.now();

    const txn = db.transaction(() => {
      for (const r of rows) {
        const code = r.FONKODU?.trim();
        if (!code) {
          unmatched++;
          continue;
        }
        const category = r.FONTURACIKLAMA?.trim() ?? null;
        const company = r.KURUCUUNVAN?.trim() ?? null;

        const result = updateStmt.run(category, company, now, code);
        if (result.changes === 0) {
          // Fund not in DB yet — insert minimal record
          insertStmt.run(
            code,
            r.FONUNVAN?.trim() ?? code,
            fundType,
            category,
            company,
            null,
            null,
            now,
          );
        } else {
          updated++;
        }
      }
    });
    txn();
  }

  const stats = db
    .prepare(`SELECT COUNT(*) as total, COUNT(category) as with_cat, COUNT(management_company) as with_co FROM funds`)
    .get() as { total: number; with_cat: number; with_co: number };

  console.log(
    `[meta] güncelleme bitti: ${updated} fon güncellendi, ${unmatched} eşleşmeyen.`,
  );
  console.log(
    `[meta] DB durumu: total=${stats.total} category=${stats.with_cat} (${Math.round((100 * stats.with_cat) / stats.total)}%) yönetim=${stats.with_co} (${Math.round((100 * stats.with_co) / stats.total)}%)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[meta] hata:', err);
    process.exit(1);
  });
